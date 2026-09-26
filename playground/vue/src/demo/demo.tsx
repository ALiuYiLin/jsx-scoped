import Card from './components/Card'
import Pill from './components/Pill'
import ScopedRoot from './components/ScopedRoot'
import AutoScopedRoot from './components/AutoScopedRoot'

// 外部 scoped scss（命名约定 *.scoped.scss）——以组件文件（demo.tsx）绝对路径为种子
import './demo.scoped.scss'

export default function Demo() {
  return (
    <section class="demo">
      <h2 class="demo__title demo__pulse">Vue JSX：class 写法 + 全部 scoped 来源</h2>
      <p class="demo__desc">
        本组件导入了外部 <code>demo.scoped.scss</code>，并内联了一个{' '}
        <code>{'<style scoped>'}</code>，二者共享同一把由 <code>demo.tsx</code> 绝对路径生成的{' '}
        <code>data-v-xxxxxxxx</code>。
      </p>

      <div class="demo__row">
        <Card />
        <Pill label="plain .css scoped" />
        {/* 组件 scoped：<ScopedRoot> 会被注入 scopedId="data-v-<hash>"，
            子组件声明该 prop 后把它绑到根元素，父组件 scoped 样式才能命中它 */}
        <ScopedRoot label="scopedId 显式绑定到根元素" />
        {/* Vue 专有玩法：<AutoScopedRoot direct-scoped> 由插件直接注入
            data-v-<hash>，Vue 的 attrs 透传（fallthrough）会自动把它落到
            子组件单根元素上 —— 子组件零改造即继承父级 scope */}
        <AutoScopedRoot direct-scoped label="attrs 透传，子组件零改造" />
      </div>

      <div class="demo__footer">
        <span class="demo__note">
          该文字颜色来自内联 <code>{'<style scoped>'}</code>（未写 lang，按 css 处理）。
        </span>
      </div>

      {/* 内联 scoped 样式（静态文本；不加 lang 默认按 css 处理） */}
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

      <div class="demo__scss-inline">
        <span class="demo__scss-note">
          该文字颜色来自内联 <code>{'<style scoped lang="scss">'}</code>（sass 嵌套语法）。
        </span>
      </div>

      {/* 内联 scoped + lang="scss"：内容先按 sass 编译，再追加 [data-v-*] */}
      <style scoped lang="scss">{`
        .demo__scss-inline {
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px dotted #e2e8f0;
          .demo__scss-note {
            color: #15803d;
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
