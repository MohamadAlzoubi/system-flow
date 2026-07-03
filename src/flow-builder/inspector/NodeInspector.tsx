import { Box, Cable, X } from "lucide-react"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { ArchitectureGoalsForm } from "./ArchitectureGoalsForm"
import { AvailabilityForm } from "./AvailabilityForm"
import { BoundariesPanel } from "./BoundariesPanel"
import { ConfigForm } from "./ConfigForm"
import { EdgeNetworkForm } from "./EdgeNetworkForm"
import { FailurePolicyForm } from "./FailurePolicyForm"
import { InteractionForm } from "./InteractionForm"
import { ResponsibilityForm } from "./ResponsibilityForm"
import { ScenarioPanel } from "./ScenarioPanel"
import { SimulationProfileForm } from "./SimulationProfileForm"
import { StateOwnershipForm } from "./StateOwnershipForm"

export function NodeInspector() {
  const graph = useFlowEditorStore((state) => state.graph)
  const selectedNodeId = useFlowEditorStore((state) => state.selectedNodeId)
  const selectedEdgeId = useFlowEditorStore((state) => state.selectedEdgeId)
  const updateNodeConfig = useFlowEditorStore((state) => state.updateNodeConfig)
  const updateNodePolicies = useFlowEditorStore((state) => state.updateNodePolicies)
  const updateSimulationProfile = useFlowEditorStore(
    (state) => state.updateSimulationProfile,
  )
  const updateArchitectureGoals = useFlowEditorStore(
    (state) => state.updateArchitectureGoals,
  )
  const updateEdgeNetwork = useFlowEditorStore((state) => state.updateEdgeNetwork)
  const updateEdgeInteraction = useFlowEditorStore((state) => state.updateEdgeInteraction)
  const updateEdgeContract = useFlowEditorStore((state) => state.updateEdgeContract)
  const updateEdgeProtection = useFlowEditorStore((state) => state.updateEdgeProtection)
  const updateEdgeFailurePolicy = useFlowEditorStore(
    (state) => state.updateEdgeFailurePolicy,
  )
  const updateNodeResponsibility = useFlowEditorStore(
    (state) => state.updateNodeResponsibility,
  )
  const updateNodeStateOwnership = useFlowEditorStore(
    (state) => state.updateNodeStateOwnership,
  )
  const setInspectorOpen = useFlowEditorStore((state) => state.setInspectorOpen)
  const updateNodeAvailability = useFlowEditorStore(
    (state) => state.updateNodeAvailability,
  )
  const node = graph.nodes.find((item) => item.id === selectedNodeId)
  const edge = graph.edges.find((item) => item.id === selectedEdgeId)
  const definition = node ? nodeRegistry.get(node.type) : undefined

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <h2>Inspector</h2>
        <button
          type="button"
          onClick={() => setInspectorOpen(false)}
          aria-label="Close inspector"
        >
          <X size={15} />
        </button>
      </div>
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
          <h3>Responsibility & boundary</h3>
          <ResponsibilityForm
            key={`responsibility-${node.id}`}
            node={node}
            boundaries={graph.boundaries ?? []}
            onSave={(boundaryId, responsibility) =>
              updateNodeResponsibility(node.id, boundaryId, responsibility)
            }
          />
          {definition.category === "Data" && (
            <>
              <h3>State ownership</h3>
              <StateOwnershipForm
                key={`ownership-${node.id}`}
                node={node}
                graph={graph}
                onSave={(stateOwnership) =>
                  updateNodeStateOwnership(node.id, stateOwnership)
                }
              />
            </>
          )}
          <h3>Availability & outage</h3>
          <AvailabilityForm
            policy={node.availabilityPolicy}
            onSave={(policy) => updateNodeAvailability(node.id, policy)}
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
              {edge.responseDataType && <small>returns {edge.responseDataType}</small>}
            </div>
          </div>
          <h3>Data contract</h3>
          <label htmlFor="edge-contract">
            Carried contract
            <select
              id="edge-contract"
              value={`${edge.dataType}@@${edge.dataTypeVersion ?? ""}`}
              onChange={(event) => {
                const [dataType, version] = event.target.value.split("@@")
                updateEdgeContract(edge.id, dataType, version || undefined)
              }}
            >
              {!graph.dataContracts.some(
                (contract) => contract.name === edge.dataType,
              ) && (
                <option value={`${edge.dataType}@@${edge.dataTypeVersion ?? ""}`}>
                  {edge.dataType} (no contract defined)
                </option>
              )}
              {[...new Set(graph.dataContracts.map((contract) => contract.name))].map(
                (name) => (
                  <option key={name} value={`${name}@@`}>
                    {name} — latest
                  </option>
                ),
              )}
              {graph.dataContracts
                .filter(
                  (contract) =>
                    graph.dataContracts.filter((item) => item.name === contract.name)
                      .length > 1,
                )
                .map((contract) => (
                  <option
                    key={`${contract.name}@${contract.version}`}
                    value={`${contract.name}@@${contract.version}`}
                  >
                    {contract.name} — pinned v{contract.version}
                  </option>
                ))}
            </select>
          </label>
          <label htmlFor="edge-protection">
            Sensitive data protection
            <select
              id="edge-protection"
              value={edge.protection ?? ""}
              onChange={(event) =>
                updateEdgeProtection(
                  edge.id,
                  (event.target.value || undefined) as typeof edge.protection,
                )
              }
            >
              <option value="">None declared</option>
              <option value="tls">TLS in transit</option>
              <option value="field-encryption">Field-level encryption</option>
              <option value="tokenization">Tokenization</option>
            </select>
          </label>
          <h3>Interaction</h3>
          <InteractionForm
            key={edge.id}
            edge={edge}
            onSave={(interaction) => updateEdgeInteraction(edge.id, interaction)}
          />
          <h3>Failure policy</h3>
          <FailurePolicyForm
            key={`failure-${edge.id}`}
            edge={edge}
            nodes={graph.nodes}
            onSave={(failurePolicy) => updateEdgeFailurePolicy(edge.id, failurePolicy)}
          />
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
            Define what this design must achieve, configure the simulation scenario, or
            select a node to edit it.
          </div>
          <h3>Design goals</h3>
          <ArchitectureGoalsForm
            key={graph.id}
            goals={graph.architectureGoals}
            onSave={updateArchitectureGoals}
          />
          <h3>Boundaries</h3>
          <BoundariesPanel />
          <h3>Failure scenarios</h3>
          <ScenarioPanel />
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
