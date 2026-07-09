import { describe, expect, it } from "vitest"
import type { ArchitectureBoundary, NodeInstance } from "../../contracts"
import {
  defaultRegionCanvasLayout,
  initialRegionCanvasLayout,
  regionAtPosition,
  regionCanvasLayout,
} from "./region-layout"

describe("region canvas layout", () => {
  it("wraps imported region members when no layout was saved", () => {
    const region: ArchitectureBoundary = {
      id: "region-eu",
      label: "EU",
      kind: "region",
      regionCode: "eu-west-1",
    }
    const member = {
      id: "worker",
      type: "worker",
      position: { x: 300, y: 200 },
      config: {},
    } satisfies NodeInstance

    const layout = regionCanvasLayout(region, 0, [member])

    expect(layout.position.x).toBeLessThan(member.position.x)
    expect(layout.position.y).toBeLessThan(member.position.y)
    expect(regionAtPosition(member.position, [{ id: region.id, layout }])).toBe(region.id)
  })

  it("uses deterministic non-overlapping defaults", () => {
    expect(defaultRegionCanvasLayout(0).position).not.toEqual(
      defaultRegionCanvasLayout(1).position,
    )
  })

  it("places new regions around unassigned nodes", () => {
    const unassigned = {
      id: "worker",
      type: "worker",
      position: { x: 320, y: 260 },
      config: {},
    } satisfies NodeInstance
    const assigned = {
      id: "database",
      type: "database",
      position: { x: 1400, y: 900 },
      config: {},
      boundaryId: "existing-region",
    } satisfies NodeInstance

    const layout = initialRegionCanvasLayout(0, [unassigned, assigned])

    expect(regionAtPosition(unassigned.position, [{ id: "new-region", layout }])).toBe(
      "new-region",
    )
    expect(regionAtPosition(assigned.position, [{ id: "new-region", layout }])).toBe(
      undefined,
    )
  })

  it("places new regions around existing nodes when every node already has metadata", () => {
    const serviceNode = {
      id: "api",
      type: "http.endpoint",
      position: { x: 500, y: 320 },
      config: {},
      boundaryId: "service",
    } satisfies NodeInstance

    const layout = initialRegionCanvasLayout(0, [serviceNode])

    expect(regionAtPosition(serviceNode.position, [{ id: "new-region", layout }])).toBe(
      "new-region",
    )
  })
})
