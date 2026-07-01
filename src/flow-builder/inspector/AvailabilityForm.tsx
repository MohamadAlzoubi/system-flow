import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { AvailabilityPolicy } from "../../contracts"

const schema = z.object({
  mode: z.enum(["online", "offline", "scheduled", "degraded"]),
  offlineFromSeconds: z.number().nonnegative(),
  offlineDurationSeconds: z.number().nonnegative(),
  recoverySeconds: z.number().nonnegative(),
  degradedCapacityPercent: z.number().min(0).max(100),
})

const defaults: AvailabilityPolicy = {
  mode: "online",
  offlineFromSeconds: 60,
  offlineDurationSeconds: 60,
  recoverySeconds: 15,
  degradedCapacityPercent: 50,
}

type Props = {
  policy?: AvailabilityPolicy
  onSave: (policy: AvailabilityPolicy) => void
}

export function AvailabilityForm({ policy, onSave }: Props) {
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<AvailabilityPolicy>({ defaultValues: policy ?? defaults })
  const mode = watch("mode")
  const submit = (values: AvailabilityPolicy) => {
    const result = schema.safeParse(values)
    if (result.success) onSave(result.data)
    else {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field as keyof AvailabilityPolicy, { message: issue.message })
        }
      }
    }
  }

  return (
    <form className="availability-form" onSubmit={handleSubmit(submit)}>
      <label htmlFor="availability-mode">
        Service state
        <small className="field-description">
          Keep online, take fully offline, schedule an outage, or reduce capacity.
        </small>
        <select id="availability-mode" {...register("mode")}>
          <option value="online">Online</option>
          <option value="offline">Fully offline</option>
          <option value="scheduled">Scheduled outage</option>
          <option value="degraded">Degraded capacity</option>
        </select>
      </label>
      {mode === "scheduled" && (
        <>
          <label htmlFor="offline-from">
            Offline from (seconds)
            <Input
              id="offline-from"
              type="number"
              {...register("offlineFromSeconds", { valueAsNumber: true })}
            />
          </label>
          <label htmlFor="offline-duration">
            Outage duration (seconds)
            <Input
              id="offline-duration"
              type="number"
              {...register("offlineDurationSeconds", { valueAsNumber: true })}
            />
          </label>
          <label htmlFor="recovery-seconds">
            Recovery duration (seconds)
            <Input
              id="recovery-seconds"
              type="number"
              {...register("recoverySeconds", { valueAsNumber: true })}
            />
          </label>
        </>
      )}
      {mode === "degraded" && (
        <label htmlFor="degraded-capacity">
          Remaining capacity (%)
          <Input
            id="degraded-capacity"
            type="number"
            {...register("degradedCapacityPercent", { valueAsNumber: true })}
          />
        </label>
      )}
      {Object.entries(errors).map(([field, error]) => (
        <small className="field-error" key={field}>
          {error.message}
        </small>
      ))}
      <Button className="inspector-save" type="submit">
        Apply availability
      </Button>
    </form>
  )
}
