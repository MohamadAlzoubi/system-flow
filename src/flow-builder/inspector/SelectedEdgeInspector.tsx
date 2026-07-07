import { ArrowLeftRight, Cable, FileJson2, ShieldAlert, Waypoints } from "lucide-react"
import type { FlowEdge, FlowGraph } from "../../contracts"
import { deploymentRegionOf } from "../../engine"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { EdgeNetworkForm } from "./EdgeNetworkForm"
import { FailurePolicyForm } from "./FailurePolicyForm"
import { InspectorSection } from "./InspectorSection"
import { InteractionForm } from "./InteractionForm"

type SelectedEdgeInspectorProps = {
  edge: FlowEdge
  graph: FlowGraph
}

export function SelectedEdgeInspector({ edge, graph }: SelectedEdgeInspectorProps) {
  const updateEdgeNetwork = useFlowEditorStore((state) => state.updateEdgeNetwork)
  const updateEdgeInteraction = useFlowEditorStore((state) => state.updateEdgeInteraction)
  const updateEdgeContract = useFlowEditorStore((state) => state.updateEdgeContract)
  const updateEdgeProtection = useFlowEditorStore((state) => state.updateEdgeProtection)
  const updateEdgeFailurePolicy = useFlowEditorStore(
    (state) => state.updateEdgeFailurePolicy,
  )
  const boundaries = new Map(
    (graph.boundaries ?? []).map((boundary) => [boundary.id, boundary]),
  )
  const edgeSource = graph.nodes.find((candidate) => candidate.id === edge.fromNodeId)
  const edgeTarget = graph.nodes.find((candidate) => candidate.id === edge.toNodeId)
  const edgeSourceRegion = edgeSource
    ? deploymentRegionOf(edgeSource, boundaries)
    : undefined
  const edgeTargetRegion = edgeTarget
    ? deploymentRegionOf(edgeTarget, boundaries)
    : undefined

  return (
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
            {!graph.dataContracts.some((contract) => contract.name === edge.dataType) && (
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
          sourceRegion={edgeSourceRegion}
          targetRegion={edgeTargetRegion}
          onSave={(network) => updateEdgeNetwork(edge.id, network)}
        />
      </InspectorSection>
    </>
  )
}
