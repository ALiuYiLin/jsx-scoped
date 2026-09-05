# @10coding/vite-plugin-jsx-scoped

Vite 主入口插件：为 React/Preact 等 JSX 框架提供 **Vue-like scoped 样式隔离**。

## 安装

```bash
pnpm add -D vite @10coding/vite-plugin-jsx-scoped
# 可选：用到 scss/sass / less 时安装对应编译器
pnpm add -D sass less
```

> 内部依赖 `@10coding/plugin-jsx-scoped`（注入 `data-v-*`）与
> `@10coding/postcss-jsx-scoped`（选择器追加 `[data-v-*]`），会随本包自动安装。

## 用法

```ts
// vite.config.ts —— jsxScoped 必须在 react()/preact() 之前！
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import jsxScoped from '@10coding/vite-plugin-jsx-scoped'

export default defineConfig({
  plugins: [jsxScoped({ warnMultiScopedImport: true }), react()],
})
```

## 类型声明：消除 `*.scoped.*` 导入报错（TS2307）

`*.scoped.scss` 这类命名约定没有内置 TS 声明，直接 `import './demo.scoped.scss'`
可能报 `Cannot find module './demo.scoped.scss' or its corresponding type declarations`。
本包附带模块声明文件，在 tsconfig 的 `types` 字段引入即可：

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "types": ["vite/client", "@10coding/vite-plugin-jsx-scoped/client"]
    // 可选：TS 5.6+ 开启副作用导入严格检查，让声明真正被用到
    // "noUncheckedSideEffectImports": true
  }
}
```

或者用三斜线引用：`/// <reference types="@10coding/vite-plugin-jsx-scoped/client" />`。

> 若项目已引入 `vite/client`，其 `*.scss` 等通配声明也能覆盖到 `demo.scoped.scss`；
> 本声明文件让**不依赖 vite/client** 的项目同样不再报错，且语义更精确
> （只声明 `*.scoped.{css,scss,sass,less}`）。

## 触发 scoped 的两种标记

1. 导入命名约定样式文件：`*.scoped.css`、`*.scoped.scss`、`*.scoped.sass`、`*.scoped.less`
2. JSX 内联标签：`<style scoped>`（lang 缺省按 css）

```tsx
import './demo.scoped.scss'
export default function Demo() {
  return (
    <section className="demo">
      <span className="demo__tip">ok</span>
      <style scoped>{`.demo__tip { color: teal; }`}</style>
    </section>
  )
}
```

## 配置

```ts
interface JsxScopedViteOptions {
  /** 同一组件导入多个 scoped 资源时的覆盖风险警告，默认 true */
  warnMultiScopedImport?: boolean
  /** scope hash 位数（md5(组件绝对路径) 截取），默认 8 */
  scopeHashLength?: number
  /**
   * 组件 scoped：默认 true。
   * 给自定义组件标签注入 <Child scopedId="data-v-{hash}">；
   * 设为 false 则自定义组件标签不被注入任何属性。
   */
  componentScoped?: boolean
  /** 注入到自定义组件标签上的属性名，默认 'scopedId' */
  scopedIdAttributeName?: string
  /** 「变量当标签」marker 属性名，默认 'direct-scoped' */
  directScopedAttributeName?: string
}
```

## 组件 scoped（child-root 继承）

默认开启。自定义组件标签会收到 `scopedId="data-v-<parentHash>"`，子组件
**按需**自行绑定到根元素，父组件 scoped 样式即可命中子组件根元素
（等价 Vue scoped 的 child-root 继承父级 scope id）：

```tsx
// Child.tsx —— 需要继承父级 scope 时手动绑定
export default function Child({ scopedId }: { scopedId?: string }) {
  return <div className="child-root" {...(scopedId ? { [scopedId]: '' } : {})}>…</div>
}
```

不需要继承的组件忽略该 prop 即可，零成本。

## 行为与边界

- 同一组件所有 scoped 资源共享同一 `data-v-{hash}`（种子 = 组件文件绝对路径）；
- **同一份 `*.scoped.*` 文件被多个组件导入 → 构建直接报错**（组件私有资源）；
- scss/less 里的 `@import` 由编译器内联，内联内容**不会**再被追加 scope
  （与 Vue scoped 一致）；`css.preprocessorOptions.*.additionalData` 照常生效；
- 未命中标记的组件完全跳过，源码不被改写；
- 内联 `<style scoped>` 必须是静态文本；组件热更新时联动刷新对应样式模块。

## 可编程复用（JsxScopedPipeline）

插件的编排逻辑被抽成可实例化的 `JsxScopedPipeline`（Vite 插件内部即用它），
可脱离 Vite hook 直接复用——典型场景：把「md 页面生成的 TSX 文本」按组件处理，
`componentFilePath` 直接传 md 绝对路径即可（不要求是真实 JSX 文件，也不会读磁盘）：

```ts
import { createJsxScopedPipeline } from '@10coding/vite-plugin-jsx-scoped'

const pipeline = createJsxScopedPipeline()

// md → TSX 文本（含 <style scoped>）
const result = pipeline.transform(tsxText, '/abs/path/page.md')
// => { enabled, code, map, warnings, scopeAttr, scopeHash, virtualIds }

// 内联样式已在 transform 时登记：load 优先取登记内容，不依赖磁盘
const css = await pipeline.load(result.virtualIds[0]) // 已追加 [data-v-{hash}]
```

要点：

- `transform(code, componentFilePath, parserFilename?)`：md 路径缺省会按 TSX 语法
  解析；`parserFilename` 可在组件路径与实际语法来源不一致时显式指定；
- 返回 `warnings: string[]`（多资源覆盖、无法解析的导入、解析失败等提示），
  绑定 Vite config 时同时写入 `config.logger`，编程式调用方可只消费返回值；
- 解析失败时 `enabled=false` 且带 `parseError` 字段；
- `virtualIds` 不含 `\0` 前缀，可用导出的 `parseVirtualId(id)` 反解成
  `{ kind: 'file'|'inline', cssRealPath/componentFilePath, index }`；
- **实例状态即会话状态，存在可共享的 registry 中**：内联样式登记、scoped 文件
  归属、HMR 失效映射、提示去重统一存放在 `JsxScopedRegistry` 内。请对共享同一
  registry 的实例传入唯一且稳定的 `componentFilePath`；
- **跨实例共享（进程级默认单例）**：未显式传 `registry` 且未开 `isolated` 的实例
  默认共享 `getDefaultJsxScopedRegistry()` 返回的进程级单例，因此「编译管线 A
  的 `transform` 登记的内联样式」可被「另一插件实例 B 的 `load`」直接读取——这是
  md→TSX 等生成代码场景下、核心编译管线与站点 Vite 插件分处不同插件上下文时的
  协作基础：
  ```ts
  import {
    createJsxScopedPipeline,
    createJsxScopedRegistry,
  } from '@10coding/vite-plugin-jsx-scoped'

  // A: 编译管线（例如 vitepress md → TSX）
  const core = createJsxScopedPipeline() // 共享默认单例
  const { code, virtualIds } = core.transform(tsxText, '/abs/path/page.md')

  // B: 站点 Vite 插件（同一进程内的另一实例）——无需同实例即可 load
  const site = createJsxScopedPipeline() // 共享同一默认单例
  const css = await site.load(virtualIds[0])
  ```
- **需要隔离时**：传 `registry: createJsxScopedRegistry()`（自建一份全新状态，
  可与其它实例显式共享同一份），或开 `isolated: true`（本实例独占全新状态，
  适合并行测试/多份互不干扰的编译）。优先级：`registry` > `isolated` > 默认单例；
- **会话结束请清理**：registry 持有全部会话状态（文件归属 / HMR 失效映射 /
  内联登记 / 提示去重），默认不自动清空。Vite 插件会在 dev server `close` 与
  单次 build（`closeBundle`，watch 模式除外）后自动 `dispose()` 其**自建**的
  registry（显式传入 `options.registry` 时生命周期归调用方，插件不自动清理）。
  编程式/测试场景在 teardown 手动调用 `pipeline.registry.reset()`（`dispose()`
  是语义别名）。清空后旧虚拟 id 无法 load（得到友好错误）；Map/Set 引用保留，
  实例可继续复用。注意：仅在没有其它活跃会话共享同一 registry 时清理；
- 外部的 css 产物若要享受 dev 注入 + HMR + build 抽取，需让产物代码 import 上述
  `virtualIds`，且本插件在该 Vite 应用中以相同选项注册（`resolveId`/`load`
  由它提供）。

## 原理速览

组件 transform 阶段把 scoped 导入改写到「虚拟 css 模块」；
模块 load 阶段：读原始样式 → sass/less/css 编译为普通 CSS →
`@10coding/postcss-jsx-scoped` 追加 `[data-v-{hash}]` →
以普通 `.css` 模块交还 Vite css 管线（dev 注入 + HMR、build 抽取产物均由 Vite 完成）。

## 开发

```bash
pnpm --filter @10coding/vite-plugin-jsx-scoped build
pnpm demo   # 仓库根目录启动 React 示例
```

License: MIT
