import {
  Background,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  MiniMap,
  type Node,
  type NodeChange,
  ReactFlow,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo } from "react"
import "@xyflow/react/dist/style.css"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { SystemNode } from "./SystemNode"

const nodeTypes = { systemNode: SystemNode }

export function FlowCanvas() {
  const graph = useFlowEditorStore((state) => state.graph)
  const addEdge = useFlowEditorStore((state) => state.addEdge)
  const removeEdges = useFlowEditorStore((state) => state.removeEdges)
  const removeNodes = useFlowEditorStore((state) => state.removeNodes)
  const setNodePosition = useFlowEditorStore((state) => state.setNodePosition)
  const setSelectedNode = useFlowEditorStore((state) => state.setSelectedNode)
  const setSelectedEdge = useFlowEditorStore((state) => state.setSelectedEdge)
  const selectedNodeId = useFlowEditorStore((state) => state.selectedNodeId)
  const selectedEdgeId = useFlowEditorStore((state) => state.selectedEdgeId)
  const result = useFlowEditorStore((state) => state.simulationResult)
  const simulationTime = useFlowEditorStore((state) => state.simulationTimeSeconds)
  const frame = result?.timeline.reduce(
    (selected, candidate) =>
      candidate.timeSeconds <= simulationTime ? candidate : selected,
    result.timeline[0],
  )
  const queueFrames = useMemo(
    () => new Map(frame?.queues.map((queue) => [queue.nodeId, queue])),
    [frame],
  )
  const serviceFrames = useMemo(
    () => new Map(frame?.services.map((service) => [service.nodeId, service])),
    [frame],
  )
  const datastoreFrames = useMemo(
    () => new Map(frame?.datastores.map((datastore) => [datastore.nodeId, datastore])),
    [frame],
  )
  const resilienceFrames = useMemo(
    () => new Map(frame?.resilience.map((resilience) => [resilience.nodeId, resilience])),
    [frame],
  )
  const nodeMetrics = useMemo(
    () => new Map(result?.nodeMetrics.map((metric) => [metric.nodeId, metric])),
    [result],
  )
  const edgeMetrics = useMemo(
    () => new Map(result?.edgeMetrics.map((metric) => [metric.edgeId, metric])),
    [result],
  )

  const nodes = useMemo<Node[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: "systemNode",
        position: node.position,
        selected: node.id === selectedNodeId,
        data: {
          nodeType: node.type,
          subtitle: String(node.config.eventType ?? node.config.queueName ?? ""),
          metrics: nodeMetrics.get(node.id),
          queueFrame: queueFrames.get(node.id),
          serviceFrame: serviceFrames.get(node.id),
          datastoreFrame: datastoreFrames.get(node.id),
          resilienceFrame: resilienceFrames.get(node.id),
        },
      })),
    [
      datastoreFrames,
      graph.nodes,
      nodeMetrics,
      queueFrames,
      resilienceFrames,
      selectedNodeId,
      serviceFrames,
    ],
  )
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => {
        const metrics = edgeMetrics.get(edge.id)
        const color =
          metrics?.status === "congested"
            ? "hsl(var(--danger))"
            : metrics
              ? "hsl(var(--primary))"
              : "hsl(214 15% 57%)"
        return {
          id: edge.id,
          source: edge.fromNodeId,
          target: edge.toNodeId,
          label: metrics
            ? `${edge.dataType} · ${metrics.ratePerSecond.toLocaleString()}/s${metrics.network ? ` · ${metrics.network.sourceRegion}→${metrics.network.targetRegion}` : ""}`
            : edge.dataType,
          animated: metrics?.status === "active",
          selected: edge.id === selectedEdgeId,
          style: {
            stroke: color,
            strokeWidth: metrics
              ? Math.min(5, 1.5 + Math.log10(metrics.ratePerSecond + 1))
              : 1,
          },
        }
      }),
    [edgeMetrics, graph.edges, selectedEdgeId],
  )

  useEffect(() => {
    const deleteSelection = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return
      }
      if (!selectedNodeId && !selectedEdgeId) return

      event.preventDefault()
      if (selectedNodeId) removeNodes([selectedNodeId])
      if (selectedEdgeId) removeEdges([selectedEdgeId])
    }

    window.addEventListener("keydown", deleteSelection)
    return () => window.removeEventListener("keydown", deleteSelection)
  }, [removeEdges, removeNodes, selectedEdgeId, selectedNodeId])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          setNodePosition(change.id, change.position)
        }
        if (change.type === "remove") removeNodes([change.id])
      }
    },
    [removeNodes, setNodePosition],
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      removeEdges(
        changes.filter((change) => change.type === "remove").map((change) => change.id),
      )
    },
    [removeEdges],
  )
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const dataType = graph.dataContracts[0]?.name ?? "Event"
      const edge: Edge = {
        id: `edge-${crypto.randomUUID()}`,
        source: connection.source,
        target: connection.target,
        label: dataType,
        animated: true,
      }
      addEdge({
        id: edge.id,
        fromNodeId: connection.source,
        toNodeId: connection.target,
        dataType,
      })
    },
    [addEdge, graph.dataContracts],
  )

  return (
    <section className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        onEdgeClick={(_, edge) => setSelectedEdge(edge.id)}
        onPaneClick={() => {
          setSelectedNode(null)
          setSelectedEdge(null)
        }}
        deleteKeyCode={null}
        fitView
      >
        <Background gap={18} size={1} />
        <Controls />
        <MiniMap pannable />
      </ReactFlow>
    </section>
  )
}
