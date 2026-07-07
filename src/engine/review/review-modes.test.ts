import { describe, expect, it } from "vitest"
import { productViewedFlow } from "../../examples"
import { nodeRegistry } from "../../node-registry"
import {
  applyReviewAnswer,
  buildReviewQuestions,
  isReviewQuestionAnswered,
  reviewModes,
} from "./review-modes"

describe("review modes", () => {
  it("provides six deterministic focused review modes", () => {
    expect(reviewModes).toHaveLength(6)
    for (const mode of reviewModes) {
      const first = buildReviewQuestions(productViewedFlow, nodeRegistry, mode.id)
      expect(first.length).toBeGreaterThanOrEqual(3)
      expect(first).toEqual(
        buildReviewQuestions(productViewedFlow, nodeRegistry, mode.id),
      )
    }
  })

  it("covers every model-writing answer type", () => {
    const kinds = new Set(
      reviewModes.flatMap((mode) =>
        buildReviewQuestions(productViewedFlow, nodeRegistry, mode.id).map(
          (question) => question.answerKind,
        ),
      ),
    )
    expect(kinds).toEqual(
      new Set(["goal", "assumption", "decision", "failure-policy", "state-ownership"]),
    )
  })

  it("writes answers back into graph domain records", () => {
    const questions = reviewModes.flatMap((mode) =>
      buildReviewQuestions(productViewedFlow, nodeRegistry, mode.id),
    )
    const answers = {
      goal: "2500",
      assumption: "Provider recovery remains below five minutes.",
      decision: "Use additive schema evolution with a two-version migration window.",
      "failure-policy": "retry",
      "state-ownership": "ProductViewedEvent",
    } as const

    for (const answerKind of Object.keys(answers) as Array<keyof typeof answers>) {
      const question = questions.find((candidate) => candidate.answerKind === answerKind)
      if (!question) throw new Error(`Missing ${answerKind} question`)
      const graph = structuredClone(productViewedFlow)
      if (question.answerKind === "goal" && question.goalKey) {
        graph.architectureGoals = {
          ...(graph.architectureGoals ?? { orderingRequirement: "none" }),
          [question.goalKey]: undefined,
        }
      }
      if (question.answerKind === "failure-policy") {
        const edge = graph.edges.find((item) => item.id === question.targetId)
        if (edge) edge.failurePolicy = undefined
      }
      if (question.answerKind === "state-ownership") {
        const node = graph.nodes.find((item) => item.id === question.targetId)
        if (node) node.stateOwnership = undefined
      }
      expect(isReviewQuestionAnswered(graph, question)).toBe(false)
      const updated = applyReviewAnswer(graph, question, answers[answerKind])
      expect(isReviewQuestionAnswered(updated, question)).toBe(true)
    }
  })
})
