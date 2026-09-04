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
 * Babel 插件入口：给 JSX 元素注入 data-v-{hash} scope 属性。
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
 *  - 默认只给 DOM 元素标签（div/span/…）注入；自定义组件（<Foo />）可通过
 *    addToComponents: true 一并注入（data-* 属性会被当作普通 props 透传）；
 *  - 若元素已存在同名属性，用生成的 scope 属性覆盖。
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

  return {
    name: '@10coding/plugin-jsx-scoped',
    visitor: {
      JSXElement(path: JsxPathLike) {
        const node = path.node
        const opening = node.openingElement
        const name = opening.name

        // 跳过 <style>（含 <style scoped>，内联样式由上层流水线处理，不注入属性）
        if (isJsxIdentifierName(name, 'style')) return

        // 默认只处理 DOM 元素
        if (!options.addToComponents && !looksLikeDomElement(name)) return

        const attributes = opening.attributes
        const existing = attributes.find(
          (attr) =>
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === scopeAttr,
        )

        if (existing) {
          // 同名属性已存在：以生成的 scope 属性覆盖
          existing.value = types.stringLiteral('')
        } else {
          attributes.push(
            types.jsxAttribute(
              types.jsxIdentifier(scopeAttr),
              types.stringLiteral(''),
            ) as JsxAttributeLike,
          )
        }
      },
    },
  }
}
