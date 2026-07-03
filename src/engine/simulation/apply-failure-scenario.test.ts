import { describe, expect, it } from "vitest"
import type { FailureScenario } from "../../contracts"
import { bottleneckFlow, productViewedFlow } from "../../examples"
import { applyFailureScenario } from "./apply-failure-scenario"

function scenario(overrides: Partial<FailureScenario>): FailureScenario {
  return {
    id: "test-scenario",
    name: "Test scenario",
    kind: "dependency-unavailable",
    affectedNodeIds: [],
    affectedBoundaryIds: [],
    startSeconds: 30,
    durationSeconds: 60,
    recoverySeconds: 15,
    ...overrides,
  }
}

describe("applyFailureScenario", () => {
  it("takes affected nodes offline without mutating the input graph", () => {
    const workerId = productViewedFlow.nodes[5].id
    const applied = applyFailureScenario(
      productViewedFlow,
      scenario({ kind: "consumer-outage", affectedNodeIds: [workerId] }),
    )

    expect(
      applied.nodes.find((node) => node.id === workerId)?.availabilityPolicy,
    ).toEqual({
      mode: "scheduled",
      offlineFromSeconds: 30,
      offlineDurationSeconds: 60,
      recoverySeconds: 15,
      degradedCapacityPercent: 100,
    })
    expect(
      productViewedFlow.nodes.find((node) => node.id === workerId)?.availabilityPolicy,
    ).toBeUndefined()
  })

  it("expands affected boundaries to their member nodes", () => {
    const boundaryId = productViewedFlow.boundaries?.[0]?.id
    if (!boundaryId) throw new Error("Fixture requires a boundary")
    const applied = applyFailureScenario(
      productViewedFlow,
      scenario({ kind: "region-unavailable", affectedBoundaryIds: [boundaryId] }),
    )

    expect(
      applied.nodes.every((node) => node.availabilityPolicy?.mode === "scheduled"),
    ).toBe(true)
  })

  it("degrades capacity for partial loss", () => {
    const workerId = bottleneckFlow.nodes[2].id
    const applied = applyFailureScenario(
      bottleneckFlow,
      scenario({
        kind: "partial-capacity-loss",
        affectedNodeIds: [workerId],
        intensityPercent: 40,
      }),
    )

    expect(
      applied.nodes.find((node) => node.id === workerId)?.availabilityPolicy,
    ).toEqual(expect.objectContaining({ mode: "degraded", degradedCapacityPercent: 60 }))
  })

  it("slows affected dependencies by the given factor", () => {
    const workerId = bottleneckFlow.nodes[2].id
    const applied = applyFailureScenario(
      bottleneckFlow,
      scenario({
        kind: "dependency-slow",
        affectedNodeIds: [workerId],
        slowdownFactor: 2,
      }),
    )

    expect(
      applied.nodes.find((node) => node.id === workerId)?.config.averageProcessingMs,
    ).toBe(400)
  })

  it("turns traffic spikes into burst profiles", () => {
    const applied = applyFailureScenario(
      productViewedFlow,
      scenario({ kind: "traffic-spike", trafficMultiplier: 5, durationSeconds: 45 }),
    )

    expect(applied.simulationProfile).toEqual(
      expect.objectContaining({
        trafficPattern: "burst",
        peakRequestsPerSecond: 2500,
        burstDurationSeconds: 45,
      }),
    )
  })

  it("injects data-quality problems and datastore failover", () => {
    const duplicates = applyFailureScenario(
      productViewedFlow,
      scenario({ kind: "duplicate-delivery", intensityPercent: 15 }),
    )
    expect(duplicates.simulationProfile.duplicateEventPercent).toBe(15)

    const databaseId = productViewedFlow.nodes[6].id
    const failover = applyFailureScenario(
      productViewedFlow,
      scenario({ kind: "datastore-failover", affectedNodeIds: [databaseId] }),
    )
    expect(failover.nodes.find((node) => node.id === databaseId)?.config).toEqual(
      expect.objectContaining({ primaryAvailable: false, failoverSeconds: 60 }),
    )
  })
})
