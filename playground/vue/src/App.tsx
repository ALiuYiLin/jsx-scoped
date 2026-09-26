import Demo from './demo/demo'

export default function App() {
  return (
    <div class="app">
      <header class="app__header">
        <h1>@10coding/jsx-scoped（Vue JSX 示例）</h1>
        <p>
          同一套流水线在 Vue JSX 下同样生效：scope 种子是<b>组件文件绝对路径</b>，
          本文件里的 JSX 元素自动注入 <code>data-v-xxxxxxxx</code>，
          <code>*.scoped.{'{css,scss,less}'}</code> 与内联 <code>{'<style scoped>'}</code>{' '}
          的选择器全部追加 <code>[data-v-xxxxxxxx]</code>。打开开发者工具即可看到注入结果。
        </p>
      </header>
      <main>
        <Demo />
      </main>
    </div>
  )
}
