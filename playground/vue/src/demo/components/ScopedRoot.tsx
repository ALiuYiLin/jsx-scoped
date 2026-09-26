import { defineComponent } from 'vue'

/**
 * Vue JSX 版 child-root 绑定（与 React / Solid 示例同语义）：
 * 父组件（demo.tsx）会在 <ScopedRoot> 标签上注入 scopedId="data-v-<父hash>"。
 * 需要继承父级 scope 时，子组件声明该 prop 并把它绑到根元素上 —— 本组件根 div
 * 因此会带上父级的 data-v-<父hash>，demo.scoped.scss 里的 .scoped-root 规则
 * 才能命中它（左侧绿色描边即父级 scope 生效的效果）。
 */
export default defineComponent({
  name: 'ScopedRoot',
  props: {
    label: { type: String, required: true },
    /** 组件 scoped：父组件自动注入 scopedId="data-v-<parentHash>" */
    scopedId: { type: String, default: '' },
  },
  setup(props) {
    return () => (
      <div class="scoped-root" {...(props.scopedId ? { [props.scopedId]: '' } : {})}>
        <span class="scoped-root__label">{props.label}</span>
      </div>
    )
  },
})
