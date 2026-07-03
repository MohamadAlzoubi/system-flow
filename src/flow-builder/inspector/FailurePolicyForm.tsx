import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { FailurePolicy, FlowEdge, NodeInstance } from "../../contracts"

const actionGuidance: Record<FailurePolicy["action"], string> = {
  propagate: "The caller sees the failure and decides what to do.",
  retry: "Try again with backoff. Requires idempotent work and an attempt limit.",
  queue: "Park the work and process it once the dependency recovers.",
  fallback: "Answer from an alternative component outside the same failure boundary.",
  drop: "Discard the work silently. Only for data nobody must see again.",
  "dead-letter": "Move repeatedly failing work aside for owned, later replay.",
}

const schema = z.object({
  action: z.enum(["propagate", "retry", "queue", "fallback", "drop", "dead-letter"]),
  timeoutMs: z.number().positive().optional(),
  maximumAttempts: z.number().int().positive().optional(),
  backoff: z.enum(["", "fixed", "linear", "exponential"]),
  initialBackoffMs: z.number().nonnegative().optional(),
  maximumBackoffMs: z.number().nonnegative().optional(),
  fallbackNodeId: z.string(),
})

type FormValues = z.infer<typeof schema>

const optionalNumber = {
  setValueAs: (value: unknown) =>
    value === "" || value === null || value === undefined ? undefined : Number(value),
}

type Props = {
  edge: FlowEdge
  nodes: NodeInstance[]
  onSave: (failurePolicy: FailurePolicy | undefined) => void
}

export function FailurePolicyForm({ edge, nodes, onSave }: Props) {
  const policy = edge.failurePolicy
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      action: policy?.action ?? "propagate",
      timeoutMs: policy?.timeoutMs,
      maximumAttempts: policy?.maximumAttempts,
      backoff: policy?.backoff ?? "",
      initialBackoffMs: policy?.initialBackoffMs,
      maximumBackoffMs: policy?.maximumBackoffMs,
      fallbackNodeId: policy?.fallbackNodeId ?? "",
    },
  })
  const action = watch("action")

  const submit = (values: FormValues) => {
    const result = schema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field as keyof FormValues, { message: issue.message })
        }
      }
      return
    }
    const parsed = result.data
    onSave({
      action: parsed.action,
      timeoutMs: parsed.timeoutMs,
      maximumAttempts: parsed.action === "retry" ? parsed.maximumAttempts : undefined,
      backoff:
        parsed.action === "retry" && parsed.backoff !== "" ? parsed.backoff : undefined,
      initialBackoffMs: parsed.action === "retry" ? parsed.initialBackoffMs : undefined,
      maximumBackoffMs: parsed.action === "retry" ? parsed.maximumBackoffMs : undefined,
      fallbackNodeId:
        parsed.action === "fallback" ? parsed.fallbackNodeId || undefined : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <label htmlFor="failure-action">
        On failure
        <select id="failure-action" {...register("action")}>
          <option value="propagate">Propagate to the caller</option>
          <option value="retry">Retry with backoff</option>
          <option value="queue">Queue for later</option>
          <option value="fallback">Use a fallback</option>
          <option value="drop">Drop silently</option>
          <option value="dead-letter">Dead-letter for replay</option>
        </select>
      </label>
      <p className="goal-hint">{actionGuidance[action]}</p>
      <label htmlFor="failure-timeout">
        Failure timeout (ms)
        <Input
          id="failure-timeout"
          type="number"
          placeholder="Defaults to the interaction timeout"
          {...register("timeoutMs", optionalNumber)}
        />
        {errors.timeoutMs && (
          <small className="field-error">{errors.timeoutMs.message}</small>
        )}
      </label>
      {action === "retry" && (
        <>
          <label htmlFor="failure-attempts">
            Maximum attempts
            <Input
              id="failure-attempts"
              type="number"
              {...register("maximumAttempts", optionalNumber)}
            />
            {errors.maximumAttempts && (
              <small className="field-error">{errors.maximumAttempts.message}</small>
            )}
          </label>
          <label htmlFor="failure-backoff">
            Backoff
            <select id="failure-backoff" {...register("backoff")}>
              <option value="">Undecided</option>
              <option value="fixed">Fixed</option>
              <option value="linear">Linear</option>
              <option value="exponential">Exponential</option>
            </select>
          </label>
          <label htmlFor="failure-initial-backoff">
            Initial backoff (ms)
            <Input
              id="failure-initial-backoff"
              type="number"
              {...register("initialBackoffMs", optionalNumber)}
            />
          </label>
          <label htmlFor="failure-maximum-backoff">
            Maximum backoff (ms)
            <Input
              id="failure-maximum-backoff"
              type="number"
              {...register("maximumBackoffMs", optionalNumber)}
            />
          </label>
        </>
      )}
      {action === "fallback" && (
        <label htmlFor="failure-fallback">
          Fallback node
          <select id="failure-fallback" {...register("fallbackNodeId")}>
            <option value="">Choose a fallback</option>
            {nodes
              .filter((node) => node.id !== edge.toNodeId)
              .map((node) => (
                <option key={node.id} value={node.id}>
                  {node.id}
                </option>
              ))}
          </select>
        </label>
      )}
      <Button className="inspector-save" type="submit">
        Apply failure policy
      </Button>
      {policy && (
        <Button type="button" variant="ghost" onClick={() => onSave(undefined)}>
          Remove failure policy
        </Button>
      )}
    </form>
  )
}
