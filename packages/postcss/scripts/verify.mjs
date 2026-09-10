// @10coding/postcss-jsx-scoped 测试
// 用法：pnpm test（= build + node scripts/verify.mjs）
import assert from 'node:assert/strict'
import { transformScopedCss } from '../dist/index.js'

const ATTR = 'data-v-3f2a9c1d'

async function run(css, options) {
  return transformScopedCss(css, ATTR, options)
}

/** 只取选择器部分（去掉幂等注释与声明块）便于断言 */
async function sel(selector, options) {
  const out = await run(`${selector} { color: red; }`, options)
  return out
    .replace(/\/\* jsx-scoped:[\w-]+:macro \*\/\s*/g, '')
    .replace(/\s*\{\s*color: red;?\s*\}/, '')
    .trim()
}

let passed = 0
async function check(name, actual, expected) {
  assert.equal(actual, expected, `${name}\n  期望: ${expected}\n  实际: ${actual}`)
  passed++
}

// ---------------------------------------------------------------------------
// 1. 基础行为
// ---------------------------------------------------------------------------
{
  const css = `
.demo .title { color: red; }
h1, h2, .a:hover, .btn::before, .legacy:after { margin: 0; }
@media (max-width: 640px) {
  .demo { padding: 8px; }
  .nested > .deep { display: none; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  50% { opacity: .5; }
  to { transform: rotate(360deg); }
}
.page-root { color: #333; }
.demo[data-v-existing] { color: #000; }
`
  const out = await run(css)

  assert.ok(out.includes(`.demo .title[${ATTR}]`), '后代选择器应追加到末尾')
  assert.ok(out.includes(`h1[${ATTR}]`), '列表第一段 h1')
  assert.ok(out.includes(`h2[${ATTR}]`), '列表第二段 h2')
  assert.ok(out.includes(`.a:hover[${ATTR}]`), ':hover 之后追加')
  assert.ok(out.includes(`.btn[${ATTR}]::before`), '双冒号伪元素保持在后')
  assert.ok(out.includes(`.legacy[${ATTR}]:after`), '单冒号伪元素保持在后')
  assert.ok(out.includes(`@media (max-width: 640px)`), 'media 保留')
  assert.ok(out.includes(`.demo[${ATTR}] { padding: 8px; }`), 'media 内规则追加')
  assert.ok(out.includes(`.nested > .deep[${ATTR}]`), '子代选择器追加')
  passed += 7

  // keyframes 帧选择器不追加属性
  assert.ok(out.includes(`from { transform: rotate(0deg); }`), 'keyframes from 不动')
  assert.ok(out.includes(`50% { opacity: .5; }`), 'keyframes 百分比不动')
  assert.ok(out.includes(`to { transform: rotate(360deg); }`), 'keyframes to 不动')
  passed += 3

  // 已有其它 data-v-* 属性：照常追加本 scope 属性
  assert.ok(out.includes(`.demo[data-v-existing]`), '其它 data-v-* 保留')
  assert.ok(out.includes(`.demo[data-v-existing][${ATTR}]`), '应追加到其后')
  passed += 2
}

// ---------------------------------------------------------------------------
// 2. :deep(...) —— 进入子组件作用域
// ---------------------------------------------------------------------------
await check('deep 有前缀', await sel('.a :deep(.b)'), `.a[${ATTR}] .b`)
await check('deep 无前缀', await sel(':deep(.b)'), `[${ATTR}] .b`)
await check('deep 紧连无空格', await sel('.a:deep(.b)'), `.a[${ATTR}] .b`)
await check('deep 右侧不再追加', await sel('.a :deep(.b) .c'), `.a[${ATTR}] .b .c`)
await check('deep 多段参数展开', await sel(':deep(.a, .b)'), `[${ATTR}] .a,[${ATTR}] .b`)
await check('deep 保留子代组合器', await sel('.a > :deep(.b)'), `.a[${ATTR}] > .b`)
await check('deep 保留伪类', await sel('.a:hover :deep(.b:hover)'), `.a:hover[${ATTR}] .b:hover`)
await check('deep 右侧伪元素', await sel('.a :deep(.b)::before'), `.a[${ATTR}] .b::before`)
{
  const out = await run(`@media (max-width: 640px) { .a :deep(.b) { color: red; } }`)
  assert.ok(
    out.includes(`@media (max-width: 640px) {`) && out.includes(`.a[${ATTR}] .b`),
    `deep 在 media 内也应生效，实际输出:\n${out}`,
  )
  passed++
}

// ---------------------------------------------------------------------------
// 3. :global(...) —— 括号内跳出作用域
// ---------------------------------------------------------------------------
await check('global 括号内不 scoped', await sel('.a :global(.b) .c'), `.a[${ATTR}] .b .c[${ATTR}]`)
await check('global 无前缀无后续 = 纯全局', await sel(':global(.b)'), `.b`)
await check('global 无前缀有后续', await sel(':global(.b) .c'), `.b .c[${ATTR}]`)
await check('global 多段参数', await sel('.a :global(.b, .c)'), `.a[${ATTR}] .b,.a[${ATTR}] .c`)

// ---------------------------------------------------------------------------
// 4. 旧写法不再兼容（按普通伪类/伪元素处理，照常追加属性）
// ---------------------------------------------------------------------------
await check('::v-deep 不再识别', await sel('.a ::v-deep(.b)'), `.a [${ATTR}]::v-deep(.b)`)
await check('无括号 :deep 不再识别', await sel('.a :deep .b'), `.a :deep .b[${ATTR}]`)

// ---------------------------------------------------------------------------
// 5. scoped @keyframes 改名 + animation 引用同步
// ---------------------------------------------------------------------------
{
  const out = await run(`
@keyframes spin { from { opacity: 0; } to { opacity: 1; } }
@-webkit-keyframes spin { from { opacity: 0; } to { opacity: 1; } }
.card { animation: spin 2.4s ease-in-out infinite; }
.other { animation-name: spin; }
.combo { animation: spin 1s, fade 0.3s linear; }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
`)
  assert.ok(out.includes(`@keyframes spin-${ATTR}`), '@keyframes 名追加 scope 后缀')
  assert.ok(out.includes(`@-webkit-keyframes spin-${ATTR}`), '带厂商前缀的 keyframes 也改名')
  assert.ok(out.includes(`animation: spin-${ATTR} 2.4s ease-in-out infinite`), 'animation 简写引用同步')
  assert.ok(out.includes(`animation-name: spin-${ATTR}`), 'animation-name 引用同步')
  assert.ok(out.includes(`animation: spin-${ATTR} 1s, fade-${ATTR} 0.3s linear`), '多个动画名都同步')
  assert.ok(out.includes(`.card[${ATTR}]`), '动画规则本身仍追加属性')
  passed += 6
}
{
  const out = await run(`@keyframes spin { from { opacity: 0; } to { opacity: 1; } }`, {
    scopeKeyframes: false,
  })
  assert.ok(out.includes('@keyframes spin'), 'scopeKeyframes:false 时不改名')
  passed++
}

// ---------------------------------------------------------------------------
// 6. 幂等
// ---------------------------------------------------------------------------
{
  const css = `
.a :deep(.b) { color: red; }
.c :global(.d) .e { color: red; }
@keyframes spin { from { opacity: 0; } to { opacity: 1; } }
.f { animation: spin 1s; }
`
  const once = await run(css)
  const twice = await run(once)
  assert.equal(twice, once, '重复执行结果应一致（幂等）')
  passed++
}
{
  const css = `.demo .title { color: red; }`
  const once = await run(css)
  const twice = await run(once)
  assert.equal(twice, once, '普通选择器重复执行幂等')
  passed++
}

// ---------------------------------------------------------------------------
// 7. 无 scope 上下文：原样输出
// ---------------------------------------------------------------------------
{
  const untouched = await transformScopedCss('.x { color: #000; }', undefined)
  assert.ok(untouched.includes('.x { color: #000; }'), '无 scopeAttr 原样输出')
  passed++
}

console.log(`✓ verify passed（${passed} 项断言）`)
