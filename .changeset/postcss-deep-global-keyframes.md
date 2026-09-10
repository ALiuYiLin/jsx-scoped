---
"@10coding/postcss-jsx-scoped": minor
---

新增 Vue 风格的选择器宏与 scoped 动画名改写：

- `:deep(...)`：进入子组件作用域，本文件属性挂在左侧最后一个复合选择器上，宏及其右侧不再追加（`.a :deep(.b) .c` → `.a[data-v-x] .b .c`）；支持多段参数展开、伪元素/组合器保留；无前缀写法 `:deep(.b)` → `[data-v-x] .b`
- `:global(...)`：括号内不追加属性，其余照常（`.a :global(.b) .c` → `.a[data-v-x] .b .c[data-v-x]`）；无前缀且无后续时为纯全局规则
- scoped 内 `@keyframes` 动画名追加 `-{scopeAttr}` 后缀并同步 `animation` / `animation-name` 引用，避免跨组件动画名冲突（可用 `scopeKeyframes: false` 关闭）
- 只支持函数式宏写法；`>>>`、`/deep/`、`::v-deep`、无括号 `:deep .x` 不做特殊处理
- 幂等保持：含宏的规则处理后插入 `/* jsx-scoped:{attr}:macro */` 注释标记，重复处理结果一致
