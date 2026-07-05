import { commonFieldMeta } from "./common-fields"
import { nodeMeta } from "./node-meta"
import type { FieldMeta, NodeMeta, SelectOptionMeta } from "./types"

export type { FieldMeta, NodeMeta, SelectOptionMeta }

export function getNodeMeta(nodeType: string): NodeMeta | undefined {
  return nodeMeta[nodeType]
}

// Unit suffixes encoded in config key names, e.g. timeoutMs → "ms".
const unitSuffixes: Array<[RegExp, string]> = [
  [/PerSecond$/, "/s"],
  [/Percentage$|Percent$/, "%"],
  [/Mbps$/, "Mbps"],
  [/Ms$/, "ms"],
  [/Seconds$/, "s"],
  [/Bytes$/, "bytes"],
  [/Mb$/, "MB"],
  [/Kb$/, "KB"],
  [/Iops$/, "IOPS"],
  [/Cores$/, "cores"],
  [/Hours$/, "h"],
  [/Days$/, "days"],
]

function derivedUnit(key: string): string | undefined {
  return unitSuffixes.find(([pattern]) => pattern.test(key))?.[1]
}

/** "averageProcessingMs" → "Average processing", with the unit moved to a badge. */
export function humanizeKey(key: string): string {
  let base = key
  for (const [pattern] of unitSuffixes) {
    if (pattern.test(base)) {
      base = base.replace(pattern, "")
      break
    }
  }
  const spaced = (base || key)
    .replace(/([A-Z])/g, " $1")
    .replaceAll("-", " ")
    .trim()
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const fallbackHelp = (label: string) =>
  `Sets the ${label.toLowerCase()} this node uses during simulation.`

export type ResolvedFieldMeta = Required<Pick<FieldMeta, "label" | "help">> &
  Omit<FieldMeta, "label" | "help"> & { advanced: boolean }

/** Node-specific metadata wins, then shared metadata, then derived defaults. */
export function resolveFieldMeta(nodeType: string, key: string): ResolvedFieldMeta {
  const specific = nodeMeta[nodeType]?.fields?.[key]
  const common = commonFieldMeta[key]
  const label = specific?.label ?? common?.label ?? humanizeKey(key)
  return {
    label,
    help: specific?.help ?? common?.help ?? fallbackHelp(label),
    unit: specific?.unit ?? common?.unit ?? derivedUnit(key),
    placeholder: specific?.placeholder ?? common?.placeholder,
    recommend: specific?.recommend ?? common?.recommend,
    options: specific?.options ?? common?.options,
    advanced: specific?.advanced ?? common?.advanced ?? false,
  }
}

/**
 * A field is advanced when flagged directly, or when the node declares an
 * essentials list that does not include it.
 */
export function isAdvancedField(nodeType: string, key: string): boolean {
  const meta = nodeMeta[nodeType]
  if (meta?.essentials) return !meta.essentials.includes(key)
  return resolveFieldMeta(nodeType, key).advanced
}
