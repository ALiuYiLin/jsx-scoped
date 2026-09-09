interface InheritCardProps {
  /** 组件 scoped：父组件自动注入 scopedId="data-v-<父hash>" */
  scopedId?: string
}

export default function InheritCard({ scopedId }: InheritCardProps) {
  // 需要被父 scoped 样式命中的每个标签都带上父级 scopedId（逐层绑定原因见
  // 示例页 InheritCard 小节里的 ::: tip 警示）
  const inherit = scopedId ? { [scopedId]: '' } : {}

  return (
    <div className="card" {...inherit}>
      <p className="card__name" {...inherit}>3. InheritCard 全元素绑定父 scopedId</p>
      <p className="card__desc" {...inherit}>
        每个标签都带上父级 data-v，父的 .card__name / .card__desc 等内层规则也能命中。
      </p>
    </div>
  )
}
