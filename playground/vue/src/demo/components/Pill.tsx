import { defineComponent } from 'vue'

import './pill.scoped.css'

/**
 * Vue JSX 里的自定义组件：需要用 defineComponent（或 defineProps）
 * 声明 props，父组件传进来的 label 才会出现在 props 上。
 */
export default defineComponent({
  name: 'Pill',
  props: {
    label: { type: String, required: true },
  },
  setup(props) {
    return () => (
      <span class="pill-scoped">
        <i class="pill-scoped__dot" />
        {props.label}
      </span>
    )
  },
})
