import { describe, expect, it } from "vitest"
import {
  bottleneckFlow,
  chatMessageFlow,
  productViewedFlow,
  purchaseFlow,
} from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { generateBlueprint } from "./generate-blueprint"
import { renderBlueprintHtml } from "./render-html"
import { renderBlueprintMarkdown } from "./render-markdown"

describe("generateBlueprint", () => {
  it("is deterministic for the same project", () => {
    expect(generateBlueprint(purchaseFlow, nodeRegistry)).toEqual(
      generateBlueprint(purchaseFlow, nodeRegistry),
    )
  })

  it("covers every bundled example without throwing", () => {
    for (const flow of [
      productViewedFlow,
      purchaseFlow,
      chatMessageFlow,
      bottleneckFlow,
    ]) {
      const blueprint = generateBlueprint(flow, nodeRegistry)
      expect(blueprint.components).toHaveLength(flow.nodes.length)
      expect(blueprint.developmentSequence[0].title).toBe("Shared contracts")
    }
  })

  it("traces overview, ownership, and reliability to graph data", () => {
    const blueprint = generateBlueprint(purchaseFlow, nodeRegistry)

    expect(blueprint.overview.goals).toContain("Availability ≥ 99.9%")
    expect(blueprint.overview.boundaries).toContainEqual(
      expect.stringContaining("checkout-team"),
    )
    const database = blueprint.components.find((component) =>
      component.label.includes("Database"),
    )
    expect(database?.stateOwnership).toContain("strong consistency")
    expect(database?.owner).toBe("checkout-team")
    expect(blueprint.reliability.idempotency).toContainEqual(
      expect.stringContaining("orderId"),
    )
    expect(blueprint.reliability.retries.length).toBeGreaterThan(0)
  })

  it("orders development by dependency-aware phases", () => {
    const steps = generateBlueprint(bottleneckFlow, nodeRegistry).developmentSequence.map(
      (phase) => phase.step,
    )
    // Phases appear in ascending order and start with shared contracts.
    expect(steps).toEqual([...steps].sort((left, right) => left - right))
    expect(steps[0]).toBe(1)
  })

  it("carries failed goals, findings, and unverified assumptions into risks", () => {
    const blueprint = generateBlueprint(purchaseFlow, nodeRegistry)
    const categories = blueprint.risks.map((group) => group.category)

    expect(categories).toContain("Failed architecture goals")
    expect(categories).toContain("Unverified assumptions")
    const assumptions = blueprint.risks.find(
      (group) => group.category === "Unverified assumptions",
    )
    expect(assumptions?.items).toContainEqual(
      expect.stringContaining("payment provider honors idempotency keys"),
    )
  })

  it("omits risk groups that have no items", () => {
    // The chat flow has owners and no unverified assumptions, so those groups
    // should not appear.
    const blueprint = generateBlueprint(chatMessageFlow, nodeRegistry)
    const categories = blueprint.risks.map((group) => group.category)
    expect(categories).not.toContain("Missing owners")
    expect(categories).not.toContain("Unverified assumptions")
  })

  it("dedupes repeated test-plan items", () => {
    const blueprint = generateBlueprint(purchaseFlow, nodeRegistry)
    const duplicateGroup = blueprint.testPlan.find(
      (group) => group.category === "Duplicate delivery",
    )
    expect(duplicateGroup?.items).toEqual([...new Set(duplicateGroup?.items)])
  })

  it("builds a traceable production readiness handoff pack", () => {
    const graph = structuredClone(purchaseFlow)
    graph.boundaries = [
      ...(graph.boundaries ?? []),
      {
        id: "region-eu",
        label: "EU West",
        kind: "region",
        regionCode: "eu-west-1",
        owner: "platform",
      },
    ]
    graph.nodes[0].boundaryId = "region-eu"
    graph.nodes[0].responsibility = {
      ...graph.nodes[0].responsibility,
      deploymentRegion: "eu-west-1",
    }
    const assumptionId = graph.assumptions?.[0]?.id
    const decisionId = graph.decisionRecords?.[0]?.id
    const scenarioId = graph.failureScenarios?.[0]?.id
    if (!assumptionId || !decisionId || !scenarioId) {
      throw new Error("Fixture requires assumption, decision, and scenario records")
    }

    const blueprint = generateBlueprint(graph, nodeRegistry)

    expect(blueprint.handoff.regionalTopology).toContainEqual(
      expect.stringContaining(graph.nodes[0].id),
    )
    expect(blueprint.handoff.criticalAssumptions).toContainEqual(
      expect.stringContaining(assumptionId),
    )
    expect(blueprint.handoff.decisions).toContainEqual(
      expect.stringContaining(decisionId),
    )
    expect(blueprint.handoff.implementationTasks).toContainEqual(
      expect.stringContaining(graph.edges[0].id),
    )
    expect(blueprint.handoff.chaosTestPlan).toContainEqual(
      expect.stringContaining(scenarioId),
    )
    expect(blueprint.handoff.observabilityChecklist.length).toBeGreaterThan(0)
    expect(blueprint.handoff.runbookOutline.length).toBeGreaterThan(0)
    expect(blueprint.handoff.rolloutSequence.length).toBeGreaterThan(0)
  })
})

describe("blueprint renderers", () => {
  it("renders deterministic markdown with all top-level sections", () => {
    const blueprint = generateBlueprint(purchaseFlow, nodeRegistry)
    const markdown = renderBlueprintMarkdown(blueprint)

    expect(markdown).toBe(renderBlueprintMarkdown(blueprint))
    for (const heading of [
      "# Purchase Event Pipeline — Implementation Blueprint",
      "## System overview",
      "## Components to implement",
      "## Contracts and interfaces",
      "## Reliability plan",
      "## Development sequence",
      "## Test plan",
      "## Risks and open questions",
      "## Production readiness handoff",
      "### Regional topology",
      "### Load test plan",
      "### Chaos test plan",
      "### Observability checklist",
      "### Runbook outline",
      "### Rollout and migration sequence",
    ]) {
      expect(markdown).toContain(heading)
    }
  })

  it("renders self-contained, escaped HTML", () => {
    const graph = structuredClone(purchaseFlow)
    graph.name = "Flow <script>alert(1)</script>"
    const html = renderBlueprintHtml(generateBlueprint(graph, nodeRegistry))

    expect(html.startsWith("<!doctype html>")).toBe(true)
    expect(html).toContain("</html>")
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain("&lt;script&gt;")
  })
})
