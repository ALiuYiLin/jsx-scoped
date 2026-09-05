// @10coding/plugin-jsx-scoped 冒烟验证
// 用法：pnpm test（= build + node scripts/verify.mjs）
import assert from 'node:assert/strict'
import { transformSync } from '@babel/core'
import jsxScopedPlugin, {
  computeScopeAttr,
  generateScopeHash,
  analyzeScopedUsage,
} from '../dist/index.js'

const FILE = 'E:/proj/src/demo.tsx'

function transform(code, options = {}, filename = FILE) {
  return transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [[jsxScopedPlugin, { componentFilePath: filename, ...options }]],
  }).code
}

// ---------- 1. 基础注入：DOM 元素注入；style/Fragment/文本跳过 ----------
// 自定义组件（<Widget />）默认注入 scopedId="data-v-{hash}"（组件 scoped），
// 子组件可自行取用并绑定到根元素。
const code1 = `
export function Demo(props: { title: string }) {
  return (
    <section className="demo">
      <h2 className="title">{props.title}</h2>
      <Widget><span className="child" /></Widget>
      <UI.Button>action</UI.Button>
      <style scoped>{'h2 { color: red; }'}</style>
      <>plain fragment text</>
    </section>
  )
}
`
const scopeAttr = computeScopeAttr(FILE)
const out1 = transform(code1)
assert.equal(out1.includes(scopeAttr), true, '输出中应包含 scope 属性')
assert.match(out1, /<section [^>]*data-v-[0-9a-f]{8}/, 'section 应注入')
assert.match(out1, /<h2 [^>]*data-v-[0-9a-f]{8}/, 'h2 应注入')
assert.match(out1, /<span [^>]*data-v-[0-9a-f]{8}/, 'span（组件内嵌 DOM）应注入')
assert.match(out1, /<style scoped>/, '<style scoped> 应原样保留、不注入')
// 组件 scoped：scopedId 值为 scopeAttr（data-v-{hash}），而不是 data-v 属性本身
assert.match(
  out1,
  new RegExp(`<Widget [^>]*scopedId="${scopeAttr}"`),
  '自定义组件 <Widget> 默认注入 scopedId="data-v-{hash}"',
)
assert.doesNotMatch(
  out1,
  /<Widget\s[^>]*\sdata-v-[0-9a-f]{8}/,
  '<Widget> 不应注入独立 data-v 属性（只有 scopedId 值）',
)
assert.match(
  out1,
  new RegExp(`<UI\\.Button [^>]*scopedId="${scopeAttr}"`),
  '成员表达式组件 <UI.Button> 也注入 scopedId',
)

// ---------- 2. 组件 scoped 可关闭；属性名可自定义 ----------
const out2a = transform(code1, { componentScoped: false })
assert.doesNotMatch(out2a, /<Widget [^>]*scopedId/, 'componentScoped:false 时组件不再注入')
assert.match(out2a, /<section [^>]*data-v-/, '关闭组件 scoped 不影响 DOM 注入')

const out2b = transform(code1, { scopedIdAttributeName: 'scopeId' })
assert.match(
  out2b,
  new RegExp(`<Widget [^>]*scopeId="${scopeAttr}"`),
  'scopedIdAttributeName 可自定义属性名',
)
assert.doesNotMatch(out2b, /<Widget [^>]*scopedId=/, '默认名 scopedId 不再使用')

// ---------- 3. hash 确定性 & 路径唯一性 ----------
assert.equal(generateScopeHash(FILE), generateScopeHash(FILE))
assert.equal(generateScopeHash(FILE).length, 8)
assert.notEqual(generateScopeHash(FILE), generateScopeHash('E:/proj/src/other.tsx'))
assert.ok(/^data-v-[0-9a-f]{8}$/.test(computeScopeAttr(FILE)))

// ---------- 4. 同名属性覆盖（值被重置、且不重复添加） ----------
const existingAttr = computeScopeAttr(FILE)
const out4 = transform(`const a = <div ${existingAttr}="old" className="x" />`)
assert.equal(
  out4.split(existingAttr).length - 1,
  1,
  '已存在同名 scope 属性时不应重复添加',
)
assert.match(out4, new RegExp(`${existingAttr}=""`), '同名属性值应以空串覆盖')

// ---------- 4b. 组件上已存在的 scopedId 被覆盖为生成的 scopeAttr ----------
const out4b = transform(`const a = <Child scopedId="data-v-00000000" />`)
assert.equal(
  (out4b.match(/scopedId=/g) ?? []).length,
  1,
  'scopedId 同名时只保留一个',
)
assert.match(out4b, new RegExp(`scopedId="${scopeAttr}"`), 'scopedId 值应被覆盖为 scopeAttr')
assert.doesNotMatch(out4b, /data-v-00000000/, '旧的 scopedId 值应被替换')

// ---------- 4c. direct-scoped：变量组件当普通 DOM 标签处理 ----------
const directCode = `
const CompLink: any = tag || (href ? 'a' : 'button')
export default function Demo() {
  return (
    <div>
      <CompLink direct-scoped className="btn" />
      <UI.Btn direct-scoped />
      <Comp />
      <div direct-scoped>marker on native tag</div>
    </div>
  )
}
`
const out4c = transform(directCode)
// 命中 marker：直接注入 data-v、不注入 scopedId、marker 从产物移除
assert.match(
  out4c,
  new RegExp(`<CompLink [^>]*data-v-[0-9a-f]{8}`),
  '带 marker 的变量组件注入 data-v',
)
assert.doesNotMatch(out4c, /<CompLink [^>]*scopedId/, '带 marker 的变量组件不注入 scopedId')
assert.match(
  out4c,
  /<CompLink [^>]*className="btn" [^>]*data-v-[0-9a-f]{8}|<CompLink [^>]*data-v-[0-9a-f]{8} [^>]*className="btn"/,
  '原有 props 保留',
)
assert.match(
  out4c,
  new RegExp(`<UI\\.Btn [^>]*data-v-[0-9a-f]{8}`),
  '成员表达式组件加 marker 同样按 DOM 处理',
)
assert.doesNotMatch(out4c, /direct-scoped/, 'marker 从产物移除（不泄漏为 prop/属性）')
// 无 marker 的大写组件保持组件 scoped 语义
assert.match(out4c, /<Comp [^>]*scopedId=/, '无 marker 的组件仍走组件 scoped 路径')
// marker 出现在原生标签上：无意义但不泄漏、DOM 照常注入
assert.match(out4c, /<div [^>]*data-v-[0-9a-f]{8}/, 'DOM 元素照常注入')

// ---------- 4d. directScopedAttributeName 可自定义 ----------
const out4d = transform(directCode, { directScopedAttributeName: 'as-native' })
assert.match(
  out4d,
  new RegExp(`<CompLink [^>]*data-v-[0-9a-f]{8}`),
  '自定义 marker 名生效',
)
assert.doesNotMatch(out4d, /as-native/, '自定义 marker 同样被移除')
assert.match(out4d, /direct-scoped/, '默认名 direct-scoped 不再被识别，作为普通属性保留')

// ---------- 5. 显式 scopeAttr / scopeHash 优先 ----------
const out5 = transform(`const a = <div />`, { scopeAttr: 'data-v-custom' })
assert.match(out5, /data-v-custom/, '显式 scopeAttr 应生效')
const out6 = transform(`const a = <div />`, { scopeHash: 'aabbccdd' })
assert.match(out6, /data-v-aabbccdd/, 'scopeHash 自动补 data-v- 前缀')

// ---------- 6. 缺少配置时报错 ----------
assert.throws(
  () => transform(`const a = <div />`, { scopeAttr: undefined }, ''),
  /缺少必要配置/,
)

// ---------- 7. analyzeScopedUsage：收集 scoped 开启标记 ----------
const srcWithMarkers = `
import './demo.scoped.scss'
import React from 'react'
export function Demo() {
  return (
    <section>
      <style scoped lang="less">{'.x { color: #333; }'}</style>
      <span />
    </section>
  )
}
`
const analysis = analyzeScopedUsage(srcWithMarkers, FILE)
assert.equal(analysis.enabled, true)
assert.deepEqual(
  analysis.externalImports.map((i) => i.specifier),
  ['./demo.scoped.scss'],
)
assert.equal(analysis.inlineStyles.length, 1)
assert.equal(analysis.inlineStyles[0].lang, 'less')
assert.ok(analysis.inlineStyles[0].content.includes('.x'))

const plain = analyzeScopedUsage(`export const a = <div />`, FILE)
assert.equal(plain.enabled, false)

console.log('✓ verify passed')
console.log('  scopeAttr for', FILE, '=', scopeAttr)
console.log('  sample output:', out1.replace(/\n\s*/g, ' ').slice(0, 220), '…')
