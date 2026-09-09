---
title: API 参考
description: jsx-scoped 三包 API —— plugin-jsx-scoped（babel 插件 + hash 工具）、postcss-jsx-scoped（transformScopedCss）、vite-plugin-jsx-scoped（配置项 / JsxScopedPipeline / registry / 导出类型）
---

# API 参考

## @10coding/plugin-jsx-scoped

### 配置项（Babel 插件）

```ts
interface JsxScopedBabelOptions {
  /** 组件文件绝对路径，默认用它计算 data-v-{hash} */
  componentFilePath?: string
  /** 完整 scope 属性名，如 'data-v-3f2a9c1d'（优先级最高） */
  scopeAttr?: string
  /** 仅 hash 部分，如 '3f2a9c1d'，自动补 data-v- 前缀 */
  scopeHash?: string
  /** hash 位数，默认 8 */
  hashLength?: number
  /** 组件 scoped，默认 true（注入 scopedId） */
  componentScoped?: boolean
  /** scopedId 属性名，默认 'scopedId' */
  scopedIdAttributeName?: string
  /** direct-scoped marker 属性名，默认 'direct-scoped' */
  directScopedAttributeName?: string
}
```

scope 属性名优先级：显式 `scopeAttr` > `scopeHash`（拼前缀）>
`componentFilePath`（md5 截前 8 位）。三者都不传则抛错。

### hash 工具函数

```ts
import {
  generateScopeHash,      // (filePath, len=8) => 'aa80bcf8'
  createScopeAttr,        // (hash) => 'data-v-aa80bcf8'
  computeScopeAttr,       // (filePath, len=8) => 'data-v-aa80bcf8'
  normalizeComponentPath, // Windows 反斜杠归一化为 '/'
} from '@10coding/plugin-jsx-scoped'
```

## @10coding/postcss-jsx-scoped

```ts
import postcssJsxScoped from '@10coding/postcss-jsx-scoped' // PostCSS 插件（默认导出）
import { transformScopedCss } from '@10coding/postcss-jsx-scoped'

// 同步：返回追加好 [data-v-aa80bcf8] 的 css 文本
const css = transformScopedCss(source, 'data-v-aa80bcf8', { from: 'x.css' })
```

追加规则见 [原理：CSS 追加规则细节](/guide/architecture#css-追加规则细节)。

## @10coding/vite-plugin-jsx-scoped

### 配置项

```ts
interface JsxScopedViteOptions {
  /** 一个组件导入多份 scoped 文件时的覆盖风险提示，默认 true */
  warnMultiScopedImport?: boolean
  /** hash 位数（md5(组件文件绝对路径) 截取长度），默认 8 */
  scopeHashLength?: number
  /** 组件 scoped：默认 true，给自定义组件注入 scopedId */
  componentScoped?: boolean
  /** scopedId 属性名，默认 'scopedId' */
  scopedIdAttributeName?: string
  /** direct-scoped marker 属性名，默认 'direct-scoped' */
  directScopedAttributeName?: string
  /** 会话级共享状态 registry */
  registry?: JsxScopedRegistry
  /** true 时本实例独占全新 registry */
  isolated?: boolean
}
```

优先级：显式 `registry` > `isolated: true`（新建）> 进程级默认单例。

### client 模块声明

`@10coding/vite-plugin-jsx-scoped/client` 声明了 `*.scoped.{css,scss,sass,less}`
模块类型；在 tsconfig `types` 引入即可（见[快速开始](/guide/getting-started)）。

### 编程式复用：JsxScopedPipeline

```ts
import {
  createJsxScopedPipeline,   // 工厂
  JsxScopedPipeline,         // 类
  createJsxScopedRegistry,
  getDefaultJsxScopedRegistry,
  parseVirtualId,
} from '@10coding/vite-plugin-jsx-scoped'

const core = createJsxScopedPipeline() // 默认共享进程级 registry
const result = core.transform(tsxText, '/abs/path/page.md')
// result: TransformScopedResult
// {
//   enabled, code, map,
//   warnings: string[], parseError?,
//   scopeAttr?, scopeHash?,
//   virtualIds: string[]        // 不含 \0 前缀
// }

const site = createJsxScopedPipeline()        // 另一实例共享同一单例
const css = await site.load(result.virtualIds[0]) // 已追加 [data-v-{hash}]

const parsed = parseVirtualId(result.virtualIds[0])
// { kind: 'file'|'inline', cssRealPath/componentFilePath, index }
```

未命中 transform 登记且文件不存在时，`load` 返回带友好说明的错误。

### JsxScopedRegistry（会话状态）

持有 5 份状态：`cssOwners`（文件归属）、`virtualModulesByCss` 与
`inlineModulesByComponent`（HMR 失效映射）、`inlineSourcesByComponent`
（内联样式登记）、`warnedKeys`（提示去重）。

```ts
const R = createJsxScopedRegistry()  // 全新独立 registry（显式共享给多个实例用）
getDefaultJsxScopedRegistry()        // 进程级默认单例

R.reset()   // 清空全部会话状态（保留 Map/Set 引用，实例可继续复用）
R.dispose() // reset 的语义别名：本 registry 不再使用
```

生命周期：Vite 插件在 dev server `close` 与单次 build（`closeBundle`，watch 模式
除外）后自动 `dispose()` 其**自建** registry；显式传入 `options.registry` 时归调用方，
插件不自动清理。编程式/测试在 teardown 手动调用。清空后旧虚拟 id 无法 load。

### 其它导出类型

`JsxScopedRegistry`、`JsxScopedViteOptions`、`TransformScopedResult`、
`ParsedVirtualId` / `FileVirtualId` / `InlineVirtualId`、`SourceMapLike`、
`AdditionalData`（vite css.preprocessorOptions 透传类型）。

## 常见问题

- **`.scoped.scss` 导入 TS 报错**：tsconfig `types` 加
  `@10coding/vite-plugin-jsx-scoped/client`；
- **构建报“组件 X 导入了 scoped 文件，而该文件已属于组件 Y”**：同一
  `*.scoped.*` 被两个组件共享，属于设计限制——每个组件应维护自己的 scoped 文件；
- **只想让部分组件标签带属性**：`componentScoped: false` 全局关，需要继承的组件
  手动处理，或用 `scopedIdAttributeName` 改名避免与业务 prop 冲突。
