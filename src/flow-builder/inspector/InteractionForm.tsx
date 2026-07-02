import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { DeliveryPolicy, FlowEdge, InteractionType } from "../../contracts"

const interactionGuidance: Record<InteractionType, string> = {
  "request-response":
    "The caller waits for the answer, so downstream latency and failures reach the caller.",
  "async-command":
    "Ask for an action to happen later. Caller latency ends once the command is accepted.",
  "published-event":
    "Announce a fact that already happened. Consumers react independently and nothing flows back.",
  stream:
    "An ordered, retained sequence. Consumers read at their own pace; partitioning decides ordering.",
  "batch-transfer":
    "Move a collection on a schedule or size threshold. Expect collection and flush delay.",
  "database-operation":
    "Read or write state the target owns. This stays on the caller's synchronous path.",
  "realtime-push":
    "Server-initiated delivery over a long-lived connection, such as a WebSocket.",
}

const interactionLabels: Record<InteractionType, string> = {
  "request-response": "Request / response",
  "async-command": "Async command",
  "published-event": "Published event",
  stream: "Stream",
  "batch-transfer": "Batch transfer",
  "database-operation": "Database operation",
  "realtime-push": "Realtime push",
}

const defaultDeliveryPolicy: DeliveryPolicy = {
  guarantee: "at-least-once",
  ordering: "none",
  acknowledgement: "automatic",
  deduplication: "none",
}

const deliveryInteractions = new Set<InteractionType>([
  "async-command",
  "published-event",
  "stream",
])

const schema = z.object({
  interactionType: z.enum([
    "request-response",
    "async-command",
    "published-event",
    "stream",
    "batch-transfer",
    "database-operation",
    "realtime-push",
  ]),
  timeoutMs: z.number().positive().optional(),
  responseDataType: z.string().optional(),
  deliveryPolicy: z.object({
    guarantee: z.enum(["at-most-once", "at-least-once", "effectively-once"]),
    ordering: z.enum(["none", "per-key", "global"]),
    acknowledgement: z.enum(["none", "automatic", "manual"]),
    deduplication: z.enum(["none", "producer", "consumer", "shared-store"]),
  }),
})

type FormValues = z.infer<typeof schema>

type Interaction = Pick<
  FlowEdge,
  "interactionType" | "timeoutMs" | "responseDataType" | "deliveryPolicy"
>

type Props = {
  edge: FlowEdge
  onSave: (interaction: Interaction) => void
}

export function InteractionForm({ edge, onSave }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      interactionType: edge.interactionType,
      timeoutMs: edge.timeoutMs,
      responseDataType: edge.responseDataType,
      deliveryPolicy: edge.deliveryPolicy ?? defaultDeliveryPolicy,
    },
  })
  const interactionType = watch("interactionType")

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
    // Only fields relevant to the chosen interaction are kept on the edge.
    const parsed = result.data
    onSave({
      interactionType: parsed.interactionType,
      timeoutMs:
        parsed.interactionType === "request-response" ? parsed.timeoutMs : undefined,
      responseDataType:
        parsed.interactionType === "request-response"
          ? parsed.responseDataType || undefined
          : undefined,
      deliveryPolicy: deliveryInteractions.has(parsed.interactionType)
        ? parsed.deliveryPolicy
        : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <label htmlFor="interaction-type">
        Interaction type
        <select id="interaction-type" {...register("interactionType")}>
          {Object.entries(interactionLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="goal-hint">{interactionGuidance[interactionType]}</p>
      {interactionType === "request-response" && (
        <>
          <label htmlFor="interaction-timeout">
            Timeout (ms)
            <Input
              id="interaction-timeout"
              type="number"
              {...register("timeoutMs", {
                setValueAs: (value) =>
                  value === "" || value === null || value === undefined
                    ? undefined
                    : Number(value),
              })}
            />
            {errors.timeoutMs && (
              <small className="field-error">{errors.timeoutMs.message}</small>
            )}
          </label>
          <label htmlFor="interaction-response">
            Response data type
            <Input id="interaction-response" {...register("responseDataType")} />
          </label>
        </>
      )}
      {deliveryInteractions.has(interactionType) && (
        <>
          <label htmlFor="delivery-guarantee">
            Delivery guarantee
            <select id="delivery-guarantee" {...register("deliveryPolicy.guarantee")}>
              <option value="at-most-once">At most once — may drop</option>
              <option value="at-least-once">At least once — may duplicate</option>
              <option value="effectively-once">
                Effectively once — needs idempotency or deduplication
              </option>
            </select>
          </label>
          <label htmlFor="delivery-ordering">
            Ordering
            <select id="delivery-ordering" {...register("deliveryPolicy.ordering")}>
              <option value="none">None</option>
              <option value="per-key">Per key</option>
              <option value="global">Global</option>
            </select>
          </label>
          <label htmlFor="delivery-acknowledgement">
            Acknowledgement
            <select
              id="delivery-acknowledgement"
              {...register("deliveryPolicy.acknowledgement")}
            >
              <option value="none">None</option>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label htmlFor="delivery-deduplication">
            Deduplication
            <select
              id="delivery-deduplication"
              {...register("deliveryPolicy.deduplication")}
            >
              <option value="none">None</option>
              <option value="producer">Producer</option>
              <option value="consumer">Consumer</option>
              <option value="shared-store">Shared store</option>
            </select>
          </label>
        </>
      )}
      <Button className="inspector-save" type="submit">
        Apply interaction
      </Button>
    </form>
  )
}
