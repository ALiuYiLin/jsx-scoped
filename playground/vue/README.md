# Vue JSX 示例（`@10coding/example-vue`）

> **结论：适用。** 插件全程在 **JSX AST 层**工作（给元素注属性、改写 scoped 导入、
> 给选择器追加 `[data-v-{hash}]`），不依赖 React 运行时，所以 Vue 3 + `@vitejs/plugin-vue-jsx`
> 下能力与 React / Solid 示例完全一致；而且 Vue 的 **attrs 透传**还让「子组件继承父级
> scope」变成零改造 —— 见下文「Vue 特有的差异」。

## 接入方式

```ts
// vite.config.ts —— jsxScoped() 必须排在 vueJsx() 之前：
// 它要在 JSX 被 @vue/babel-plugin-jsx 编译成 createVNode 之前完成注入与提取。
import { fileURLToPath, URL } from 'node:url'

import vueJsx from '@vitejs/plugin-vue-jsx'
import jsxScoped from '@10coding/vite-plugin-jsx-scoped'

export default defineConfig({
  plugins: [jsxScoped({ warnMultiScopedImport: true }), vueJsx()],
  // 路径别名照常用：插件会读取这里配置的 resolve.alias 解析 scoped 样式导入
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    preprocessorOptions: {
      scss: { additionalData: '$jsx-scoped-brand: #42b883;\n' }, // 照常生效
    },
  },
})
```

```jsonc
// tsconfig.json —— Vue JSX 需要 preserve + jsxImportSource；
// paths 与 vite 的 resolve.alias 保持一致（编辑器 / tsc --noEmit 用）
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "vue",
    "types": ["vite/client", "@10coding/vite-plugin-jsx-scoped/client"],
    "noUncheckedSideEffectImports": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

类型上不需要额外声明：Vue 自带的 JSX 类型里 `StyleHTMLAttributes` 本就有
`scoped`，所以 `<style scoped lang="scss">` 能通过 `tsc --noEmit`；`direct-scoped`
这类**带连字符**的属性 TS 不做检查，也不会报未知 prop。

### 路径别名导入 scoped 样式

`*.scoped.*` 的 specifier 按 **vite 自身的解析顺序**解析：先 `resolve.alias`，
再相对/绝对路径。所以别名导入与相对导入完全等价：

```tsx
// Pill.tsx —— 命名约定只看文件名后缀，路径怎么写都可以
import '@/demo/components/pill.scoped.css'
// 等价于 import './pill.scoped.css'
// 两者都会生成同一个 jsx-scoped-file: 虚拟模块（生产产物字节一致）
```

- 插件在 `configResolved` 阶段读取同一份 `resolve.alias`，无需额外配置插件选项；
- 别名与相对路径指向同一文件时按**解析后的真实路径**判定归属，
  所以「同一份 css 只允许一个组件导入」的规则不受路径写法影响；
- 命中 alias 但文件不存在、或裸包名（`some-pkg/x.scoped.css`）不参与 scope，
  构建期给出一条「已跳过 scoped 化」警告。

## 示例覆盖的能力

| 能力 | 位置 | 说明 |
| --- | --- | --- |
| 外部 `*.scoped.scss` | `src/demo/demo.tsx` + `demo.scoped.scss` | sass 嵌套、`@media`、`@keyframes` 改名 + `animation` 引用同步 |
| 外部 `*.scoped.less` | `src/demo/components/Card.tsx` | less 嵌套 / 变量 / `fade()` |
| 外部 `*.scoped.css` | `src/demo/components/Pill.tsx` | 纯 css，**用路径别名 `@/…` 导入**；伪元素规则位置（`.pill-scoped[data-v-x]::after`） |
| 内联 `<style scoped>` / `lang="scss"` | `src/demo/demo.tsx` | 编译期提取并移除，不渲染真实 `<style>` 节点 |
| 组件 scoped：`scopedId` 显式绑定 | `src/demo/components/ScopedRoot.tsx` | 与 React / Solid 示例同语义，跨框架写法一致 |
| 组件 scoped：Vue attrs 透传 | `src/demo/components/AutoScopedRoot.tsx` | `<AutoScopedRoot direct-scoped />`，子组件零改造 |
| 全局样式对照 | `src/styles/global.css` | 不带 scoped 后缀 → 选择器不改写 |
| 覆盖风险 warning | `demo.tsx` | 同组件 3 个 scoped 资源（外部 1 + 内联 2）复用同一 hash，构建期提示 |

组件侧写法与 React 版几乎一致，只有框架语法差异（`class` 而非 `className`、
自定义组件用 `defineComponent` 声明 props）：

```tsx
import { defineComponent } from 'vue'
import './demo.scoped.scss'

export default defineComponent({
  name: 'Demo',
  props: { title: { type: String, required: true } },
  setup(props) {
    return () => (
      <section class="demo">
        <h2 class="demo__title">{props.title}</h2>
        <style scoped>{`.demo__title { color: teal; }`}</style>
      </section>
    )
  },
})
```

## Vue 特有的差异（均在本示例中实测）

### 1. attrs 透传让 child-root 继承零成本

Vue 会把子组件**未声明**的 attrs 自动合并到子组件的**唯一根元素**上。于是给组件
加 `direct-scoped` marker（插件直接注入 `data-v-{父hash}`，而不是 `scopedId`）后，
子组件什么都不用写就能继承父级 scope：

```tsx
<AutoScopedRoot direct-scoped label="attrs 透传，子组件零改造" />
// 子组件根元素最终带上 data-v-{父hash} → 父组件的 .auto-root[data-v-{父hash}] 命中
```

```tsx
// AutoScopedRoot.tsx —— 完全不需要知道 scoped 的存在
export default defineComponent({
  props: { label: { type: String, required: true } },
  setup(props) {
    return () => <div class="auto-root">{props.label}</div>
  },
})
```

限制（Vue 语义决定，与本插件无关）：

- 仅**单根**组件生效；多根 / Fragment / 文本根会触发 Vue 的
  `Extraneous non-props attributes … could not be automatically inherited` 警告；
- 子组件必须是**有状态组件**（`defineComponent`）**或声明了 `props` 的函数组件**：
  Vue 对「裸函数组件」只透传 `class` / `style` / 事件监听
  （runtime-core 的 `getFunctionalFallthrough`），其它 attrs 会被**静默丢弃**
  —— 也就是说对裸函数组件用 `direct-scoped` 不会生效。
- 子组件 `inheritAttrs: false` 时同样不生效。

### 2. 未声明的 `scopedId` 不会被丢掉，而是落到子组件根元素上

默认 `componentScoped: true` 时，插件给自定义组件注入
`scopedId="data-v-{父hash}"`。Vue 没有 React 那种「未知 prop 直接忽略」，
所以**有 props 声明**的子组件会把它透传成根元素上的
`scopedid="data-v-{父hash}"`（DOM 属性名小写化）：

```html
<!-- Pill 是 defineComponent，未声明 scopedId → 多出 scopedid 属性（仅噪声，不影响样式命中） -->
<span class="pill-scoped" data-v-{自己的hash} scopedid="data-v-{父hash}">
<!-- Card 是裸函数组件 → scopedId 被静默丢弃，DOM 更干净 -->
<div class="card-scoped card-scoped--primary" data-v-{自己的hash}>
```

不想要这点噪声，二选一：

- 子组件声明并消费它（本示例 `ScopedRoot`，顺便获得 child-root 继承能力）；
- 或者 `jsxScoped({ componentScoped: false })` 整体关闭注入，需要继承时改用
  上面 `direct-scoped` + attrs 透传。

### 3. 无需 `.vue` 插件

示例是**纯 JSX**（没有 SFC），只挂 `@vitejs/plugin-vue-jsx` 即可。若项目里同时有
`.vue` 文件，按 `[jsxScoped(), vueJsx(), vue()]` 的顺序追加 `@vitejs/plugin-vue`：
`jsxScoped` 始终保持在最前面即可。

## 运行与校验

> 本示例固定在 **Vite 8（Rolldown 内核）** 上运行；同一套 `verify` 断言在
> Vite 6.4.3 与 8.2.2 下逐项一致（dev SSR、dev HTTP 虚拟模块、别名导入、
> HMR 联动、生产产物选择器）。

```bash
pnpm install

pnpm --filter @10coding/example-vue dev        # 开发（根目录可用 pnpm demo:vue）
pnpm --filter @10coding/example-vue build      # 生产构建（根目录可用 pnpm build:demo:vue）
pnpm --filter @10coding/example-vue typecheck  # tsc --noEmit
pnpm --filter @10coding/example-vue verify     # 根目录可用 pnpm verify:demo:vue
```

`verify` 会起一个真实 Vite dev server，然后：

1. 走 **dev SSR** 把 `demo.tsx` 渲染成 HTML，断言
   `<section class="demo" data-v-…>`、子组件根元素继承父级 hash、
   内联 `<style scoped>` 未被渲染成真实节点；
2. 走 **dev HTTP**（浏览器同款路径）拉取 `demo.tsx` / `Pill.tsx` 与 `jsx-scoped-file:` /
   `jsx-scoped-inline:` 虚拟模块，断言 `*.scoped.*` 导入被改写、选择器带 `[data-v-…]`；
   其中 `Pill.tsx` 走的是 **路径别名导入**，断言别名 specifier 被改写成虚拟模块。

构建产物同样验证过：`dist/assets/*.css` 里是 `.demo[data-v-…]`、
`.pill-scoped[data-v-…]`、`.auto-root[data-v-…]` 等已追加属性的选择器，
JS 产物里保留注入的属性。
