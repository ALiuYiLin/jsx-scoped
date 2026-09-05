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
   * 组件 scoped：默认自动开启（true）。
   * 开启时给自定义组件标签（<Child />、<UI.Button />）注入
   * `<Child scopedId="data-v-{hash}">`：子组件需要时，可在自身根元素上
   * 手动绑定该属性（等价于 Vue scoped 的“子组件根元素继承父级 scope id”），
   * 父组件的 scoped 样式才能命中子组件根元素。
   *
   * 设为 false 可关闭：自定义组件标签不被注入任何属性。
   * @default true
   */
  componentScoped?: boolean
  /**
   * 注入到自定义组件标签上的属性名。
   * @default 'scopedId'
   */
  scopedIdAttributeName?: string
  /**
   * 「变量当标签」marker 属性名。
   *
   * 当大写组件标签实际渲染成原生 DOM 标签时（如
   * `const Comp: any = tag || (href ? 'a' : 'button')` 后写 `<Comp />`），
   * 在该标签上加 marker（默认 `<Comp direct-scoped />`）即可让插件把它当普通
   * DOM 元素处理：直接注入 `data-v-{hash}=""`，不再注入 scopedId。
   * marker 为编译期指令，会从产物中移除。
   * @default 'direct-scoped'
   */
  directScopedAttributeName?: string
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
