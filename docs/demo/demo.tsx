import ChildCard from './components/ChildCard'
import GlobalCard from './components/GlobalCard'
import InheritCard from './components/InheritCard'

// 父组件的外部 scoped scss（命名约定 *.scoped.scss）——hash 由 demo.tsx 的绝对路径生成
import './demo.scoped.scss'

export default function Demo() {
  return (
    <section className="demo">
      <h2 className="demo__title">同名 .card：scoped / 继承 / 全局</h2>

      <div className="demo__row">
        {/* 卡片 1：结构直接写在父组件里 —— 命中父的 .card[data-v-父hash] */}
        <div className="card">
          <p className="card__name">1. 父组件内直写 card</p>
          <p className="card__desc">
            结构写在 demo.tsx 中，DOM 带父组件 hash；样式来自父的 demo.scoped.scss
            里同名 .card，只作用于本文件。
          </p>
        </div>

        {/* 卡片 2/3/4：子组件。父组件会在大写组件标签上注入 scopedId="data-v-<父hash>"，
            是否使用（绑定到自己的 DOM）由子组件决定 */}
        <ChildCard />
        <InheritCard />
        <GlobalCard />
      </div>
    </section>
  )
}
