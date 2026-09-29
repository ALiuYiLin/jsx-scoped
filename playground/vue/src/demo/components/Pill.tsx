import { defineComponent } from 'vue'

// 路径别名 `@` → src（vite.config.ts 的 resolve.alias）：
// 插件会读取同一份 resolve.alias 解析 scoped 样式导入，所以别名导入
// 与相对路径导入完全等价，选择器照样会被追加 [data-v-{hash}]。
import '@/demo/components/pill.scoped.css'

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
