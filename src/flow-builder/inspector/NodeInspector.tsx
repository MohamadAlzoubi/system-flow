import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  Cable,
  Database,
  FileJson2,
  Gauge,
  Power,
  ShieldAlert,
  SlidersHorizontal,
  Split,
  Target,
  Users,
  Waypoints,
  X,
} from "lucide-react"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { fallbackNodeIcon, nodeTypeIcons } from "../node-icons"
import { ArchitectureGoalsForm } from "./ArchitectureGoalsForm"
import { AvailabilityForm } from "./AvailabilityForm"
import { BoundariesPanel } from "./BoundariesPanel"
import { ConfigForm } from "./ConfigForm"
import { EdgeNetworkForm } from "./EdgeNetworkForm"
import { FailurePolicyForm } from "./FailurePolicyForm"
import { InspectorSection } from "./InspectorSection"
import { InteractionForm } from "./InteractionForm"
import { ResponsibilityForm } from "./ResponsibilityForm"
import { ScenarioPanel } from "./ScenarioPanel"
import { SimulationProfileForm } from "./SimulationProfileForm"
import { StateOwnershipForm } from "./StateOwnershipForm"

const routingModes = [
  {
    value: "broadcast",
    label: "Broadcast — copy to every branch",
    hint: "Each outgoing edge receives the full stream.",
  },
  {
    value: "weighted",
    label: "Weighted — split by percentage",
    hint: "Traffic divides across branches; weights must total 100%.",
  },
  {
    value: "conditional",
    label: "Conditional — route by rules",
    hint: "Messages follow the first matching routing rule.",
  },
  {
    value: "round-robin",
    label: "Round robin — take turns",
    hint: "Each message takes the next branch in rotation.",
  },
  {
    value: "failover",
    label: "Failover — primary with backup",
    hint: "All traffic uses the first branch until it fails.",
  },
  {
    value: "competing-consumers",
    label: "Competing consumers — one receiver wins",
    hint: "Downstream consumers share the stream; each message is handled once.",
  },
] as const

const mergeModes = [
  {
    value: "sum",
    label: "Sum — combine all streams",
    hint: "Incoming rates simply add together.",
  },
  {
    value: "wait-all",
    label: "Wait for all — join inputs",
    hint: "Waits for every input; latency becomes the slowest branch.",
  },
  {
    value: "first-response",
    label: "First response — race inputs",
    hint: "Continues as soon as the fastest input arrives.",
  },
  {
    value: "asynchronous",
    label: "Asynchronous — independent inputs",
    hint: "Inputs are processed independently without joining.",
  },
] as const

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
  const routingValue = node?.routingPolicy?.mode ?? "broadcast"
  const mergeValue = node?.mergePolicy?.mode ?? "sum"
  const NodeIcon = node ? (nodeTypeIcons[node.type] ?? fallbackNodeIcon) : undefined

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
            {NodeIcon && <NodeIcon size={17} />}
            <div>
              <strong>{definition.label}</strong>
              <small>{definition.category}</small>
            </div>
          </div>
          <InspectorSection title="Configuration" icon={SlidersHorizontal} defaultOpen>
            <ConfigForm
              key={node.id}
              node={node}
              definition={definition}
              onSave={(config) => updateNodeConfig(node.id, config)}
            />
          </InspectorSection>
          <InspectorSection title="Traffic routing & merging" icon={Split}>
            <label>
              <span className="field-head">
                <span className="field-label">Outgoing traffic</span>
              </span>
              <select
                value={routingValue}
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
                {routingModes.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
              <small className="select-hint">
                {routingModes.find((mode) => mode.value === routingValue)?.hint}
              </small>
            </label>
            <label>
              <span className="field-head">
                <span className="field-label">Incoming traffic</span>
              </span>
              <select
                value={mergeValue}
                onChange={(event) =>
                  updateNodePolicies(node.id, node.routingPolicy, {
                    mode: event.target.value as NonNullable<
                      typeof node.mergePolicy
                    >["mode"],
                  })
                }
              >
                {mergeModes.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
              <small className="select-hint">
                {mergeModes.find((mode) => mode.value === mergeValue)?.hint}
              </small>
            </label>
          </InspectorSection>
          <InspectorSection title="Availability & outage" icon={Power}>
            <AvailabilityForm
              policy={node.availabilityPolicy}
              onSave={(policy) => updateNodeAvailability(node.id, policy)}
            />
          </InspectorSection>
          <InspectorSection title="Responsibility & boundary" icon={Users}>
            <ResponsibilityForm
              key={`responsibility-${node.id}`}
              node={node}
              boundaries={graph.boundaries ?? []}
              onSave={(boundaryId, responsibility) =>
                updateNodeResponsibility(node.id, boundaryId, responsibility)
              }
            />
          </InspectorSection>
          {definition.category === "Data" && (
            <InspectorSection title="State ownership" icon={Database}>
              <StateOwnershipForm
                key={`ownership-${node.id}`}
                node={node}
                graph={graph}
                onSave={(stateOwnership) =>
                  updateNodeStateOwnership(node.id, stateOwnership)
                }
              />
            </InspectorSection>
          )}
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
          <InspectorSection title="Data contract" icon={FileJson2} defaultOpen>
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
          </InspectorSection>
          <InspectorSection title="Interaction" icon={ArrowLeftRight} defaultOpen>
            <InteractionForm
              key={edge.id}
              edge={edge}
              onSave={(interaction) => updateEdgeInteraction(edge.id, interaction)}
            />
          </InspectorSection>
          <InspectorSection title="Failure policy" icon={ShieldAlert}>
            <FailurePolicyForm
              key={`failure-${edge.id}`}
              edge={edge}
              nodes={graph.nodes}
              onSave={(failurePolicy) => updateEdgeFailurePolicy(edge.id, failurePolicy)}
            />
          </InspectorSection>
          <InspectorSection title="Network topology" icon={Waypoints}>
            <EdgeNetworkForm
              key={edge.id}
              edge={edge}
              onSave={(network) => updateEdgeNetwork(edge.id, network)}
            />
          </InspectorSection>
        </>
      ) : (
        <>
          <div className="empty">
            Build freely: drag nodes from the library, connect them, then select any node
            or edge to tune it. The sections below apply to the whole flow.
          </div>
          <InspectorSection title="Design goals" icon={Target} defaultOpen>
            <ArchitectureGoalsForm
              key={graph.id}
              goals={graph.architectureGoals}
              onSave={updateArchitectureGoals}
            />
          </InspectorSection>
          <InspectorSection title="Simulation scenario" icon={Gauge}>
            <SimulationProfileForm
              profile={graph.simulationProfile}
              onSave={updateSimulationProfile}
            />
          </InspectorSection>
          <InspectorSection title="Failure scenarios" icon={AlertTriangle}>
            <ScenarioPanel />
          </InspectorSection>
          <InspectorSection title="Boundaries" icon={Boxes}>
            <BoundariesPanel />
          </InspectorSection>
        </>
      )}
    </aside>
  )
}
