import { parse, type ParserPlugin } from '@babel/parser'

/**
 * scoped 样式文件命名约定：*.scoped.css / *.scoped.scss / *.scoped.sass / *.scoped.less
 * 匹配的是 import 路径的“结尾”（可带 query，如 ?url）。
 */
export const SCOPED_STYLE_FILE_RE = /\.scoped\.(?:css|scss|sass|less)(?:\?|$)/i

/** 快速 gate：源码里只要出现 .scoped.(css|scss|sass|less) 就值得做一次完整解析 */
export const SCOPED_STYLE_FILE_GATE_RE = /\.scoped\.(?:css|scss|sass|less)/i

/** 快速 gate：内联 <style ... scoped> */
export const SCOPED_STYLE_TAG_GATE_RE = /<style\b[^>]*\bscoped\b/i

export const STYLE_LANGS = ['css', 'scss', 'sass', 'less'] as const
export type StyleLang = (typeof STYLE_LANGS)[number]

export function isStyleLang(value: unknown): value is StyleLang {
  return typeof value === 'string' && (STYLE_LANGS as readonly string[]).includes(value)
}

/** 归一化 lang 属性：不写 / 未知一律按 css */
export function normalizeStyleLang(raw?: string | null): StyleLang {
  const v = (raw ?? 'css').toLowerCase()
  return isStyleLang(v) ? v : 'css'
}

export interface ScopedExternalImport {
  /** import 语句中的模块标识，如 './demo.scoped.scss' */
  specifier: string
}

export interface ScopedInlineStyle {
  /** lang 属性，缺省按 css */
  lang: StyleLang
  /** <style> 的静态文本内容（预处理器源码，尚未编译） */
  content: string
}

export interface ScopedUsageAnalysis {
  /** 是否命中任一开启标记（外部 scoped 导入 或 内联 <style scoped>） */
  enabled: boolean
  /** 匹配命名约定的静态 import */
  externalImports: ScopedExternalImport[]
  /** 文档顺序的内联 style 块 */
  inlineStyles: ScopedInlineStyle[]
  /** 解析失败信息（此时 enabled 恒为 false，调用方应告警） */
  parseError?: string
}

// ---------------------------------------------------------------------------
// AST 遍历工具（不引入 @babel/traverse，通用递归足够）
// ---------------------------------------------------------------------------
type AstNode = { type: string; [key: string]: unknown }

function walk(node: unknown, visit: (node: AstNode) => void): void {
  if (!node || typeof node !== 'object') return
  const anyNode = node as Record<string, unknown>
  if (typeof anyNode.type === 'string') visit(anyNode as AstNode)
  for (const key of Object.keys(anyNode)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue
    const value = anyNode[key]
    if (Array.isArray(value)) {
      for (const item of value) walk(item, visit)
    } else if (value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string') {
      walk(value, visit)
    }
  }
}

/** 提取 <style> 子节点的静态文本（只允许 JSXText / 静态字符串 / 无插值模板） */
export function styleTextFromChildren(children: unknown[]): string {
  const parts: string[] = []
  for (const child of children) {
    const node = child as AstNode
    if (node.type === 'JSXText') {
      parts.push((node.value as string) ?? '')
    } else if (node.type === 'JSXExpressionContainer') {
      const expr = node.expression as AstNode
      if (expr.type === 'StringLiteral') {
        parts.push((expr.value as string) ?? '')
      } else if (expr.type === 'TemplateLiteral' && (expr.expressions as unknown[]).length === 0) {
        const quasis = expr.quasis as Array<{ value: { cooked: string | null; raw: string } }>
        parts.push(quasis.map((q) => q.value.cooked ?? q.value.raw).join(''))
      } else {
        throw new Error(
          '<style scoped> 的内容只支持静态文本/字符串，不能包含 JS 表达式插值',
        )
      }
    } else {
      throw new Error('<style scoped> 的内容只支持静态文本/字符串')
    }
  }
  return parts.join('')
}

/**
 * 分析一份 tsx/jsx 源码，收集 scoped 开启标记：
 *  1. 匹配 *.scoped.{css,scss,sass,less} 命名约定的静态 import；
 *  2. JSX 中的 <style scoped>（提取 lang 与文本内容）。
 */
export function analyzeScopedUsage(
  source: string,
  filename = 'unknown.jsx',
): ScopedUsageAnalysis {
  const empty: ScopedUsageAnalysis = { enabled: false, externalImports: [], inlineStyles: [] }

  // 快速 gate：大部分文件与 scoped 无关，不做完整 parse
  if (!SCOPED_STYLE_FILE_GATE_RE.test(source) && !SCOPED_STYLE_TAG_GATE_RE.test(source)) {
    return empty
  }

  const isTs = /\.tsx?$/i.test(filename)
  const parserPlugins: ParserPlugin[] = isTs ? ['typescript', 'jsx'] : ['jsx']

  let ast: ReturnType<typeof parse>
  try {
    ast = parse(source, { sourceType: 'module', plugins: parserPlugins, errorRecovery: false })
  } catch (error) {
    return {
      ...empty,
      parseError: error instanceof Error ? error.message : String(error),
    }
  }

  const externalImports: ScopedExternalImport[] = []
  const inlineStyles: ScopedInlineStyle[] = []

  for (const stmt of ast.program.body) {
    if (
      stmt.type === 'ImportDeclaration' &&
      typeof stmt.source.value === 'string' &&
      SCOPED_STYLE_FILE_RE.test(stmt.source.value)
    ) {
      externalImports.push({ specifier: stmt.source.value })
    }
  }

  walk(ast, (node) => {
    if (node.type !== 'JSXElement') return
    const opening = node.openingElement as {
      name?: { type: string; name?: string }
      attributes?: Array<{
        type: string
        name?: { type: string; name?: string }
        value?: { type: string; value?: string }
      }>
    }
    const name = opening.name
    if (!name || name.type !== 'JSXIdentifier' || name.name !== 'style') return

    const attributes = opening.attributes ?? []
    const hasScoped = attributes.some(
      (a) => a.type === 'JSXAttribute' && a.name?.type === 'JSXIdentifier' && a.name.name === 'scoped',
    )
    if (!hasScoped) return

    const langAttr = attributes.find(
      (a) => a.type === 'JSXAttribute' && a.name?.type === 'JSXIdentifier' && a.name.name === 'lang',
    )
    const langRaw =
      langAttr?.value?.type === 'StringLiteral' ? langAttr.value.value : undefined
    const content = styleTextFromChildren((node.children as unknown[]) ?? [])

    inlineStyles.push({ lang: normalizeStyleLang(langRaw), content })
  })

  return {
    enabled: externalImports.length > 0 || inlineStyles.length > 0,
    externalImports,
    inlineStyles,
  }
}
