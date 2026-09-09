---
title: 原理
description: jsx-scoped 工作原理 —— 双链路只在 hash 对齐、hash 种子、虚拟 css 模块 load 流程、预处理先于 scope、单归属校验与 HMR
---

# 原理

## 总览：两条链路只在 hash 上对齐

```
JSX 侧(transform)                         CSS 侧(虚拟模块 load)
─────────────────────                    ──────────────────────────
组件文件路径 ──md5→ data-v-{hash}        *.scoped.scss / <style scoped>
        │                                       │ 读源码 / 取登记内容
        │  Babel 注入：                        ▼
        │   DOM 元素 → data-v-{hash}=""   sass / less 先编译成普通 CSS
        │   组件标签 → scopedId=…         postcss-jsx-scoped 追加
        │   (或 direct-scoped → data-v)   [data-v-{hash}]
        ▼                                       ▼
    带上属性的 JSX ==================== 带 [data-v-{hash}] 的选择器
                          ↑ 同一把 hash，两处互不耦合
```

- **种子 = 组件文件绝对路径**（不是样式文件路径）：同一组件的全部 scoped 资源共用
  一把；不同文件路径 → 不同 hash → 互不泄漏。md 页面场景则是页面 md 文件路径。
- **JSX 侧**（`@10coding/plugin-jsx-scoped`）：命中 `.scoped.(css|scss|sass|less)`
  导入或 `<style scoped>` 即开启，由 Babel 完成「注入属性 + 提取样式」。
- **CSS 侧**（`@10coding/postcss-jsx-scoped`）：样式被改写为**虚拟 `.css` 模块**
  的 import，由 vite 插件 `load` 时处理（见下）。

## 虚拟 css 模块的 load 流程

1. 外部文件：读磁盘源码；内联样式：取 transform 时登记的内容（不回读组件文件）；
2. **预处理先于 scope**：scss/sass → sass（`compileStringAsync`）、less → less、
   css 直用，先产出**普通 CSS**（遵守 Vite 的 preprocessorOptions/additionalData，
   且绝不改 scss/less 源文件）；
3. `transformScopedCss` 追加 `[data-v-{hash}]`；
4. 以普通 `.css` 模块交还 Vite —— dev 注入 / HMR / build 抽 css 产物全部由
   **Vite 原生 css 管线**完成，无需自研注入与产物抽取。

虚拟 id 形态（不含 `\0`）：文件类 `jsx-scoped-file:<b64(css 路径)>:<b64(组件路径)>.css`、
内联类 `jsx-scoped-inline:<b64(组件路径)>:<index>.css`；结尾 `.css` 让 Vite 按普通
CSS 处理而不二次预处理。

## 为什么框架无关

属性注入是 **JSX AST 层面**的：DOM 元素加属性、大写组件加 `scopedId`、样式导入
改写为虚拟模块，全程不绑定某个框架运行时。因此 React / Solid / 任意 JSX 方言、
以及 md 生成的 TSX（`componentFilePath` 传 md 路径）都通用——仓库 `playground/solid`
即用于验证该性质。

## 为什么“多组件共享同一 scoped 文件”是错误

`*.scoped.*` 是**组件私有资源**：选择器只追加了组件 A 的 hash，若组件 B 也导入
同一文件，B 的 DOM 永远命中不了这些规则，还容易互相“借到”样式。transform 阶段
按 `cssRealPath → 归属组件` 登记并校验，发现第二个主人直接抛**构建错误**；
同一组件反复 transform（HMR）不误报。

## HMR 与会话状态（registry）

- 组件 / scoped 样式文件变更 → 按登记映射失效对应虚拟模块，dev 下样式随热更刷新；
- 内联登记、归属校验、HMR 失效映射、提示去重统一存放在 `JsxScopedRegistry`；
- 多实例默认共享**进程级单例**（跨插件上下文协作，如“编译管线 A 登记、站点插件 B
  load”）；可用 `registry` 显式共享或 `isolated: true` 隔离（优先级：
  `registry` > `isolated` > 默认单例）；
- registry 提供 `reset()` / `dispose()`：会话结束（dev server close / 单次 build /
  测试 teardown）清空状态，避免长驻进程里文件归属残留导致的误报与累积。
  Vite 插件会在 dev server `close` 与单次 build 后自动 dispose 其自建 registry；
  显式传入 `registry` 时生命周期归调用方。

## CSS 追加规则细节

- 规则选择器末尾追加属性（逗号列表逐段追加）；
- **伪元素保持在属性之后**：`.btn::before` → `.btn[data-v-x]::before`
  （旧式单冒号伪元素同规则处理）；
- `@keyframes` 帧选择器（`from`/`to`/百分比）、`@page` **不追加**；`@import` 保留；
- 选择器已含同一属性时跳过 → 幂等、可安全重复处理。
