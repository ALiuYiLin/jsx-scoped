export default function GlobalCard() {
  return (
    // 与其它卡片同名的 .card，但没有任何 scoped 规则命中它：
    //  - 没有自己的 *.scoped.* 文件（本组件的 hash 上没有对应规则）；
    //  - 也没有把父组件注入的 scopedId 绑到 DOM 上（不继承父样式）。
    // 于是能命中它的只剩父组件引入的全局 global.css（选择器不带 [data-v-*]）。
    <div className="card">
      <p className="card__name">4. GlobalCard（global.css · 无 scoped）</p>
      <p className="card__desc">
        global.css 不带 scoped 后缀：选择器不改写、全站生效 —— 别处出现同名 .card
        也会被它影响；上面三张卡因 [data-v-*] 特异性更高而把它覆盖。
      </p>
    </div>
  )
}
