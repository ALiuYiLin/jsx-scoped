---
'@10coding/vite-plugin-jsx-scoped': minor
---

- 抽出可复用的 `JsxScopedPipeline` / `createJsxScopedPipeline`:可对任意 TSX 文本执行
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
