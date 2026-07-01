import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { EdgeNetworkPolicy, FlowEdge } from "../../contracts"

const schema = z.object({
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
  onSave: (network: EdgeNetworkPolicy | undefined) => void
}

export function EdgeNetworkForm({ edge, onSave }: Props) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EdgeNetworkPolicy>({ defaultValues: edge.network ?? defaults })

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
