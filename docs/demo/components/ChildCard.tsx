import './child-card.scoped.css'

export default function ChildCard() {
  return (
    // 类名与父组件相同（.card），但 hash 属于本文件 —— 同名类各自隔离
    <div className="card">
      <p className="card__name">2. ChildCard 自带 scoped</p>
      <p className="card__desc">
        同名 .card，样式来自本组件的 child-card.scoped.css
        （.card[data-v-子hash]），父的 .card 规则命中不了这里。
      </p>
    </div>
  )
}
