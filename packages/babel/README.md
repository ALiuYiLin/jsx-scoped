# @10coding/plugin-jsx-scoped

面向 JSX / TSX（React 等框架）的 **Vue-like scoped 样式**工具链中的 **Babel 插件**。

它负责「注入 scope 属性」这一环：以组件文件**绝对路径**为种子生成 hash，
给 JSX 元素注入 `data-v-{hash}` 属性，为后续 CSS 选择器追加
`[data-v-{hash}]`（由 postcss / vite 插件完成）提供匹配基础。

> 原理复刻 Vue SFC scoped：Vue 的 hash 取自 SFC 文件路径，这里同样取自
> `.tsx/.jsx` 组件文件路径，而不是样式文件路径。

## 特性

- 纯 Babel 插件，无运行时依赖（`@babel/core` 为 peer，可选）
- 种子：组件文件绝对路径 → `md5` → 截取前 8 位 → `data-v-3f2a9c1d`
- DOM 元素（div/span/…）注入完整属性：`<div data-v-3f2a9c1d="">`
  - 跳过 `<style>`（含 `<style scoped>`，留给上层流水线处理）
  - 跳过 `<Fragment>` 与文本节点（本来也不是元素）
- **组件 scoped（默认自动开启）**：自定义组件标签注入
  `<Child scopedId="data-v-3f2a9c1d">`，子组件需要时自行读取 scopedId
  并绑定到根元素（child-root 继承父级 scope id）；`componentScoped: false` 关闭
- 元素已存在同名属性时自动覆盖，不会重复添加
- 附带独立的 hash 工具函数，供 vite/postcss 包复用

## 安装

```bash
pnpm add -D @babel/core @10coding/plugin-jsx-scoped
```

## 用法

### 方式一：babel.config.js

```js
// babel.config.cjs
module.exports = {
  plugins: [
    // 需要拿到每个文件的绝对路径：babel 提供 filename，可再用插件填充
    ['@10coding/plugin-jsx-scoped', { componentFilePath: /* __filename */ }],
  ],
}
```

### 方式二：@babel/core 编程式（推荐，vite 插件内部即如此调用）

```ts
import { transformSync } from '@babel/core'
import jsxScoped from '@10coding/plugin-jsx-scoped'

const filename = 'E:/proj/src/demo.tsx' // 组件文件绝对路径
const result = transformSync(code, {
  filename,
  parserOpts: { plugins: ['typescript', 'jsx'] },
  plugins: [[jsxScoped, { componentFilePath: filename }]],
})
```

### 转换效果

输入 `demo.tsx`：

```tsx
import Child from './Child'

export function Demo() {
  return (
    <section className="demo">
      <h2 className="title">Hello</h2>
      <Child />
      <style scoped>{'h2 { color: red; }'}</style>
    </section>
  )
}
```

输出（scope 属性名由 `md5('E:/proj/src/demo.tsx')` 前 8 位决定）：

```tsx
import Child from './Child'

export function Demo() {
  return (
    <section className="demo" data-v-aa80bcf8="">
      <h2 className="title" data-v-aa80bcf8="">Hello</h2>
      <Child scopedId="data-v-aa80bcf8" />
      <style scoped>{'h2 { color: red; }'}</style>
    </section>
  )
}
```

### 组件 scoped（child-root 继承）

自定义组件不会被直接注入 `data-v-*`（那只是普通 props），而是注入
`scopedId="data-v-{hash}"`。子组件**如果需要**继承父级 scope（让父组件 scoped
样式能命中子组件根元素），自行读取并把该属性绑到根元素上：

```tsx
// Child.tsx
export default function Child({ scopedId }: { scopedId?: string }) {
  return (
    <div className="child-root" {...(scopedId ? { [scopedId]: '' } : {})}>
      {/* 根元素因此带上父级的 data-v-{hash} */}
    </div>
  )
}
```

```scss
/* demo.scoped.scss —— 选择器被追加 [data-v-aa80bcf8]，可命中上面的 child-root */
.child-root { border-left: 4px solid #4f46e5; }
```

## 配置项

```ts
interface JsxScopedBabelOptions {
  /** 组件文件绝对路径（.tsx/.jsx），默认用它计算 data-v-{hash} */
  componentFilePath?: string
  /** 完整 scope 属性名，如 'data-v-3f2a9c1d'（优先级最高） */
  scopeAttr?: string
  /** 仅 hash 部分，如 '3f2a9c1d'，自动拼 data-v- 前缀 */
  scopeHash?: string
  /** hash 位数，默认 8 */
  hashLength?: number
  /**
   * 组件 scoped：默认 true。
   * 给自定义组件标签注入 <Child scopedId="data-v-{hash}">；
   * 设为 false 则自定义组件标签不被注入任何属性。
   */
  componentScoped?: boolean
  /** 注入到自定义组件标签上的属性名，默认 'scopedId' */
  scopedIdAttributeName?: string
}
```

## 工具函数

```ts
import {
  generateScopeHash, // (filePath, len=8) => 'aa80bcf8'
  createScopeAttr,   // (hash) => 'data-v-aa80bcf8'
  computeScopeAttr,  // (filePath, len=8) => 'data-v-aa80bcf8'
  normalizeComponentPath, // Windows 反斜杠归一化为 '/'
} from '@10coding/plugin-jsx-scoped'
```

## 开发

```bash
pnpm install
pnpm --filter @10coding/plugin-jsx-scoped build   # tsup 构建 esm/cjs/dts
pnpm --filter @10coding/plugin-jsx-scoped test    # 冒烟验证（@babel/core 实际转换）
```

## 说明

- 本插件只负责 JSX AST 侧注入；「样式文件选择器追加 `[data-v-{hash}]`」
  由仓库内的 `@10coding/postcss-jsx-scoped`、编排由
  `@10coding/vite-plugin-jsx-scoped` 完成（见仓库根目录）。
- License: MIT
