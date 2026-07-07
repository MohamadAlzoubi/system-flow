import { describe, expect, it } from "vitest"
import type { FailureScenario } from "../../contracts"
import { productViewedFlow } from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { runSimulation } from "./run-simulation"

describe("production readiness estimates", () => {
  it("evaluates cache TTL and queue lag as staleness", () => {
    const result = runSimulation(productViewedFlow, nodeRegistry)

    expect(result.readiness.dataStalenessMs).toBe(3_600_000)
    expect(result.readiness.evidence).toContainEqual(
      expect.objectContaining({
        metric: "data-staleness",
        source: "cache-ttl",
        nodeId: productViewedFlow.nodes[3].id,
      }),
    )
    expect(result.goalReport?.evaluations).toContainEqual(
      expect.objectContaining({
        goal: "maximumDataStalenessMs",
        status: "failed",
      }),
    )
  })

  it("estimates recovery time and recovery point for an outage", () => {
    const scenario = productViewedFlow.failureScenarios?.[0]
    if (!scenario) throw new Error("Fixture requires an outage scenario")

    const result = runSimulation(productViewedFlow, nodeRegistry, scenario)

    expect(result.readiness.recoveryTimeSeconds).toBeGreaterThanOrEqual(
      scenario.durationSeconds + scenario.recoverySeconds,
    )
    expect(result.readiness.recoveryPointSeconds).toBeGreaterThanOrEqual(0)
    expect(result.readiness.evidence).toContainEqual(
      expect.objectContaining({
        metric: "recovery-time",
        source: scenario.id,
      }),
    )
  })

  it("includes datastore failover windows when work is dropped", () => {
    const database = productViewedFlow.nodes.find((node) => node.type === "database")
    if (!database) throw new Error("Fixture requires a database")
    const scenario: FailureScenario = {
      id: "database-failover",
      name: "Database failover",
      kind: "datastore-failover",
      affectedNodeIds: [database.id],
      affectedBoundaryIds: [],
      startSeconds: 30,
      durationSeconds: 45,
      recoverySeconds: 15,
    }

    const result = runSimulation(productViewedFlow, nodeRegistry, scenario)

    expect(result.readiness.recoveryTimeSeconds).toBeGreaterThanOrEqual(60)
    expect(result.readiness.recoveryPointSeconds).toBeGreaterThan(0)
    expect(result.readiness.evidence).toContainEqual(
      expect.objectContaining({
        metric: "recovery-point",
        source: "datastore-failover",
      }),
    )
  })
})
