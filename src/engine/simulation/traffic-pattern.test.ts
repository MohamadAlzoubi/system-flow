import { describe, expect, it } from "vitest"
import type { SimulationProfile } from "../../contracts"
import { trafficRateAt } from "./traffic-pattern"

function profileWith(overrides: Partial<SimulationProfile>): SimulationProfile {
  return {
    durationSeconds: 300,
    cpuCores: 8,
    memoryMb: 16000,
    networkLatencyMs: 5,
    requestsPerSecond: 100,
    trafficPattern: "steady",
    ...overrides,
  }
}

describe("trafficRateAt", () => {
  it("holds the baseline for steady traffic", () => {
    const profile = profileWith({ peakRequestsPerSecond: 400 })
    expect(trafficRateAt(100, profile, 0, 0.5)).toBe(100)
    expect(trafficRateAt(100, profile, 299, 0.5)).toBe(100)
  })

  it("ramps into the burst and drops back to baseline", () => {
    const profile = profileWith({
      trafficPattern: "burst",
      peakRequestsPerSecond: 400,
      burstStartSeconds: 60,
      rampUpSeconds: 30,
      burstDurationSeconds: 60,
    })
    expect(trafficRateAt(100, profile, 30, 0.5)).toBe(100)
    expect(trafficRateAt(100, profile, 75, 0.5)).toBe(250)
    expect(trafficRateAt(100, profile, 100, 0.5)).toBe(400)
    expect(trafficRateAt(100, profile, 149, 0.5)).toBe(400)
    expect(trafficRateAt(100, profile, 150, 0.5)).toBe(100)
  })

  it("peaks during the middle quarter of a daily-peak run", () => {
    const profile = profileWith({
      trafficPattern: "daily-peak",
      peakRequestsPerSecond: 400,
    })
    expect(trafficRateAt(100, profile, 60, 0.5)).toBe(100)
    expect(trafficRateAt(100, profile, 150, 0.5)).toBe(400)
    expect(trafficRateAt(100, profile, 250, 0.5)).toBe(100)
  })

  it("stays between baseline and peak for random traffic", () => {
    const profile = profileWith({
      trafficPattern: "random",
      peakRequestsPerSecond: 400,
    })
    expect(trafficRateAt(100, profile, 10, 0)).toBe(100)
    expect(trafficRateAt(100, profile, 10, 1)).toBe(400)
    expect(trafficRateAt(100, profile, 10, 0.25)).toBe(175)
  })
})
