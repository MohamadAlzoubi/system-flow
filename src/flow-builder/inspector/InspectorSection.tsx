import { ChevronDown, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

type InspectorSectionProps = {
  title: string
  icon: LucideIcon
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * Collapsible inspector panel. Only the sections a user is working with stay
 * open, which keeps long node forms approachable.
 */
export function InspectorSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: InspectorSectionProps) {
  return (
    <details className="inspector-section" open={defaultOpen}>
      <summary>
        <Icon size={13} />
        <span>{title}</span>
        <ChevronDown className="section-chevron" size={13} />
      </summary>
      <div className="inspector-section-body">{children}</div>
    </details>
  )
}
