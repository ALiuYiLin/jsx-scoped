/**
 * Vue JSX 示例的自动化校验：起一个真实的 Vite dev server，然后
 *
 *   1. 走 dev SSR 管线渲染 demo 组件为 HTML，断言注入结果与最终 DOM 属性；
 *   2. 走 dev（浏览器同款）HTTP 请求拉取 *.tsx 与虚拟 css 模块，断言 scoped 选择器。
 *
 * 断言的能力：
 *   - 本文件 JSX DOM 元素被注入 data-v-<hash>（hash = 组件文件绝对路径的 md5 前 8 位）；
 *   - 内联 <style scoped> 被提取移除（不会渲染成真实 <style> 节点）；
 *   - 外部 *.scoped.* 导入被改写到虚拟 css 模块，且选择器追加了 [data-v-<hash>]；
 *   - 组件 scoped：子组件根元素拿到父级 data-v-<hash>
 *     —— ScopedRoot 走显式 scopedId 绑定，AutoScopedRoot 走 Vue attrs 透传。
 *
 * 运行：pnpm --filter @10coding/example-vue verify
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { computeScopeAttr } from '@10coding/plugin-jsx-scoped'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createServer } from 'vite'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

const demoScope = computeScopeAttr(path.join(root, 'src/demo/demo.tsx'))
const cardScope = computeScopeAttr(path.join(root, 'src/demo/components/Card.tsx'))
const pillScope = computeScopeAttr(path.join(root, 'src/demo/components/Pill.tsx'))

/** 取「带某个 class 的元素」的开标签，避免依赖属性书写顺序 */
function openingTag(html, tagName, className) {
  const re = new RegExp(`<${tagName}\\b[^>]*\\bclass="[^"]*\\b${className}\\b[^"]*"[^>]*>`)
  const match = html.match(re)
  assert.ok(match, `未找到 <${tagName} class 含 ${className}> 的元素`)
  return match[0]
}

const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  logLevel: 'silent',
})

try {
  await server.listen()
  const base = server.resolvedUrls.local[0].replace(/\/$/, '')

  // ---- 1) dev SSR 渲染：注入结果 → 真实 DOM 属性 ----
  const { default: Demo } = await server.ssrLoadModule('/src/demo/demo.tsx')
  const html = await renderToString(createSSRApp(Demo))
  if (process.env.JSX_SCOPED_DUMP) console.log(html)

  assert.ok(openingTag(html, 'section', 'demo').includes(demoScope), 'section 应被注入 scope 属性')
  assert.ok(openingTag(html, 'h2', 'demo__title').includes(demoScope), '类名选择器命中的元素同样注入')
  assert.ok(openingTag(html, 'span', 'demo__note').includes(demoScope), '内联 <style scoped>（css）')
  assert.ok(
    openingTag(html, 'span', 'demo__scss-note').includes(demoScope),
    '内联 <style scoped lang="scss">（sass 嵌套）',
  )
  assert.ok(!html.includes('<style'), '内联 <style scoped> 应在编译期被提取移除')

  // ---- 2) scope 种子是「组件文件路径」：每个组件各有自己的 hash ----
  assert.ok(openingTag(html, 'div', 'card-scoped').includes(cardScope), 'Card 用自己的 hash')
  assert.ok(openingTag(html, 'span', 'pill-scoped').includes(pillScope), 'Pill 用自己的 hash')

  // ---- 3) 组件 scoped：子组件声明 scopedId prop 并显式绑到根元素 ----
  assert.ok(
    openingTag(html, 'div', 'scoped-root').includes(demoScope),
    'scopedId 显式绑定：子组件根元素应带父级 scope 属性',
  )

  // ---- 4) 组件 scoped：<AutoScopedRoot direct-scoped> → 注入的属性交给 Vue attrs 透传 ----
  const autoRoot = openingTag(html, 'div', 'auto-root')
  assert.ok(autoRoot.includes(demoScope), 'direct-scoped：子组件根元素应带父级 scope 属性')
  assert.ok(!autoRoot.includes('direct-scoped'), 'marker 是编译期指令，不应泄漏到 DOM')

  // ---- 5) Vue 与 React 的差异：组件未声明的 scopedId 不会被丢弃，而是作为普通 attrs
  //         透传到子组件根元素（属性名小写化为 scopedid）。注意只对有 props 声明的
  //         组件成立：Pill 是 defineComponent → 透传；Card 是裸函数组件，Vue 只透传
  //         class/style/事件（getFunctionalFallthrough），于是静默忽略。
  assert.match(
    openingTag(html, 'span', 'pill-scoped'),
    /scopedid="data-v-[0-9a-f]{8}"/,
    'Vue 会把未声明的 scopedId 透传为根元素属性（仅噪声，不影响样式命中）',
  )
  assert.ok(
    !openingTag(html, 'div', 'card-scoped').includes('scopedid'),
    '裸函数组件（Card）不会透传 scopedId',
  )

  // ---- 6) dev（浏览器同款 HTTP）管线：*.scoped.* 导入被改写到虚拟 css 模块 ----
  const entry = await fetch(`${base}/`)
  assert.ok(entry.ok, 'dev server 应能返回 index.html')
  assert.ok((await entry.text()).includes('/src/main.tsx'), 'index.html 应引用 main.tsx')

  const demoRes = await fetch(`${base}/src/demo/demo.tsx`)
  assert.ok(demoRes.ok, 'demo.tsx 应能在 dev 下加载')
  const demoCode = await demoRes.text()
  assert.ok(demoCode.includes(demoScope), 'dev transform 产物应含注入的 scope 属性')

  const virtualUrls = [
    ...demoCode.matchAll(/["']([^"']*jsx-scoped-[^"']*\.css)["']/g),
  ].map((m) => m[1])
  assert.ok(
    virtualUrls.some((u) => u.includes('jsx-scoped-file:')),
    'dev transform 应把 *.scoped.scss 导入改写到 jsx-scoped-file 虚拟模块',
  )
  assert.ok(
    virtualUrls.some((u) => u.includes('jsx-scoped-inline:')),
    'dev transform 应把内联 <style scoped> 改写为 jsx-scoped-inline 虚拟模块',
  )
  for (const url of virtualUrls) {
    const res = await fetch(new URL(url, base))
    assert.ok(res.ok, `虚拟 css 模块应可加载: ${url}`)
    assert.ok(
      (await res.text()).includes(`[${demoScope}]`),
      `虚拟 css 模块应含 scoped 选择器 [${demoScope}]: ${url}`,
    )
  }

  console.log('[verify] Vue JSX scoped 校验通过')
  console.log(`[verify] demo.tsx → ${demoScope}（外部 scss + 2 个内联 <style scoped>）`)
  console.log(`[verify] Card.tsx → ${cardScope}（裸函数组件：scopedId 静默忽略）`)
  console.log(`[verify] Pill.tsx → ${pillScope}（defineComponent：scopedId 透传为属性）`)
} finally {
  await server.close()
}
