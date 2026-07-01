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
  updateSimulationProfile: (profile: SimulationProfile) => void
  addNode: (type: string, position?: NodeInstance["position"]) => void
  addEdge: (edge: FlowEdge) => void
  removeNodes: (ids: string[]) => void
  removeEdges: (ids: string[]) => void
  setValidationIssues: (issues: ValidationIssue[]) => void
  setSimulationResult: (result: SimulationResult | null) => void
  captureSimulationBaseline: () => void
  clearSimulationBaseline: () => void
  setSimulationTimeSeconds: (timeSeconds: number) => void
}

export const useFlowEditorStore = create<FlowEditorState>((set) => ({
  graph: productViewedFlow,
  selectedNodeId: null,
  selectedEdgeId: null,
  activePanel: "analysis",
  simulationResult: null,
  simulationBaseline: null,
  simulationComparison: null,
  simulationTimeSeconds: 0,
  validationIssues: [],
  isDirty: false,
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
  updateSimulationProfile: (simulationProfile) =>
    set((state) => ({
      graph: { ...state.graph, simulationProfile },
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
}))
