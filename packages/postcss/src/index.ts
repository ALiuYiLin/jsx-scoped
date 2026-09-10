import postcss from 'postcss'
import type { AtRule, Comment, Plugin, Root, Rule } from 'postcss'
import parser from 'postcss-selector-parser'

/**
 * @10coding/postcss-jsx-scoped 的插件配置。
 * scope 属性名取值优先级：
 *   scopeAttr > scopeHash(自动补 data-v- 前缀) > resolveScope(from)
 */
export interface JsxScopedPostcssOptions {
  /** 完整 scope 属性名，如 'data-v-3f2a9c1d' */
  scopeAttr?: string
  /** 仅 hash 部分，自动拼 data-v- 前缀 */
  scopeHash?: string
  /** 属性前缀（默认 data-v-） */
  prefix?: string
  /**
   * 当 options 拿不到 scopeAttr 时（例如通过 css.postcss 全局注册、多个
   * css 文件共用一个插件实例），可用 resolveScope 依据 css 文件路径解析。
   */
  resolveScope?: (from?: string) => string | undefined
  /**
   * 是否改写 scoped 作用域内 @keyframes 的动画名（追加 `-{scopeAttr}` 后缀，
   * 与 Vue scoped 行为一致，避免跨组件动画名冲突）。@default true
   */
  scopeKeyframes?: boolean
}

// ---------------------------------------------------------------------------
// 结构式最小类型（选择器侧不引用 postcss-selector-parser 的类型定义）
// ---------------------------------------------------------------------------
/** 需要跳过“内部规则追加”的 at-rule：keyframes 帧选择器、@page 等 */
const SKIP_ANCESTOR_ATRULE = /^(?:-\w+-)?(?:keyframes|page)$/i

/** @keyframes（含厂商前缀） */
const KEYFRAMES_ATRULE = /^(?:-\w+-)?keyframes$/i

/** animation / animation-name 声明（含厂商前缀） */
const ANIMATION_DECL = /^(?:-\w+-)?animation(?:-name)?$/i

/** 老式单冒号写法也属于伪元素（双冒号以 :: 判断） */
const LEGACY_PSEUDO_ELEMENTS = new Set([
  'before',
  'after',
  'first-line',
  'first-letter',
  'selection',
  'backdrop',
  'marker',
  'placeholder',
  'file-selector-button',
])

interface SelectorNodeLike {
  type: string
  value?: string
  attribute?: string
  nodes?: SelectorNodeLike[]
  spaces?: { before?: string; after?: string }
  clone?: () => SelectorNodeLike
}

interface SelectorListLike {
  type: string
  nodes?: SelectorNodeLike[]
  first?: SelectorNodeLike
  clone?: () => SelectorListLike
  each?: (cb: (node: SelectorNodeLike) => void) => void
  append?: (node: unknown) => void
  insertBefore?: (existing: unknown, node: unknown) => void
  insertAfter?: (existing: unknown, node: unknown) => void
  removeAll?: () => void
}

function isPseudoElementNode(node: SelectorNodeLike): boolean {
  if (node.type !== 'pseudo') return false
  const value = node.value ?? ''
  if (value.startsWith('::')) return true
  return LEGACY_PSEUDO_ELEMENTS.has(value.replace(/^:/, ''))
}

function isCombinatorNode(node: SelectorNodeLike | undefined): boolean {
  return node?.type === 'combinator'
}

function hasScopeAttribute(sel: SelectorListLike, attrName: string): boolean {
  return (
    sel.nodes?.some((n) => n.type === 'attribute' && n.attribute === attrName) ?? false
  )
}

/**
 * 解析 `[${attrName}]` 得到一枚 attribute 节点（临时 parse + clone，
 * 不依赖 postcss-selector-parser 内部构造器 API 的稳定性）。
 */
function buildAttributeNode(attrName: string): SelectorNodeLike {
  let node: SelectorNodeLike | undefined
  parser((root) => {
    const first = root?.first as SelectorListLike | undefined
    node = first?.nodes?.[0]?.clone?.()
  }).processSync(`[${attrName}]`)
  if (!node) {
    throw new Error(`[@10coding/postcss-jsx-scoped] 无法构造选择器节点: [${attrName}]`)
  }
  return node
}

/** 解析得到一个后代组合器（空格）节点 */
function buildSpaceNode(): SelectorNodeLike {
  let node: SelectorNodeLike | undefined
  parser((root) => {
    const sel = root?.first as SelectorListLike | undefined
    node = sel?.nodes?.[1]?.clone?.()
  }).processSync('a b')
  if (!node) {
    throw new Error('[@10coding/postcss-jsx-scoped] 无法构造组合器节点')
  }
  return node
}

/**
 * 把 scope 属性插入到一段“复合选择器链”的末尾（伪元素之前）。
 * `.a::before` → `.a[data-v-x]::before`
 */
function insertAttrAtCompoundEnd(
  nodes: SelectorNodeLike[],
  attrNode: SelectorNodeLike,
): SelectorNodeLike[] {
  const out = [...nodes]
  let insertIndex = out.length
  for (let i = out.length - 1; i >= 0; i--) {
    const n = out[i]
    if (n && isPseudoElementNode(n)) {
      insertIndex = i
    } else {
      break
    }
  }
  out.splice(insertIndex, 0, attrNode.clone?.() ?? attrNode)
  return out
}

/**
 * 把 scope 属性插入 prefix（`:deep`/`:global` 左侧的选择器链）：
 * 属性挂在 prefix 里最后一个复合选择器上（若结尾是组合器则挂在它之前），
 * 且保持伪元素在属性之后。`.a > ` → `.a[data-v-x] > `
 */
function insertAttrIntoPrefix(
  prefix: SelectorNodeLike[],
  attrNode: SelectorNodeLike,
): SelectorNodeLike[] {
  const out = [...prefix]
  let compoundEnd = out.length
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] && !isCombinatorNode(out[i])) {
      compoundEnd = i + 1
      break
    }
    compoundEnd = i
  }
  let insertIndex = compoundEnd
  for (let i = compoundEnd - 1; i >= 0; i--) {
    const n = out[i]
    if (n && isPseudoElementNode(n)) {
      insertIndex = i
    } else {
      break
    }
  }
  out.splice(insertIndex, 0, attrNode.clone?.() ?? attrNode)
  return out
}

/** 用空格组合器连接两段节点（避免 `..b` 粘连，也避免重复空格） */
function joinWithSpace(
  left: SelectorNodeLike[],
  right: SelectorNodeLike[],
  spaceNode: SelectorNodeLike,
): SelectorNodeLike[] {
  if (left.length === 0) return [...right]
  if (right.length === 0) return [...left]
  if (isCombinatorNode(left[left.length - 1]) || isCombinatorNode(right[0])) {
    return [...left, ...right]
  }
  return [...left, spaceNode.clone?.() ?? spaceNode, ...right]
}

/**
 * 收尾清理：去掉首尾组合器；紧邻组合器的节点不再保留自带空白，
 * 避免宏展开后出现 `.a[data-v-x]  .b` 这类重复空格。
 */
function cleanupNodes(nodes: SelectorNodeLike[]): SelectorNodeLike[] {
  let out = [...nodes]
  while (out.length > 0 && isCombinatorNode(out[0])) out = out.slice(1)
  while (out.length > 0 && isCombinatorNode(out[out.length - 1])) out = out.slice(0, -1)
  for (let i = 0; i < out.length; i++) {
    const node = out[i]
    if (!node || isCombinatorNode(node)) continue
    const prev = out[i - 1]
    const next = out[i + 1]
    if (!prev || isCombinatorNode(prev)) node.spaces = { ...node.spaces, before: '' }
    if (!next || isCombinatorNode(next)) node.spaces = { ...node.spaces, after: '' }
  }
  return out
}

// ---------------------------------------------------------------------------
// 选择器宏：函数式 :deep(...) / :global(...)
// ---------------------------------------------------------------------------

/**
 * 只有**函数式**写法被识别：`:deep(.x)` / `:global(.x)`。
 * 不支持 `>>>`、`/deep/`、`::v-deep`、无括号 `:deep .x` 等旧写法/别名，
 * 它们会被当作普通伪类按常规规则追加 scope 属性。
 */
function isMacroNode(node: SelectorNodeLike): boolean {
  if (node.type !== 'pseudo') return false
  if (node.value !== ':deep' && node.value !== ':global') return false
  return (node.nodes?.length ?? 0) > 0
}

interface MacroPlan {
  prefix: SelectorNodeLike[]
  marker: SelectorNodeLike
  suffix: SelectorNodeLike[]
  /** 括号内的参数（逗号分隔的每一段） */
  inner: SelectorNodeLike[][]
}

function resolveMacroPlan(sel: SelectorListLike): MacroPlan | null {
  const nodes = sel.nodes ?? []
  const idx = nodes.findIndex((n) => isMacroNode(n))
  if (idx === -1) return null
  const marker = nodes[idx] as SelectorNodeLike
  const args = (marker.nodes ?? []) as unknown as SelectorListLike[]
  return {
    prefix: nodes.slice(0, idx),
    marker,
    suffix: nodes.slice(idx + 1),
    inner: args.map((arg) => arg.nodes ?? []),
  }
}

/**
 * 按宏语义重建一段复杂选择器：
 *
 *  - `:deep(.x)`：左侧照常追加属性；`:deep` 起（含其右侧）进入子组件作用域，
 *    不再追加属性 → `.a :deep(.b) .c` = `.a[data-v-x] .b .c`
 *  - 无前缀的 `:deep(.b)` = `[data-v-x] .b`（收窄到本组件根，Vue 行为）
 *  - `:global(.x)`：括号内不追加属性，其余照常
 *    → `.a :global(.b) .c` = `.a[data-v-x] .b .c[data-v-x]`
 *  - 无前缀且无后续选择器的 `:global(.b)` = `.b`（纯全局）
 */
function composeMacroNodes(
  plan: MacroPlan,
  innerNodes: SelectorNodeLike[],
  attrNode: SelectorNodeLike,
  spaceNode: SelectorNodeLike,
): SelectorNodeLike[] {
  const isDeep = plan.marker.value === ':deep'
  // :deep 之后整体进入子作用域；:global 只放行括号内，其余仍属本文件
  const suffixPart = isDeep
    ? plan.suffix
    : plan.suffix.length > 0
      ? insertAttrAtCompoundEnd(plan.suffix, attrNode)
      : []
  const rest = [...innerNodes, ...suffixPart]

  if (plan.prefix.length > 0) {
    return cleanupNodes(
      joinWithSpace(insertAttrIntoPrefix(plan.prefix, attrNode), rest, spaceNode),
    )
  }
  if (isDeep) {
    return cleanupNodes(
      joinWithSpace([attrNode.clone?.() ?? attrNode], rest, spaceNode),
    )
  }
  // 无前缀的 :global(.b)：纯全局
  if (rest.length > 0) return cleanupNodes(rest)
  return [attrNode.clone?.() ?? attrNode]
}

/** 处理单条复杂选择器（`:deep(.a, .b)` 会展开为多段） */
function transformComplexSelector(
  sel: SelectorListLike,
  list: SelectorListLike,
  attrName: string,
  attrNode: SelectorNodeLike,
  spaceNode: SelectorNodeLike,
): boolean {
  const plan = resolveMacroPlan(sel)
  if (!plan) {
    if (!hasScopeAttribute(sel, attrName)) {
      const next = insertAttrAtCompoundEnd(sel.nodes ?? [], attrNode)
      sel.removeAll?.()
      for (const n of next) sel.append?.(n as never)
    }
    return false
  }

  const apply = (target: SelectorListLike, inner: SelectorNodeLike[]) => {
    const nodes = composeMacroNodes(plan, inner, attrNode, spaceNode)
    target.removeAll?.()
    for (const n of nodes) target.append?.(n as never)
  }

  apply(sel, plan.inner[0] ?? [])
  for (let i = 1; i < plan.inner.length; i++) {
    const clone = sel.clone?.()
    if (!clone) break
    apply(clone, plan.inner[i] ?? [])
    list.insertAfter?.(sel as never, clone as never)
  }
  return true
}

/** 处理一整条选择器列表（逗号分隔） */
function transformSelectorList(
  selector: string,
  attrName: string,
  attrNode: SelectorNodeLike,
  spaceNode: SelectorNodeLike,
): { selector: string; hadMacro: boolean } {
  let hadMacro = false

  const next = parser((root) => {
    const list = root as unknown as SelectorListLike
    const selectors = [...(list.nodes ?? [])]
    for (const sel of selectors) {
      if (!sel || sel.type !== 'selector') continue
      const isMacro = transformComplexSelector(sel, list, attrName, attrNode, spaceNode)
      hadMacro = hadMacro || isMacro
    }
  }).processSync(selector)

  return { selector: next, hadMacro }
}

/** 给“选择器列表”（逗号分隔的每一段）分别追加 scope 属性（无宏场景） */
function appendScopeToSelectorList(selector: string, attrName: string): string {
  if (!selector || selector.includes(`[${attrName}]`)) return selector

  return parser((root) => {
    root.each((sel) => {
      const node = sel as SelectorListLike
      if (!node || node.type !== 'selector') return
      if (hasScopeAttribute(node, attrName)) return

      const attrNode = buildAttributeNode(attrName)
      node.removeAll?.()
      for (const n of insertAttrAtCompoundEnd(node.nodes ?? [], attrNode)) {
        node.append?.(n as never)
      }
    })
  }).processSync(selector)
}

/** 规则是否位于需要跳过（@keyframes 帧 / @page）的 at-rule 内部 */
function isInsideSkippedAtRule(rule: Rule): boolean {
  let current = rule.parent as Root | AtRule | Rule | undefined
  while (current) {
    if (current.type === 'atrule' && SKIP_ANCESTOR_ATRULE.test(current.name)) {
      return true
    }
    if (current.type === 'root') break
    current = current.parent as Root | AtRule | Rule | undefined
  }
  return false
}

/** 幂等标记：含选择器宏的规则处理后插一条注释，重复处理时据此跳过 */
function macroMark(scopeAttr: string): string {
  return `jsx-scoped:${scopeAttr}:macro`
}

function hasMacroMark(rule: Rule, scopeAttr: string): boolean {
  const prev = rule.prev()
  return (
    prev?.type === 'comment' && (prev as Comment).text === macroMark(scopeAttr)
  )
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * scoped 作用域内的 @keyframes 改名：`spin` → `spin-data-v-xxxx`
 * （与 Vue scoped 一致，避免不同组件的同名动画互相覆盖），并同步改写
 * animation / animation-name 声明里的引用。
 */
function scopeKeyframes(root: Root, scopeAttr: string): void {
  const renamed = new Map<string, string>()

  root.walkAtRules((atRule) => {
    if (!KEYFRAMES_ATRULE.test(atRule.name)) return
    const current = atRule.params.trim()
    if (!current) return
    if (current.endsWith(`-${scopeAttr}`)) return // 已改名（幂等）
    const next = `${current}-${scopeAttr}`
    renamed.set(current, next)
    atRule.params = next
  })

  if (renamed.size === 0) return

  root.walkDecls((decl) => {
    if (!ANIMATION_DECL.test(decl.prop)) return
    let value = decl.value
    let changed = false
    for (const [from, to] of renamed) {
      const re = new RegExp(`(?<![\\w-])${escapeRegExp(from)}(?![\\w-])`, 'g')
      if (re.test(value)) {
        value = value.replace(re, to)
        changed = true
      }
    }
    if (changed) decl.value = value
  })
}

function resolveScopeAttr(
  options: JsxScopedPostcssOptions,
  from?: string,
): string | undefined {
  const prefix = options.prefix ?? 'data-v-'
  if (options.scopeAttr) return options.scopeAttr
  if (options.scopeHash) return `${prefix}${options.scopeHash}`
  return options.resolveScope?.(from)
}

/**
 * PostCSS 插件工厂。
 *
 * ```js
 * import postcssJsxScoped from '@10coding/postcss-jsx-scoped'
 * postcss([postcssJsxScoped({ scopeAttr: 'data-v-3f2a9c1d' })]).process(css)
 * ```
 *
 * 规则：
 *  - 普通选择器末尾追加 [data-v-{hash}]（逗号分隔的每一段都追加）；
 *  - @media / @supports / @layer / @container 内部规则正常追加；
 *  - @keyframes 帧选择器（from/to/百分比）、@page 不追加；
 *  - 选择器宏（仅函数式写法）：
 *    - `:deep(.x)`：进入子组件作用域，本文件属性挂在左侧最后一个复合选择器上，
 *      宏及其右侧不再追加；
 *    - `:global(.x)`：括号内不做 scoped，其余照常追加；
 *  - scoped 内 @keyframes 动画名追加 `-{scopeAttr}` 后缀，并同步改写
 *    animation / animation-name 引用（可用 scopeKeyframes: false 关闭）；
 *  - 已含同 scope 属性时跳过（幂等，可安全重复执行）。
 */
export default function postcssJsxScoped(
  options: JsxScopedPostcssOptions = {},
): Plugin {
  const scopeKeyframesEnabled = options.scopeKeyframes !== false

  return {
    postcssPlugin: '@10coding/postcss-jsx-scoped',
    Once(root, helpers) {
      const scopeAttr = resolveScopeAttr(options, helpers.result.opts.from)
      if (!scopeAttr) return // 无 scope 上下文：本次不做任何修改

      if (scopeKeyframesEnabled) scopeKeyframes(root, scopeAttr)

      const attrNode = buildAttributeNode(scopeAttr)
      const spaceNode = buildSpaceNode()

      root.walkRules((rule) => {
        if (isInsideSkippedAtRule(rule)) return
        if (!rule.selector || rule.selector.trim() === '') return
        // 含宏的规则已处理过（二次执行）：选择器不再重复改写
        if (hasMacroMark(rule, scopeAttr)) return

        const { selector, hadMacro } = transformSelectorList(
          rule.selector,
          scopeAttr,
          attrNode,
          spaceNode,
        )
        if (selector !== rule.selector) {
          rule.selector = selector
        }
        if (hadMacro) {
          rule.before(postcss.comment({ text: macroMark(scopeAttr) }))
        }
      })
    },
  }
}

/**
 * 编程式便捷入口：直接给一段（已编译为普通 CSS 的）源码追加 scope 属性。
 *
 * ```ts
 * import { transformScopedCss } from '@10coding/postcss-jsx-scoped'
 * const css = await transformScopedCss(plainCss, 'data-v-3f2a9c1d')
 * ```
 */
export async function transformScopedCss(
  css: string,
  scopeAttr: string,
  options: { from?: string; prefix?: string; scopeKeyframes?: boolean } = {},
): Promise<string> {
  const result = await postcss([
    postcssJsxScoped({
      scopeAttr,
      prefix: options.prefix,
      scopeKeyframes: options.scopeKeyframes,
    }),
  ]).process(css, { from: options.from })
  return result.css
}

export { postcssJsxScoped }
