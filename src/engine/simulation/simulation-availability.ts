import type { NodeInstance } from "../../contracts"

export type AvailabilityState = "online" | "offline" | "degraded" | "recovering"

export function availabilityAt(
  node: NodeInstance,
  timeSeconds: number,
): { state: AvailabilityState; factor: number } {
  const policy = node.availabilityPolicy
  if (!policy || policy.mode === "online") return { state: "online", factor: 1 }
  if (policy.mode === "offline") return { state: "offline", factor: 0 }
  if (policy.mode === "degraded") {
    return { state: "degraded", factor: policy.degradedCapacityPercent / 100 }
  }
  const outageEnd = policy.offlineFromSeconds + policy.offlineDurationSeconds
  if (timeSeconds < policy.offlineFromSeconds) return { state: "online", factor: 1 }
  if (timeSeconds < outageEnd) return { state: "offline", factor: 0 }
  if (policy.recoverySeconds > 0 && timeSeconds < outageEnd + policy.recoverySeconds) {
    return {
      state: "recovering",
      factor: (timeSeconds - outageEnd) / policy.recoverySeconds,
    }
  }
  return { state: "online", factor: 1 }
}

export function averageAvailability(node: NodeInstance, durationSeconds: number): number {
  const samples = Math.max(1, Math.min(300, durationSeconds))
  let total = 0
  for (let index = 0; index < samples; index += 1) {
    total += availabilityAt(node, (index / samples) * durationSeconds).factor
  }
  return total / samples
}
