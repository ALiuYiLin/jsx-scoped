---
title: 快速开始
description: 安装与接入 jsx-scoped —— vite 插件顺序、tsconfig 类型声明、第一个 scoped 组件与内联样式
---

# 快速开始

jsx-scoped 给 **JSX/TSX（React 等）** 提供 Vue-like 的组件级样式隔离：把组件文件
绝对路径哈希成 `data-v-{hash}`，JSX 元素自动带上该属性，`*.scoped.*` / 内联
`<style scoped>` 编译后选择器追加 `[data-v-{hash}]`，规则只命中本组件 DOM。

仓库内三个 npm 包分层协作：

| 包 | 职责 |
| --- | --- |
| `@10coding/plugin-jsx-scoped` | JSX 侧：分析 + hash 工具 + Babel 注入插件 |
| `@10coding/postcss-jsx-scoped` | CSS 侧：选择器追加 `[data-v-{hash}]` |
| `@10coding/vite-plugin-jsx-scoped` | 编排：transform / 虚拟 css 模块 / 预处理器 / HMR / 可编程 `JsxScopedPipeline` |

特性速览：

- 自动注入：DOM 元素 → `data-v-{hash}=""`；自定义组件 → `scopedId`（child-root 继承）
- `direct-scoped`：变量当原生标签的大写组件按 DOM 处理
- 外部 `*.scoped.{css,scss,sass,less}` 与内联 `<style scoped>` 双写，同组件共享一把 hash
- 同一 `*.scoped.*` 被两个组件导入 → 构建报错（私有资源）
- scss/sass/less 先编译成普通 CSS 再追加属性，绝不改写源文件
- 虚拟 css 模块交给 Vite 原生管线：dev 注入 + HMR + build 产物

## 安装

```bash
pnpm add -D @10coding/vite-plugin-jsx-scoped
```

依赖会自动带上 babel / postcss 两包；单独使用它们亦可按需安装
（见 [API 参考](/reference/api)）。

## 接入 Vite

```ts
// vite.config.ts —— 注意顺序：jsxScoped() 必须排在 react()/solid() 等 JSX 编译插件之前
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import jsxScoped from '@10coding/vite-plugin-jsx-scoped'

export default defineConfig({
  plugins: [jsxScoped(), react()]
})
```

## TS 类型声明

`*.scoped.scss` 这类导入需要模块声明，否则 TS 报 `Cannot find module`：

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "types": ["vite/client", "@10coding/vite-plugin-jsx-scoped/client"]
  }
}
```

## 第一个组件

```tsx
import './demo.scoped.scss' // 选择器会被追加 [data-v-{hash}]

export default function Demo({ title }: { title: string }) {
  return (
    <section className="demo">
      <h2 className="title">{title}</h2>
      {/* 自动注入 data-v-{hash}=""；.title 规则只命中这里 */}
    </section>
  )
}
```

```tsx
// 内联写法：lang 默认 css，可 scss/sass/less
export default function Demo() {
  return (
    <div className="card">
      <style scoped>{`.card { border: 1px solid #4f46e5 }`}</style>
      card…
    </div>
  )
}
```

更完整的用法见 [功能与用法](/guide/usage)，底层机制见 [原理](/guide/architecture)。

## 本地体验

本仓库自带两个示例（`playground/react`、`playground/solid`，后者验证框架无关性）：

```bash
pnpm demo         # React 示例
pnpm demo:solid   # Solid 示例
```
