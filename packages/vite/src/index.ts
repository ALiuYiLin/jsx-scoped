import fs from 'node:fs/promises'
import path from 'node:path'
import { transformSync } from '@babel/core'
import type { PluginItem } from '@babel/core'
import jsxScopedBabelPlugin, {
  analyzeScopedUsage,
  computeScopeAttr,
} from '@10coding/plugin-jsx-scoped'
import { transformScopedCss } from '@10coding/postcss-jsx-scoped'

import { compileCssToPlain, langFromFilename } from './compile'
import { buildExtractor } from './extract'
import type { AdditionalData } from './compile'

export type { AdditionalData } from './compile'

import type { ModuleNode, Plugin, ResolvedConfig } from 'vite'

/**
 * @10coding/vite-plugin-jsx-scoped 配置项
 */
export interface JsxScopedViteOptions {
  /**
   * 是否开启「一个组件导入多个 scoped 样式资源」的覆盖风险警告。
   * @default true
   */
  warnMultiScopedImport?: boolean
  /**
   * scope hash 位数（md5(组件文件绝对路径) 截取长度）。
   * @default 8
   */
  scopeHashLength?: number
}

// ---------------------------------------------------------------------------
// 内部常量 / 工具
// ---------------------------------------------------------------------------
const JSX_FILE_RE = /\.(?:tsx|jsx)$/i
const VIRT_FILE_PREFIX = 'jsx-scoped-file:'
const VIRT_INLINE_PREFIX = 'jsx-scoped-inline:'

/** 归一化路径（统一正斜杠，保证 Windows 下 key 一致） */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function unb64(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

/**
 * 外部 scoped 样式 → 虚拟 css 模块 specifier
 * 形如 jsx-scoped-file:<b64(cssPath)>:<b64(compPath)>.css
 */
function makeFileVirtual(cssRealPath: string, componentFilePath: string): string {
  return `${VIRT_FILE_PREFIX}${b64url(cssRealPath)}:${b64url(componentFilePath)}.css`
}

/** 内联样式 → 虚拟 css 模块 specifier，形如 jsx-scoped-inline:<b64(comp)>:<i>.css */
function makeInlineVirtual(componentFilePath: string, index: number): string {
  return `${VIRT_INLINE_PREFIX}${b64url(componentFilePath)}:${index}.css`
}

interface FileVirtualId {
  kind: 'file'
  cssRealPath: string
  componentFilePath: string
}

interface InlineVirtualId {
  kind: 'inline'
  componentFilePath: string
  index: number
}

/** 解析虚拟模块 id（入参为去掉 \0 的字符串） */
function parseVirtualId(id: string): FileVirtualId | InlineVirtualId | null {
  if (id.startsWith(VIRT_FILE_PREFIX)) {
    const rest = id.slice(VIRT_FILE_PREFIX.length).replace(/\.css$/, '')
    const sep = rest.lastIndexOf(':')
    if (sep <= 0) return null
    return {
      kind: 'file',
      cssRealPath: unb64(rest.slice(0, sep)),
      componentFilePath: unb64(rest.slice(sep + 1)),
    }
  }
  if (id.startsWith(VIRT_INLINE_PREFIX)) {
    const rest = id.slice(VIRT_INLINE_PREFIX.length).replace(/\.css$/, '')
    const sep = rest.lastIndexOf(':')
    if (sep <= 0) return null
    const index = Number(rest.slice(sep + 1))
    if (!Number.isInteger(index) || index < 0) return null
    return { kind: 'inline', componentFilePath: unb64(rest.slice(0, sep)), index }
  }
  return null
}

/** 解析组件里的 scoped 样式导入 → 磁盘真实路径（仅支持相对/绝对路径） */
function resolveRealCssPath(componentFilePath: string, specifier: string): string | null {
  const clean = specifier.split('?')[0] ?? specifier
  if (!clean) return null
  let resolved: string
  if (/^\.{1,2}\//.test(clean)) {
    resolved = path.resolve(path.dirname(componentFilePath), clean)
  } else if (path.isAbsolute(clean)) {
    resolved = clean
  } else {
    return null
  }
  return normalizePath(resolved)
}

function parserPluginsFor(filename: string): Array<'typescript' | 'jsx'> {
  return /\.tsx?$/i.test(filename) ? ['typescript', 'jsx'] : ['jsx']
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Vite 主入口插件。
 *
 * 工作流：
 *  1. transform（.tsx/.jsx，pre 阶段）：
 *     - 收集 *.scoped.{css,scss,sass,less} 静态导入与内联 <style scoped>；
 *     - 由组件文件绝对路径生成 scopeAttr（data-v-{hash}，同一组件内所有资源共用）；
 *     - 校验「scoped 样式文件不允许被多个组件共享」，违规直接抛构建错误；
 *     - babel：给 JSX DOM 元素注入 scope 属性 + 把 scoped 导入改写成虚拟 css 模块；
 *  2. load（虚拟 css 模块）：读原始样式 → 预处理器编译为普通 CSS →
 *     @10coding/postcss-jsx-scoped 追加 [data-v-{hash}] → 交给 Vite css 管线
 *     （dev 注入 + HMR、build 抽取 .css 产物均由 Vite 原生完成）；
 *  3. handleHotUpdate：组件/样式文件变更时联动失效对应虚拟 css 模块。
 *
 * ⚠️ 插件必须排在 @vitejs/plugin-react / preact 等 JSX 转换插件之前：
 * ```ts
 * plugins: [jsxScoped(), react()]
 * ```
 */
export default function jsxScopedVitePlugin(
  options: JsxScopedViteOptions = {},
): Plugin {
  const warnMultiScopedImport = options.warnMultiScopedImport ?? true
  const scopeHashLength = options.scopeHashLength ?? 8

  let config: ResolvedConfig | undefined

  // cssRealPath(归一化) → componentFilePath：用于多组件共享报错
  const cssOwners = new Map<string, string>()
  // cssRealPath → 已生成的虚拟模块 id 列表（HMR 失效用）
  const virtualModulesByCss = new Map<string, string[]>()
  // componentFilePath → 内联样式虚拟模块 id 列表（HMR 失效用）
  const inlineModulesByComponent = new Map<string, string[]>()
  const warnedMulti = new Set<string>()

  function pushMap(map: Map<string, string[]>, key: string, value: string): void {
    const list = map.get(key)
    if (list) {
      list.push(value)
    } else {
      map.set(key, [value])
    }
  }

  /** 从 Vite css.preprocessorOptions 取 additionalData / 查找路径 */
  function preprocessorContext(lang: 'scss' | 'sass' | 'less'): {
    additionalData?: AdditionalData
    loadPaths?: string[]
  } {
    const pre = config?.css?.preprocessorOptions?.[lang]
    if (!pre || typeof pre !== 'object') return {}
    const record = pre as {
      additionalData?: AdditionalData
      loadPaths?: string[]
      includePaths?: string[]
    }
    return {
      additionalData: record.additionalData,
      loadPaths: [...(record.loadPaths ?? []), ...(record.includePaths ?? [])],
    }
  }

  return {
    name: '@10coding/vite-plugin-jsx-scoped',
    enforce: 'pre',

    configResolved(resolved) {
      config = resolved
    },

    resolveId(source) {
      if (source.startsWith(VIRT_FILE_PREFIX) || source.startsWith(VIRT_INLINE_PREFIX)) {
        return { id: `\0${source}` }
      }
      return null
    },

    async load(rawId) {
      if (!rawId.startsWith('\0')) return null
      const parsed = parseVirtualId(rawId.slice(1))
      if (!parsed) return null

      const scopeAttr = computeScopeAttr(parsed.componentFilePath, scopeHashLength)

      if (parsed.kind === 'file') {
        const raw = await fs.readFile(parsed.cssRealPath, 'utf8')
        const lang = langFromFilename(parsed.cssRealPath)
        const plain = await compileCssToPlain({
          lang,
          source: raw,
          filename: parsed.cssRealPath,
          ...(lang === 'scss'
            ? preprocessorContext('scss')
            : lang === 'sass'
              ? preprocessorContext('sass')
              : lang === 'less'
                ? preprocessorContext('less')
                : {}),
        })
        return transformScopedCss(plain, scopeAttr, { from: parsed.cssRealPath })
      }

      // 内联样式：直接从组件文件实时提取第 index 个 <style scoped>
      const componentSource = await fs.readFile(parsed.componentFilePath, 'utf8')
      const analysis = analyzeScopedUsage(componentSource, parsed.componentFilePath)
      const style = analysis.inlineStyles[parsed.index]
      if (!style) {
        throw new Error(
          `[@10coding/vite-plugin-jsx-scoped] 找不到组件 ${parsed.componentFilePath} 的第 ${parsed.index} 个 <style scoped>（内容或顺序已变化？）`,
        )
      }
      const plain = await compileCssToPlain({
        lang: style.lang,
        source: style.content,
        filename: parsed.componentFilePath,
        ...(style.lang === 'scss'
          ? preprocessorContext('scss')
          : style.lang === 'sass'
            ? preprocessorContext('sass')
            : style.lang === 'less'
              ? preprocessorContext('less')
              : {}),
      })
      return transformScopedCss(plain, scopeAttr, { from: parsed.componentFilePath })
    },

    transform(code, id) {
      if (!JSX_FILE_RE.test(id)) return
      if (id.includes('node_modules')) return

      const analysis = analyzeScopedUsage(code, id)
      if (analysis.parseError) {
        config?.logger.warn(
          `[@10coding/vite-plugin-jsx-scoped] 解析失败，已跳过 scoped 处理: ${id}\n${analysis.parseError}`,
        )
        return
      }
      if (!analysis.enabled) return

      const componentFilePath = normalizePath(id.split('?')[0] ?? id)
      const scopeAttr = computeScopeAttr(componentFilePath, scopeHashLength)
      const totalResources = analysis.externalImports.length + analysis.inlineStyles.length

      // ---- 1) 外部 *.scoped.* 导入：解析真实路径 + 多组件共享校验 ----
      const scopedImportMap = new Map<string, string>()
      for (const external of analysis.externalImports) {
        const cssRealPath = resolveRealCssPath(componentFilePath, external.specifier)
        if (!cssRealPath) {
          config?.logger.warn(
            `[@10coding/vite-plugin-jsx-scoped] 仅支持相对/绝对路径的 scoped 样式导入（已跳过 scoped 化）: ${componentFilePath} -> ${external.specifier}`,
          )
          continue
        }
        const previousOwner = cssOwners.get(cssRealPath)
        if (previousOwner && previousOwner !== componentFilePath) {
          throw new Error(
            `[@10coding/vite-plugin-jsx-scoped] 构建错误：scoped 样式文件被多个组件共享。\n` +
              `  样式文件: ${cssRealPath}\n` +
              `  已属于组件: ${previousOwner}\n` +
              `  又被组件: ${componentFilePath} 导入\n` +
              `规则：*.scoped.{css,scss,sass,less} 是组件私有资源，同一文件只允许被一个组件导入。`,
          )
        }
        cssOwners.set(cssRealPath, componentFilePath)

        const virtual = makeFileVirtual(cssRealPath, componentFilePath)
        scopedImportMap.set(external.specifier, virtual)
        pushMap(virtualModulesByCss, cssRealPath, `\0${virtual}`)
      }

      // ---- 2) 多资源覆盖风险警告（同一 hash，书写顺序可能互相覆盖） ----
      if (warnMultiScopedImport && totalResources > 1 && !warnedMulti.has(componentFilePath)) {
        warnedMulti.add(componentFilePath)
        config?.logger.warn(
          `[@10coding/vite-plugin-jsx-scoped] 组件 ${componentFilePath} 导入了 ${totalResources} 个 ` +
            `scoped 样式资源（外部 ${analysis.externalImports.length} 个 + 内联 ${analysis.inlineStyles.length} 个），` +
            `它们复用同一 scope 属性 ${scopeAttr}；注意样式书写顺序与选择器优先级可能导致规则互相覆盖。`,
        )
      }

      // ---- 3) babel：注入属性 + 改写导入 + 提取内联 style ----
      try {
        const result = transformSync(code, {
          filename: componentFilePath,
          babelrc: false,
          configFile: false,
          sourceMaps: true,
          parserOpts: { plugins: parserPluginsFor(componentFilePath), sourceType: 'module' },
          plugins: [
            [jsxScopedBabelPlugin, { componentFilePath, scopeAttr }],
            [
              buildExtractor,
              {
                scopedImportMap,
                inlineStyleCount: analysis.inlineStyles.length,
                makeInlineVirtual: (index: number) =>
                  makeInlineVirtual(componentFilePath, index),
              },
            ],
          ] as PluginItem[],
        })
        if (!result?.code) return

        const inlineVirtualIds: string[] = []
        for (let i = 0; i < analysis.inlineStyles.length; i++) {
          inlineVirtualIds.push(`\0${makeInlineVirtual(componentFilePath, i)}`)
        }
        if (inlineVirtualIds.length > 0) {
          inlineModulesByComponent.set(componentFilePath, inlineVirtualIds)
        }

        return { code: result.code, map: result.map ?? null }
      } catch (error) {
        const err = asError(error)
        throw new Error(
          `[@10coding/vite-plugin-jsx-scoped] 转换失败 ${componentFilePath}: ${err.message}`,
        )
      }
    },

    handleHotUpdate(ctx) {
      const file = normalizePath(ctx.file)
      const moduleIds = [
        ...(virtualModulesByCss.get(file) ?? []),
        ...(inlineModulesByComponent.get(file) ?? []),
      ]
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



