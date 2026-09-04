import { SCOPED_STYLE_FILE_RE } from '@10coding/plugin-jsx-scoped'

/**
 * Vite 插件内部使用的辅助 Babel 插件：
 *  1. 把 `import './x.scoped.scss'` 改写成指向虚拟 css 模块的导入；
 *  2. 移除 JSX 中的 <style scoped>（内容已由 analyze 阶段收集）；
 *  3. 在文件顶部插入内联样式的虚拟模块导入。
 */
export interface ExtractPluginOptions {
  /** 原始 import specifier → 虚拟 css 模块 specifier */
  scopedImportMap: ReadonlyMap<string, string>
  /** 内联 <style scoped> 数量（来自 analyze 结果，文档序） */
  inlineStyleCount: number
  /** 生成第 index 个内联样式的虚拟模块 specifier */
  makeInlineVirtual: (index: number) => string
}

export interface ExtractBabelApi {
  types?: {
    stringLiteral(value: string): unknown
    importDeclaration(specifiers: never[], source: unknown): unknown
  }
}

interface ExtractPathLike {
  node: {
    type: string
    source?: { value?: string }
    openingElement?: {
      name?: { type: string; name?: string }
      attributes?: Array<{
        type: string
        name?: { type: string; name?: string }
      }>
    }
  }
  remove(): void
  unshiftContainer(key: string, nodes: unknown[]): void
}

interface ExtractPluginObject {
  name: string
  visitor: Record<string, unknown>
}

function isStyleTagWithScoped(node: ExtractPathLike['node']): boolean {
  const opening = node.openingElement
  if (!opening?.name || opening.name.type !== 'JSXIdentifier' || opening.name.name !== 'style') {
    return false
  }
  return (
    opening.attributes?.some(
      (attr) =>
        attr.type === 'JSXAttribute' &&
        attr.name?.type === 'JSXIdentifier' &&
        attr.name.name === 'scoped',
    ) ?? false
  )
}

export function buildExtractor(
  api: ExtractBabelApi,
  options: ExtractPluginOptions,
): ExtractPluginObject {
  const types = api.types

  return {
    name: '@10coding/vite-plugin-jsx-scoped:extract',
    visitor: {
      ImportDeclaration(path: ExtractPathLike) {
        const value = path.node.source?.value
        if (typeof value !== 'string' || !SCOPED_STYLE_FILE_RE.test(value)) return
        const virtual = options.scopedImportMap.get(value)
        if (virtual && path.node.source) {
          path.node.source.value = virtual
        }
      },

      JSXElement(path: ExtractPathLike) {
        if (isStyleTagWithScoped(path.node)) {
          path.remove()
        }
      },

      Program: {
        exit(path: ExtractPathLike) {
          if (!types || options.inlineStyleCount <= 0) return
          const declarations: unknown[] = []
          for (let i = 0; i < options.inlineStyleCount; i++) {
            declarations.push(
              types.importDeclaration([], types.stringLiteral(options.makeInlineVirtual(i))),
            )
          }
          path.unshiftContainer('body', declarations)
        },
      },
    },
  }
}
