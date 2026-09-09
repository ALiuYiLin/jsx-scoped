---
title: 示例：import 页面级 scoped 样式
description: 在 Markdown 页面中通过 import './xx.scoped.css' 使用页面级 scoped 样式
---

# 示例：页面级 scoped 样式

本站开启了 jsx-scoped（`markdownScopedCss: true` + `jsxScopedVitePlugin()`）。
vitepress-react 会把 Markdown 编译成页面组件，所以在页面里 import 一个相对本页的
`*.scoped.css`，样式就只作用于当前页面。

<script>
import './examples-scoped.scoped.css'
import Demo from  './demo/demo.tsx'
</script>

## 实时效果

把样式放进独立文件（文件名必须以 `.scoped.css` / `.scoped.scss` / `.scoped.sass`
/ `.scoped.less` 结尾），再在页面的 `<script>` 里按相对本 md 的路径导入（下面
这张卡片用的就是本页顶部已真实导入的 `./examples-scoped.scoped.css`）：

**加粗文字**的 danger 色来自 `.vse-scoped-card strong`。元素检查可见卡片 DOM 带
`data-v-xxxxxxxx`，编译后的选择器形如 `.vse-scoped-card[data-v-xxxxxxxx]` ——
规则只命中本页，不会泄漏到其它页面。{.vse-scoped-card}

## Markdown 写法

```md
<script>
import './examples-scoped.scoped.css'
</script>

{.vse-scoped-card}

**加粗文字**的 danger 色来自外部 scoped 文件。
```

## CSS 写法

```css
/* examples-scoped.scoped.css（与页面同目录） */
.vse-scoped-card {
  border: 2px dashed var(--vp-c-brand-2);
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
}

.vse-scoped-card strong {
  color: var(--vp-c-danger-1);
}
```

作为对比：不带 scoped 的普通 CSS import 或全局样式不会改写选择器，作用于全站。

<Demo />

## 完整源码（docs/demo）

以下源码用 vitepress snippet（`<<< @/…`）直接引入 `docs/demo` 的真实文件。
demo 演示**同名 `.card` 的四种样式关系**（style scoped 的含义：本文件里类名的
样式只属于本文件，不污染全局）：四张卡片类名完全相同，靠各自的 `data-v-{hash}`
区分作用域 —— 即使样式隔离不生效，它们也会各自正确渲染，看不出差别；隔离
生效时，谁命中谁不命中一目了然。

### Demo（父组件）

::: code-group

<<< @/demo/demo.tsx [demo.tsx]

<<< @/demo/demo.scoped.scss [demo.scoped.scss]

:::

卡片 1 的结构**直接写在父组件里**，DOM 带父组件 hash，命中父的 `.card[data-v-父hash]`。

### ChildCard（子组件 · 同名 .card + 自带 scoped）

::: code-group

<<< @/demo/components/ChildCard.tsx [ChildCard.tsx]

<<< @/demo/components/child-card.scoped.css [child-card.scoped.css]

:::

与父**同名 `.card`**，但样式来自本组件自己的 scoped 文件
（`.card[data-v-子hash]`）—— 同名类互不污染，父样式命中不了这里。

### InheritCard（子组件 · 同名 .card + 手动继承父 scopedId）

<<< @/demo/components/InheritCard.tsx [InheritCard.tsx]

与父**同名 `.card`**，且无自己的 scoped 样式，外观继承自父组件样式。

::: warning 警示：继承需要逐层绑定
组件 scoped 下，父样式会编译成带 `[data-v-父hash]` 的选择器。只把 `scopedId`
绑到根元素时，**只有根元素**继承父样式：父样式里形如 `.card__name` /
`.card__desc` 的内层选择器（编译后 `.card__name[data-v-父]`）命中不了不带该
属性的子元素。因此要把 `scopedId` 展开到**每一个希望被父样式命中的标签**上
（结构有多少层，就需要继承多少层）。
:::

### GlobalCard（父组件中渲染 · 同名 .card + global.css）

::: code-group

<<< @/demo/components/GlobalCard.tsx [GlobalCard.tsx]

<<< @/demo/global.css [global.css]

:::

第四张卡**在父组件中渲染**，类名同样为 `.card`，但没有自己的 scoped 文件、
也不绑定父 scopedId —— 能命中它的只有 `global.css`（不带 scoped 后缀，选择器
不改写、**全站生效**）。对照即见差异：上面三张卡各自被带 `[data-v-*]` 的规则
覆盖成自己的主题色，而这张卡展示的是 global.css 的全局样式；若站点别处出现
同名 `.card`，同样会被这份全局样式影响（这就是 scoped 要防的“污染”）。
