/**
 * @10coding/plugin-jsx-scoped 的插件配置。
 *
 * scope 属性名优先级：
 *   1. scopeAttr（显式给定完整属性名）
 *   2. scopeHash + SCOPE_ATTR_PREFIX（data-v- 前缀由插件拼）
 *   3. componentFilePath → md5 截前 hashLength 位 → data-v-{hash}（默认路径）
 */
export interface JsxScopedBabelOptions {
  /**
   * 组件文件绝对路径（.tsx/.jsx）。
   * 未显式传 scopeAttr/scopeHash 时，用它计算 data-v-{hash}。
   */
  componentFilePath?: string
  /** 完整 scope 属性名，如 'data-v-3f2a9c1d'。优先于其它来源。 */
  scopeAttr?: string
  /** 仅 hash 部分，如 '3f2a9c1d'，插件会自动拼 data-v- 前缀。 */
  scopeHash?: string
  /** hash 位数，默认 8（仅当由 componentFilePath 计算时生效） */
  hashLength?: number
  /**
   * 是否也向自定义组件标签（如 <Foo />、<UI.Button />）注入属性。
   * 默认 false：只注入到真实 DOM 元素标签（小写开头，如 div/span/svg）。
   */
  addToComponents?: boolean
}

/** babel 插件会注入的最小 api 形状（避免对外依赖 @babel/core 类型） */
export interface JsxScopedBabelApi {
  assertVersion?: (range: string | number) => void
  types?: {
    jsxIdentifier(name: string): unknown
    stringLiteral(value: string): unknown
    jsxAttribute(name: unknown, value?: unknown): unknown
  }
}

/** babel 插件对象的最小编码形状 */
export interface JsxScopedBabelPlugin {
  name: string
  visitor: Record<string, unknown>
}

/** 简单样式语言（为后续 postcss/vite 包预留） */
export type ScopedStyleLang = 'css' | 'scss' | 'sass' | 'less'
