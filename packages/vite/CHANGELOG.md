# @10coding/vite-plugin-jsx-scoped

## 0.4.0

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

### Patch Changes

- Updated dependencies [29b320f]
  - @10coding/plugin-jsx-scoped@0.2.0

## 0.3.0

### Minor Changes

- 56437bf: 支持跨实例共享会话级状态:新增 `JsxScopedRegistry`(cssOwners / virtualModulesByCss / inlineModulesByComponent / inlineSourcesByComponent / warnedKeys)、`createJsxScopedRegistry()` 与进程级默认单例 `getDefaultJsxScopedRegistry()`。
  
  配置项新增 `registry?: JsxScopedRegistry`(显式共享同一份状态)与 `isolated?: boolean`(默认 `false`;开启后使用全新独立 registry)。未显式传 `registry` 且未开 `isolated` 的实例默认共享同一进程级单例,使「编译管线 A 的 transform 登记的内联样式」可被「站点插件 B 的虚拟 css load」读取——这是 md→TSX 等生成代码场景下跨插件上下文协作的基础。
  
  优先级:`registry` > `isolated: true`(全新) > 进程级默认单例。
  
  会话生命周期:`JsxScopedRegistry` 新增 `reset()` / `dispose()`(清空全部会话状态,
  保留 Map/Set 引用,实例可继续复用)。Vite 插件在 dev server `close` 与单次 build
  (`closeBundle`,watch 模式除外)后自动 dispose 其自建 registry;显式传入
  `options.registry` 时生命周期归调用方,插件不自动清理。编程式/测试场景在
  teardown 手动调用,避免长驻进程中「文件删除/改名后的归属残留导致误报多组件
  共享」与状态累积。

## 0.2.0

### Minor Changes

- 561ea06: - 抽出可复用的 `JsxScopedPipeline` / `createJsxScopedPipeline`:可对任意 TSX 文本执行
    transform(显式传入 `componentFilePath`,例如 md 页面生成的 TSX),不要求文件真实存在;
    md 路径缺省按 TSX 语法解析(可用 `parserFilename` 覆盖);
  - 内联 `<style scoped>` 内容在 transform 时登记,虚拟 css `load` 优先读取登记内容,
    不再必须重读磁盘组件文件(便于外部管线集成);组件不再含 scoped 标记时自动清理登记;
  - transform 结果新增 `warnings: string[]`(多资源覆盖、无法解析的导入、解析失败等提示,
    绑定 Vite config 时同步写入 logger)与 `parseError?: string`(解析失败时 enabled=false);
  - 状态打磨:同一 css 的 HMR 失效映射每次 transform 重建、去重提示避免 HMR 刷屏;
    内联样式未命中登记且组件文件不存在时报友好错误;
  - 导出 `parseVirtualId`、`TransformScopedResult`、`FileVirtualId`、`InlineVirtualId`、
    `SourceMapLike` 等类型,`map` 与 Vite `ExistingRawSourceMap` 形状兼容;
    Vite 插件默认行为保持不变。
