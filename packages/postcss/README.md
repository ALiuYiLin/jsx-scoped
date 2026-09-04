# @10coding/postcss-jsx-scoped

PostCSS 插件：为 CSS 选择器追加 scope 属性选择器（Vue-like scoped）。

```
.demo .title        →  .demo .title[data-v-3f2a9c1d]
h1, h2              →  h1[data-v-3f2a9c1d], h2[data-v-3f2a9c1d]
.btn::before        →  .btn[data-v-3f2a9c1d]::before   （伪元素保持在属性之后）
@media (...) { .a } →  @media (...) { .a[data-v-3f2a9c1d] }
@keyframes { from{} }→  from{} 帧选择器不追加
```

## 安装

```bash
pnpm add -D @10coding/postcss-jsx-scoped
```

## 用法

### 编程式（vite 插件内部即用这个入口）

```ts
import { transformScopedCss } from '@10coding/postcss-jsx-scoped'

// 样式必须先经过预处理（scss/less → css）
const css = await transformScopedCss(plainCss, 'data-v-3f2a9c1d', {
  from: '/abs/path/to/file.css',
})
```

### 作为 PostCSS 插件

```js
import postcssJsxScoped from '@10coding/postcss-jsx-scoped'

postcss([postcssJsxScoped({ scopeAttr: 'data-v-3f2a9c1d' })]).process(css)
```

### 多文件共用实例（resolveScope 模式）

```js
postcssJsxScoped({
  resolveScope: (from) => (from?.endsWith('.scoped.css') ? registry.get(from) : undefined),
})
```

## 规则

- 只处理**普通规则**的选择器；选择器列表（逗号）逐段追加；
- `@media / @supports / @layer / @container` 内部规则正常追加；
- `@keyframes` 帧选择器（`from` / `to` / 百分比）、`@page` 不追加；
- 已含同 scope 属性时跳过（幂等，可重复执行）；
- 伪元素（`::before` 等，含单冒号旧写法）保持在 `[data-v-*]` 之后。

## 开发

```bash
pnpm --filter @10coding/postcss-jsx-scoped build   # tsup esm/cjs/dts
pnpm --filter @10coding/postcss-jsx-scoped test    # 冒烟验证
```

License: MIT
