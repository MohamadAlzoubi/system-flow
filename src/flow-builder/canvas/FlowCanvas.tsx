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
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo } from "react"
import "@xyflow/react/dist/style.css"
import type { InteractionType } from "../../contracts"
import { inferInteractionDefaults } from "../../engine"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { nodeDragMimeType } from "../dnd"
import { regionAtPosition, regionCanvasLayout } from "../regions/region-layout"
import {
  type RegionAvailabilityState,
  type RegionFlowNode,
  RegionNode,
} from "./RegionNode"
import { SystemNode } from "./SystemNode"

const nodeTypes = { systemNode: SystemNode, regionNode: RegionNode }
const regionNodePrefix = "architecture-region:"

// Solid edges are synchronous; dashes mark asynchronous boundaries.
const interactionDashes: Record<InteractionType, string | undefined> = {
  "request-response": undefined,
  "database-operation": undefined,
  "async-command": "7 5",
  "published-event": "7 5",
  stream: "2 4",
  "realtime-push": "2 4",
  "batch-transfer": "14 6",
}

function regionAvailabilityState(
  memberIds: string[],
  availabilityFrames: Map<
    string,
    { state: "online" | "offline" | "degraded" | "recovering" }
  >,
): RegionAvailabilityState {
  const states = memberIds
    .map((id) => availabilityFrames.get(id)?.state)
    .filter((state) => state !== undefined)
  if (states.includes("offline")) return "offline"
  if (states.includes("recovering")) return "recovering"
  if (states.includes("degraded")) return "degraded"
  return "healthy"
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  )
}

function FlowCanvasInner() {
  const graph = useFlowEditorStore((state) => state.graph)
  const addEdge = useFlowEditorStore((state) => state.addEdge)
  const addNode = useFlowEditorStore((state) => state.addNode)
  const assignNodeToRegion = useFlowEditorStore((state) => state.assignNodeToRegion)
  const { screenToFlowPosition } = useReactFlow()
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
  const availabilityFrames = useMemo(
    () =>
      new Map(
        frame?.availability.map((availability) => [availability.nodeId, availability]),
      ),
    [frame],
  )
  const trafficFrames = useMemo(
    () => new Map(frame?.traffic.map((traffic) => [traffic.nodeId, traffic])),
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
  const regionLayouts = useMemo(
    () =>
      (graph.boundaries ?? [])
        .filter((boundary) => boundary.kind === "region")
        .map((region, index) => ({
          id: region.id,
          region,
          layout: regionCanvasLayout(
            region,
            index,
            graph.nodes.filter((node) => node.boundaryId === region.id),
          ),
        })),
    [graph.boundaries, graph.nodes],
  )

  const nodes = useMemo<Node[]>(() => {
    const regionNodes: RegionFlowNode[] = regionLayouts.map(({ region, layout }) => {
      const memberIds = graph.nodes
        .filter((node) => node.boundaryId === region.id)
        .map((node) => node.id)
      return {
        id: `${regionNodePrefix}${region.id}`,
        type: "regionNode",
        position: layout.position,
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        zIndex: -1,
        style: {
          width: layout.width,
          height: layout.height,
          pointerEvents: "none",
        },
        data: {
          label: region.label,
          regionCode: region.regionCode?.trim() || region.id,
          owner: region.owner,
          memberCount: memberIds.length,
          availabilityState: regionAvailabilityState(memberIds, availabilityFrames),
        },
      }
    })
    const systemNodes: Node[] = graph.nodes.map((node) => ({
      id: node.id,
      type: "systemNode",
      position: node.position,
      selected: node.id === selectedNodeId,
      zIndex: 1,
      data: {
        nodeType: node.type,
        subtitle: String(node.config.eventType ?? node.config.queueName ?? ""),
        boundaryLabel: graph.boundaries?.find(
          (boundary) => boundary.id === node.boundaryId,
        )?.label,
        owner: node.responsibility?.owner,
        metrics: nodeMetrics.get(node.id),
        queueFrame: queueFrames.get(node.id),
        serviceFrame: serviceFrames.get(node.id),
        datastoreFrame: datastoreFrames.get(node.id),
        resilienceFrame: resilienceFrames.get(node.id),
        availabilityFrame: availabilityFrames.get(node.id),
        // Traffic frames only surface while the user scrubs the timeline.
        trafficFrame: simulationTime > 0 ? trafficFrames.get(node.id) : undefined,
      },
    }))
    return [...regionNodes, ...systemNodes]
  }, [
    availabilityFrames,
    datastoreFrames,
    graph.boundaries,
    graph.nodes,
    nodeMetrics,
    queueFrames,
    regionLayouts,
    resilienceFrames,
    selectedNodeId,
    serviceFrames,
    simulationTime,
    trafficFrames,
  ])
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
            strokeDasharray: interactionDashes[edge.interactionType],
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
      const base = {
        id: `edge-${crypto.randomUUID()}`,
        fromNodeId: connection.source,
        toNodeId: connection.target,
        dataType,
      }
      addEdge({
        ...base,
        ...inferInteractionDefaults(base, graph.nodes, nodeRegistry),
      })
      setSelectedEdge(base.id)
    },
    [addEdge, graph.dataContracts, graph.nodes, setSelectedEdge],
  )
  const onDragOver = useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes(nodeDragMimeType)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      const type = event.dataTransfer.getData(nodeDragMimeType)
      if (!type) return
      event.preventDefault()
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      addNode(type, position, regionAtPosition(position, regionLayouts))
    },
    [addNode, regionLayouts, screenToFlowPosition],
  )
  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, flowNode: Node) => {
      if (flowNode.id.startsWith(regionNodePrefix)) return
      const graphNode = graph.nodes.find((node) => node.id === flowNode.id)
      if (!graphNode) return

      const nextRegionId = regionAtPosition(flowNode.position, regionLayouts)
      if (nextRegionId && nextRegionId !== graphNode.boundaryId) {
        assignNodeToRegion(graphNode.id, nextRegionId)
        return
      }
      const currentBoundary = (graph.boundaries ?? []).find(
        (boundary) => boundary.id === graphNode.boundaryId,
      )
      if (!nextRegionId && currentBoundary?.kind === "region") {
        assignNodeToRegion(graphNode.id, undefined)
      }
    },
    [assignNodeToRegion, graph.boundaries, graph.nodes, regionLayouts],
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
        onNodeDragStop={onNodeDragStop}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={(_, node) => {
          if (!node.id.startsWith(regionNodePrefix)) setSelectedNode(node.id)
        }}
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
