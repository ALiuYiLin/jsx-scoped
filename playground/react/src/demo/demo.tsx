import Card from './components/Card'
import Pill from './components/Pill'
import ScopedRoot from './components/ScopedRoot'

// 外部 scoped scss（命名约定 *.scoped.scss）——本文件用路径种子生成 scope hash
import './demo.scoped.scss'

export default function Demo() {
  return (
    <section className="demo">
      <h2 className="demo__title demo__pulse">同一个组件，多种 scoped 样式来源</h2>
      <p className="demo__desc">
        本组件导入了外部 <code>demo.scoped.scss</code>，并内联了一个{' '}
        <code>{'<style scoped>'}</code>，二者共享同一把{' '}
        <code>data-v-xxxxxxxx</code>（由 <code>demo.tsx</code> 绝对路径生成）。
      </p>

      <div className="demo__row">
        <Card />
        <Pill label="plain .css scoped" />
        {/* 组件 scoped：<ScopedRoot> 会被注入 scopedId="data-v-d875de6e"，
            子组件把 scopedId 绑到根元素后，demo.scoped.scss 的 .scoped-root
            规则才能命中它（左侧蓝色描边即父级 scope 生效的效果） */}
        <ScopedRoot label="Child 根元素绑定了父级 scopedId" />
      </div>

      <div className="demo__footer">
        <span className="demo__note">该文字颜色来自内联 <code>{'<style scoped>'}</code>。</span>
      </div>

      {/* 内联 scoped 样式（静态文本） */}
      <style scoped>{`
        .demo__footer {
          margin-top: 18px;
          padding-top: 12px;
          border-top: 1px dashed #cbd5e1;
        }
        .demo__note {
          color: #0d9488;
          font-size: 13px;
          font-weight: 600;
        }
        .demo__note::before {
          content: '◎ ';
        }
      `}</style>
    </section>
  )
}
