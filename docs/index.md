---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "jsx-scoped"
  text: "Vue-like scoped styles for JSX/TSX"
  tagline: 组件级样式隔离工具链 —— React / Solid / 任意 JSX 应用通用（babel 注入 · postcss 追加 · vite 编排）
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: API 参考
      link: /reference/api

features:
  - title: 组件级 scoped 样式
    details: 组件文件路径 → data-v-{hash}，scoped 规则只命中本组件 DOM，不泄漏
  - title: 框架无关
    details: 纯 JSX AST 注入，React / Solid / md 生成的 TSX 通用
  - title: 组件 scoped 与 direct-scoped
    details: scopedId 实现 child-root 继承；变量当原生标签用 direct-scoped 按 DOM 处理
  - title: 三包分层
    details: plugin-jsx-scoped / postcss-jsx-scoped / vite-plugin-jsx-scoped
  - title: 虚拟 css 模块
    details: 交给 Vite 原生管线——dev 注入、HMR、build 产物全部开箱即用
  - title: 可编程复用
    details: JsxScopedPipeline + 会话 registry，可在任意生成代码场景单独调用
---
