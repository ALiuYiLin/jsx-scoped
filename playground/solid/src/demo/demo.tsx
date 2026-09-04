import DemoChild from './components/DemoChild'

// 外部 scoped scss（命名约定 *.scoped.scss）——Solid 下同样有效
import './demo.scoped.scss'

export default function Demo() {
  return (
    <section class="demo">
      <h2 class="demo__title demo__pulse">Solid 组件：外部 scss + 内联 scss</h2>
      <p class="demo__desc">
        本组件导入了外部 <code>demo.scoped.scss</code> 并内联了一个{' '}
        <code>{'<style scoped lang="scss">'}</code>，两者共享同一把由{' '}
        <code>demo.tsx</code> 绝对路径生成的 <code>data-v-xxxxxxxx</code>。
      </p>

      <div class="demo__row">
        {/* 组件 scoped：<DemoChild> 会被注入 scopedId="data-v-<hash>"，
            子组件自行把 scopedId 绑到根元素后，父级 scoped 样式才能命中它 */}
        <DemoChild label="Solid Child 根元素绑定了父级 scopedId" />
      </div>

      <div class="demo__inline">
        <span class="demo__inline-note">
          该文字颜色来自内联 <code>{'<style scoped lang="scss">'}</code>。
        </span>
      </div>

      {/* 内联 scoped + lang="scss"（静态文本模板，无插值） */}
      <style scoped lang="scss">{`
        .demo__inline {
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px dotted #d6d3d1;
          .demo__inline-note {
            color: #b45309;
            font-size: 13px;
            font-weight: 600;
            &::before {
              content: '◈ ';
            }
          }
        }
      `}</style>
    </section>
  )
}
