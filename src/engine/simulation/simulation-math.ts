import type { FlowGraph } from "../../contracts"

export const number = (value: unknown) => Number(value)

export const round = (value: number) => Number(value.toFixed(2))

const finiteOr = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const nonnegativeOr = (value: unknown, fallback: number) => {
  const parsed = finiteOr(value, fallback)
  return parsed >= 0 ? parsed : fallback
}

export const positiveOr = (value: unknown, fallback: number) => {
  const parsed = finiteOr(value, fallback)
  return parsed > 0 ? parsed : fallback
}

export function seedFrom(value: string): number {
  let seed = 2166136261
  for (const character of value) {
    seed ^= character.charCodeAt(0)
    seed = Math.imul(seed, 16777619)
  }
  return seed >>> 0
}

export function createRandom(seed: number): () => number {
  let state = seed || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function normalSample(random: () => number): number {
  const first = Math.max(random(), Number.EPSILON)
  const second = random()
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second)
}

export function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}

export function effectiveTrafficRate(
  baseline: number,
  profile: FlowGraph["simulationProfile"],
): number {
  const peak = profile.peakRequestsPerSecond ?? baseline
  const duration = Math.max(1, profile.durationSeconds)
  const burst = Math.min(duration, Math.max(0, profile.burstDurationSeconds ?? 0))
  const ramp = Math.min(duration - burst, Math.max(0, profile.rampUpSeconds ?? 0))
  if (profile.trafficPattern === "burst") {
    return (
      (baseline * (duration - burst - ramp) +
        peak * burst +
        ((baseline + peak) / 2) * ramp) /
      duration
    )
  }
  if (profile.trafficPattern === "daily-peak") return baseline * 0.75 + peak * 0.25
  if (profile.trafficPattern === "random") return (baseline + peak) / 2
  return baseline
}
