import { z } from "zod"
import { create } from "zustand"
import type {
  ArchitectureAssumption,
  ArchitectureBoundary,
  DataContract,
  DecisionRecord,
  FailureScenario,
  FlowEdge,
  FlowGraph,
  NodeInstance,
  RuleAcceptance,
  SimulationBaseline,
  SimulationComparison,
  SimulationProfile,
  SimulationResult,
  ValidationIssue,
} from "../contracts"
import {
  compareSimulations,
  inferInteractionDefaults,
  nextContractVersion,
  normalizeDataContract,
} from "../engine"
import { productViewedFlow } from "../examples"
import { nodeRegistry } from "../node-registry"

type FlowEditorState = {
  graph: FlowGraph
  selectedNodeId: string | null
  selectedEdgeId: string | null
  activePanel: "analysis" | "validation"
  activeScenarioId: string | null
  simulationResult: SimulationResult | null
  simulationBaseline: SimulationBaseline | null
  simulationComparison: SimulationComparison | null
  simulationTimeSeconds: number
  validationIssues: ValidationIssue[]
  isDirty: boolean
  isInspectorOpen: boolean
  isAnalysisOpen: boolean
  setGraph: (graph: FlowGraph) => void
  setSelectedNode: (id: string | null) => void
  setSelectedEdge: (id: string | null) => void
  setNodePosition: (id: string, position: NodeInstance["position"]) => void
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void
  updateNodePolicies: (
    id: string,
    routingMode: NodeInstance["routingPolicy"],
    mergeMode: NodeInstance["mergePolicy"],
  ) => void
  updateNodeAvailability: (
    id: string,
    availabilityPolicy: NodeInstance["availabilityPolicy"],
  ) => void
  updateNodeResponsibility: (
    id: string,
    boundaryId: NodeInstance["boundaryId"],
    responsibility: NodeInstance["responsibility"],
  ) => void
  updateNodeStateOwnership: (
    id: string,
    stateOwnership: NodeInstance["stateOwnership"],
  ) => void
  upsertBoundary: (boundary: ArchitectureBoundary) => void
  removeBoundary: (id: string) => void
  updateEdgeProtection: (id: string, protection: FlowEdge["protection"]) => void
  updateEdgeFailurePolicy: (id: string, failurePolicy: FlowEdge["failurePolicy"]) => void
  upsertFailureScenario: (scenario: FailureScenario) => void
  removeFailureScenario: (id: string) => void
  setActiveScenario: (id: string | null) => void
  acceptRuleFinding: (acceptance: RuleAcceptance, record?: DecisionRecord) => void
  revokeRuleAcceptance: (ruleCode: string, targetKey: string) => void
  upsertDecisionRecord: (record: DecisionRecord) => void
  removeDecisionRecord: (id: string) => void
  upsertAssumption: (assumption: ArchitectureAssumption) => void
  removeAssumption: (id: string) => void
  updateSimulationProfile: (profile: SimulationProfile) => void
  updateArchitectureGoals: (goals: FlowGraph["architectureGoals"]) => void
  updateEdgeNetwork: (id: string, network: FlowEdge["network"]) => void
  updateEdgeInteraction: (
    id: string,
    interaction: Pick<
      FlowEdge,
      "interactionType" | "timeoutMs" | "responseDataType" | "deliveryPolicy"
    >,
  ) => void
  updateEdgeContract: (
    id: string,
    dataType: string,
    dataTypeVersion: string | undefined,
  ) => void
  upsertDataContract: (
    contract: DataContract,
    previous?: { name: string; version: string },
  ) => void
  removeDataContract: (name: string, version: string) => void
  duplicateDataContract: (name: string, version: string) => void
  addNode: (type: string, position?: NodeInstance["position"]) => void
  addEdge: (edge: FlowEdge) => void
  removeNodes: (ids: string[]) => void
  removeEdges: (ids: string[]) => void
  setValidationIssues: (issues: ValidationIssue[]) => void
  setSimulationResult: (result: SimulationResult | null) => void
  captureSimulationBaseline: () => void
  clearSimulationBaseline: () => void
  setSimulationTimeSeconds: (timeSeconds: number) => void
  setInspectorOpen: (open: boolean) => void
  setAnalysisOpen: (open: boolean) => void
}

const storageKey = "system-flow.graph.v1"
const savedGraphSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    nodes: z.array(
      z
        .object({
          id: z.string(),
          type: z.string(),
          position: z.object({ x: z.number(), y: z.number() }),
          config: z.record(z.string(), z.unknown()),
        })
        .passthrough(),
    ),
    edges: z.array(
      z
        .object({
          id: z.string(),
          fromNodeId: z.string(),
          toNodeId: z.string(),
          dataType: z.string(),
        })
        .passthrough(),
    ),
    dataContracts: z.array(z.unknown()),
    simulationProfile: z
      .object({
        durationSeconds: z.number(),
        cpuCores: z.number(),
        memoryMb: z.number(),
        networkLatencyMs: z.number(),
        requestsPerSecond: z.number(),
        trafficPattern: z.enum(["steady", "burst", "daily-peak", "random"]),
      })
      .passthrough(),
  })
  .passthrough()

function loadSavedGraph(): FlowGraph {
  if (typeof window === "undefined") return productViewedFlow
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "null")
    const parsed = savedGraphSchema.safeParse(value)
    if (parsed.success) {
      const graph = parsed.data as FlowGraph
      return {
        ...graph,
        // Graphs saved before interaction types migrate with inferred defaults.
        edges: graph.edges.map((edge) =>
          edge.interactionType
            ? edge
            : { ...edge, ...inferInteractionDefaults(edge, graph.nodes, nodeRegistry) },
        ),
        // Contracts saved as raw schema objects migrate to structured fields.
        dataContracts: graph.dataContracts.map(normalizeDataContract),
      }
    }
  } catch {
    // Ignore invalid or outdated local data and use the bundled example.
  }
  return productViewedFlow
}

export const useFlowEditorStore = create<FlowEditorState>((set) => ({
  graph: loadSavedGraph(),
  selectedNodeId: null,
  selectedEdgeId: null,
  activePanel: "analysis",
  activeScenarioId: null,
  simulationResult: null,
  simulationBaseline: null,
  simulationComparison: null,
  simulationTimeSeconds: 0,
  validationIssues: [],
  isDirty: false,
  isInspectorOpen: true,
  isAnalysisOpen: false,
  setGraph: (graph) =>
    set({
      graph,
      selectedNodeId: null,
      selectedEdgeId: null,
      activeScenarioId: null,
      simulationResult: null,
      simulationBaseline: null,
      simulationComparison: null,
      simulationTimeSeconds: 0,
      validationIssues: [],
      isDirty: false,
    }),
  setSelectedNode: (selectedNodeId) => set({ selectedNodeId, selectedEdgeId: null }),
  setSelectedEdge: (selectedEdgeId) => set({ selectedEdgeId, selectedNodeId: null }),
  setNodePosition: (id, position) =>
    set((state) => ({
      graph: {
        ...state.graph,
        nodes: state.graph.nodes.map((node) =>
          node.id === id ? { ...node, position } : node,
        ),
      },
      isDirty: true,
    })),
  updateNodeConfig: (id, config) =>
    set((state) => ({
      graph: {
        ...state.graph,
        nodes: state.graph.nodes.map((node) =>
          node.id === id ? { ...node, config } : node,
        ),
      },
      isDirty: true,
    })),
  updateNodePolicies: (id, routingPolicy, mergePolicy) =>
    set((state) => ({
      graph: {
        ...state.graph,
        nodes: state.graph.nodes.map((node) =>
          node.id === id ? { ...node, routingPolicy, mergePolicy } : node,
        ),
      },
      isDirty: true,
    })),
  updateNodeAvailability: (id, availabilityPolicy) =>
    set((state) => ({
      graph: {
        ...state.graph,
        nodes: state.graph.nodes.map((node) =>
          node.id === id ? { ...node, availabilityPolicy } : node,
        ),
      },
      simulationResult: null,
      simulationComparison: null,
      validationIssues: [],
      isDirty: true,
    })),
  updateSimulationProfile: (simulationProfile) =>
    set((state) => ({
      graph: { ...state.graph, simulationProfile },
      simulationResult: null,
      simulationComparison: null,
      validationIssues: [],
      isDirty: true,
    })),
  updateArchitectureGoals: (architectureGoals) =>
    set((state) => ({
      graph: { ...state.graph, architectureGoals },
      simulationResult: null,
      simulationComparison: null,
      validationIssues: [],
      isDirty: true,
    })),
  updateEdgeNetwork: (id, network) =>
    set((state) => ({
      graph: {
        ...state.graph,
        edges: state.graph.edges.map((edge) =>
          edge.id === id ? { ...edge, network } : edge,
        ),
      },
      simulationResult: null,
      simulationComparison: null,
      validationIssues: [],
      isDirty: true,
    })),
  updateEdgeInteraction: (id, interaction) =>
    set((state) => ({
      graph: {
        ...state.graph,
        edges: state.graph.edges.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                interactionType: interaction.interactionType,
                timeoutMs: interaction.timeoutMs,
                responseDataType: interaction.responseDataType,
                deliveryPolicy: interaction.deliveryPolicy,
              }
            : edge,
        ),
      },
      simulationResult: null,
      simulationComparison: null,
      validationIssues: [],
      isDirty: true,
    })),
  updateNodeResponsibility: (id, boundaryId, responsibility) =>
    set((state) => ({
      graph: {
        ...state.graph,
        nodes: state.graph.nodes.map((node) =>
          node.id === id ? { ...node, boundaryId, responsibility } : node,
        ),
      },
      validationIssues: [],
      isDirty: true,
    })),
  updateNodeStateOwnership: (id, stateOwnership) =>
    set((state) => ({
      graph: {
        ...state.graph,
        nodes: state.graph.nodes.map((node) =>
          node.id === id ? { ...node, stateOwnership } : node,
        ),
      },
      validationIssues: [],
      isDirty: true,
    })),
  upsertBoundary: (boundary) =>
    set((state) => {
      const boundaries = state.graph.boundaries ?? []
      const exists = boundaries.some((item) => item.id === boundary.id)
      return {
        graph: {
          ...state.graph,
          boundaries: exists
            ? boundaries.map((item) => (item.id === boundary.id ? boundary : item))
            : [...boundaries, boundary],
        },
        validationIssues: [],
        isDirty: true,
      }
    }),
  removeBoundary: (id) =>
    set((state) => ({
      graph: {
        ...state.graph,
        boundaries: (state.graph.boundaries ?? [])
          .filter((boundary) => boundary.id !== id)
          .map((boundary) =>
            boundary.parentId === id ? { ...boundary, parentId: undefined } : boundary,
          ),
        nodes: state.graph.nodes.map((node) =>
          node.boundaryId === id ? { ...node, boundaryId: undefined } : node,
        ),
      },
      validationIssues: [],
      isDirty: true,
    })),
  updateEdgeProtection: (id, protection) =>
    set((state) => ({
      graph: {
        ...state.graph,
        edges: state.graph.edges.map((edge) =>
          edge.id === id ? { ...edge, protection } : edge,
        ),
      },
      validationIssues: [],
      isDirty: true,
    })),
  updateEdgeFailurePolicy: (id, failurePolicy) =>
    set((state) => ({
      graph: {
        ...state.graph,
        edges: state.graph.edges.map((edge) =>
          edge.id === id ? { ...edge, failurePolicy } : edge,
        ),
      },
      simulationResult: null,
      simulationComparison: null,
      validationIssues: [],
      isDirty: true,
    })),
  upsertFailureScenario: (scenario) =>
    set((state) => {
      const scenarios = state.graph.failureScenarios ?? []
      const exists = scenarios.some((item) => item.id === scenario.id)
      return {
        graph: {
          ...state.graph,
          failureScenarios: exists
            ? scenarios.map((item) => (item.id === scenario.id ? scenario : item))
            : [...scenarios, scenario],
        },
        validationIssues: [],
        isDirty: true,
      }
    }),
  removeFailureScenario: (id) =>
    set((state) => ({
      graph: {
        ...state.graph,
        failureScenarios: (state.graph.failureScenarios ?? []).filter(
          (scenario) => scenario.id !== id,
        ),
      },
      activeScenarioId: state.activeScenarioId === id ? null : state.activeScenarioId,
      validationIssues: [],
      isDirty: true,
    })),
  setActiveScenario: (activeScenarioId) =>
    set({ activeScenarioId, simulationResult: null, simulationComparison: null }),
  acceptRuleFinding: (acceptance, record) =>
    set((state) => {
      // An accepted risk becomes a decision record so it survives export;
      // the id is derived so reopening can supersede the same record.
      const recordId = `acceptance:${acceptance.ruleCode}:${acceptance.targetKey}`
      const records = state.graph.decisionRecords ?? []
      const nextRecords = record
        ? [
            ...records.filter((existing) => existing.id !== recordId),
            { ...record, id: recordId, status: "accepted" as const },
          ]
        : records
      return {
        graph: {
          ...state.graph,
          ruleAcceptances: [
            ...(state.graph.ruleAcceptances ?? []).filter(
              (existing) =>
                existing.ruleCode !== acceptance.ruleCode ||
                existing.targetKey !== acceptance.targetKey,
            ),
            acceptance,
          ],
          decisionRecords: nextRecords,
        },
        isDirty: true,
      }
    }),
  revokeRuleAcceptance: (ruleCode, targetKey) =>
    set((state) => {
      const recordId = `acceptance:${ruleCode}:${targetKey}`
      return {
        graph: {
          ...state.graph,
          ruleAcceptances: (state.graph.ruleAcceptances ?? []).filter(
            (existing) =>
              existing.ruleCode !== ruleCode || existing.targetKey !== targetKey,
          ),
          // The decision stays visible as superseded rather than vanishing.
          decisionRecords: (state.graph.decisionRecords ?? []).map((existing) =>
            existing.id === recordId
              ? { ...existing, status: "superseded" as const }
              : existing,
          ),
        },
        isDirty: true,
      }
    }),
  upsertDecisionRecord: (record) =>
    set((state) => {
      const records = state.graph.decisionRecords ?? []
      const exists = records.some((existing) => existing.id === record.id)
      return {
        graph: {
          ...state.graph,
          decisionRecords: exists
            ? records.map((existing) => (existing.id === record.id ? record : existing))
            : [...records, record],
        },
        isDirty: true,
      }
    }),
  removeDecisionRecord: (id) =>
    set((state) => ({
      graph: {
        ...state.graph,
        decisionRecords: (state.graph.decisionRecords ?? []).filter(
          (record) => record.id !== id,
        ),
      },
      isDirty: true,
    })),
  upsertAssumption: (assumption) =>
    set((state) => {
      const assumptions = state.graph.assumptions ?? []
      const exists = assumptions.some((existing) => existing.id === assumption.id)
      return {
        graph: {
          ...state.graph,
          assumptions: exists
            ? assumptions.map((existing) =>
                existing.id === assumption.id ? assumption : existing,
              )
            : [...assumptions, assumption],
        },
        validationIssues: [],
        isDirty: true,
      }
    }),
  removeAssumption: (id) =>
    set((state) => ({
      graph: {
        ...state.graph,
        assumptions: (state.graph.assumptions ?? []).filter(
          (assumption) => assumption.id !== id,
        ),
        // Detach the removed assumption from any decision that referenced it.
        decisionRecords: (state.graph.decisionRecords ?? []).map((record) => ({
          ...record,
          assumptionIds: record.assumptionIds.filter(
            (assumptionId) => assumptionId !== id,
          ),
        })),
      },
      validationIssues: [],
      isDirty: true,
    })),
  updateEdgeContract: (id, dataType, dataTypeVersion) =>
    set((state) => ({
      graph: {
        ...state.graph,
        edges: state.graph.edges.map((edge) =>
          edge.id === id ? { ...edge, dataType, dataTypeVersion } : edge,
        ),
      },
      simulationResult: null,
      simulationComparison: null,
      validationIssues: [],
      isDirty: true,
    })),
  upsertDataContract: (contract, previous) =>
    set((state) => {
      const replaces = (candidate: DataContract) =>
        previous !== undefined &&
        candidate.name === previous.name &&
        candidate.version === previous.version
      const exists = state.graph.dataContracts.some(replaces)
      return {
        graph: {
          ...state.graph,
          dataContracts: exists
            ? state.graph.dataContracts.map((candidate) =>
                replaces(candidate) ? contract : candidate,
              )
            : [...state.graph.dataContracts, contract],
        },
        simulationResult: null,
        simulationComparison: null,
        validationIssues: [],
        isDirty: true,
      }
    }),
  removeDataContract: (name, version) =>
    set((state) => ({
      graph: {
        ...state.graph,
        dataContracts: state.graph.dataContracts.filter(
          (contract) => contract.name !== name || contract.version !== version,
        ),
      },
      simulationResult: null,
      simulationComparison: null,
      validationIssues: [],
      isDirty: true,
    })),
  duplicateDataContract: (name, version) =>
    set((state) => {
      const original = state.graph.dataContracts.find(
        (contract) => contract.name === name && contract.version === version,
      )
      if (!original) return state
      const takenVersions = new Set(
        state.graph.dataContracts
          .filter((contract) => contract.name === name)
          .map((contract) => contract.version),
      )
      let nextVersion = nextContractVersion(version)
      while (takenVersions.has(nextVersion)) {
        nextVersion = nextContractVersion(nextVersion)
      }
      return {
        graph: {
          ...state.graph,
          dataContracts: [
            ...state.graph.dataContracts,
            { ...structuredClone(original), version: nextVersion },
          ],
        },
        isDirty: true,
      }
    }),
  addNode: (type, position) =>
    set((state) => {
      const definition = nodeRegistry.get(type)
      if (!definition) return state
      const id = `${type}-${crypto.randomUUID()}`
      return {
        graph: {
          ...state.graph,
          nodes: [
            ...state.graph.nodes,
            {
              id,
              type,
              position: position ?? { x: 280, y: 160 },
              config: { ...definition.defaultConfig },
            },
          ],
        },
        selectedNodeId: id,
        isDirty: true,
      }
    }),
  addEdge: (edge) =>
    set((state) => ({
      graph: { ...state.graph, edges: [...state.graph.edges, edge] },
      isDirty: true,
    })),
  removeNodes: (ids) =>
    set((state) => ({
      graph: {
        ...state.graph,
        nodes: state.graph.nodes.filter((node) => !ids.includes(node.id)),
        edges: state.graph.edges.filter(
          (edge) => !ids.includes(edge.fromNodeId) && !ids.includes(edge.toNodeId),
        ),
      },
      selectedNodeId: ids.includes(state.selectedNodeId ?? "")
        ? null
        : state.selectedNodeId,
      isDirty: true,
    })),
  removeEdges: (ids) =>
    set((state) => ({
      graph: {
        ...state.graph,
        edges: state.graph.edges.filter((edge) => !ids.includes(edge.id)),
      },
      selectedEdgeId: ids.includes(state.selectedEdgeId ?? "")
        ? null
        : state.selectedEdgeId,
      isDirty: true,
    })),
  setValidationIssues: (validationIssues) => set({ validationIssues }),
  setSimulationResult: (simulationResult) =>
    set((state) => ({
      simulationResult,
      simulationComparison:
        simulationResult && state.simulationBaseline
          ? compareSimulations(state.simulationBaseline.result, simulationResult)
          : null,
      simulationTimeSeconds: 0,
    })),
  captureSimulationBaseline: () =>
    set((state) => {
      if (!state.simulationResult) return state
      return {
        simulationBaseline: {
          graphId: state.graph.id,
          graphName: state.graph.name,
          capturedAt: new Date().toISOString(),
          result: structuredClone(state.simulationResult),
        },
        simulationComparison: null,
      }
    }),
  clearSimulationBaseline: () =>
    set({ simulationBaseline: null, simulationComparison: null }),
  setSimulationTimeSeconds: (simulationTimeSeconds) => set({ simulationTimeSeconds }),
  setInspectorOpen: (isInspectorOpen) => set({ isInspectorOpen }),
  setAnalysisOpen: (isAnalysisOpen) => set({ isAnalysisOpen }),
}))

if (typeof window !== "undefined") {
  useFlowEditorStore.subscribe((state) => {
    window.localStorage.setItem(storageKey, JSON.stringify(state.graph))
  })
}
