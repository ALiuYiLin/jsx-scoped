import type { ModuleNode, Plugin } from 'vite'

import {
  createJsxScopedPipeline,
  type JsxScopedPipeline,
  type JsxScopedViteOptions,
} from './pipeline'

export type {
  AdditionalData,
  FileVirtualId,
  InlineVirtualId,
  JsxScopedRegistry,
  JsxScopedViteOptions,
  ParsedVirtualId,
  SourceMapLike,
  TransformScopedResult,
} from './pipeline'
export {
  JsxScopedPipeline,
  createJsxScopedPipeline,
  createJsxScopedRegistry,
  getDefaultJsxScopedRegistry,
  parseVirtualId,
} from './pipeline'

/**
 * @10coding/vite-plugin-jsx-scoped 主入口。
 *
 * 工作流:
 *  1. transform(.tsx/.jsx,pre 阶段):收集 *.scoped.* 导入与内联 <style scoped>,
 *     生成 scope 属性,Babel 注入 + 改写导入 + 提取内联样式;
 *  2. resolveId / load(虚拟 css 模块):预处理(sass/less/css)→
 *     @10coding/postcss-jsx-scoped 追加 [data-v-{hash}] → 交给 Vite css 管线;
 *  3. handleHotUpdate:组件/样式文件变更联动失效虚拟 css 模块。
 *
 * 编排逻辑在 {@link JsxScopedPipeline} 中实现并可独立复用
 * (例如对"生成的 TSX 文本"直接 transform,componentFilePath 传 md 路径即可)。
 *
 * ⚠️ 插件必须排在 @vitejs/plugin-react / preact 等 JSX 转换插件之前:
 * ```ts
 * plugins: [jsxScoped(), react()]
 * ```
 */
export default function jsxScopedVitePlugin(
  options: JsxScopedViteOptions = {},
): Plugin {
  const pipeline: JsxScopedPipeline = createJsxScopedPipeline(options)

  return {
    name: '@10coding/vite-plugin-jsx-scoped',
    enforce: 'pre',

    configResolved(resolved) {
      pipeline.bindViteConfig(resolved)
    },

    resolveId(source) {
      return pipeline.resolveId(source)
    },

    async load(rawId) {
      if (!rawId.startsWith('\0')) return null
      const css = await pipeline.load(rawId.slice(1))
      return css == null ? null : css
    },

    transform(code, id) {
      if (!/\.(?:tsx|jsx)$/i.test(id)) return
      if (id.includes('node_modules')) return

      const result = pipeline.transform(code, id)
      if (!result.enabled) return
      return { code: result.code, map: result.map ?? null }
    },

    handleHotUpdate(ctx) {
      const moduleIds = pipeline.invalidationIds(ctx.file)
      if (moduleIds.length === 0) return

      const extra: ModuleNode[] = []
      for (const id of moduleIds) {
        const mod = ctx.server.moduleGraph.getModuleById(id)
        if (mod) {
          ctx.server.moduleGraph.invalidateModule(mod)
          extra.push(mod)
        }
      }
      return extra.length > 0 ? [...ctx.modules, ...extra] : ctx.modules
    },
  }
}

export { jsxScopedVitePlugin }
