import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { SimulationProfile } from "../../contracts"

const measurementSourceSchema = z.enum([
  "assumed",
  "load-test",
  "production",
  "vendor-doc",
  "unknown",
])

const schema = z
  .object({
    durationSeconds: z.number().int().min(1).max(86400),
    requestsPerSecond: z.number().min(0),
    trafficPattern: z.enum(["steady", "burst", "daily-peak", "random"]),
    cpuCores: z.number().positive(),
    memoryMb: z.number().positive(),
    networkLatencyMs: z.number().min(0),
    observedLatencyMs: z.number().positive().optional(),
    observedLatencySource: measurementSourceSchema.optional(),
    observedThroughputPerSecond: z.number().positive().optional(),
    observedThroughputSource: measurementSourceSchema.optional(),
    peakRequestsPerSecond: z.number().nonnegative().optional(),
    burstDurationSeconds: z.number().nonnegative().optional(),
    rampUpSeconds: z.number().nonnegative().optional(),
    burstStartSeconds: z.number().nonnegative().optional(),
    payloadSizeBytes: z.number().positive().optional(),
    duplicateEventPercent: z.number().min(0).max(100).optional(),
    malformedEventPercent: z.number().min(0).max(100).optional(),
  })
  .superRefine((values, context) => {
    if (
      values.observedLatencyMs !== undefined &&
      values.observedLatencySource === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["observedLatencySource"],
        message: "Choose where this latency value came from.",
      })
    }
    if (
      values.observedThroughputPerSecond !== undefined &&
      values.observedThroughputSource === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["observedThroughputSource"],
        message: "Choose where this throughput value came from.",
      })
    }
  })

const measurementSourceOptions = [
  ["assumed", "Assumed estimate"],
  ["load-test", "Controlled load test"],
  ["production", "Production telemetry"],
  ["vendor-doc", "Vendor documentation"],
  ["unknown", "Unknown or imported"],
] as const

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
    reset,
  } = useForm<SimulationProfile>({
    defaultValues: profile,
  })
  const submit = (values: SimulationProfile) => {
    const result = schema.safeParse(values)
    if (result.success) {
      onSave({
        ...result.data,
        observedLatencySource:
          result.data.observedLatencyMs === undefined
            ? undefined
            : result.data.observedLatencySource,
        observedThroughputSource:
          result.data.observedThroughputPerSecond === undefined
            ? undefined
            : result.data.observedThroughputSource,
      })
    } else {
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
      <div className="scenario-presets">
        <button
          type="button"
          onClick={() =>
            reset({
              ...profile,
              trafficPattern: "steady",
              peakRequestsPerSecond: profile.requestsPerSecond,
              burstDurationSeconds: 0,
              rampUpSeconds: 0,
            })
          }
        >
          Steady
        </button>
        <button
          type="button"
          onClick={() =>
            reset({
              ...profile,
              trafficPattern: "burst",
              peakRequestsPerSecond: profile.requestsPerSecond * 4,
              burstDurationSeconds: 60,
              rampUpSeconds: 30,
            })
          }
        >
          Traffic spike
        </button>
      </div>
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
      <label htmlFor="profile-peak">
        Peak traffic (events/second)
        <Input
          id="profile-peak"
          type="number"
          {...register("peakRequestsPerSecond", { valueAsNumber: true })}
        />
      </label>
      <label htmlFor="profile-burst-duration">
        Burst duration (seconds)
        <Input
          id="profile-burst-duration"
          type="number"
          {...register("burstDurationSeconds", { valueAsNumber: true })}
        />
      </label>
      <label htmlFor="profile-ramp">
        Ramp-up duration (seconds)
        <Input
          id="profile-ramp"
          type="number"
          {...register("rampUpSeconds", { valueAsNumber: true })}
        />
      </label>
      <label htmlFor="profile-burst-start">
        Burst start (seconds, optional)
        <Input
          id="profile-burst-start"
          type="number"
          {...register("burstStartSeconds", {
            setValueAs: (value) => (value === "" ? undefined : Number(value)),
          })}
        />
      </label>
      <label htmlFor="profile-payload">
        Payload size (bytes)
        <Input
          id="profile-payload"
          type="number"
          {...register("payloadSizeBytes", { valueAsNumber: true })}
        />
      </label>
      <label htmlFor="profile-duplicates">
        Duplicate events (%)
        <Input
          id="profile-duplicates"
          type="number"
          step="any"
          {...register("duplicateEventPercent", { valueAsNumber: true })}
        />
      </label>
      <label htmlFor="profile-malformed">
        Malformed events (%)
        <Input
          id="profile-malformed"
          type="number"
          step="any"
          {...register("malformedEventPercent", { valueAsNumber: true })}
        />
      </label>
      <label htmlFor="profile-cpu">
        Fallback CPU budget (cores)
        <Input
          id="profile-cpu"
          type="number"
          step="any"
          {...register("cpuCores", { valueAsNumber: true })}
        />
      </label>
      <label htmlFor="profile-memory">
        Fallback memory budget (MB)
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
      <label htmlFor="profile-observed-latency">
        Observed latency (ms, optional)
        <Input
          id="profile-observed-latency"
          type="number"
          {...register("observedLatencyMs", {
            setValueAs: (value) => (value === "" ? undefined : Number(value)),
          })}
        />
      </label>
      <label htmlFor="profile-observed-latency-source">
        Latency measurement source
        <select
          id="profile-observed-latency-source"
          {...register("observedLatencySource", {
            setValueAs: (value) => (value === "" ? undefined : value),
          })}
        >
          <option value="">Select source…</option>
          {measurementSourceOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.observedLatencySource && (
          <small className="field-error">{errors.observedLatencySource.message}</small>
        )}
      </label>
      <label htmlFor="profile-observed-throughput">
        Observed throughput (/s, optional)
        <Input
          id="profile-observed-throughput"
          type="number"
          {...register("observedThroughputPerSecond", {
            setValueAs: (value) => (value === "" ? undefined : Number(value)),
          })}
        />
      </label>
      <label htmlFor="profile-observed-throughput-source">
        Throughput measurement source
        <select
          id="profile-observed-throughput-source"
          {...register("observedThroughputSource", {
            setValueAs: (value) => (value === "" ? undefined : value),
          })}
        >
          <option value="">Select source…</option>
          {measurementSourceOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.observedThroughputSource && (
          <small className="field-error">{errors.observedThroughputSource.message}</small>
        )}
      </label>
      <Button className="inspector-save" type="submit">
        Apply scenario
      </Button>
    </form>
  )
}
