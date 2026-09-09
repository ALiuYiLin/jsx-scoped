---
"@10coding/vite-plugin-jsx-scoped": patch
---

自动清理(dev server close / build closeBundle)现在只作用于 `isolated: true` 的独占 registry。默认进程级单例可能与其它实例(如 vitepress-react 核心的 md 管线)共享,单个插件擅自 `dispose()` 会抹掉其它实例刚 transform 登记的内联样式,导致后续虚拟模块 load 扑空。显式传入 `options.registry` 时生命周期仍归调用方。
