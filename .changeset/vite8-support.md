---
'@10coding/vite-plugin-jsx-scoped': minor
---

声明支持 Vite 8（Rolldown 内核）

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
