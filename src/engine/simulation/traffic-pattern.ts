import type { SimulationProfile } from "../../contracts"

/**
 * Traffic entering the flow at one moment of the scenario. Shapes integrate to
 * the same whole-scenario averages the topology view reports:
 * - steady: the baseline for the whole run.
 * - burst: ramp from baseline to peak over rampUpSeconds starting at
 *   burstStartSeconds, hold the peak for burstDurationSeconds, drop back.
 * - daily-peak: peak during the middle quarter of the run, baseline otherwise.
 * - random: a deterministic per-frame value between baseline and peak taken
 *   from the caller's seeded sequence.
 */
export function trafficRateAt(
  baseline: number,
  profile: SimulationProfile,
  timeSeconds: number,
  randomFraction: number,
): number {
  const peak = profile.peakRequestsPerSecond ?? baseline
  if (profile.trafficPattern === "burst") {
    const duration = Math.max(1, profile.durationSeconds)
    const burst = Math.min(duration, Math.max(0, profile.burstDurationSeconds ?? 0))
    const ramp = Math.min(duration - burst, Math.max(0, profile.rampUpSeconds ?? 0))
    const rampStart = Math.max(0, profile.burstStartSeconds ?? 0)
    const peakStart = rampStart + ramp
    const peakEnd = peakStart + burst
    if (timeSeconds < rampStart || timeSeconds >= peakEnd) return baseline
    if (timeSeconds < peakStart) {
      return (
        baseline + (peak - baseline) * ((timeSeconds - rampStart) / Math.max(1, ramp))
      )
    }
    return peak
  }
  if (profile.trafficPattern === "daily-peak") {
    const duration = Math.max(1, profile.durationSeconds)
    const inPeakWindow = timeSeconds >= duration * 0.375 && timeSeconds < duration * 0.625
    return inPeakWindow ? peak : baseline
  }
  if (profile.trafficPattern === "random") {
    return baseline + (peak - baseline) * randomFraction
  }
  return baseline
}
