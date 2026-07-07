import { beforeEach, describe, expect, it } from "vitest"
import type { ArchitectureBoundary } from "../contracts"
import { buildReviewQuestions } from "../engine"
import { productViewedFlow } from "../examples"
import { nodeRegistry } from "../node-registry"
import { useFlowEditorStore } from "./flow-editor.store"

const region: ArchitectureBoundary = {
  id: "region-eu",
  label: "EU West",
  kind: "region",
  regionCode: "eu-west-1",
  canvasLayout: {
    position: { x: 80, y: 80 },
    width: 520,
    height: 300,
  },
}

describe("flow editor region assignment", () => {
  beforeEach(() => {
    useFlowEditorStore.getState().setGraph(structuredClone(productViewedFlow))
    useFlowEditorStore.getState().upsertBoundary(region)
  })

  it("derives deployment region when assigning a node", () => {
    const nodeId = useFlowEditorStore.getState().graph.nodes[0].id

    useFlowEditorStore.getState().assignNodeToRegion(nodeId, region.id)

    const node = useFlowEditorStore
      .getState()
      .graph.nodes.find((candidate) => candidate.id === nodeId)
    expect(node).toMatchObject({
      boundaryId: region.id,
      responsibility: { deploymentRegion: "eu-west-1" },
    })
  })

  it("updates assigned nodes when a region code changes", () => {
    const nodeId = useFlowEditorStore.getState().graph.nodes[0].id
    useFlowEditorStore.getState().assignNodeToRegion(nodeId, region.id)

    useFlowEditorStore.getState().upsertBoundary({
      ...region,
      regionCode: "eu-central-1",
    })

    const node = useFlowEditorStore
      .getState()
      .graph.nodes.find((candidate) => candidate.id === nodeId)
    expect(node?.responsibility?.deploymentRegion).toBe("eu-central-1")
  })

  it("clears only the deployment region derived from a removed assignment", () => {
    const nodeId = useFlowEditorStore.getState().graph.nodes[0].id
    const node = useFlowEditorStore
      .getState()
      .graph.nodes.find((candidate) => candidate.id === nodeId)
    useFlowEditorStore.getState().updateNodeResponsibility(nodeId, undefined, {
      ...node?.responsibility,
      owner: "platform",
    })
    useFlowEditorStore.getState().assignNodeToRegion(nodeId, region.id)

    useFlowEditorStore.getState().assignNodeToRegion(nodeId, undefined)

    const updated = useFlowEditorStore
      .getState()
      .graph.nodes.find((candidate) => candidate.id === nodeId)
    expect(updated?.boundaryId).toBeUndefined()
    expect(updated?.responsibility).toMatchObject({ owner: "platform" })
    expect(updated?.responsibility?.deploymentRegion).toBeUndefined()
  })

  it("marks legacy observed metrics with unknown provenance", () => {
    const graph = structuredClone(productViewedFlow)
    graph.simulationProfile.observedLatencyMs = 90
    graph.simulationProfile.observedThroughputPerSecond = 500

    useFlowEditorStore.getState().setGraph(graph)

    expect(useFlowEditorStore.getState().graph.simulationProfile).toEqual(
      expect.objectContaining({
        observedLatencySource: "unknown",
        observedThroughputSource: "unknown",
      }),
    )
  })

  it("persists guided review answers through the canonical graph store", () => {
    const question = buildReviewQuestions(
      useFlowEditorStore.getState().graph,
      nodeRegistry,
      "reliability",
    ).find((candidate) => candidate.answerKind === "goal")
    if (!question) throw new Error("Reliability review requires a goal question")

    useFlowEditorStore.getState().answerReviewQuestion(question, "240")

    expect(
      useFlowEditorStore.getState().graph.architectureGoals?.maximumRecoveryTimeSeconds,
    ).toBe(240)
    expect(useFlowEditorStore.getState().isDirty).toBe(true)
  })
})
