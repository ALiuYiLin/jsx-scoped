# @10coding/plugin-jsx-scoped

## 0.2.0

### Minor Changes

- 29b320f: 「变量当标签」场景支持：大写组件标签在运行时会渲染成原生 DOM 标签时
  （如 `const Comp: any = tag || (href ? 'a' : 'button')`），可在标签上加 marker
  `<Comp direct-scoped />`，让 babel 插件把它当普通 DOM 元素处理——直接注入
  `data-v-{hash}=""`，不再注入 `scopedId`。
  
  - marker 是编译期指令，注入后从产物中移除（不泄漏为 prop/运行时属性）；
  - 支持大写组件与成员表达式组件（`<UI.Button direct-scoped />`）；
  - 属性名可配置：`directScopedAttributeName`（默认 `'direct-scoped'`，
    babel 与 vite 插件选项均已透传）；
  - 原生 DOM 标签上出现 marker 时静默忽略并移除。
