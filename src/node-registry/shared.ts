import type { NodeDefinition } from "../contracts"

export const number = (value: unknown) => Number(value)

export const defineNode = (definition: NodeDefinition) => definition
