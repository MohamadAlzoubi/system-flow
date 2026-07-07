import type { Node, NodeProps } from "@xyflow/react"
import { Globe2 } from "lucide-react"

export type RegionAvailabilityState = "healthy" | "degraded" | "offline" | "recovering"

export type RegionNodeData = {
  label: string
  regionCode: string
  owner?: string
  memberCount: number
  availabilityState: RegionAvailabilityState
}

export type RegionFlowNode = Node<RegionNodeData, "regionNode">

export function RegionNode({ data }: NodeProps<RegionFlowNode>) {
  return (
    <div className={`region-container region-${data.availabilityState}`}>
      <div className="region-container-title">
        <Globe2 size={15} />
        <span>
          <strong>{data.label}</strong>
          <small>{data.regionCode}</small>
        </span>
        <em>{data.availabilityState}</em>
      </div>
      <div className="region-container-meta">
        <span>{data.memberCount} nodes</span>
        {data.owner && <span>{data.owner}</span>}
      </div>
    </div>
  )
}
