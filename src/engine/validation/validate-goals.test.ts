import { describe, expect, it } from "vitest"
import {
  bottleneckFlow,
  chatMessageFlow,
  productViewedFlow,
  purchaseFlow,
} from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { validateGoals } from "./validate-goals"

describe("validateGoals", () => {
  it("accepts every bundled example", () => {
    for (const flow of [
      productViewedFlow,
      purchaseFlow,
      chatMessageFlow,
      bottleneckFlow,
    ]) {
      expect(validateGoals(flow, nodeRegistry)).toEqual([])
    }
  })

  it("warns when a flow declares no goals", () => {
    const graph = structuredClone(productViewedFlow)
    graph.architectureGoals = undefined

    expect(validateGoals(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "GOALS_MISSING", severity: "warning" }),
    )
  })

  it("warns when peak traffic is an open question", () => {
    const graph = structuredClone(productViewedFlow)
    graph.architectureGoals = {
      ...graph.architectureGoals,
      peakTrafficPerSecond: undefined,
      orderingRequirement: "none",
    }

    expect(validateGoals(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "GOAL_PEAK_TRAFFIC_MISSING" }),
    )
  })

  it("requires a latency target for user-facing flows", () => {
    const graph = structuredClone(productViewedFlow)
    graph.architectureGoals = {
      ...graph.architectureGoals,
      maximumAverageLatencyMs: undefined,
      maximumP95LatencyMs: undefined,
      orderingRequirement: "none",
    }

    expect(validateGoals(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "GOAL_LATENCY_TARGET_MISSING" }),
    )
  })

  it("requires recovery or data-loss goals for stateful flows", () => {
    const graph = structuredClone(bottleneckFlow)
    graph.architectureGoals = {
      ...graph.architectureGoals,
      maximumDataLossEvents: undefined,
      maximumRecoveryTimeSeconds: undefined,
      maximumRecoveryPointSeconds: undefined,
      orderingRequirement: "none",
    }

    expect(validateGoals(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "GOAL_RECOVERY_TARGET_MISSING" }),
    )
  })

  it("warns when an availability target has no failure scenario", () => {
    const graph = structuredClone(chatMessageFlow)
    const fallible = graph.nodes.find((node) => node.type === "function.service")
    if (!fallible) throw new Error("Fixture requires a function node")
    fallible.config.failureRate = 0
    graph.failureScenarios = []
    graph.architectureGoals = {
      ...graph.architectureGoals,
      minimumAvailabilityPercent: 99.9,
      orderingRequirement: "per-key",
    }

    expect(validateGoals(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "GOAL_AVAILABILITY_UNTESTED" }),
    )

    graph.nodes[1].availabilityPolicy = {
      mode: "scheduled",
      offlineFromSeconds: 60,
      offlineDurationSeconds: 30,
      recoverySeconds: 15,
      degradedCapacityPercent: 100,
    }
    expect(validateGoals(graph, nodeRegistry)).not.toContainEqual(
      expect.objectContaining({ code: "GOAL_AVAILABILITY_UNTESTED" }),
    )

    // A declared failure scenario also counts as exercising the target.
    graph.nodes[1].availabilityPolicy = undefined
    graph.failureScenarios = structuredClone(chatMessageFlow.failureScenarios)
    expect(validateGoals(graph, nodeRegistry)).not.toContainEqual(
      expect.objectContaining({ code: "GOAL_AVAILABILITY_UNTESTED" }),
    )
  })

  it("rejects goal values outside their valid ranges", () => {
    const graph = structuredClone(productViewedFlow)
    graph.architectureGoals = {
      averageTrafficPerSecond: -5,
      minimumAvailabilityPercent: 120,
      orderingRequirement: "none",
    }

    expect(validateGoals(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "INVALID_GOALS", severity: "error" }),
    )
  })
})
