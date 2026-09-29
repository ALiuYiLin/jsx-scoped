---
'@10coding/vite-plugin-jsx-scoped': minor
---

支持 vite `resolve.alias` 解析 scoped 样式导入

外部 `*.scoped.{css,scss,sass,less}` 的 specifier 现在按 **vite 自身的解析顺序**
处理：先 `resolve.alias`（字符串与正则写法均可，语义对齐 `@rollup/plugin-alias`：
精确匹配或 `find/` 前缀），再相对/绝对路径。于是
`import '@/components/pill.scoped.css'` 与 `./pill.scoped.css` 完全等价 ——
生成同一个虚拟 css 模块，并且「同一份 css 只允许一个组件导入」按解析后的真实路径判定。

插件在 `configResolved` 阶段读取同一份 `resolve.alias`，无需新增插件配置项。
命中 alias 但文件不存在、以及裸包名导入不参与 scope，会给出更明确的
「已跳过 scoped 化」警告（含解析尝试的绝对路径）。
