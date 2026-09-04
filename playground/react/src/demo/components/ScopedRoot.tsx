interface ScopedRootProps {
  label: string
  /** 组件 scoped：父组件自动注入 scopedId="data-v-<parentHash>" */
  scopedId?: string
}

/**
 * 演示「组件 scoped」的 child-root 绑定：
 * 父组件（demo.tsx）会在 <ScopedRoot> 标签上注入 scopedId="data-v-xxxx"。
 * 子组件如果需要继承父级 scope（让父组件 scoped 样式能命中本组件根元素），
 * 由用户自行读取该 prop 并绑定到根元素上 —— 本组件根 div 因此会带上父级
 * 的 data-v-xxxx 属性，demo.scoped.scss 里的 .scoped-root 规则才能命中它。
 */
export default function ScopedRoot({ label, scopedId }: ScopedRootProps) {
  return (
    <div className="scoped-root" {...(scopedId ? { [scopedId]: '' } : {})}>
      <span className="scoped-root__label">{label}</span>
    </div>
  )
}
