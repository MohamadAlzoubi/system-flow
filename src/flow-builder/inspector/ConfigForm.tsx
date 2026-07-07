import { GraduationCap, Info, Settings2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { NodeDefinition, NodeInstance } from "../../contracts"
import {
  applyCapacityPreset,
  capacityPresetsFor,
} from "../../node-registry/capacity-presets"
import {
  getNodeMeta,
  isAdvancedField,
  type ResolvedFieldMeta,
  resolveFieldMeta,
} from "./field-meta"

type ConfigFormProps = {
  node: NodeInstance
  definition: NodeDefinition
  onSave: (config: Record<string, unknown>) => void
}

/** Mirrors the education page slugs so Learn links land on the node's section. */
function educationSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

function fieldGroup(key: string): string {
  if (/latency|timeout|delay|duration|interval|ttl|processing|backoff|lag/i.test(key)) {
    return "Timing"
  }
  if (/failure|retry|durable|ack|dead|outage|circuit|health|recovery/i.test(key)) {
    return "Reliability"
  }
  if (
    /capacity|concurrency|replica|connection|throughput|rate|memory|cpu|iops|size|prefetch|partition|bandwidth|quota|scal/i.test(
      key,
    )
  ) {
    return "Capacity & scaling"
  }
  return "General"
}

export function ConfigForm({ node, definition, onSave }: ConfigFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
    setError,
  } = useForm<Record<string, unknown>>({ defaultValues: node.config })

  useEffect(() => reset(node.config), [node, reset])

  const submit = (values: Record<string, unknown>) => {
    const result = definition.configSchema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field, { message: issue.message })
        }
      }
      return
    }
    onSave(result.data as Record<string, unknown>)
  }

  const meta = getNodeMeta(node.type)
  const presets = capacityPresetsFor(node.type)
  const entries = Object.entries(node.config)
  const essentialEntries = meta?.essentials
    ? meta.essentials
        .map((key) => entries.find(([candidate]) => candidate === key))
        .filter((entry): entry is [string, unknown] => entry !== undefined)
    : entries.filter(([key]) => !isAdvancedField(node.type, key))
  const advancedEntries = entries.filter(([key]) => isAdvancedField(node.type, key))
  const groupedAdvanced =
    advancedEntries.length > 5
      ? advancedEntries.reduce(
          (groups, entry) => {
            const group = fieldGroup(entry[0])
            groups[group] = [...(groups[group] ?? []), entry]
            return groups
          },
          {} as Record<string, Array<[string, unknown]>>,
        )
      : { "": advancedEntries }

  const renderControl = (key: string, value: unknown, field: ResolvedFieldMeta) => {
    if (field.options) {
      const current = watch(key)
      const selected = field.options.find((option) => option.value === current)
      return (
        <>
          <select id={`config-${key}`} {...register(key)}>
            {field.options.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {selected?.hint && <small className="select-hint">{selected.hint}</small>}
        </>
      )
    }
    if (typeof value === "boolean") {
      return <input id={`config-${key}`} type="checkbox" {...register(key)} />
    }
    if (typeof value === "object") {
      return (
        <textarea
          id={`config-${key}`}
          defaultValue={JSON.stringify(value, null, 2)}
          placeholder={field.placeholder}
          onChange={(event) => {
            try {
              const parsed = JSON.parse(event.target.value)
              register(key).onChange({ target: { name: key, value: parsed } })
            } catch {
              setError(key, { message: "Enter valid JSON" })
            }
          }}
        />
      )
    }
    return (
      <Input
        id={`config-${key}`}
        type={typeof value === "number" ? "number" : "text"}
        step={typeof value === "number" ? "any" : undefined}
        placeholder={field.placeholder}
        {...register(key, { valueAsNumber: typeof value === "number" })}
      />
    )
  }

  const renderField = ([key, value]: [string, unknown]) => {
    const field = resolveFieldMeta(node.type, key)
    const isToggle = typeof value === "boolean" && !field.options
    return (
      <label
        htmlFor={`config-${key}`}
        key={key}
        className={isToggle ? "config-field field-toggle" : "config-field"}
      >
        <span className="field-head">
          <span className="field-label">{field.label}</span>
          {field.unit && <em className="field-unit">{field.unit}</em>}
          <span className="field-info" data-tip={field.help}>
            <Info size={12} aria-label={field.help} />
          </span>
        </span>
        {renderControl(key, value, field)}
        {errors[key]?.message && (
          <small className="field-error">{String(errors[key]?.message)}</small>
        )}
        {field.recommend && <small className="field-guidance">{field.recommend}</small>}
      </label>
    )
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="config-form">
      {meta?.summary && (
        <p className="node-summary">
          {meta.summary}{" "}
          <a
            className="node-learn-link"
            href={`/education#${educationSlug(definition.label)}`}
            aria-label={`Open the ${definition.label} handbook entry`}
          >
            <GraduationCap size={12} /> Handbook entry
          </a>
        </p>
      )}
      {presets.length > 0 && (
        <label className="capacity-preset" htmlFor={`capacity-preset-${node.id}`}>
          Capacity preset
          <select
            id={`capacity-preset-${node.id}`}
            value=""
            onChange={(event) => {
              const preset = presets.find(
                (candidate) => candidate.id === event.target.value,
              )
              if (!preset) return
              const config = applyCapacityPreset(node.config, preset)
              const result = definition.configSchema.safeParse(config)
              if (!result.success) return
              const explicit = result.data as Record<string, unknown>
              reset(explicit)
              onSave(explicit)
            }}
          >
            <option value="">Choose a deployment shape…</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id} title={preset.description}>
                {preset.label}
              </option>
            ))}
          </select>
          <small className="select-hint">
            Applying a preset fills the fields below; every value remains editable.
          </small>
        </label>
      )}
      {essentialEntries.map(renderField)}
      {advancedEntries.length > 0 && (
        <details className="advanced-fields">
          <summary>
            <Settings2 size={13} />
            Advanced settings
            <span className="advanced-count">{advancedEntries.length}</span>
          </summary>
          {Object.entries(groupedAdvanced).map(([group, fields]) =>
            group ? (
              <fieldset className="config-group" key={group}>
                <legend>{group}</legend>
                {fields.map(renderField)}
              </fieldset>
            ) : (
              fields.map(renderField)
            ),
          )}
        </details>
      )}
      <Button className="inspector-save" type="submit">
        Apply changes
      </Button>
    </form>
  )
}
