// @10coding/postcss-jsx-scoped 冒烟验证
// 用法：pnpm test（= build + node scripts/verify.mjs）
import assert from 'node:assert/strict'
import { transformScopedCss } from '../dist/index.js'

const ATTR = 'data-v-3f2a9c1d'

async function run(css, scopeAttr = ATTR) {
  return transformScopedCss(css, scopeAttr)
}

const css = `
.demo .title {
  color: red;
}
h1, h2, .a:hover, .btn::before, .legacy:after {
  margin: 0;
}
@media (max-width: 640px) {
  .demo { padding: 8px; }
  .nested > .deep { display: none; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  50% { opacity: .5; }
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes spin { from { opacity: 1; } to { opacity: 1; } }
}
.page-root { color: #333; }
.demo[data-v-existing] { color: #000; }
`

const out = await run(css)

// 1. 普通选择器末尾追加
assert.ok(out.includes(`.demo .title[data-v-3f2a9c1d]`), '后代选择器应追加到末尾')
// 2. 选择器列表逐段追加
assert.ok(out.includes(`h1[data-v-3f2a9c1d]`), '列表第一段 h1')
assert.ok(out.includes(`h2[data-v-3f2a9c1d]`), '列表第二段 h2')
// 3. 伪类在属性前、伪元素保持在属性之后
assert.ok(out.includes(`.a:hover[data-v-3f2a9c1d]`), ':hover 之后追加')
assert.ok(out.includes(`.btn[data-v-3f2a9c1d]::before`), '双冒号伪元素保持在后')
assert.ok(out.includes(`.legacy[data-v-3f2a9c1d]:after`), '单冒号伪元素保持在后')
// 4. 媒体查询内部规则正常追加
assert.ok(out.includes(`@media (max-width: 640px)`), 'media 保留')
assert.ok(out.includes(`.demo[data-v-3f2a9c1d] { padding: 8px; }`), 'media 内规则追加')
assert.ok(out.includes(`.nested > .deep[data-v-3f2a9c1d]`), '子代选择器追加')
// 5. keyframes 帧选择器不追加
assert.ok(out.includes(`from { transform: rotate(0deg); }`), 'keyframes from 不动')
assert.ok(out.includes(`50% { opacity: .5; }`), 'keyframes 百分比不动')
assert.ok(out.includes(`to { transform: rotate(360deg); }`), 'keyframes to 不动')
// 6. 幂等：二次处理不重复追加
const out2 = await run(out)
assert.equal(out2, out, '重复执行结果应一致（幂等）')
// 7. 已含同属性选择器跳过
assert.ok(out.includes(`.demo[data-v-existing]`), '其它 data-v-* 不动')
assert.ok(out.includes(`.demo[data-v-existing][data-v-3f2a9c1d]`), '应追加到其后')
// 8. 无 scope 上下文时不做任何修改
const untouched = await transformScopedCss('.x { color: #000; }', undefined)
assert.ok(untouched.includes('.x { color: #000; }'), '无 scopeAttr 原样输出')

console.log('✓ verify passed')
console.log('--- sample ---')
console.log(out)
