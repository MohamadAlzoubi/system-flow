import { LocateFixed, Save } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { ReviewModeId, ReviewQuestion } from "../../engine"
import { buildReviewQuestions, isReviewQuestionAnswered, reviewModes } from "../../engine"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"

type Props = {
  modeId: ReviewModeId
  onJump: (id: string) => void
}

function existingAnswer(
  graph: ReturnType<typeof useFlowEditorStore.getState>["graph"],
  question: ReviewQuestion,
): string {
  const answerId = `review-answer:${question.id}`
  switch (question.answerKind) {
    case "goal":
      return question.goalKey
        ? String(graph.architectureGoals?.[question.goalKey] ?? "")
        : ""
    case "assumption":
      return graph.assumptions?.find((item) => item.id === answerId)?.statement ?? ""
    case "decision":
      return graph.decisionRecords?.find((item) => item.id === answerId)?.decision ?? ""
    case "failure-policy":
      return (
        graph.edges.find((edge) => edge.id === question.targetId)?.failurePolicy
          ?.action ?? ""
      )
    case "state-ownership":
      return (
        graph.nodes
          .find((node) => node.id === question.targetId)
          ?.stateOwnership?.dataOwned.join(", ") ?? ""
      )
  }
}

function ReviewQuestionCard({
  question,
  onJump,
}: {
  question: ReviewQuestion
  onJump: (id: string) => void
}) {
  const graph = useFlowEditorStore((state) => state.graph)
  const answerReviewQuestion = useFlowEditorStore((state) => state.answerReviewQuestion)
  const [answer, setAnswer] = useState(() => existingAnswer(graph, question))
  const answered = isReviewQuestionAnswered(graph, question)
  const numericInvalid =
    question.answerKind === "goal" &&
    answer.trim() !== "" &&
    (!Number.isFinite(Number(answer)) || Number(answer) < 0)

  return (
    <article className={`review-question-card ${answered ? "answered" : ""}`}>
      <div className="review-question-head">
        <span>{question.answerKind.replace("-", " ")}</span>
        {answered && <b>Recorded</b>}
      </div>
      <strong>{question.prompt}</strong>
      <p>{question.rationale}</p>
      <div className="review-question-answer">
        {question.answerKind === "failure-policy" ? (
          <select
            aria-label={question.prompt}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
          >
            <option value="">Choose action…</option>
            <option value="propagate">Propagate failure</option>
            <option value="retry">Retry with bounded exponential backoff</option>
            <option value="queue">Queue for later</option>
            <option value="drop">Drop explicitly</option>
            <option value="dead-letter">Dead-letter</option>
          </select>
        ) : (
          <Input
            aria-label={question.prompt}
            type={question.answerKind === "goal" ? "number" : "text"}
            min={question.answerKind === "goal" ? 0 : undefined}
            step={question.answerKind === "goal" ? "any" : undefined}
            placeholder={question.placeholder}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
          />
        )}
        <Button
          disabled={!answer.trim() || numericInvalid}
          onClick={() => answerReviewQuestion(question, answer)}
        >
          <Save size={13} />
          {answered ? "Update answer" : "Record answer"}
        </Button>
        {question.targetId && (
          <Button variant="outline" onClick={() => onJump(question.targetId ?? "")}>
            <LocateFixed size={13} />
            View{" "}
            {graph.edges.some((edge) => edge.id === question.targetId) ? "edge" : "node"}
          </Button>
        )}
      </div>
      {numericInvalid && (
        <small className="field-error">Enter a non-negative number.</small>
      )}
    </article>
  )
}

export function ReviewModePanel({ modeId, onJump }: Props) {
  const graph = useFlowEditorStore((state) => state.graph)
  const mode = reviewModes.find((candidate) => candidate.id === modeId)
  const questions = useMemo(
    () => buildReviewQuestions(graph, nodeRegistry, modeId),
    [graph, modeId],
  )
  const answered = questions.filter((question) =>
    isReviewQuestionAnswered(graph, question),
  ).length

  return (
    <div className="guided-review">
      <div className="guided-review-summary">
        <span>
          <strong>{mode?.label}</strong>
          <small>{mode?.description}</small>
        </span>
        <b>
          {answered}/{questions.length} answered
        </b>
      </div>
      {questions.map((question) => (
        <ReviewQuestionCard key={question.id} question={question} onJump={onJump} />
      ))}
    </div>
  )
}
