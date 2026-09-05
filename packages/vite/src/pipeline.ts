import fs from 'node:fs/promises'
import path from 'node:path'
import { transformSync, type PluginItem } from '@babel/core'
import jsxScopedBabelPlugin, {
  analyzeScopedUsage,
  computeScopeAttr,
  type ScopedInlineStyle,
} from '@10coding/plugin-jsx-scoped'
import { transformScopedCss } from '@10coding/postcss-jsx-scoped'

import { compileCssToPlain, langFromFilename, type AdditionalData } from './compile'
import { buildExtractor } from './extract'
import type { ResolvedConfig } from 'vite'

export type { AdditionalData }

/**
 * 会话级共享状态集合(「scoped 文件归属」「HMR 失效映射」「内联样式登记」
 * 「提示去重」),可在多个 {@link JsxScopedPipeline} / Vite 插件实例间共享。
 *
 * 通常无需手动构造,直接用 {@link createJsxScopedRegistry} 新建,
 * 或通过默认单例 {@link getDefaultJsxScopedRegistry} 参与进程级共享。
 */
export interface JsxScopedRegistry {
  /** cssRealPath(归一化) → componentFilePath:用于多组件共享校验 */
  cssOwners: Map<string, string>
  /** cssRealPath → 已生成的虚拟模块 id 列表(HMR 失效用) */
  virtualModulesByCss: Map<string, string[]>
  /** componentFilePath → 内联样式虚拟模块 id 列表(HMR 失效用) */
  inlineModulesByComponent: Map<string, string[]>
  /** componentFilePath → transform 时登记的 <style scoped> 内容(文档序) */
  inlineSourcesByComponent: Map<string, ScopedInlineStyle[]>
  /** 去重提示 key(避免 HMR 反复 transform 时刷屏) */
  warnedKeys: Set<string>
}

/**
 * 创建一个全新的、空的会话级 registry。
 * 需要隔离状态(并行测试、多份互不干扰的编译)时用此新建再传入 options.registry。
 */
export function createJsxScopedRegistry(): JsxScopedRegistry {
  return {
    cssOwners: new Map<string, string>(),
    virtualModulesByCss: new Map<string, string[]>(),
    inlineModulesByComponent: new Map<string, string[]>(),
    inlineSourcesByComponent: new Map<string, ScopedInlineStyle[]>(),
    warnedKeys: new Set<string>(),
  }
}

/**
 * 进程级默认单例 registry(惰性复用,模块加载即创建)。
 *
 * 未显式传 `registry` 且未开启 `isolated` 的 {@link JsxScopedPipeline} 默认
 * 共享此单例,从而让「transform 登记的内联样式」与「另一插件实例的虚拟 css
 * load」跨插件上下文互通——这是 md→TSX 编译管线与站点 Vite 插件协作的基础。
 */
const DEFAULT_REGISTRY: JsxScopedRegistry = createJsxScopedRegistry()

/** 获取进程级默认单例 registry(与所有未隔离实例共享) */
export function getDefaultJsxScopedRegistry(): JsxScopedRegistry {
  return DEFAULT_REGISTRY
}

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
   * scope hash 位数(md5(组件文件绝对路径) 截取长度)。
   * @default 8
   */
  scopeHashLength?: number
  /**
   * 组件 scoped:默认自动开启(true)。
   * 开启时给自定义组件标签注入 <Child scopedId="data-v-{hash}">。
   * @default true
   */
  componentScoped?: boolean
  /**
   * 注入到自定义组件标签上的属性名。
   * @default 'scopedId'
   */
  scopedIdAttributeName?: string
  /**
   * 会话级共享状态 registry。
   *
   * 多个 JsxScopedPipeline / Vite 插件实例可以通过传入同一个 registry 共享
   * 「scoped 文件归属」「HMR 失效映射」「内联样式登记」等状态,典型场景:
   * 编译管线 A(md→TSX 的 transform)与站点插件 B(虚拟 css 的 load)处于
   * 不同的 Vite 插件上下文,需要 A.transform 登记的内联样式能被 B.load 读取。
   *
   * 与 `isolated` 互斥:同时提供时以 `registry` 为准。
   */
  registry?: JsxScopedRegistry
  /**
   * 是否使用全新的独立 registry(不共享进程级默认单例)。
   *
   * 缺省(false)时,未显式传入 `registry` 的实例共享
   * {@link getDefaultJsxScopedRegistry} 的默认单例;`isolated: true` 则让
   * 本实例独占一份全新状态,适用于需要完全隔离的并行/测试场景。
   *
   * 与 `registry` 互斥:同时提供时以 `registry` 为准。
   * @default false
   */
  isolated?: boolean
}

/** Babel sourcemap 的最小公开形状(与 Vite 接受的 ExistingRawSourceMap 兼容) */
export interface SourceMapLike {
  version: number
  file?: string
  sources: string[]
  sourcesContent?: string[]
  names: string[]
  mappings: string
}

/** transform 返回的产物信息(供 vite 插件或外部管线复用) */
export interface TransformScopedResult {
  /** 是否命中 scoped 开启标记(未命中时 code 原样返回) */
  enabled: boolean
  /** 注入/改写后的代码;enabled=false 时等于输入 code */
  code: string
  /** Babel sourcemap */
  map: SourceMapLike | null
  /** 本次 transform 产生的提示信息(需调用方决定如何输出) */
  warnings: string[]
  /** 解析失败原因(enabled=false 且因解析失败跳过时存在) */
  parseError?: string
  /** scope 属性全名,如 data-v-xxxxxxxx */
  scopeAttr?: string
  /** scope hash */
  scopeHash?: string
  /** 本组件产生的虚拟 css 模块 id(不含 \0 前缀) */
  virtualIds: string[]
}

export interface FileVirtualId {
  kind: 'file'
  cssRealPath: string
  componentFilePath: string
}

export interface InlineVirtualId {
  kind: 'inline'
  componentFilePath: string
  index: number
}

export type ParsedVirtualId = FileVirtualId | InlineVirtualId | null

// ---------------------------------------------------------------------------
// 内部常量 / 工具
// ---------------------------------------------------------------------------
const VIRT_FILE_PREFIX = 'jsx-scoped-file:'
const VIRT_INLINE_PREFIX = 'jsx-scoped-inline:'

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function unb64(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

/** 外部 scoped 样式 → 虚拟 css 模块 specifier */
function makeFileVirtual(cssRealPath: string, componentFilePath: string): string {
  return `${VIRT_FILE_PREFIX}${b64url(cssRealPath)}:${b64url(componentFilePath)}.css`
}

/** 内联样式 → 虚拟 css 模块 specifier */
function makeInlineVirtual(componentFilePath: string, index: number): string {
  return `${VIRT_INLINE_PREFIX}${b64url(componentFilePath)}:${index}.css`
}

/** 解析虚拟模块 id(入参为去掉 \0 的字符串) */
export function parseVirtualId(id: string): ParsedVirtualId {
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

/** 解析组件里的 scoped 样式导入 → 磁盘真实路径(仅支持相对/绝对路径) */
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
  if (/\.tsx?$/i.test(filename)) return ['typescript', 'jsx']
  if (/\.md$/i.test(filename)) return ['typescript', 'jsx'] // md 生成的 TSX 默认按 TSX 解析
  return ['jsx']
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function isEnoent(error: unknown): boolean {
  return (error as { code?: string })?.code === 'ENOENT'
}

function pushMap(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key)
  if (list) {
    list.push(value)
  } else {
    map.set(key, [value])
  }
}

/**
 * jsx-scoped 编排逻辑的可复用实例。
 *
 * Vite 插件默认创建并使用本实例;外部管线(如 vitepress 的 md→TSX 编译)可
 * 直接 `pipeline.transform(tsxCode, componentFilePath)`:
 *  - componentFilePath 可以是真实 tsx,也可以是 md 的绝对路径(仅作 hash 种子
 *    与相对导入解析基准,不需要是可解析的 JSX 文件);
 *  - 内联 <style scoped> 的内容在 transform 时登记,虚拟 css load 不再依赖
 *    "重读磁盘组件文件",因此也适用于"源码并非磁盘原文件"的场景。
 *
 * 状态与生命周期:
 *  - 实例持有的「scoped 文件归属」「HMR 失效映射」「内联样式登记」「提示去重」
 *    等会话级状态统一存放在 {@link JsxScopedRegistry} 中,生命周期 = registry
 *    的持有者(dev 会话内随 HMR 持续更新);
 *  - 默认(未传 `registry` / 未开 `isolated`)时实例共享进程级默认单例
 *    {@link getDefaultJsxScopedRegistry},因此不同插件实例之间默认互通状态;
 *    需要隔离时请传入 {@link createJsxScopedRegistry} 新建的 registry,
 *    或开启 `isolated: true`;
 *  - 调用方需保证:同一 registry 内传入的 componentFilePath 唯一且稳定
 *    (scope hash 与内联样式登记均以其为 key);
 *  - 提示类信息(多资源覆盖、无法解析的导入、解析失败)以 `warnings` 数组随
 *    transform 结果返回;若实例已绑定 Vite config(通过 bindViteConfig),同时
 *    会写入 config.logger,外部编程式调用方可只消费返回值。
 */
export class JsxScopedPipeline {
  readonly options: JsxScopedViteOptions
  readonly warnMultiScopedImport: boolean
  readonly scopeHashLength: number
  /** 会话级共享状态(默认进程级单例;见 {@link createJsxScopedRegistry}) */
  readonly registry: JsxScopedRegistry

  private config: ResolvedConfig | undefined

  constructor(options: JsxScopedViteOptions = {}) {
    this.options = options
    this.warnMultiScopedImport = options.warnMultiScopedImport ?? true
    this.scopeHashLength = options.scopeHashLength ?? 8
    // registry 优先于 isolated(显式共享 > 全新隔离 > 进程级默认单例)
    this.registry =
      options.registry ??
      (options.isolated ? createJsxScopedRegistry() : getDefaultJsxScopedRegistry())
  }

  /** Vite 插件在 configResolved 时调用,用于 css 预处理器上下文与日志 */
  bindViteConfig(config: ResolvedConfig): void {
    this.config = config
  }

  private printWarn(message: string): void {
    if (this.config?.logger) {
      this.config.logger.warn(message)
    } else {
      console.warn(message)
    }
  }

  /** 收集一条提示:去重 + 写入返回结果,并(若绑定 vite config)打印 */
  private collectWarn(warnings: string[], dedupeKey: string, message: string): void {
    if (this.registry.warnedKeys.has(dedupeKey)) return
    this.registry.warnedKeys.add(dedupeKey)
    warnings.push(message)
    this.printWarn(message)
  }

  private preprocessorContext(lang: 'scss' | 'sass' | 'less'): {
    additionalData?: AdditionalData
    loadPaths?: string[]
  } {
    const pre = this.config?.css?.preprocessorOptions?.[lang]
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

  /** 清理某组件的会话级登记(组件不再命中/解析失败时避免残留) */
  private clearComponentRegistrations(componentFilePath: string): void {
    const key = normalizePath(componentFilePath.split('?')[0] ?? componentFilePath)
    this.registry.inlineModulesByComponent.delete(key)
    this.registry.inlineSourcesByComponent.delete(key)
  }

  /**
   * 核心转换:注入 scope 属性 + 改写 scoped import + 提取内联 <style scoped>。
   * @param code              tsx/jsx 源码
   * @param componentFilePath scope 种子与相对导入解析基准(可非真实 JSX 文件)
   * @param parserFilename    参与 TS/JSX 语法判定与 sourcemap 命名的文件名;
   *                          缺省用 componentFilePath(若为 .md 会自动按 TSX 解析)
   */
  transform(
    code: string,
    componentFilePath: string,
    parserFilename?: string,
  ): TransformScopedResult {
    const analyzeFile = parserFilename ?? componentFilePath
    const normalizedComponent = normalizePath(
      componentFilePath.split('?')[0] ?? componentFilePath,
    )
    const warnings: string[] = []

    const analysis = analyzeScopedUsage(
      code,
      /\.md$/i.test(analyzeFile) ? `${analyzeFile}.tsx` : analyzeFile,
    )
    if (analysis.parseError) {
      const message =
        `[@10coding/vite-plugin-jsx-scoped] 解析失败,已跳过 scoped 处理: ` +
        `${componentFilePath}\n${analysis.parseError}`
      this.collectWarn(warnings, `parse|${normalizedComponent}`, message)
      this.clearComponentRegistrations(normalizedComponent)
      return {
        enabled: false,
        code,
        map: null,
        warnings,
        parseError: analysis.parseError,
        virtualIds: [],
      }
    }
    if (!analysis.enabled) {
      // 组件不再含任何 scoped 标记:清理旧登记,避免陈旧内联 css 残留
      this.clearComponentRegistrations(normalizedComponent)
      return { enabled: false, code, map: null, warnings, virtualIds: [] }
    }

    const scopeAttr = computeScopeAttr(normalizedComponent, this.scopeHashLength)
    const totalResources = analysis.externalImports.length + analysis.inlineStyles.length

    // ---- 1) 外部 *.scoped.* 导入:解析真实路径 + 多组件共享校验 ----
    const scopedImportMap = new Map<string, string>()
    const virtualIds: string[] = []
    for (const external of analysis.externalImports) {
      const cssRealPath = resolveRealCssPath(normalizedComponent, external.specifier)
      if (!cssRealPath) {
        this.collectWarn(
          warnings,
          `spec|${normalizedComponent}|${external.specifier}`,
          `[@10coding/vite-plugin-jsx-scoped] 仅支持相对/绝对路径的 scoped 样式导入` +
            `(已跳过 scoped 化): ${normalizedComponent} -> ${external.specifier}`,
        )
        continue
      }
      const previousOwner = this.registry.cssOwners.get(cssRealPath)
      if (previousOwner && previousOwner !== normalizedComponent) {
        throw new Error(
          `[@10coding/vite-plugin-jsx-scoped] 构建错误:scoped 样式文件被多个组件共享。\n` +
            `  样式文件: ${cssRealPath}\n` +
            `  已属于组件: ${previousOwner}\n` +
            `  又被组件: ${normalizedComponent} 导入\n` +
            `规则:*.scoped.{css,scss,sass,less} 是组件私有资源,同一文件只允许被一个组件导入。`,
        )
      }
      this.registry.cssOwners.set(cssRealPath, normalizedComponent)

      // 该 css 归属唯一组件:每次重跑 transform 都重建失效映射,避免重复 id
      this.registry.virtualModulesByCss.delete(cssRealPath)
      const virtual = makeFileVirtual(cssRealPath, normalizedComponent)
      scopedImportMap.set(external.specifier, virtual)
      virtualIds.push(virtual)
      pushMap(this.registry.virtualModulesByCss, cssRealPath, `\0${virtual}`)
    }

    // ---- 2) 多资源覆盖风险警告(同一 hash,书写顺序可能互相覆盖) ----
    if (this.warnMultiScopedImport && totalResources > 1) {
      this.collectWarn(
        warnings,
        `multi|${normalizedComponent}`,
        `[@10coding/vite-plugin-jsx-scoped] 组件 ${normalizedComponent} 导入了 ${totalResources} 个 ` +
          `scoped 样式资源(外部 ${analysis.externalImports.length} 个 + 内联 ${analysis.inlineStyles.length} 个),` +
          `它们复用同一 scope 属性 ${scopeAttr};注意样式书写顺序与选择器优先级可能导致规则互相覆盖。`,
      )
    }

    // ---- 3) 登记内联样式(虚拟 css load 优先取此,不重读磁盘) ----
    if (analysis.inlineStyles.length > 0) {
      this.registry.inlineSourcesByComponent.set(normalizedComponent, analysis.inlineStyles)
    } else {
      this.registry.inlineSourcesByComponent.delete(normalizedComponent)
    }

    // ---- 4) babel:注入属性 + 改写导入 + 提取内联 style ----
    try {
      const result = transformSync(code, {
        filename: normalizedComponent,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: parserPluginsFor(analyzeFile), sourceType: 'module' },
        plugins: [
          [
            jsxScopedBabelPlugin,
            {
              componentFilePath: normalizedComponent,
              scopeAttr,
              componentScoped: this.options.componentScoped,
              scopedIdAttributeName: this.options.scopedIdAttributeName,
            },
          ],
          [
            buildExtractor,
            {
              scopedImportMap,
              inlineStyleCount: analysis.inlineStyles.length,
              makeInlineVirtual: (index: number) =>
                makeInlineVirtual(normalizedComponent, index),
            },
          ],
        ] as PluginItem[],
      })
      if (!result?.code) {
        return { enabled: true, code, map: null, warnings, scopeAttr, virtualIds }
      }

      const inlineVirtualIds: string[] = []
      for (let i = 0; i < analysis.inlineStyles.length; i++) {
        const vid = makeInlineVirtual(normalizedComponent, i)
        inlineVirtualIds.push(`\0${vid}`)
        virtualIds.push(vid)
      }
      if (inlineVirtualIds.length > 0) {
        this.registry.inlineModulesByComponent.set(normalizedComponent, inlineVirtualIds)
      } else {
        this.registry.inlineModulesByComponent.delete(normalizedComponent)
      }

      return {
        enabled: true,
        code: result.code,
        map: (result.map as unknown as SourceMapLike | null | undefined) ?? null,
        warnings,
        scopeAttr,
        scopeHash: scopeAttr.slice('data-v-'.length),
        virtualIds,
      }
    } catch (error) {
      const err = asError(error)
      throw new Error(
        `[@10coding/vite-plugin-jsx-scoped] 转换失败 ${normalizedComponent}: ${err.message}`,
      )
    }
  }

  /** 返回虚拟 css specifier 对应的 \0id,没有则返回 null */
  resolveId(source: string): string | null {
    if (source.startsWith(VIRT_FILE_PREFIX) || source.startsWith(VIRT_INLINE_PREFIX)) {
      return `\0${source}`
    }
    return null
  }

  /**
   * 加载虚拟 css 模块(入参为去掉 \0 的原始虚拟 id)。
   * 内联样式优先使用 transform 时登记的内容;找不到时回退为读取磁盘组件文件。
   */
  async load(rawId: string): Promise<string | null> {
    const parsed = parseVirtualId(rawId)
    if (!parsed) return null

    const scopeAttr = computeScopeAttr(parsed.componentFilePath, this.scopeHashLength)

    if (parsed.kind === 'file') {
      const raw = await fs.readFile(parsed.cssRealPath, 'utf8')
      const lang = langFromFilename(parsed.cssRealPath)
      const plain = await compileCssToPlain({
        lang,
        source: raw,
        filename: parsed.cssRealPath,
        ...(lang === 'scss'
          ? this.preprocessorContext('scss')
          : lang === 'sass'
            ? this.preprocessorContext('sass')
            : lang === 'less'
              ? this.preprocessorContext('less')
              : {}),
      })
      return transformScopedCss(plain, scopeAttr, { from: parsed.cssRealPath })
    }

    // 内联样式:先查 transform 登记表,回退到读磁盘组件文件实时提取
    let style: ScopedInlineStyle | undefined
    const registered = this.registry.inlineSourcesByComponent.get(parsed.componentFilePath)
    if (registered) {
      style = registered[parsed.index]
    }
    if (!style) {
      let componentSource: string
      try {
        componentSource = await fs.readFile(parsed.componentFilePath, 'utf8')
      } catch (error) {
        if (isEnoent(error)) {
          throw new Error(
            `[@10coding/vite-plugin-jsx-scoped] 内联样式 ${rawId} 未命中 transform 登记,` +
              `且组件文件不存在: ${parsed.componentFilePath}。` +
              `非磁盘来源的调用方请确保已对共享同一 registry 的某个 JsxScopedPipeline ` +
              `实例执行过 transform(含 <style scoped>)后再 load 其 virtualIds。`,
          )
        }
        throw error
      }
      const analysis = analyzeScopedUsage(componentSource, parsed.componentFilePath)
      style = analysis.inlineStyles[parsed.index]
    }
    if (!style) {
      throw new Error(
        `[@10coding/vite-plugin-jsx-scoped] 找不到组件 ${parsed.componentFilePath} 的第 ${parsed.index} 个 <style scoped>(内容或顺序已变化?)`,
      )
    }
    const plain = await compileCssToPlain({
      lang: style.lang,
      source: style.content,
      filename: parsed.componentFilePath,
      ...(style.lang === 'scss'
        ? this.preprocessorContext('scss')
        : style.lang === 'sass'
          ? this.preprocessorContext('sass')
          : style.lang === 'less'
            ? this.preprocessorContext('less')
            : {}),
    })
    return transformScopedCss(plain, scopeAttr, { from: parsed.componentFilePath })
  }

  /** 返回某个文件变更时应失效的 \0 虚拟模块 id 列表 */
  invalidationIds(file: string): string[] {
    const normalized = normalizePath(file)
    return [
      ...(this.registry.virtualModulesByCss.get(normalized) ?? []),
      ...(this.registry.inlineModulesByComponent.get(normalized) ?? []),
    ]
  }
}

/** 便捷工厂 */
export function createJsxScopedPipeline(options?: JsxScopedViteOptions): JsxScopedPipeline {
  return new JsxScopedPipeline(options)
}
