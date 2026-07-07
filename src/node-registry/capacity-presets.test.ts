import { describe, expect, it } from "vitest"
import { nodeRegistry } from "."
import {
  applyCapacityPreset,
  capacityPresets,
  capacityPresetsFor,
} from "./capacity-presets"

describe("capacity presets", () => {
  it("produces explicit configs accepted by each node schema", () => {
    for (const preset of capacityPresets) {
      const definition = nodeRegistry.get(preset.nodeType)
      if (!definition) throw new Error(`Missing node type ${preset.nodeType}`)
      const config = applyCapacityPreset(definition.defaultConfig, preset)
      expect(definition.configSchema.safeParse(config).success).toBe(true)
      expect(config).toEqual(expect.objectContaining(preset.config))
    }
  })

  it("exposes multiple editable production shapes", () => {
    expect(capacityPresetsFor("redis.cache").length).toBeGreaterThanOrEqual(4)
    expect(capacityPresetsFor("worker").length).toBeGreaterThanOrEqual(2)
  })
})
