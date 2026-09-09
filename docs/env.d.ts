// docs 专用全局类型补充（见 docs/tsconfig.json 的 include）

// 主题样式等普通 .css 副作用导入（vite 运行时处理；此处仅让 TS 认识模块）
declare module '*.css' {
  const css: string
  export default css
}
