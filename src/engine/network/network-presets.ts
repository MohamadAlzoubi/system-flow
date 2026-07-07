import type { EdgeNetworkPolicy, NetworkPresetId } from "../../contracts"

export type NetworkPreset = {
  id: NetworkPresetId
  label: string
  description: string
  values: Omit<EdgeNetworkPolicy, "presetId" | "sourceRegion" | "targetRegion">
}

export const networkPresets: NetworkPreset[] = [
  {
    id: "same-availability-zone",
    label: "Same availability zone",
    description: "Low-latency private networking within one failure zone.",
    values: {
      bandwidthMbps: 10000,
      baseLatencyMs: 0.2,
      tlsHandshakeMs: 5,
      connectionReusePercent: 99,
      outagePercent: 0.01,
    },
  },
  {
    id: "same-region-cross-zone",
    label: "Same region, cross-zone",
    description: "Private traffic between availability zones in one region.",
    values: {
      bandwidthMbps: 5000,
      baseLatencyMs: 1.5,
      tlsHandshakeMs: 5,
      connectionReusePercent: 99,
      outagePercent: 0.05,
    },
  },
  {
    id: "same-continent",
    label: "Same continent",
    description: "Regional traffic over a provider backbone.",
    values: {
      bandwidthMbps: 2000,
      baseLatencyMs: 25,
      tlsHandshakeMs: 15,
      connectionReusePercent: 98,
      outagePercent: 0.1,
    },
  },
  {
    id: "cross-continent",
    label: "Cross-continent",
    description: "Long-haul regional traffic with meaningful propagation delay.",
    values: {
      bandwidthMbps: 1000,
      baseLatencyMs: 100,
      tlsHandshakeMs: 25,
      connectionReusePercent: 95,
      outagePercent: 0.5,
    },
  },
  {
    id: "public-internet-edge",
    label: "Public internet to edge",
    description: "Client or public traffic entering an edge service.",
    values: {
      bandwidthMbps: 500,
      baseLatencyMs: 35,
      tlsHandshakeMs: 30,
      connectionReusePercent: 85,
      outagePercent: 1,
    },
  },
  {
    id: "private-backbone-regions",
    label: "Private backbone between regions",
    description: "Cross-region service traffic over a managed private backbone.",
    values: {
      bandwidthMbps: 5000,
      baseLatencyMs: 65,
      tlsHandshakeMs: 10,
      connectionReusePercent: 99,
      outagePercent: 0.1,
    },
  },
  {
    id: "external-provider-edge",
    label: "External provider edge",
    description: "Traffic to a third-party provider over the public internet.",
    values: {
      bandwidthMbps: 200,
      baseLatencyMs: 80,
      tlsHandshakeMs: 35,
      connectionReusePercent: 80,
      outagePercent: 2,
    },
  },
]

export function networkPresetById(id: NetworkPresetId): NetworkPreset | undefined {
  return networkPresets.find((preset) => preset.id === id)
}

export function applyNetworkPreset(
  preset: NetworkPreset,
  sourceRegion: string,
  targetRegion: string,
): EdgeNetworkPolicy {
  return {
    presetId: preset.id,
    sourceRegion,
    targetRegion,
    ...preset.values,
  }
}

export function suggestedNetworkPresetId(
  sourceRegion: string | undefined,
  targetRegion: string | undefined,
): NetworkPresetId | undefined {
  if (!sourceRegion || !targetRegion) return undefined
  return sourceRegion === targetRegion
    ? "same-region-cross-zone"
    : "private-backbone-regions"
}
