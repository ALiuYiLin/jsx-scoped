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

// ---------- 1. 基础注入：DOM 元素注入，style/Fragment/文本跳过，自定义组件默认跳过 ----------
const code1 = `
export function Demo(props: { title: string }) {
  return (
    <section className="demo">
      <h2 className="title">{props.title}</h2>
      <Widget><span className="child" /></Widget>
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
assert.doesNotMatch(out1, /<Widget [^>]*data-v-/, '默认不注入自定义组件 <Widget>')
assert.match(out1, /<style scoped>/, '<style scoped> 应原样保留、不注入')

// ---------- 2. addToComponents: true ----------
const out2 = transform(code1, { addToComponents: true })
assert.match(out2, /<Widget [^>]*data-v-[0-9a-f]{8}/, 'addToComponents 后组件也应注入')

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
