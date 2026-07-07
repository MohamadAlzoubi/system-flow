import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { FailureScenario, FailureScenarioKind, FlowGraph } from "../../contracts"

export const scenarioKindLabels: Record<FailureScenarioKind, string> = {
  "dependency-unavailable": "Dependency unavailable",
  "dependency-slow": "Dependency slow",
  "partial-capacity-loss": "Partial capacity loss",
  "region-unavailable": "Region unavailable",
  "malformed-data": "Malformed or incompatible data",
  "duplicate-delivery": "Duplicate delivery",
  "traffic-spike": "Traffic spike",
  "datastore-failover": "Primary datastore failover",
  "consumer-outage": "Consumer outage",
}

const schema = z.object({
  name: z.string().min(1),
  kind: z.enum([
    "dependency-unavailable",
    "dependency-slow",
    "partial-capacity-loss",
    "region-unavailable",
    "malformed-data",
    "duplicate-delivery",
    "traffic-spike",
    "datastore-failover",
    "consumer-outage",
  ]),
  affectedNodeIds: z.array(z.string()),
  affectedBoundaryIds: z.array(z.string()),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive(),
  recoverySeconds: z.number().nonnegative(),
  intensityPercent: z.number().min(0).max(100).optional(),
  slowdownFactor: z.number().positive().optional(),
  trafficMultiplier: z.number().positive().optional(),
  expectedResponse: z.string(),
  expectedUserImpact: z.string(),
  recoveryBehavior: z.string(),
})

type FormValues = z.infer<typeof schema>

const optionalNumber = {
  setValueAs: (value: unknown) =>
    value === "" || value === null || value === undefined ? undefined : Number(value),
}

const requiredNumber = { valueAsNumber: true }

type Props = {
  scenario: FailureScenario
  graph: FlowGraph
  onSave: (scenario: FailureScenario) => void
}

export function FailureScenarioForm({ scenario, graph, onSave }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: scenario.name,
      kind: scenario.kind,
      affectedNodeIds: scenario.affectedNodeIds,
      affectedBoundaryIds: scenario.affectedBoundaryIds,
      startSeconds: scenario.startSeconds,
      durationSeconds: scenario.durationSeconds,
      recoverySeconds: scenario.recoverySeconds,
      intensityPercent: scenario.intensityPercent,
      slowdownFactor: scenario.slowdownFactor,
      trafficMultiplier: scenario.trafficMultiplier,
      expectedResponse: scenario.expectedResponse ?? "",
      expectedUserImpact: scenario.expectedUserImpact ?? "",
      recoveryBehavior: scenario.recoveryBehavior ?? "",
    },
  })
  const kind = watch("kind")
  const boundaries = graph.boundaries ?? []
  const regionBoundaries = boundaries.filter((boundary) => boundary.kind === "region")
  const affectedBoundaryOptions =
    kind === "region-unavailable" && regionBoundaries.length > 0
      ? regionBoundaries
      : boundaries

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
    const affectedBoundaryIds =
      parsed.kind === "region-unavailable" && regionBoundaries.length > 0
        ? parsed.affectedBoundaryIds.filter((id) =>
            regionBoundaries.some((boundary) => boundary.id === id),
          )
        : parsed.affectedBoundaryIds
    onSave({
      id: scenario.id,
      name: parsed.name.trim(),
      kind: parsed.kind,
      affectedNodeIds: parsed.affectedNodeIds,
      affectedBoundaryIds,
      startSeconds: parsed.startSeconds,
      durationSeconds: parsed.durationSeconds,
      recoverySeconds: parsed.recoverySeconds,
      intensityPercent: parsed.intensityPercent,
      slowdownFactor: parsed.slowdownFactor,
      trafficMultiplier: parsed.trafficMultiplier,
      expectedResponse: parsed.expectedResponse.trim() || undefined,
      expectedUserImpact: parsed.expectedUserImpact.trim() || undefined,
      recoveryBehavior: parsed.recoveryBehavior.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <label htmlFor="scenario-name">
        Name
        <Input id="scenario-name" {...register("name")} />
        {errors.name && <small className="field-error">{errors.name.message}</small>}
      </label>
      <label htmlFor="scenario-kind">
        Trigger
        <select id="scenario-kind" {...register("kind")}>
          {Object.entries(scenarioKindLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="ownership-set">
        <legend>Affected nodes</legend>
        {graph.nodes.map((node) => (
          <label className="contract-flag" key={node.id}>
            <input type="checkbox" value={node.id} {...register("affectedNodeIds")} />
            {node.id}
          </label>
        ))}
      </fieldset>
      {affectedBoundaryOptions.length > 0 && (
        <fieldset className="ownership-set">
          <legend>
            {kind === "region-unavailable" ? "Affected regions" : "Affected boundaries"}
          </legend>
          {affectedBoundaryOptions.map((boundary) => (
            <label className="contract-flag" key={boundary.id}>
              <input
                type="checkbox"
                value={boundary.id}
                {...register("affectedBoundaryIds")}
              />
              {boundary.label}
              {boundary.kind === "region" && boundary.regionCode
                ? ` (${boundary.regionCode})`
                : ""}
            </label>
          ))}
        </fieldset>
      )}
      <label htmlFor="scenario-start">
        Start (seconds)
        <Input
          id="scenario-start"
          type="number"
          {...register("startSeconds", requiredNumber)}
        />
      </label>
      <label htmlFor="scenario-duration">
        Duration (seconds)
        <Input
          id="scenario-duration"
          type="number"
          {...register("durationSeconds", requiredNumber)}
        />
        {errors.durationSeconds && (
          <small className="field-error">{errors.durationSeconds.message}</small>
        )}
      </label>
      <label htmlFor="scenario-recovery">
        Recovery (seconds)
        <Input
          id="scenario-recovery"
          type="number"
          {...register("recoverySeconds", requiredNumber)}
        />
      </label>
      {(kind === "partial-capacity-loss" ||
        kind === "malformed-data" ||
        kind === "duplicate-delivery") && (
        <label htmlFor="scenario-intensity">
          Intensity (%)
          <Input
            id="scenario-intensity"
            type="number"
            {...register("intensityPercent", optionalNumber)}
          />
        </label>
      )}
      {kind === "dependency-slow" && (
        <label htmlFor="scenario-slowdown">
          Slowdown factor
          <Input
            id="scenario-slowdown"
            type="number"
            step="any"
            {...register("slowdownFactor", optionalNumber)}
          />
        </label>
      )}
      {kind === "traffic-spike" && (
        <label htmlFor="scenario-multiplier">
          Traffic multiplier
          <Input
            id="scenario-multiplier"
            type="number"
            step="any"
            {...register("trafficMultiplier", optionalNumber)}
          />
        </label>
      )}
      <label htmlFor="scenario-response">
        Expected system response
        <Input id="scenario-response" {...register("expectedResponse")} />
      </label>
      <label htmlFor="scenario-impact">
        Expected user impact
        <Input id="scenario-impact" {...register("expectedUserImpact")} />
      </label>
      <label htmlFor="scenario-recovery-behavior">
        Recovery behavior
        <Input id="scenario-recovery-behavior" {...register("recoveryBehavior")} />
      </label>
      <Button className="inspector-save" type="submit">
        Save scenario
      </Button>
    </form>
  )
}
