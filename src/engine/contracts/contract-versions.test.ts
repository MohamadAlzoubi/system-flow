import { describe, expect, it } from "vitest"
import type { DataContract } from "../../contracts"
import {
  compareContractVersions,
  nextContractVersion,
  resolveEdgeContract,
} from "./contract-versions"

function contract(name: string, version: string): DataContract {
  return {
    name,
    version,
    kind: "event",
    description: "",
    fields: [{ name: "id", type: "string", required: true }],
    estimatedSizeBytes: 100,
    compatibility: "backward",
  }
}

describe("contract versions", () => {
  it("compares versions numerically per segment", () => {
    expect(compareContractVersions("1.9", "1.10")).toBeLessThan(0)
    expect(compareContractVersions("2.0", "1.10")).toBeGreaterThan(0)
    expect(compareContractVersions("1.0", "1.0")).toBe(0)
  })

  it("bumps the last numeric segment for new versions", () => {
    expect(nextContractVersion("1.0")).toBe("1.1")
    expect(nextContractVersion("2")).toBe("3")
    expect(nextContractVersion("beta")).toBe("beta.1")
  })

  it("resolves the latest version unless the edge pins one", () => {
    const contracts = [
      contract("Order", "1.0"),
      contract("Order", "1.10"),
      contract("Order", "1.9"),
    ]

    expect(resolveEdgeContract(contracts, { dataType: "Order" })?.version).toBe("1.10")
    expect(
      resolveEdgeContract(contracts, { dataType: "Order", dataTypeVersion: "1.9" })
        ?.version,
    ).toBe("1.9")
    expect(
      resolveEdgeContract(contracts, { dataType: "Order", dataTypeVersion: "9.9" }),
    ).toBeUndefined()
    expect(resolveEdgeContract(contracts, { dataType: "Missing" })).toBeUndefined()
  })
})
