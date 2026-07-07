import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { EdgeNetworkPolicy, FlowEdge, NetworkPresetId } from "../../contracts"
import {
  applyNetworkPreset,
  networkPresetById,
  networkPresets,
  suggestedNetworkPresetId,
} from "../../engine"

const schema = z.object({
  presetId: z
    .enum([
      "same-availability-zone",
      "same-region-cross-zone",
      "same-continent",
      "cross-continent",
      "public-internet-edge",
      "private-backbone-regions",
      "external-provider-edge",
    ])
    .optional(),
  sourceRegion: z.string().min(1),
  targetRegion: z.string().min(1),
  bandwidthMbps: z.number().positive(),
  baseLatencyMs: z.number().nonnegative(),
  tlsHandshakeMs: z.number().nonnegative(),
  connectionReusePercent: z.number().min(0).max(100),
  outagePercent: z.number().min(0).max(100),
})

const defaults: EdgeNetworkPolicy = {
  sourceRegion: "local",
  targetRegion: "local",
  bandwidthMbps: 1000,
  baseLatencyMs: 1,
  tlsHandshakeMs: 10,
  connectionReusePercent: 95,
  outagePercent: 0,
}

type Props = {
  edge: FlowEdge
  sourceRegion?: string
  targetRegion?: string
  onSave: (network: EdgeNetworkPolicy | undefined) => void
}

export function EdgeNetworkForm({ edge, sourceRegion, targetRegion, onSave }: Props) {
  const initial = edge.network ?? {
    ...defaults,
    sourceRegion: sourceRegion ?? defaults.sourceRegion,
    targetRegion: targetRegion ?? defaults.targetRegion,
  }
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<EdgeNetworkPolicy>({ defaultValues: initial })
  const selectedPresetId = watch("presetId")
  const suggestion = suggestedNetworkPresetId(sourceRegion, targetRegion)

  const submit = (values: EdgeNetworkPolicy) => {
    const result = schema.safeParse(values)
    if (result.success) onSave(result.data)
    else {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field as keyof EdgeNetworkPolicy, { message: issue.message })
        }
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <label htmlFor="network-preset">
        Network preset
        <select
          id="network-preset"
          value={selectedPresetId ?? ""}
          onChange={(event) => {
            const presetId = event.target.value as NetworkPresetId | ""
            if (!presetId) {
              reset({ ...getValues(), presetId: undefined })
              return
            }
            const preset = networkPresetById(presetId)
            if (!preset) return
            reset(
              applyNetworkPreset(
                preset,
                sourceRegion ?? getValues("sourceRegion"),
                targetRegion ?? getValues("targetRegion"),
              ),
            )
          }}
        >
          <option value="">Custom values</option>
          {networkPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
              {preset.id === suggestion ? " — suggested" : ""}
            </option>
          ))}
        </select>
        <small className="select-hint">
          {selectedPresetId
            ? `${networkPresetById(selectedPresetId)?.description} Values remain editable planning assumptions.`
            : suggestion
              ? `${networkPresetById(suggestion)?.label} is suggested for this placement.`
              : "Choose a planning assumption or enter explicit values."}
        </small>
      </label>
      {(
        [
          ["sourceRegion", "Source region"],
          ["targetRegion", "Target region"],
        ] as const
      ).map(([field, label]) => (
        <label htmlFor={`network-${field}`} key={field}>
          {label}
          <Input id={`network-${field}`} {...register(field)} />
          {errors[field] && (
            <small className="field-error">{errors[field]?.message}</small>
          )}
        </label>
      ))}
      {(
        [
          ["bandwidthMbps", "Bandwidth (Mbps)"],
          ["baseLatencyMs", "Base latency (ms)"],
          ["tlsHandshakeMs", "TLS handshake (ms)"],
          ["connectionReusePercent", "Connection reuse (%)"],
          ["outagePercent", "Partial outage (%)"],
        ] as const
      ).map(([field, label]) => (
        <label htmlFor={`network-${field}`} key={field}>
          {label}
          <Input
            id={`network-${field}`}
            type="number"
            step="any"
            {...register(field, { valueAsNumber: true })}
          />
          {errors[field] && (
            <small className="field-error">{errors[field]?.message}</small>
          )}
        </label>
      ))}
      <Button className="inspector-save" type="submit">
        Apply network
      </Button>
      {edge.network && (
        <Button type="button" variant="ghost" onClick={() => onSave(undefined)}>
          Remove network policy
        </Button>
      )}
    </form>
  )
}
