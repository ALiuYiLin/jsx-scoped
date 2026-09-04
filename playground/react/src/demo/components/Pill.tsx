import './pill.scoped.css'

export default function Pill({ label }: { label: string }) {
  return (
    <span className="pill-scoped">
      <i className="pill-scoped__dot" />
      {label}
    </span>
  )
}
