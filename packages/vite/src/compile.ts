import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { StyleLang } from '@10coding/plugin-jsx-scoped'

export type { StyleLang }

/** 与 Vite css.preprocessorOptions.*.additionalData 形状一致 */
export type AdditionalData =
  | string
  | ((source: string, filename: string) => string | Promise<string>)

export interface CompileCssOptions {
  lang: StyleLang
  /** 原始源码（scss/less/css），尚未预处理 */
  source: string
  /** 用于定位相对 @import / 报错信息的文件名 */
  filename: string
  additionalData?: AdditionalData
  /** 额外查找路径（例如 vite preprocessorOptions 里的 loadPaths/includePaths） */
  loadPaths?: string[]
}

export function langFromFilename(filename: string): StyleLang {
  const match = /\.(scss|sass|less|css)$/i.exec(filename)
  const value = (match?.[1] ?? 'css').toLowerCase()
  return value as StyleLang
}

async function resolveAdditionalData(
  additionalData: AdditionalData | undefined,
  source: string,
  filename: string,
): Promise<string> {
  if (typeof additionalData === 'function') {
    return (await additionalData(source, filename)) ?? ''
  }
  return additionalData ?? ''
}

function isMissingModuleError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as { code?: string }).code
  return (
    code === 'ERR_MODULE_NOT_FOUND' ||
    code === 'MODULE_NOT_FOUND' ||
    error.message.includes('Cannot find module')
  )
}

/**
 * 预处理 + 产出普通 CSS（不改动原始 scss/less 源码文件本身）。
 * 原则：scss/sass → sass 编译器；less → less 编译器；css 原样返回。
 * 预处理完成后由调用方交给 @10coding/postcss-jsx-scoped 追加 scope 属性。
 */
export async function compileCssToPlain(options: CompileCssOptions): Promise<string> {
  const { lang, filename } = options

  if (lang === 'css') return options.source

  const additional = await resolveAdditionalData(options.additionalData, options.source, filename)
  const loadPaths = [path.dirname(path.resolve(filename)), ...(options.loadPaths ?? [])]

  if (lang === 'scss' || lang === 'sass') {
    let sass: typeof import('sass')
    try {
      sass = await import('sass')
    } catch (error) {
      if (isMissingModuleError(error)) {
        throw new Error(
          '[@10coding/vite-plugin-jsx-scoped] 编译 .scss/.sass 需要安装 sass：pnpm add -D sass',
        )
      }
      throw error
    }
    // indented 语法（.sass）下前置 additionalData 会破坏缩进，因此跳过
    const input =
      lang === 'sass' || !additional ? options.source : `${additional}\n${options.source}`
    const result = await sass.compileStringAsync(input, {
      url: pathToFileURL(path.resolve(filename)),
      syntax: lang === 'sass' ? 'indented' : 'scss',
      loadPaths,
      style: 'expanded',
      sourceMap: false,
    })
    return result.css
  }

  // less
  let less: {
    render(
      input: string,
      options: Record<string, unknown>,
      callback: (err: Error | null, output?: { css: string }) => void,
    ): void
  }
  try {
    const mod = (await import('less')) as unknown as { default?: typeof less }
    less = (mod.default ?? mod) as typeof less
  } catch (error) {
    if (isMissingModuleError(error)) {
      throw new Error(
        '[@10coding/vite-plugin-jsx-scoped] 编译 .less 需要安装 less：pnpm add -D less',
      )
    }
    throw error
  }

  const input = additional ? `${additional}\n${options.source}` : options.source
  const output = await new Promise<{ css: string }>((resolve, reject) => {
    less.render(
      input,
      {
        filename: path.resolve(filename),
        paths: loadPaths,
        javascriptEnabled: false,
      },
      (err, result) => (err ? reject(err) : resolve(result as { css: string })),
    )
  })
  return output.css
}
