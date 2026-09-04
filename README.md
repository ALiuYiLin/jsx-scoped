# jsx-scoped —— 面向 JSX/TSX 的 Vue-like scoped 样式工具链

让 React 等 JSX 框架获得 **Vue SFC scoped** 一样的样式隔离能力：

- Scope 种子是 **组件文件（.tsx/.jsx）的绝对路径**，而不是样式文件路径；
- 组件内所有 JSX DOM 元素自动注入唯一属性 `data-v-xxxxxxxx`；
- 组件关联的 `*.scoped.{css,scss,sass,less}` 样式与内联 `<style scoped>`，
  所有选择器自动追加 `[data-v-xxxxxxxx]`；
- 支持外部样式导入 + 内联 `<style scoped>`（含 `lang="scss"/"less"/...`），
  支持 css / scss / sass / less。

## 仓库结构（pnpm monorepo + tsup）

```
jsx-scoped/
├─ packages/
│  ├─ babel/     → @10coding/plugin-jsx-scoped      # Babel 插件：注入 data-v-{hash}
│  ├─ postcss/   → @10coding/postcss-jsx-scoped     # PostCSS 插件：选择器追加 [data-v-{hash}]
│  └─ vite/      → @10coding/vite-plugin-jsx-scoped # Vite 主入口：编排以上两者 + 预处理编译
└─ playground/
   └─ react/     → React 示例（demo.tsx + demo.scoped.scss 等）
```

## 快速开始

```bash
pnpm install
pnpm build          # 构建三个包
pnpm demo           # 启动 React 示例（vite dev）
pnpm build:demo     # 生产构建示例
```

React 示例包含：外部 `*.scoped.scss`、外部 `*.scoped.less`、外部 `*.scoped.css`、
组件内联 `<style scoped>`（纯 css）与 `<style scoped lang="scss">`（sass 嵌套）、
全局非 scoped css，以及一个构建期 warning
（同一组件导入多个 scoped 资源时提示书写顺序可能互相覆盖）。

## 在项目里使用

```ts
// vite.config.ts —— 注意：jsxScoped 必须排在 react() 之前
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import jsxScoped from '@10coding/vite-plugin-jsx-scoped'

export default defineConfig({
  plugins: [jsxScoped({ warnMultiScopedImport: true }), react()],
  css: {
    preprocessorOptions: {
      scss: { additionalData: '$brand: #4f46e5;\n' }, // 照常生效
    },
  },
})
```

组件侧写法：

```tsx
// src/demo/demo.tsx
import './demo.scoped.scss' // 命名约定触发 scoped

export default function Demo() {
  return (
    <section className="demo">
      <h2 className="demo__title">标题</h2>
      {/* 内联 scoped 样式同样支持 */}
      <style scoped>{`.demo__tip { color: teal; }`}</style>
    </section>
  )
}
```

### 类型声明（消除 `*.scoped.*` 导入的 TS2307）

`*.scoped.scss` 等命名约定没有内置 TS 声明，在 tsconfig `types` 引入本插件自带的
模块声明文件即可（可选配合 `noUncheckedSideEffectImports` 严格检查）：

```jsonc
{
  "compilerOptions": {
    "types": ["vite/client", "@10coding/vite-plugin-jsx-scoped/client"],
    "noUncheckedSideEffectImports": true
  }
}
```

```scss
// src/demo/demo.scoped.scss —— 编译后每条选择器都追加 [data-v-<hash>]
.demo {
  &__title { color: $brand; }
  &:hover { box-shadow: ...; }
  @media (max-width: 640px) { padding: 12px; }
}
@keyframes pulse { from { opacity: 1; } to { opacity: 0.5; } } // keyframes 帧选择器不会被追加
```

## 内联 `<style scoped>` 样式隔离用法

内联样式与外部 `*.scoped.*` 完全等价：同样以组件文件路径生成 scope hash；
`<style scoped>` 标签会在编译期被**提取并移除**（不会渲染成真实 `<style>` 节点），
样式由 Vite css 管线注入（dev 注入 + HMR、build 抽取进 css 产物）。

```tsx
export default function Demo() {
  return (
    <section className="demo">
      {/* 写法一：纯 css —— 不需要写 lang */}
      <style scoped>{`
        .demo__tip { color: teal; }
        .demo__tip::before { content: '◆ '; }
      `}</style>

      {/* 写法二：scss 嵌套 —— 必须声明 lang="scss" */}
      <style scoped lang="scss">{`
        .panel {
          padding: 8px;
          .panel__title { font-weight: 700; } // 嵌套由 sass 先编译展开
          &:hover { border-color: #4f46e5; }
        }
      `}</style>

      {/* 写法三：less */}
      <style scoped lang="less">{`
        @brand: #0ea5e9;
        .badge { color: @brand; }
      `}</style>
    </section>
  )
}
```

### 识别规则

| 写法 | 处理方式 |
| --- | --- |
| `<style scoped>` | ✅ 按 **css** 处理（lang 缺省） |
| `<style scoped lang="scss">` / `"sass"` / `"less"` / `"css"` | ✅ 先由对应预处理器编译成普通 CSS，再追加 `[data-v-{hash}]` |
| `<style ...>`（不带 `scoped`） | ❌ 不进入 scoped 流水线，原样留在 JSX 中 |
| `lang` 与 `scoped` 顺序任意、大小写不敏感 | ✅ |
| `lang={'scss'}`（表达式写法） | ⚠️ 不识别，会按 css 处理（lang 需为字符串字面量） |

### 约束

- **触发条件 = 属性名 `scoped` 存在**（与 Vue 布尔属性语义一致，不看值）。
  请直接写 `scoped`，不要写 `scoped={false}`——属性存在即视为开启。
- 内容必须为**静态文本**：直接写文本，或用 `{'字符串'}` / 无插值模板字符串包一层；
  含 JS 表达式插值会在构建期直接报错。
- 同一组件里外部 `*.scoped.*` 与内联 `<style scoped>` 可以混用，全部复用同一
  `data-v-{hash}`；当 scoped 资源超过 1 个时输出书写顺序/优先级互相覆盖的
  构建警告（`warnMultiScopedImport: false` 可关）。
- `lang` 决定预处理方式：`scss`→sass、`sass`→sass 缩进语法、`less`→less，
  未知/缺省一律按 css。

## 处理流程（分阶段）

| 阶段 | 输入 | 动作 | 输出 |
| --- | --- | --- | --- |
| 1. Vite transform 扫描 | tsx/jsx 源码 + 文件绝对路径 | 匹配 `*.scoped.(css\|scss\|sass\|less)` 导入、扫描 `<style scoped>`；命中即用 **md5(组件文件路径)** 前 8 位生成 `data-v-{hash}` 并登记 | 标记开启 + ComponentScopeInfo |
| 2. Babel 插件（@10coding/plugin-jsx-scoped） | JSX AST + 组件路径/scopeAttr | 给 JSX DOM 元素注入 `data-v-{hash}`；自定义组件默认注入 `<Child scopedId="data-v-{hash}">`（组件 scoped，可关闭）；跳过 Fragment、文本、`<style>`；同名属性覆盖 | 修改后的 JSX AST |
| 3. 样式编译（Vite 插件 load） | 样式资源 + ComponentScopeInfo | scss/sass → sass；less → less；css 直用；**先编译成普通 CSS** | 纯 CSS |
| 4. PostCSS 插件（@10coding/postcss-jsx-scoped） | CSS AST + scopeAttr | 每条普通选择器末尾追加 `[data-v-{hash}]`；@media/@supports 内正常；@keyframes 帧、@page 不追加；伪元素保持在属性之后 | 最终 scoped CSS |

> 在 Vite 中，第 3、4 步由 `@10coding/vite-plugin-jsx-scoped` 的虚拟 css 模块完成：
> 组件里的 scoped 导入被改写到虚拟模块，load 阶段读原文件 → 预处理 → 交给
> postcss 插件追加属性 → 以普通 `.css` 模块交还 Vite css 管线
> （dev 注入 + HMR、build 抽取 css 产物均由 Vite 原生完成）。

## 数据对象

```ts
interface ComponentScopeInfo {
  componentFilePath: string // tsx 组件绝对路径
  scopeHash: string         // md5(路径) 前 8 位
  scopeAttr: string         // 完整属性名 data-v-xxxxxxxx
  styleResources: Array<{
    type: 'external-file' | 'inline-style'
    filePath?: string            // 外部样式磁盘路径
    inlineStyleContent?: string  // 内联样式源码文本
    lang?: 'css' | 'scss' | 'sass' | 'less'
  }>
}

// vite 插件内部：Map<组件绝对路径, ComponentScopeInfo> + Map<css路径, 归属组件>
```

## 边界条件与异常处理

1. **一个组件多个 scoped 资源**：全部复用同一个由组件路径生成的 hash；
   默认输出构建 warning（可 `warnMultiScopedImport: false` 关闭），提示注意
   css 书写顺序 / 选择器优先级导致的规则覆盖。
2. **多个组件导入同一份 scoped 样式**：构建抛错
   （`scoped 样式文件被多个组件共享`），`*.scoped.*` 属于组件私有资源。
3. **@import 引入的外部样式**：不会自动追加 scope hash（与 Vue scoped 行为一致；
   scss/less 里的 `@import` 由编译器内联时同样不追加）。
4. **没有开启标记的组件**：跳过全部流程，源码零改动。
5. **内联 `<style scoped>` 无 lang**：按 css 处理。

## 配置项（vite 插件）

```ts
interface JsxScopedViteOptions {
  /** 是否开启「一个组件导入多个 scoped 样式资源」的覆盖风险警告，默认 true */
  warnMultiScopedImport?: boolean
  /** scope hash 位数，默认 8 */
  scopeHashLength?: number
  /** 组件 scoped：默认 true。给自定义组件注入 <Child scopedId="data-v-{hash}"> */
  componentScoped?: boolean
  /** 注入到自定义组件标签上的属性名，默认 'scopedId' */
  scopedIdAttributeName?: string
}
```

## 各包文档

- [packages/babel/README.md](./packages/babel/README.md) —— Babel 插件（注入）
- [packages/postcss/README.md](./packages/postcss/README.md) —— PostCSS 插件（追加选择器）
- [packages/vite/README.md](./packages/vite/README.md) —— Vite 插件（编排）

## 组件 scoped（child-root 继承，默认自动开启）

自定义组件标签默认注入 `<Child scopedId="data-v-<parentHash>">`（可用
`componentScoped: false` 整体关闭）。子组件**如果需要**继承父级 scope，
自行读取 scopedId 并绑定到自身根元素：

```tsx
// Child.tsx —— 需要继承父级 scope 时手动绑定（可选，零成本）
export default function Child({ scopedId }: { scopedId?: string }) {
  return <div className="child-root" {...(scopedId ? { [scopedId]: '' } : {})}>…</div>
}
```

```scss
// 父组件 demo.scoped.scss —— .child-root 选择器会被追加父级 [data-v-…]
.child-root { border-left: 4px solid #4f46e5; }
```

这样父组件的 scoped 样式可以命中子组件根元素（同 Vue scoped 的 child-root
语义；子组件内部其它 DOM 仍由子组件自身 scope 决定）。

## 已知限制（v1）

- 样式隔离只作用于「本文件里书写的 JSX 元素」。跨文件组件内部 DOM 默认不带
  父组件 scope 属性；需要时用上面的 `scopedId` 手动把父级 scope 绑到子组件
  **根元素**（React 无法像 Vue 那样自动透传，因此由用户按需绑定）。
- 内联 `<style scoped>` / scoped css 文件里的相对 `url(...)`、css `@import`
  以虚拟模块路径为基准，可能无法正确解析；**推荐资源引用走绝对路径或经
  Vite 资源管线处理**（scss/less 的 `@import` 由编译器内联，不受影响）。
- 内联 `<style scoped>` 内容需为静态文本（不支持 JS 表达式插值），
  `lang` 需为字符串字面量（如 `lang="scss"`）。
- scope 属性在 dev 与 build 行为一致（都会照常注入）。

## License

MIT
