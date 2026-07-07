import { describe, expect, it } from "vitest"
import {
  applyNetworkPreset,
  networkPresetById,
  networkPresets,
  suggestedNetworkPresetId,
} from "./network-presets"

describe("network presets", () => {
  it("materializes every planning assumption into an explicit edge policy", () => {
    for (const preset of networkPresets) {
      expect(applyNetworkPreset(preset, "eu-west-1", "us-east-1")).toEqual({
        presetId: preset.id,
        sourceRegion: "eu-west-1",
        targetRegion: "us-east-1",
        ...preset.values,
      })
    }
  })

  it("suggests regional defaults without claiming provider-specific precision", () => {
    expect(suggestedNetworkPresetId("eu-west-1", "eu-west-1")).toBe(
      "same-region-cross-zone",
    )
    expect(suggestedNetworkPresetId("eu-west-1", "us-east-1")).toBe(
      "private-backbone-regions",
    )
    expect(networkPresetById("private-backbone-regions")?.description).toContain(
      "private backbone",
    )
  })
})
