import { Box, Cable } from "lucide-react"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { ConfigForm } from "./ConfigForm"
import { EdgeNetworkForm } from "./EdgeNetworkForm"
import { SimulationProfileForm } from "./SimulationProfileForm"

export function NodeInspector() {
  const graph = useFlowEditorStore((state) => state.graph)
  const selectedNodeId = useFlowEditorStore((state) => state.selectedNodeId)
  const selectedEdgeId = useFlowEditorStore((state) => state.selectedEdgeId)
  const updateNodeConfig = useFlowEditorStore((state) => state.updateNodeConfig)
  const updateNodePolicies = useFlowEditorStore((state) => state.updateNodePolicies)
  const updateSimulationProfile = useFlowEditorStore(
    (state) => state.updateSimulationProfile,
  )
  const updateEdgeNetwork = useFlowEditorStore((state) => state.updateEdgeNetwork)
  const node = graph.nodes.find((item) => item.id === selectedNodeId)
  const edge = graph.edges.find((item) => item.id === selectedEdgeId)
  const definition = node ? nodeRegistry.get(node.type) : undefined

  return (
    <aside className="inspector">
      <h2>Inspector</h2>
      {node && definition ? (
        <>
          <div className="inspector-title">
            <Box size={17} />
            <div>
              <strong>{definition.label}</strong>
              <small>{node.id}</small>
            </div>
          </div>
          <ConfigForm
            key={node.id}
            node={node}
            definition={definition}
            onSave={(config) => updateNodeConfig(node.id, config)}
          />
          <h3>Flow policies</h3>
          <label>
            Routing
            <select
              value={node.routingPolicy?.mode ?? "broadcast"}
              onChange={(event) =>
                updateNodePolicies(
                  node.id,
                  {
                    mode: event.target.value as NonNullable<
                      typeof node.routingPolicy
                    >["mode"],
                  },
                  node.mergePolicy,
                )
              }
            >
              {[
                "broadcast",
                "weighted",
                "conditional",
                "round-robin",
                "failover",
                "competing-consumers",
              ].map((mode) => (
                <option key={mode}>{mode}</option>
              ))}
            </select>
          </label>
          <label>
            Merge
            <select
              value={node.mergePolicy?.mode ?? "sum"}
              onChange={(event) =>
                updateNodePolicies(node.id, node.routingPolicy, {
                  mode: event.target.value as NonNullable<
                    typeof node.mergePolicy
                  >["mode"],
                })
              }
            >
              {["sum", "wait-all", "first-response", "asynchronous"].map((mode) => (
                <option key={mode}>{mode}</option>
              ))}
            </select>
          </label>
        </>
      ) : edge ? (
        <>
          <div className="inspector-title">
            <Cable size={17} />
            <div>
              <strong>{edge.dataType}</strong>
              <small>
                {edge.fromNodeId} → {edge.toNodeId}
              </small>
            </div>
          </div>
          <h3>Network topology</h3>
          <EdgeNetworkForm
            key={edge.id}
            edge={edge}
            onSave={(network) => updateEdgeNetwork(edge.id, network)}
          />
        </>
      ) : (
        <>
          <div className="empty">
            Configure the simulation scenario or select a node to edit it.
          </div>
          <h3>Simulation scenario</h3>
          <SimulationProfileForm
            profile={graph.simulationProfile}
            onSave={updateSimulationProfile}
          />
        </>
      )}
    </aside>
  )
}
