export type SelectOptionMeta = {
  value: string
  /** Friendly text shown in the dropdown instead of the raw value. */
  label: string
  /** Shown under the select while this option is chosen. */
  hint?: string
}

export type FieldMeta = {
  /** Human label shown instead of the humanized config key. */
  label?: string
  /** One-line explanation surfaced as a tooltip, not inline text. */
  help?: string
  /** Unit badge rendered next to the label (ms, MB, /s, %…). */
  unit?: string
  /** Example value or format shown as the input placeholder. */
  placeholder?: string
  /** Practical guidance: recommended range or common mistake to avoid. */
  recommend?: string
  /** Hidden behind the Advanced toggle even without an essentials list. */
  advanced?: boolean
  /** Renders a select with friendly labels and per-option hints. */
  options?: SelectOptionMeta[]
}

export type NodeMeta = {
  /** One-line description of what the node models, shown under the title. */
  summary: string
  /**
   * Config keys shown outside the Advanced toggle, in display order.
   * When omitted every field is treated as essential.
   */
  essentials?: string[]
  fields?: Record<string, FieldMeta>
}
