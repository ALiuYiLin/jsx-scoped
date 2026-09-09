---
title: 功能与用法
description: jsx-scoped 用法细节 —— 组件 scoped（scopedId child-root）、direct-scoped 变量标签、外部 scoped 导入与内联 <style scoped>、CSS 规则边界
---

# 功能与用法

## 组件 scoped（child-root 继承）

自定义组件不会被直接注入 `data-v-*`（那只是普通 props），而是注入
`scopedId="data-v-{hash}"`。子组件**如果需要**继承父级 scope（让父组件 scoped
样式能命中子组件根元素），自行读取并把该属性绑到根元素上：

```tsx
// Child.tsx
export default function Child({ scopedId }: { scopedId?: string }) {
  return <div className="child-root" {...(scopedId ? { [scopedId]: '' } : {})}>…</div>
}
```

```scss
/* demo.scoped.scss —— 选择器被追加 [data-v-{hash}]，可命中上面的 child-root */
.child-root { border-left: 4px solid #4f46e5; }
```

- 默认开启；`componentScoped: false` 整体关闭（组件标签不再注入任何属性）；
- 属性名可用 `scopedIdAttributeName` 配置；
- 已存在同名属性时自动覆盖，不会重复添加。

## 变量当标签：`<Comp direct-scoped />`

当大写组件在**运行时其实是原生 DOM 标签**时（如变量持有 `'a'/'button'`），
scopedId 语义不适用。加一个 marker 让插件按普通 DOM 元素处理——直接注入
`data-v-{hash}=""`、不再注入 scopedId；marker 是编译期指令，会从产物中移除。

```tsx
const Comp: any = tag || (href ? 'a' : 'button')

export default function Demo() {
  return <Comp direct-scoped className="vp-button">按钮</Comp>
}
// 产物 ≈ <Comp data-v-xxxxxxxx="" className="vp-button">…</Comp>（无 direct-scoped）
```

- 大写组件、成员表达式组件（`<UI.Button direct-scoped />`）均可；
- 原生标签上写 marker 无意义，静默忽略并移除；
- 属性名可用 `directScopedAttributeName` 配置；
- 强类型组件会对未知 marker 属性报 TS 错——面向 `any`/宽松 props 的变量标签场景。

## 样式来源一：外部 `*.scoped.*` 导入

```tsx
import './a.scoped.css'
import './b.scoped.scss'
```

- 仅 `*.scoped.{css,scss,sass,less}` 参与 scope（其余样式文件按 Vite 常规处理）；
- 一个组件可导入多份，与内联块**共享同一把 hash**；多份外部文件会触发
  `warnMultiScopedImport` 警告（默认开），提示覆盖风险；
- **同一份文件被两个不同组件导入 → 构建报错**（组件私有资源）。

## 样式来源二：内联 `<style scoped>`

```tsx
export default function Demo() {
  return (
    <div className="wrap">
      <style scoped>{`.wrap { padding: 1rem }`}</style>
      <style scoped lang="scss">{`.btn { &:hover { opacity: .9 } }`}</style>
    </div>
  )
}
```

- 属性存在即生效（布尔语义，同 Vue）；`lang` 只认字符串字面量（默认 css）；
- 内容只支持静态文本；含 JSX 表达式会报错；
- 组件内可写多个内联块；所有块共享组件 hash。

## CSS 追加规则与边界

- 规则选择器末尾追加属性（逗号列表逐段追加）；`@media/@supports/@layer/@container`
  内正常生效；
- **伪元素保持在属性之后**：`.btn::before` → `.btn[data-v-x]::before`；
- `@keyframes` 帧选择器、`@page` 不追加；`@import` 原样保留；
- 选择器已含同一属性时跳过（幂等）；
- scss/less 的 `@import` 由预处理器内联展开后再追加，同样命中 scope。

## 注意

- 隔离只作用于「本文件书写的 JSX 元素」；跨文件组件内部 DOM 默认不带父级 scope，
  需要时用 `scopedId` 手动继承；
- 全局样式（普通 `<style>` / 非 `.scoped.*` 文件）不受本工具影响。

配置项与完整 API 见 [API 参考](/reference/api)。
