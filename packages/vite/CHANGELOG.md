# @10coding/vite-plugin-jsx-scoped

## 0.6.0

### Minor Changes

- fa19414: 声明支持 Vite 8（Rolldown 内核）
  
  `peerDependencies` 由 `^5.0.0 || ^6.0.0 || ^7.0.0` 放宽为
  `^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0`，并在 `playground/vue`（已固定到 vite 8.2.2）
  上实测：
  
  - dev：JSX 注入、SSR 渲染、`jsx-scoped-file:` / `jsx-scoped-inline:` 虚拟 css 模块、
    `resolve.alias` 解析 scoped 导入 —— 断言与 Vite 6.4.3 逐项一致；
  - HMR：修改 `*.scoped.css` → 虚拟模块失效 + ws `update`/`js-update` payload，
    与 Vite 6 完全相同；
  - build：Rolldown 产物照常追加 `[data-v-{hash}]`，
    `css.preprocessorOptions.scss.additionalData` 正常生效；`build --watch` 下
    `this.meta.watchMode` 仍为 `true`（`{ rolldownVersion, viteVersion, watchMode }`）；
  - 插件源码在 Vite 8 类型下 `tsc --noEmit` 通过。
  
  用到的 hook / 配置面（`resolveId` / `load` / `transform` / `configResolved` /
  `configureServer` / `closeBundle` / `handleHotUpdate`、`resolve.alias` /
  `css.preprocessorOptions` / `logger` / `moduleGraph`）在 Vite 8 中均未变更或移除。
  
  注意：产物 `d.ts` 仍以 **Vite 6 类型为编译基线**（`devDependencies.vite` 保持 `^6`）。
  Vite 8 的 rolldown `Plugin` 类型与 Vite 6/7 的 `hotUpdate` hook `this` 类型互不兼容
  （以 Vite 8 类型产出 d.ts 会让 Vite 6 消费者 `tsc` 报 TS2769），而 Vite 6 类型产出的
  d.ts 在 Vite 6 / 8 消费者下均可通过类型检查 —— 因此 peer 范围放宽、编译基线不动。
  Vite 8 自身要求 Node `^20.19.0 || >=22.12.0`。

## 0.5.0

### Minor Changes

- 5c306c1: 支持 vite `resolve.alias` 解析 scoped 样式导入
  
  外部 `*.scoped.{css,scss,sass,less}` 的 specifier 现在按 **vite 自身的解析顺序**
  处理：先 `resolve.alias`（字符串与正则写法均可，语义对齐 `@rollup/plugin-alias`：
  精确匹配或 `find/` 前缀），再相对/绝对路径。于是
  `import '@/components/pill.scoped.css'` 与 `./pill.scoped.css` 完全等价 ——
  生成同一个虚拟 css 模块，并且「同一份 css 只允许一个组件导入」按解析后的真实路径判定。
  
  插件在 `configResolved` 阶段读取同一份 `resolve.alias`，无需新增插件配置项。
  命中 alias 但文件不存在、以及裸包名导入不参与 scope，会给出更明确的
  「已跳过 scoped 化」警告（含解析尝试的绝对路径）。

## 0.4.1

### Patch Changes

- fb6c2ac: 自动清理(dev server close / build closeBundle)现在只作用于 `isolated: true` 的独占 registry。默认进程级单例可能与其它实例(如 vitepress-react 核心的 md 管线)共享,单个插件擅自 `dispose()` 会抹掉其它实例刚 transform 登记的内联样式,导致后续虚拟模块 load 扑空。显式传入 `options.registry` 时生命周期仍归调用方。
- Updated dependencies [43a1a05]
  - @10coding/postcss-jsx-scoped@0.2.0

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
