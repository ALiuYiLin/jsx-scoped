/**
 * @10coding/vite-plugin-jsx-scoped/client —— 模块声明（类型）
 *
 * 让 TypeScript 识别 `*.scoped.{css,scss,sass,less}` 这类命名约定的样式导入，
 * 避免 "Cannot find module './xxx.scoped.scss'" (TS2307) 报错。
 *
 * 使用方式（二选一）：
 *
 * 1) tsconfig.json 的 types 字段：
 * ```jsonc
 * {
 *   "compilerOptions": {
 *     "types": ["@10coding/vite-plugin-jsx-scoped/client"]
 *   }
 * }
 * ```
 *
 * 2) 三斜线引用：
 * ```ts
 * /// <reference types="@10coding/vite-plugin-jsx-scoped/client" />
 * ```
 *
 * 建议同时开启 TS 5.6+ 的严格副作用导入检查，让这类声明真正被用到：
 * ```jsonc
 * { "compilerOptions": { "noUncheckedSideEffectImports": true } }
 * ```
 */

declare module '*.scoped.css' {
  const css: string
  export default css
}

declare module '*.scoped.scss' {
  const css: string
  export default css
}

declare module '*.scoped.sass' {
  const css: string
  export default css
}

declare module '*.scoped.less' {
  const css: string
  export default css
}
