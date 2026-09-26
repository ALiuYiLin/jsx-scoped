import { defineComponent } from 'vue'

/**
 * Vue 专属：子组件**零改造**继承父级 scope。
 *
 * 父组件写 `<AutoScopedRoot direct-scoped />`，jsxScoped 在编译期把 marker 摘掉，
 * 并直接注入 `data-v-<父hash>`；该属性不是本组件声明的 prop，于是被 Vue 当作
 * 普通 attrs 透传（fallthrough）自动落到「唯一根元素」上。
 *
 * 结果等价于 ScopedRoot 里手动 `{...{ [scopedId]: '' }}` 的写法，但本组件
 * 完全不需要知道 scoped 的存在。注意：只在单根组件上生效（多根 / Fragment
 * 根会触发 Vue 的 "could not be automatically inherited" 警告）。
 */
export default defineComponent({
  name: 'AutoScopedRoot',
  props: {
    label: { type: String, required: true },
  },
  setup(props) {
    return () => (
      <div class="auto-root">
        <span class="auto-root__label">{props.label}</span>
      </div>
    )
  },
})
