import { Database, Power, SlidersHorizontal, Split, Users } from "lucide-react"
import type { FlowGraph, NodeDefinition, NodeInstance } from "../../contracts"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { fallbackNodeIcon, nodeTypeIcons } from "../node-icons"
import { AvailabilityForm } from "./AvailabilityForm"
import { ConfigForm } from "./ConfigForm"
import { InspectorSection } from "./InspectorSection"
import { ResponsibilityForm } from "./ResponsibilityForm"
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

type SelectedNodeInspectorProps = {
  graph: FlowGraph
  node: NodeInstance
  definition: NodeDefinition
}

export function SelectedNodeInspector({
  graph,
  node,
  definition,
}: SelectedNodeInspectorProps) {
  const updateNodeConfig = useFlowEditorStore((state) => state.updateNodeConfig)
  const updateNodePolicies = useFlowEditorStore((state) => state.updateNodePolicies)
  const updateNodeResponsibility = useFlowEditorStore(
    (state) => state.updateNodeResponsibility,
  )
  const updateNodeStateOwnership = useFlowEditorStore(
    (state) => state.updateNodeStateOwnership,
  )
  const updateNodeAvailability = useFlowEditorStore(
    (state) => state.updateNodeAvailability,
  )
  const routingValue =
    node.routingPolicy?.mode ??
    (node.type === "network.load-balancer" ? "round-robin" : "broadcast")
  const mergeValue = node.mergePolicy?.mode ?? "sum"
  const NodeIcon = nodeTypeIcons[node.type] ?? fallbackNodeIcon

  return (
    <>
      <div className="inspector-title">
        <NodeIcon size={17} />
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
                mode: event.target.value as NonNullable<typeof node.mergePolicy>["mode"],
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
            onSave={(stateOwnership) => updateNodeStateOwnership(node.id, stateOwnership)}
          />
        </InspectorSection>
      )}
    </>
  )
}
