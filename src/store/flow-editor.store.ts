import { z } from "zod"
import { create } from "zustand"
import type {
  FlowEdge,
  FlowGraph,
  NodeInstance,
  SimulationBaseline,
  SimulationComparison,
  SimulationProfile,
  SimulationResult,
  ValidationIssue,
} from "../contracts"
import { compareSimulations } from "../engine"
import { productViewedFlow } from "../examples"
import { nodeRegistry } from "../node-registry"

type FlowEditorState = {
  graph: FlowGraph
  selectedNodeId: string | null
  selectedEdgeId: string | null
  activePanel: "analysis" | "validation"
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
  updateSimulationProfile: (profile: SimulationProfile) => void
  updateEdgeNetwork: (id: string, network: FlowEdge["network"]) => void
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
    if (parsed.success) return parsed.data as FlowGraph
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
