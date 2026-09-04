import Demo from './demo/demo'

export default function App() {
  return (
    <div class="app">
      <header class="app__header">
        <h1>@10coding/jsx-scoped（Solid 示例）</h1>
        <p>
          验证同一套流水线在非 React 的 JSX 框架下依然有效：
          以组件文件绝对路径生成 <code>data-v-xxxxxxxx</code>，
          DOM 元素自动注入、自定义组件注入 <code>scopedId</code>、
          外部 <code>*.scoped.scss</code> 与内联 <code>{'<style scoped>'}</code> 的选择器全部追加{' '}
          <code>[data-v-xxxxxxxx]</code>。
        </p>
      </header>
      <main>
        <Demo />
      </main>
    </div>
  )
}
