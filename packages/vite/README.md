# @10coding/vite-plugin-jsx-scoped

Vite 主入口插件：为 React/Preact 等 JSX 框架提供 **Vue-like scoped 样式隔离**。

## 安装

```bash
pnpm add -D vite @10coding/vite-plugin-jsx-scoped
# 可选：用到 scss/sass / less 时安装对应编译器
pnpm add -D sass less
```

> 内部依赖 `@10coding/plugin-jsx-scoped`（注入 `data-v-*`）与
> `@10coding/postcss-jsx-scoped`（选择器追加 `[data-v-*]`），会随本包自动安装。

## 用法

```ts
// vite.config.ts —— jsxScoped 必须在 react()/preact() 之前！
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import jsxScoped from '@10coding/vite-plugin-jsx-scoped'

export default defineConfig({
  plugins: [jsxScoped({ warnMultiScopedImport: true }), react()],
})
```

## 触发 scoped 的两种标记

1. 导入命名约定样式文件：`*.scoped.css`、`*.scoped.scss`、`*.scoped.sass`、`*.scoped.less`
2. JSX 内联标签：`<style scoped>`（lang 缺省按 css）

```tsx
import './demo.scoped.scss'
export default function Demo() {
  return (
    <section className="demo">
      <span className="demo__tip">ok</span>
      <style scoped>{`.demo__tip { color: teal; }`}</style>
    </section>
  )
}
```

## 配置

```ts
interface JsxScopedViteOptions {
  /** 同一组件导入多个 scoped 资源时的覆盖风险警告，默认 true */
  warnMultiScopedImport?: boolean
  /** scope hash 位数（md5(组件绝对路径) 截取），默认 8 */
  scopeHashLength?: number
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

## 组件 scoped（child-root 继承）

默认开启。自定义组件标签会收到 `scopedId="data-v-<parentHash>"`，子组件
**按需**自行绑定到根元素，父组件 scoped 样式即可命中子组件根元素
（等价 Vue scoped 的 child-root 继承父级 scope id）：

```tsx
// Child.tsx —— 需要继承父级 scope 时手动绑定
export default function Child({ scopedId }: { scopedId?: string }) {
  return <div className="child-root" {...(scopedId ? { [scopedId]: '' } : {})}>…</div>
}
```

不需要继承的组件忽略该 prop 即可，零成本。

## 行为与边界

- 同一组件所有 scoped 资源共享同一 `data-v-{hash}`（种子 = 组件文件绝对路径）；
- **同一份 `*.scoped.*` 文件被多个组件导入 → 构建直接报错**（组件私有资源）；
- scss/less 里的 `@import` 由编译器内联，内联内容**不会**再被追加 scope
  （与 Vue scoped 一致）；`css.preprocessorOptions.*.additionalData` 照常生效；
- 未命中标记的组件完全跳过，源码不被改写；
- 内联 `<style scoped>` 必须是静态文本；组件热更新时联动刷新对应样式模块。

## 原理速览

组件 transform 阶段把 scoped 导入改写到「虚拟 css 模块」；
模块 load 阶段：读原始样式 → sass/less/css 编译为普通 CSS →
`@10coding/postcss-jsx-scoped` 追加 `[data-v-{hash}]` →
以普通 `.css` 模块交还 Vite css 管线（dev 注入 + HMR、build 抽取产物均由 Vite 完成）。

## 开发

```bash
pnpm --filter @10coding/vite-plugin-jsx-scoped build
pnpm demo   # 仓库根目录启动 React 示例
```

License: MIT
