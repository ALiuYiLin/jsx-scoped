---
'@10coding/plugin-jsx-scoped': minor
'@10coding/postcss-jsx-scoped': minor
'@10coding/vite-plugin-jsx-scoped': minor
---

首次发布：面向 JSX/TSX（React 等）的 Vue-like scoped 样式工具链。

- `@10coding/plugin-jsx-scoped`（babel）：以组件文件绝对路径 md5 截前 8 位生成 `data-v-{hash}`；
  DOM 元素注入 `data-v-{hash}`；自定义组件默认注入 `scopedId="data-v-{hash}"`（组件 scoped，
  child-root 由子组件按需手动绑定，可用 `componentScoped: false` 关闭）；同名属性覆盖、幂等。
- `@10coding/postcss-jsx-scoped`（postcss）：普通选择器末尾追加 `[data-v-{hash}]`；
  `@media/@supports/@layer` 内规则正常追加，`@keyframes` 帧选择器与 `@page` 不追加，
  伪元素保持在属性选择器之后；已含同属性时跳过（幂等）。
- `@10coding/vite-plugin-jsx-scoped`（vite）：识别 `*.scoped.{css,scss,sass,less}` 导入与
  内联 `<style scoped>`（含 `lang="scss"/"less"/...`，缺省按 css）；预处理器先编译为普通 CSS
  再交由 postcss 追加 scope 属性；同一组件多资源复用同一 hash 并输出覆盖风险警告；
  同一 scoped 样式文件被多个组件导入时构建报错；dev 注入 + HMR / build 抽取 css 产物均由
  Vite 原生管线完成；`css.preprocessorOptions.*.additionalData` 照常生效；
  附带 `client.d.ts` 模块声明（`types: ["@10coding/vite-plugin-jsx-scoped/client"]`）解决
  `*.scoped.*` 导入的 TS2307。
