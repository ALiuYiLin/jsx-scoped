interface DemoChildProps {
  label: string
  /** 组件 scoped：父组件自动注入 scopedId="data-v-<parentHash>" */
  scopedId?: string
}

/**
 * Solid 版 child-root 绑定演示：
 * 父组件（demo.tsx）会在 <DemoChild> 上注入 scopedId="data-v-xxxx"。
 * 需要继承父级 scope 时，由用户自行读取并把该属性绑定到根元素。
 */
export default function DemoChild(props: DemoChildProps) {
  const scope = () => (props.scopedId ? { [props.scopedId]: '' } : {})
  return (
    <div class="child-root-solid" {...scope()}>
      <span>{props.label}</span>
    </div>
  )
}
