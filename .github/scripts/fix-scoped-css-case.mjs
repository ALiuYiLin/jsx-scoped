// 临时 workaround（Linux CI 用）：
// @10coding/vitepress-react@2.0.0-alpha.22 发布包内 scoped css 文件名是全小写
// （如 vpbadge.scoped.css），但主题组件源码 import 用了 PascalCase
// （如 VPBadge.scoped.css）。Windows 大小写不敏感时构建正常；Linux（GitHub
// Actions）大小写敏感会报 UNRESOLVED_IMPORT。
// 本脚本扫描主题 JS 里所有相对 *.scoped.css 引用，若目标文件缺失则用目录中
// 同名（忽略大小写）的文件补一份副本。vitepress-react 上游修复后可删除。
import { readdirSync, readFileSync, existsSync, copyFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'

const root = process.argv[2] ?? process.cwd()
const pnpmRoot = join(root, 'node_modules', '.pnpm')
let copied = 0

function walk(dir, fn) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, fn)
    else if (/\.(js|mjs)$/.test(name)) fn(p)
  }
}

function ensureFile(target) {
  const dir = dirname(target)
  if (!existsSync(dir)) return
  const base = target.slice(dir.length + 1)
  // 用 readdirSync 精确比较（大小写敏感语义，两平台一致）：
  // 精确同名已存在则无需处理；否则找同名（忽略大小写）的文件补副本
  for (const f of readdirSync(dir)) {
    if (f === base) return
  }
  for (const f of readdirSync(dir)) {
    if (f.toLowerCase() === base.toLowerCase()) {
      copyFileSync(join(dir, f), target)
      copied++
      console.log(`fix-scoped-css-case: ${base} <- copy from ${f}`)
      return
    }
  }
}

for (const entry of readdirSync(pnpmRoot)) {
  if (!entry.startsWith('@10coding+vitepress-react@')) continue
  const theme = join(
    pnpmRoot,
    entry,
    'node_modules',
    '@10coding',
    'vitepress-react',
    'dist',
    'client',
    'theme-default',
  )
  if (!existsSync(theme)) continue
  walk(theme, (file) => {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/["']((?:\.\.?\/)[^"']+\.scoped\.css)["']/g)) {
      ensureFile(join(dirname(file), m[1]))
    }
  })
}

console.log(`fix-scoped-css-case: done, copied ${copied} case-alias file(s)`)
