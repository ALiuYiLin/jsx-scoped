import Demo from './demo/demo'

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>@10coding/jsx-scoped（React 示例）</h1>
        <p>
          每个组件文件的 <code>*.scoped.{'{css,scss,less}'}</code> 导入与内联{' '}
          <code>{'<style scoped>'}</code>，都会以「组件文件绝对路径」生成唯一的{' '}
          <code>data-v-xxxxxxxx</code> 属性；开发者工具里查看元素即可看到注入结果。
        </p>
      </header>
      <main>
        <Demo />
      </main>
    </div>
  )
}
