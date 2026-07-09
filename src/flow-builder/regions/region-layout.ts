import type {
  ArchitectureBoundary,
  BoundaryCanvasLayout,
  NodeInstance,
} from "../../contracts"

export const systemNodeWidth = 176
export const systemNodeHeight = 64
export const regionMinWidth = 520
export const regionMinHeight = 320

export function defaultRegionCanvasLayout(index: number): BoundaryCanvasLayout {
  return {
    position: {
      x: 80 + (index % 2) * 820,
      y: 80 + Math.floor(index / 2) * 500,
    },
    width: 720,
    height: 420,
  }
}

export function initialRegionCanvasLayout(
  index: number,
  nodes: NodeInstance[],
): BoundaryCanvasLayout {
  const unassignedNodes = nodes.filter((node) => node.boundaryId === undefined)
  const anchorNodes = unassignedNodes.length > 0 ? unassignedNodes : nodes
  if (anchorNodes.length === 0) return defaultRegionCanvasLayout(index)

  return regionCanvasLayout(
    {
      id: "new-region-preview",
      label: "New region",
      kind: "region",
    },
    index,
    anchorNodes,
  )
}

export function regionCanvasLayout(
  region: ArchitectureBoundary,
  index: number,
  members: NodeInstance[],
): BoundaryCanvasLayout {
  if (region.canvasLayout) return region.canvasLayout
  if (members.length === 0) return defaultRegionCanvasLayout(index)

  const minX = Math.min(...members.map((node) => node.position.x))
  const minY = Math.min(...members.map((node) => node.position.y))
  const maxX = Math.max(...members.map((node) => node.position.x + systemNodeWidth))
  const maxY = Math.max(...members.map((node) => node.position.y + systemNodeHeight))

  return {
    position: { x: minX - 32, y: minY - 72 },
    width: Math.max(regionMinWidth, maxX - minX + 64),
    height: Math.max(regionMinHeight, maxY - minY + 104),
  }
}

export function regionAtPosition(
  position: NodeInstance["position"],
  regions: Array<{ id: string; layout: BoundaryCanvasLayout }>,
): string | undefined {
  const center = {
    x: position.x + systemNodeWidth / 2,
    y: position.y + systemNodeHeight / 2,
  }
  return regions.find(
    ({ layout }) =>
      center.x >= layout.position.x &&
      center.x <= layout.position.x + layout.width &&
      center.y >= layout.position.y &&
      center.y <= layout.position.y + layout.height,
  )?.id
}

export function nextPositionInRegion(
  layout: BoundaryCanvasLayout,
  memberCount: number,
): NodeInstance["position"] {
  const horizontalGap = 24
  const verticalGap = 24
  const usableWidth = Math.max(systemNodeWidth, layout.width - 64)
  const columns = Math.max(
    1,
    Math.floor((usableWidth + horizontalGap) / (systemNodeWidth + horizontalGap)),
  )
  const column = memberCount % columns
  const row = Math.floor(memberCount / columns)

  return {
    x: layout.position.x + 32 + column * (systemNodeWidth + horizontalGap),
    y: layout.position.y + 72 + row * (systemNodeHeight + verticalGap),
  }
}
