# @10coding/postcss-jsx-scoped

PostCSS 插件：为 CSS 选择器追加 scope 属性选择器，实现 Vue-like scoped 样式的
「选择器收尾」环节。

```
.demo .title        →  .demo .title[data-v-3f2a9c1d]
h1, h2              →  h1[data-v-3f2a9c1d], h2[data-v-3f2a9c1d]
.btn::before        →  .btn[data-v-3f2a9c1d]::before   （伪元素保持在属性之后）
@media (...) { .a } →  @media (...) { .a[data-v-3f2a9c1d] }
@keyframes { from{} }→  from{} 帧选择器不追加
```

> 组件 JSX 侧注入 `data-v-{hash}` 由 `@10coding/plugin-jsx-scoped`（babel）完成，
> 编排与预处理器编译由 `@10coding/vite-plugin-jsx-scoped`（vite）完成；
> 本包只负责把「已编译成普通 CSS 的选择器」追加 scope 属性。

## 安装

```bash
pnpm add -D @10coding/postcss-jsx-scoped
```

## 用法

### 方式一：编程式（vite 插件内部即用这个入口）

```ts
import { transformScopedCss } from '@10coding/postcss-jsx-scoped'

// 注意：输入必须是普通 CSS（scss/less 需先预处理，见下方「内联样式隔离」示例）
const css = await transformScopedCss(plainCss, 'data-v-3f2a9c1d', {
  from: '/abs/path/to/file.css',
})
```

### 方式二：作为 PostCSS 插件

```js
import postcssJsxScoped from '@10coding/postcss-jsx-scoped'

postcss([postcssJsxScoped({ scopeAttr: 'data-v-3f2a9c1d' })]).process(css)
```

### 方式三：多文件共用实例（resolveScope 模式）

常用于把插件挂到 Vite 的 `css.postcss` 或全局 PostCSS 配置里，
按 css 文件路径解析各自的 scope：

```js
postcssJsxScoped({
  resolveScope: (from) =>
    from?.endsWith('.scoped.css') ? scopeRegistry.get(from) : undefined,
})
```

## 内联 `<style scoped>` 样式隔离（用法与示例）

内联样式的隔离遵循与外部 `*.scoped.*` 完全相同的原则：
**预处理器必须先编译成普通 CSS，再由本插件追加 `[data-v-{hash}]`，
禁止直接改 scss/less 源码**。

```tsx
// 组件里（由 vite 插件提取）
export default function Demo() {
  return (
    <section className="demo">
      {/* lang 缺省 = css */}
      <style scoped>{`.demo__tip { color: teal; }`}</style>

      {/* 想要 scss 嵌套 / 变量，必须写 lang="scss" */}
      <style scoped lang="scss">{`
        .panel {
          .panel__title { color: #4f46e5; font-weight: 700; }
        }
      `}</style>
    </section>
  )
}
```

等价的手动流水线（不依赖 vite 插件，演示本包职责）：

```ts
import { transformScopedCss } from '@10coding/postcss-jsx-scoped'
import { compileStringAsync } from 'sass'

// 1) 提取到的内联 scss 文本（生产环境由 babel/vite 插件自动完成）
const rawScss = `.panel { .panel__title { color: #4f46e5; } }`
// 2) 先编译成普通 CSS（原则：不直接改 scss 源码）
const { css } = await compileStringAsync(rawScss, { style: 'expanded' })
// 3) 再追加 [data-v-{hash}]
const scopedCss = await transformScopedCss(css, 'data-v-3f2a9c1d')
```

结果：

```css
.panel[data-v-3f2a9c1d] { }
.panel .panel__title[data-v-3f2a9c1d] { color: #4f46e5; }
```

### 内联样式隔离的完整链路（Vite 项目）

1. vite 插件在组件 transform 阶段扫描 `<style scoped>`（属性名存在即开启；
   `lang` 缺省按 css，`lang="scss" | "sass" | "less"` 指定预处理器），
   并把标签从 JSX 中移除，改写成虚拟 css 模块导入；
2. 虚拟 css 模块 load 时：读取该内联块文本 → sass/less/css 编译为普通 CSS；
3. 调用本包 `transformScopedCss(css, scopeAttr)` 追加 `[data-v-{hash}]`；
4. 以普通 `.css` 模块交还 Vite css 管线（dev 注入 + HMR、build 抽取 css 产物）。

> 同一组件可混用外部 `*.scoped.*` 与多个内联 `<style scoped>`，全部复用同一个
> 由组件文件路径生成的 hash。重复调用本插件是安全的（幂等：已含同属性则跳过）。

## 规则

- 只处理**普通规则**的选择器；选择器列表（逗号）逐段追加；
- `@media / @supports / @layer / @container` 内部规则正常追加；
- `@keyframes` 帧选择器（`from` / `to` / 百分比）、`@page` 不追加；
- 已含同 scope 属性时跳过（幂等，可重复执行）；
- 伪元素（`::before` 等，含单冒号旧写法）保持在 `[data-v-*]` 之后；
- 输入必须是普通 CSS：scss/less 请先预处理（见上方示例），
  嵌套/变量等语法由预处理器负责展开，本插件不参与。

## 开发

```bash
pnpm --filter @10coding/postcss-jsx-scoped build   # tsup esm/cjs/dts
pnpm --filter @10coding/postcss-jsx-scoped test    # 冒烟验证
```

License: MIT
