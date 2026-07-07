import { describe, expect, it } from "vitest"
import type { ArchitectureGoals } from "../../contracts"
import { evaluateGoals, type GoalMeasurements } from "./evaluate-goals"

const healthyMeasurements: GoalMeasurements = {
  averageLatencyMs: 250,
  p95LatencyMs: 600,
  sourceRatePerSecond: 500,
  bottleneckRatio: 2,
  lostEvents: 0,
  availabilityPercent: 100,
}

describe("evaluateGoals", () => {
  it("marks a flow without goals as an open question", () => {
    const report = evaluateGoals(undefined, healthyMeasurements)

    expect(report.evaluations).toEqual([])
    expect(report.openQuestions).toEqual([
      "No architecture goals are declared for this flow.",
    ])
  })

  it("is deterministic for the same goals and measurements", () => {
    const goals: ArchitectureGoals = {
      averageTrafficPerSecond: 500,
      peakTrafficPerSecond: 1500,
      orderingRequirement: "per-key",
    }

    expect(evaluateGoals(goals, healthyMeasurements)).toEqual(
      evaluateGoals(goals, healthyMeasurements),
    )
  })

  it("extrapolates sustainable traffic from the bottleneck ratio", () => {
    const report = evaluateGoals(
      {
        averageTrafficPerSecond: 500,
        peakTrafficPerSecond: 1500,
        orderingRequirement: "none",
      },
      healthyMeasurements,
    )

    expect(report.evaluations).toContainEqual(
      expect.objectContaining({
        goal: "averageTrafficPerSecond",
        status: "passed",
        actual: 1000,
        safetyMarginPercent: 100,
      }),
    )
    expect(report.evaluations).toContainEqual(
      expect.objectContaining({
        goal: "peakTrafficPerSecond",
        status: "failed",
        actual: 1000,
        safetyMarginPercent: -33.33,
      }),
    )
    expect(report.assumptions).toContainEqual(
      expect.stringContaining("extrapolated linearly"),
    )
  })

  it("cannot evaluate traffic goals without a capacity limit", () => {
    const report = evaluateGoals(
      { peakTrafficPerSecond: 1500, orderingRequirement: "none" },
      { ...healthyMeasurements, bottleneckRatio: undefined },
    )

    expect(report.evaluations).toContainEqual(
      expect.objectContaining({
        goal: "peakTrafficPerSecond",
        status: "not-evaluated",
      }),
    )
  })

  it("compares latency, availability, and data loss against targets", () => {
    const report = evaluateGoals(
      {
        maximumAverageLatencyMs: 300,
        maximumP95LatencyMs: 500,
        minimumAvailabilityPercent: 99.9,
        maximumDataLossEvents: 0,
        orderingRequirement: "none",
      },
      { ...healthyMeasurements, lostEvents: 1200 },
    )

    expect(report.evaluations).toContainEqual(
      expect.objectContaining({
        goal: "maximumAverageLatencyMs",
        status: "passed",
        safetyMarginPercent: 16.67,
      }),
    )
    expect(report.evaluations).toContainEqual(
      expect.objectContaining({ goal: "maximumP95LatencyMs", status: "failed" }),
    )
    expect(report.evaluations).toContainEqual(
      expect.objectContaining({
        goal: "minimumAvailabilityPercent",
        status: "passed",
      }),
    )
    expect(report.evaluations).toContainEqual(
      expect.objectContaining({
        goal: "maximumDataLossEvents",
        status: "failed",
        actual: 1200,
        safetyMarginPercent: undefined,
      }),
    )
    expect(report.passed).toBe(2)
    expect(report.failed).toBe(2)
  })

  it("reports goals the simulator cannot measure yet", () => {
    const report = evaluateGoals(
      {
        maximumRecoveryTimeSeconds: 300,
        maximumRecoveryPointSeconds: 60,
        maximumDataStalenessMs: 5000,
        orderingRequirement: "global",
      },
      healthyMeasurements,
    )

    expect(report.notEvaluated).toBe(4)
    for (const evaluation of report.evaluations) {
      expect(evaluation.status).toBe("not-evaluated")
      expect(evaluation.reason.length).toBeGreaterThan(0)
    }
  })

  it("passes and fails recovery and freshness goals when evidence is available", () => {
    const report = evaluateGoals(
      {
        maximumRecoveryTimeSeconds: 180,
        maximumRecoveryPointSeconds: 5,
        maximumDataStalenessMs: 1000,
        orderingRequirement: "none",
      },
      {
        ...healthyMeasurements,
        recoveryTimeSeconds: 150,
        recoveryPointSeconds: 12,
        dataStalenessMs: 500,
      },
    )

    expect(report.evaluations).toContainEqual(
      expect.objectContaining({
        goal: "maximumRecoveryTimeSeconds",
        status: "passed",
        actual: 150,
      }),
    )
    expect(report.evaluations).toContainEqual(
      expect.objectContaining({
        goal: "maximumRecoveryPointSeconds",
        status: "failed",
        actual: 12,
      }),
    )
    expect(report.evaluations).toContainEqual(
      expect.objectContaining({
        goal: "maximumDataStalenessMs",
        status: "passed",
        actual: 500,
      }),
    )
  })

  it("records undeclared goals as open questions", () => {
    const report = evaluateGoals(
      { averageTrafficPerSecond: 500, orderingRequirement: "none" },
      healthyMeasurements,
    )

    expect(report.openQuestions).toContain("Peak traffic has not been decided.")
    expect(report.openQuestions).toContain("Availability has not been decided.")
    expect(report.openQuestions).toContain("Data loss has not been decided.")
  })
})
