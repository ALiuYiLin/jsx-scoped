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

## 选择器宏（Vue 风格）

在 scoped 样式里可以用两个函数式宏精确控制“哪一段不加 scope 属性”：

```css
/* :deep(...) —— 进入子组件作用域：本文件属性挂在左侧最后一个复合选择器上，
   宏及其右侧不再追加（父组件样式借此命中子组件内部 DOM） */
.parent :deep(.child) { color: red; }
/* → .parent[data-v-x] .child */

/* :global(...) —— 括号内跳出作用域，其余照常 */
.card :global(.ant-btn) { color: red; }
/* → .card[data-v-x] .ant-btn */
```

- `:deep(.b)` 无前缀写法 = `[data-v-x] .b`（收窄到本组件根）；
- `:deep(.a, .b)` 多段参数会展开为多条选择器；
- `:global(.b)` 无前缀且无后续选择器 = `.b`（纯全局规则）；
- 只支持**函数式**写法；`>>>`、`/deep/`、`::v-deep`、无括号 `:deep .b` 等旧写法/别名
  不再特殊处理（会按普通伪类/伪元素走常规追加逻辑）；
- 含宏的规则处理后会插入一条 `/* jsx-scoped:{attr}:macro */` 注释用于幂等，压缩时会被移除。

> 与组件 scoped（`scopedId`）的关系：`:deep(...)` 解决“父组件样式命中子组件内部
> 任意后代”；`scopedId` 解决“子组件主动继承父作用域（含逐层绑定）”。两者互补。

## scoped 动画名（@keyframes）

scoped 作用域内的 `@keyframes` 名会追加 `-{scopeAttr}` 后缀（与 Vue scoped 一致），
避免不同组件的同名动画互相覆盖，同时自动改写 `animation` / `animation-name` 引用：

```css
@keyframes spin { from { opacity: 0 } to { opacity: 1 } }
.card { animation: spin 2.4s infinite; }
/* → @keyframes spin-data-v-x { … }  /  .card[data-v-x] { animation: spin-data-v-x 2.4s infinite } */
```

不需要该行为时传 `scopeKeyframes: false` 关闭。注意：若动画名被 JS 内联样式引用，
改名后需同步（与 Vue scoped 的限制一致）。

## 规则

- 只处理**普通规则**的选择器；选择器列表（逗号）逐段追加；
- `@media / @supports / @layer / @container` 内部规则正常追加；
- `@keyframes` 帧选择器（`from` / `to` / 百分比）、`@page` 不追加；`@keyframes` 名本身
  会按上一节改写（可关闭）；
- 选择器宏 `:deep(...)` / `:global(...)` 按上一节语义处理（仅函数式写法）；
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
