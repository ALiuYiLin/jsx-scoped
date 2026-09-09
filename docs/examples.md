---
title: 示例：同名 .card 的 scoped 隔离
description: 以 docs/demo 的四张同名 .card 卡片为例，演示组件级 scoped：父组件样式、子组件自带 scoped、手动继承父 scopedId、全局样式
---

# 示例：同名类的 scoped 隔离

这个案例来自 `docs/demo`：一个 `Demo` 组件里渲染了**四张类名完全相同**
（`class="card"`）的卡片，分别来自四种样式来源：

| 卡片 | 写法 | 样式来源 | 作用域 |
| --- | --- | --- | --- |
| 1 | 结构直接写在父组件里 | `demo.scoped.scss` | 父组件 hash |
| 2 | 子组件 `ChildCard` | `child-card.scoped.css` | 子组件自身 hash |
| 3 | 子组件 `InheritCard` | 无自带样式，逐层绑定父 `scopedId` | 继承父组件 hash |
| 4 | 子组件 `GlobalCard` | 父组件引入的 `global.css` | 全局（选择器不改写） |

style scoped 的含义：**当前文件里类名的样式只属于当前文件，不污染全局**。
类名相同没关系 —— 每条规则都会被改写成带本文件 hash 的选择器
（`.card[data-v-{hash}]`），DOM 上也只带属于自己文件的 `data-v-{hash}`，两者
一一对应、互不干扰。若隔离不生效，四张同名卡会互相覆盖、渲染错乱；隔离生效
时，谁命中谁不命中，一眼就能看出来。

下方是真实渲染：页面 `<script>` 里 `import Demo from './demo/demo.tsx'`，直接
把 `Demo` 当作页面组件渲染出来。

<script>
import Demo from './demo/demo.tsx'
</script>

<Demo />

## 完整源码（docs/demo）

以下源码按组件**从父到子**排列，用 vitepress snippet（`<<< @/…`）直接引入
`docs/demo` 的真实文件。

### Demo（父组件）

::: code-group

<<< @/demo/demo.tsx [demo.tsx]

<<< @/demo/demo.scoped.scss [demo.scoped.scss]

<<< @/demo/global.css [global.css]

:::

卡片 1 的结构**直接写在父组件里**：它和页面上的其它 DOM 一样带上父组件 hash，
命中父的 `.card[data-v-父hash]`；父的 scoped 样式到此为止，进不了任何子组件。
父组件还同时 import 了不带 scoped 后缀的 `global.css`（全局对照，见下方
GlobalCard）。

### ChildCard（子组件 · 同名 .card + 自带 scoped）

::: code-group

<<< @/demo/components/ChildCard.tsx [ChildCard.tsx]

<<< @/demo/components/child-card.scoped.css [child-card.scoped.css]

:::

与父**同名 `.card`**，但样式来自本组件自己的 scoped 文件
（`.card[data-v-子hash]`）：两条规则各自命中自己文件产生的 DOM，同名类互不污染
—— 父的样式命中不了这张卡，这张卡的样式也影响不到父组件。

### InheritCard（子组件 · 同名 .card + 手动继承父 scopedId）

<<< @/demo/components/InheritCard.tsx [InheritCard.tsx]

与父**同名 `.card`**，且没有自己的 scoped 文件；想让父的 scoped 样式命中自己，
就把父组件注入的 `scopedId` 绑到自己的 DOM 上（继承父组件的外观）。

::: warning 警示：继承需要逐层绑定
组件 scoped 下，父样式会编译成带 `[data-v-父hash]` 的选择器。只把 `scopedId`
绑到根元素时，**只有根元素**继承父样式：父样式里形如 `.card__name` /
`.card__desc` 的内层选择器（编译后 `.card__name[data-v-父]`）命中不了不带该
属性的子元素。因此要把 `scopedId` 展开到**每一个希望被父样式命中的标签**上
（结构有多少层，就需要继承多少层）。
:::

### GlobalCard（父组件中渲染 · 同名 .card · 只吃全局样式）

<<< @/demo/components/GlobalCard.tsx [GlobalCard.tsx]

第四张卡同样由父组件渲染、类名依然是 `.card`，但它既没有自己的 scoped 文件，
也没有绑定父 `scopedId` —— 能命中它的只剩**父组件引入的** `global.css`：
不带 scoped 后缀的选择器**不会被改写**，全站生效。对照即见差异：这份全局规则
其实也命中了前三张卡，但它们各自带更高特异性的 `[data-v-*]` 规则（
`.card[data-v-父]` / `.card[data-v-子]`），把全局样式覆盖掉了；只有 GlobalCard
没有任何 scoped 身份，全局样式才最终可见。站点别处若出现同名 `.card`，同样会
被 `global.css` 影响 —— 这正是 scoped 要防的“污染”。
