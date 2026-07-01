import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { SimulationProfile } from "../../contracts"

const schema = z.object({
  durationSeconds: z.number().int().min(1).max(86400),
  requestsPerSecond: z.number().min(0),
  trafficPattern: z.enum(["steady", "burst", "daily-peak", "random"]),
  cpuCores: z.number().positive(),
  memoryMb: z.number().positive(),
  networkLatencyMs: z.number().min(0),
})

type Props = {
  profile: SimulationProfile
  onSave: (profile: SimulationProfile) => void
}

export function SimulationProfileForm({ profile, onSave }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<SimulationProfile>({
    defaultValues: profile,
  })
  const submit = (values: SimulationProfile) => {
    const result = schema.safeParse(values)
    if (result.success) onSave(result.data)
    else {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field as keyof SimulationProfile, { message: issue.message })
        }
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <label htmlFor="profile-duration">
        Duration (seconds)
        <Input
          id="profile-duration"
          type="number"
          {...register("durationSeconds", { valueAsNumber: true })}
        />
        {errors.durationSeconds && (
          <small className="field-error">{errors.durationSeconds.message}</small>
        )}
      </label>
      <label htmlFor="profile-rate">
        Traffic (events/second)
        <Input
          id="profile-rate"
          type="number"
          {...register("requestsPerSecond", { valueAsNumber: true })}
        />
      </label>
      <label htmlFor="profile-pattern">
        Traffic pattern
        <select id="profile-pattern" {...register("trafficPattern")}>
          <option value="steady">Steady</option>
          <option value="burst">Burst</option>
          <option value="daily-peak">Daily peak</option>
          <option value="random">Random</option>
        </select>
      </label>
      <label htmlFor="profile-cpu">
        CPU budget (cores)
        <Input
          id="profile-cpu"
          type="number"
          step="any"
          {...register("cpuCores", { valueAsNumber: true })}
        />
      </label>
      <label htmlFor="profile-memory">
        Memory budget (MB)
        <Input
          id="profile-memory"
          type="number"
          {...register("memoryMb", { valueAsNumber: true })}
        />
      </label>
      <label htmlFor="profile-network">
        Network latency (ms/hop)
        <Input
          id="profile-network"
          type="number"
          {...register("networkLatencyMs", { valueAsNumber: true })}
        />
      </label>
      <Button className="inspector-save" type="submit">
        Apply scenario
      </Button>
    </form>
  )
}
