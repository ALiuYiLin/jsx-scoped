import './card.scoped.less'

export default function Card() {
  return (
    <div class="card-scoped card-scoped--primary">
      <div class="card-scoped__name">Card 组件</div>
      <div class="card-scoped__desc">来源：card.scoped.less（less 嵌套编译）</div>
    </div>
  )
}
