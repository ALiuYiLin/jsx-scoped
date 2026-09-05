import { computeScopeAttr, createScopeAttr, DEFAULT_HASH_LENGTH } from './hash'
import type { JsxScopedBabelApi, JsxScopedBabelOptions, JsxScopedBabelPlugin } from './types'

export type {
  JsxScopedBabelOptions,
  JsxScopedBabelApi,
  JsxScopedBabelPlugin,
  ScopedStyleLang,
} from './types'

export {
  SCOPE_ATTR_PREFIX,
  DEFAULT_HASH_LENGTH,
  normalizeComponentPath,
  generateScopeHash,
  createScopeAttr,
  computeScopeAttr,
} from './hash'

export {
  SCOPED_STYLE_FILE_RE,
  SCOPED_STYLE_FILE_GATE_RE,
  SCOPED_STYLE_TAG_GATE_RE,
  STYLE_LANGS,
  isStyleLang,
  normalizeStyleLang,
  styleTextFromChildren,
  analyzeScopedUsage,
} from './analyze'
export type {
  StyleLang,
  ScopedExternalImport,
  ScopedInlineStyle,
  ScopedUsageAnalysis,
} from './analyze'

/** 兜底选项归一化：从 options 解析出最终 scope 属性名 */
export function resolveScopeAttr(options: JsxScopedBabelOptions): string {
  const hashLength = options.hashLength ?? DEFAULT_HASH_LENGTH

  if (options.scopeAttr) return options.scopeAttr
  if (options.scopeHash) return createScopeAttr(options.scopeHash)
  if (options.componentFilePath) return computeScopeAttr(options.componentFilePath, hashLength)

  throw new Error(
    '[@10coding/plugin-jsx-scoped] 缺少必要配置：请至少提供 componentFilePath（推荐），' +
      '或 scopeAttr / scopeHash 之一。',
  )
}

// ---------------------------------------------------------------------------
// 内部 AST 结构的最小类型描述（不引用 @babel/types，保持零运行时依赖）
// ---------------------------------------------------------------------------
interface JsxAttributeLike {
  type: 'JSXAttribute'
  name: { type: 'JSXIdentifier' | 'JSXNamespacedName'; name?: string }
  value?: unknown
}

interface JsxOpeningElementLike {
  name: { type: 'JSXIdentifier' | 'JSXMemberExpression' | 'JSXNamespacedName'; name?: string }
  attributes: JsxAttributeLike[]
}

interface JsxElementNode {
  type: 'JSXElement'
  openingElement: JsxOpeningElementLike
}

interface JsxPathLike {
  node: JsxElementNode
}

function isJsxIdentifierName(
  name: JsxOpeningElementLike['name'],
  expected: string,
): boolean {
  return name?.type === 'JSXIdentifier' && name.name === expected
}

/** 判断是否“看起来像 DOM 元素标签”：小写开头或包含连字符（如 my-widget） */
function looksLikeDomElement(name: JsxOpeningElementLike['name']): boolean {
  if (name?.type === 'JSXIdentifier') {
    const n = name.name ?? ''
    return /^[a-z]/.test(n) || n.includes('-')
  }
  return false
}

/**
 * 判断是否为「自定义组件标签」：大写开头标识符（<Child />）
 * 或成员表达式（<UI.Button />）。
 */
function isCustomComponentTag(name: JsxOpeningElementLike['name']): boolean {
  if (name?.type === 'JSXIdentifier') {
    return /^[A-Z]/.test(name.name ?? '')
  }
  return name?.type === 'JSXMemberExpression'
}

/**
 * 追加或覆盖某个 JSX 属性（同名覆盖，避免重复添加）
 */
function upsertJsxAttribute(
  attributes: JsxAttributeLike[],
  attrName: string,
  value: unknown,
  types: NonNullable<JsxScopedBabelApi['types']>,
): void {
  const existing = attributes.find(
    (attr) =>
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === attrName,
  )
  if (existing) {
    existing.value = value
  } else {
    attributes.push(
      types.jsxAttribute(types.jsxIdentifier(attrName), value) as JsxAttributeLike,
    )
  }
}

/** 找到并移除指定名字的属性（marker 等编译期指令），返回是否存在 */
function takeJsxAttribute(
  attributes: JsxAttributeLike[],
  attrName: string,
): boolean {
  const index = attributes.findIndex(
    (attr) =>
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === attrName,
  )
  if (index < 0) return false
  attributes.splice(index, 1)
  return true
}

/**
 * Babel 插件入口：给 JSX 元素注入 scope 属性。
 *
 * 用法（babel 配置或 @babel/core 编程式）：
 * ```js
 * plugins: [
 *   [jsxScopedBabelPlugin, { componentFilePath: filename }],
 * ]
 * ```
 *
 * 规则：
 *  - 跳过 <Fragment>（JSXFragment 天然不在此 visitor）、文本节点、<style> 标签；
 *  - DOM 元素标签（div/span/…）：注入 `data-v-{hash}` 属性；
 *  - 自定义组件标签（<Child />、<UI.Button />）：默认注入
 *    `<Child scopedId="data-v-{hash}">`（组件 scoped，可用
 *    componentScoped: false 关闭）。子组件若需要，可自行读取 scopedId 并绑定到
 *    根元素上，父组件 scoped 样式才能命中子组件根元素；
 *  - 「变量当标签」场景：组件运行时会渲染成原生 DOM 标签时
 *    （如 `const Comp: any = tag || (href ? 'a' : 'button')`，`<Comp ... />`），
 *    可在该大写组件标签上加 marker `<Comp direct-scoped />`（属性名可用
 *    directScopedAttributeName 配置），让插件把它当普通 DOM 元素处理——
 *    直接注入 `data-v-{hash}=""`，不再注入 scopedId。marker 是编译期指令，
 *    会从产物中移除，不会作为 prop 传给运行时；
 *  - 元素已存在同名属性时，用生成的 scope 属性覆盖。
 */
export default function jsxScopedBabelPlugin(
  api: JsxScopedBabelApi,
  options: JsxScopedBabelOptions = {},
): JsxScopedBabelPlugin {
  api.assertVersion?.(7)

  const scopeAttr = resolveScopeAttr(options)
  const types = api.types
  if (!types) {
    throw new Error('[@10coding/plugin-jsx-scoped] 需要 @babel/core >= 7.13（api.types 缺失）')
  }

  const componentScoped = options.componentScoped ?? true
  const scopedIdAttributeName = options.scopedIdAttributeName ?? 'scopedId'
  const directScopedAttributeName = options.directScopedAttributeName ?? 'direct-scoped'

  return {
    name: '@10coding/plugin-jsx-scoped',
    visitor: {
      JSXElement(path: JsxPathLike) {
        const node = path.node
        const opening = node.openingElement
        const name = opening.name

        // 跳过 <style>（含 <style scoped>，内联样式由上层流水线处理，不注入属性）
        if (isJsxIdentifierName(name, 'style')) return

        const attributes = opening.attributes

        // direct-scoped marker：编译期指令，从产物中移除；
        // 命中的大写组件按 DOM 元素处理（直接注入 data-v-{hash}）
        const directScoped = takeJsxAttribute(attributes, directScopedAttributeName)

        if (isCustomComponentTag(name)) {
          if (directScoped) {
            // 变量组件实际渲染成原生标签：注入完整 scope 属性
            upsertJsxAttribute(attributes, scopeAttr, types.stringLiteral(''), types)
            return
          }
          // 组件 scoped：默认注入 scopedId="data-v-{hash}"，子组件自行取用
          if (componentScoped) {
            upsertJsxAttribute(
              attributes,
              scopedIdAttributeName,
              types.stringLiteral(scopeAttr),
              types,
            )
          }
          return
        }

        // DOM 元素：注入完整 scope 属性（marker 在 DOM 上无意义，已移除）
        if (looksLikeDomElement(name)) {
          upsertJsxAttribute(attributes, scopeAttr, types.stringLiteral(''), types)
        }
      },
    },
  }
}

export { jsxScopedBabelPlugin }
