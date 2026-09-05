---
'@10coding/vite-plugin-jsx-scoped': minor
---

支持跨实例共享会话级状态:新增 `JsxScopedRegistry`(cssOwners / virtualModulesByCss / inlineModulesByComponent / inlineSourcesByComponent / warnedKeys)、`createJsxScopedRegistry()` 与进程级默认单例 `getDefaultJsxScopedRegistry()`。

配置项新增 `registry?: JsxScopedRegistry`(显式共享同一份状态)与 `isolated?: boolean`(默认 `false`;开启后使用全新独立 registry)。未显式传 `registry` 且未开 `isolated` 的实例默认共享同一进程级单例,使「编译管线 A 的 transform 登记的内联样式」可被「站点插件 B 的虚拟 css load」读取——这是 md→TSX 等生成代码场景下跨插件上下文协作的基础。

优先级:`registry` > `isolated: true`(全新) > 进程级默认单例。
