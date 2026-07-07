import { describe, expect, it } from "vitest"
import type { ArchitectureBoundary, NodeInstance } from "../../contracts"
import {
  defaultRegionCanvasLayout,
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
})
