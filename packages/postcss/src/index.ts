import postcss from 'postcss'
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
}

// ---------------------------------------------------------------------------
// 结构式最小类型（不引用 postcss 类型定义，保持依赖干净）
// ---------------------------------------------------------------------------
interface ContainerLike {
  type?: string
  name?: string
  selector?: string
  parent?: ContainerLike
}

interface RuleLike extends ContainerLike {
  selector?: string
}

interface PostcssRootLike {
  walkRules: (cb: (rule: RuleLike) => void) => void
}

interface PostcssHelpersLike {
  result?: { opts?: { from?: string } }
}

interface PostcssPluginObject {
  postcssPlugin: string
  Once: (root: PostcssRootLike, helpers: PostcssHelpersLike) => void
}

/** 需要跳过“内部规则追加”的 at-rule：keyframes 帧选择器、@page 等 */
const SKIP_ANCESTOR_ATRULE = /^(?:-\w+-)?(?:keyframes|page)$/i

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
  clone?: () => unknown
}

interface SelectorListLike {
  type: string
  nodes?: SelectorNodeLike[]
  append?: (node: unknown) => void
  insertBefore?: (existing: unknown, node: unknown) => void
}

function isPseudoElementNode(node: SelectorNodeLike): boolean {
  if (node.type !== 'pseudo') return false
  const value = node.value ?? ''
  if (value.startsWith('::')) return true
  return LEGACY_PSEUDO_ELEMENTS.has(value.replace(/^:/, ''))
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
function buildAttributeNode(attrName: string): unknown {
  let node: unknown
  parser((root) => {
    const first = root?.first as SelectorListLike | undefined
    node = first?.nodes?.[0]?.clone?.()
  }).processSync(`[${attrName}]`)
  if (!node) {
    throw new Error(`[@10coding/postcss-jsx-scoped] 无法构造选择器节点: [${attrName}]`)
  }
  return node
}

/** 给“选择器列表”（逗号分隔的每一段）分别追加 scope 属性 */
function appendScopeToSelectorList(selector: string, attrName: string): string {
  if (!selector || selector.includes(`[${attrName}]`)) return selector

  return parser((root) => {
    root.each((sel) => {
      const node = sel as SelectorListLike
      if (!node || node.type !== 'selector') return
      if (hasScopeAttribute(node, attrName)) return

      const attrNode = buildAttributeNode(attrName)
      const nodes = node.nodes ?? []
      // 找末尾伪元素之前的插入位：.a::before → .a[data-v-x]::before
      let insertIndex = nodes.length
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]
        if (n && n.type === 'pseudo' && isPseudoElementNode(n)) {
          insertIndex = i
        } else {
          break
        }
      }
      if (insertIndex < nodes.length) {
        node.insertBefore?.(nodes[insertIndex] as never, attrNode as never)
      } else {
        node.append?.(attrNode)
      }
    })
  }).processSync(selector)
}

/** 规则是否位于需要跳过（@keyframes 帧 / @page）的 at-rule 内部 */
function isInsideSkippedAtRule(rule: ContainerLike): boolean {
  let current = rule.parent
  while (current) {
    if (
      current.type === 'atrule' &&
      current.name &&
      SKIP_ANCESTOR_ATRULE.test(current.name)
    ) {
      return true
    }
    if (current.type === 'root') break
    current = current.parent
  }
  return false
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
 *  - 已含同 scope 属性时跳过（幂等，可安全重复执行）；
 *  - 伪元素保持在属性选择器之后：.a::before → .a[data-v-x]::before。
 */
export default function postcssJsxScoped(
  options: JsxScopedPostcssOptions = {},
): PostcssPluginObject {
  return {
    postcssPlugin: '@10coding/postcss-jsx-scoped',
    Once(root, helpers) {
      const scopeAttr = resolveScopeAttr(options, helpers.result?.opts?.from)
      if (!scopeAttr) return // 无 scope 上下文：本次不做任何修改

      root.walkRules((rule) => {
        if (isInsideSkippedAtRule(rule)) return
        if (!rule.selector || rule.selector.trim() === '') return

        const next = appendScopeToSelectorList(rule.selector, scopeAttr)
        if (next !== rule.selector) {
          rule.selector = next
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
  options: { from?: string; prefix?: string } = {},
): Promise<string> {
  const result = await postcss([
    postcssJsxScoped({ scopeAttr, prefix: options.prefix }),
  ]).process(css, { from: options.from })
  return result.css
}

export { postcssJsxScoped }
