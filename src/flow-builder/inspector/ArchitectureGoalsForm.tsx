import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { ArchitectureGoals } from "../../contracts"
import { architectureGoalPresets, goalFieldHelp } from "./architecture-goal-presets"

const schema = z.object({
  averageTrafficPerSecond: z.number().nonnegative().optional(),
  peakTrafficPerSecond: z.number().nonnegative().optional(),
  maximumAverageLatencyMs: z.number().positive().optional(),
  maximumP95LatencyMs: z.number().positive().optional(),
  minimumAvailabilityPercent: z.number().min(0).max(100).optional(),
  maximumDataLossEvents: z.number().nonnegative().optional(),
  maximumRecoveryTimeSeconds: z.number().nonnegative().optional(),
  maximumRecoveryPointSeconds: z.number().nonnegative().optional(),
  maximumDataStalenessMs: z.number().nonnegative().optional(),
  orderingRequirement: z.enum(["none", "per-key", "global"]),
})

const numberFields: {
  name: Exclude<keyof ArchitectureGoals, "orderingRequirement">
  label: string
}[] = [
  { name: "averageTrafficPerSecond", label: "Average traffic (events/second)" },
  { name: "peakTrafficPerSecond", label: "Peak traffic (events/second)" },
  { name: "maximumAverageLatencyMs", label: "Maximum average latency (ms)" },
  { name: "maximumP95LatencyMs", label: "Maximum p95 latency (ms)" },
  { name: "minimumAvailabilityPercent", label: "Minimum availability (%)" },
  { name: "maximumDataLossEvents", label: "Maximum data loss (events)" },
  { name: "maximumRecoveryTimeSeconds", label: "Maximum recovery time (seconds)" },
  {
    name: "maximumRecoveryPointSeconds",
    label: "Maximum recovery point (seconds)",
  },
  { name: "maximumDataStalenessMs", label: "Maximum data staleness (ms)" },
]

type Props = {
  goals: ArchitectureGoals | undefined
  onSave: (goals: ArchitectureGoals) => void
}

export function ArchitectureGoalsForm({ goals, onSave }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<ArchitectureGoals>({
    defaultValues: goals ?? { orderingRequirement: "none" },
  })
  const submit = (values: ArchitectureGoals) => {
    const result = schema.safeParse(values)
    if (result.success) onSave(result.data)
    else {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field as keyof ArchitectureGoals, { message: issue.message })
        }
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <div className="scenario-presets">
        {architectureGoalPresets.map((preset) => (
          <button
            type="button"
            key={preset.id}
            title={preset.description}
            onClick={() => reset(preset.goals)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="goal-hint">
        Goals describe what the design must achieve, not how components are configured.
        Leave a goal empty to record it as an open question.
      </p>
      {numberFields.map((field) => (
        <label htmlFor={`goal-${field.name}`} key={field.name}>
          {field.label}
          <Input
            id={`goal-${field.name}`}
            type="number"
            step="any"
            title={goalFieldHelp[field.name]}
            {...register(field.name, {
              setValueAs: (value) =>
                value === "" || value === null || value === undefined
                  ? undefined
                  : Number(value),
            })}
          />
          {errors[field.name] && (
            <small className="field-error">{errors[field.name]?.message}</small>
          )}
        </label>
      ))}
      <label htmlFor="goal-ordering" title={goalFieldHelp.orderingRequirement}>
        Ordering requirement
        <select id="goal-ordering" {...register("orderingRequirement")}>
          <option value="none">None — any order is acceptable</option>
          <option value="per-key">Per key — order matters per entity</option>
          <option value="global">Global — strict total order</option>
        </select>
      </label>
      <Button className="inspector-save" type="submit">
        Apply goals
      </Button>
    </form>
  )
}
