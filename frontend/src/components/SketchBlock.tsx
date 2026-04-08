import type { ReactNode } from 'react'

type SketchBlockProps = {
  label: string
  children?: ReactNode
}

/** Визуальный блок-заглушка с подписью и outline */
export function SketchBlock({ label, children }: SketchBlockProps) {
  return (
    <section className="sketch-block" aria-label={label}>
      <div className="sketch-block__tag">{label}</div>
      <div className="sketch-block__body">{children}</div>
    </section>
  )
}
