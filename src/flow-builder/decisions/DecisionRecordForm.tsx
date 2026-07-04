import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type {
  ArchitectureAssumption,
  DecisionRecord,
  DecisionStatus,
} from "../../contracts"

const schema = z.object({
  title: z.string().min(1),
  status: z.enum(["proposed", "accepted", "rejected", "superseded"]),
  context: z.string(),
  decision: z.string(),
  alternatives: z.string(),
  consequences: z.string(),
  reviewDate: z.string(),
})

type FormValues = z.infer<typeof schema>

const linesToList = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

type Props = {
  record: DecisionRecord
  assumptions: ArchitectureAssumption[]
  onSave: (record: DecisionRecord) => void
}

export function DecisionRecordForm({ record, assumptions, onSave }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: record.title,
      status: record.status,
      context: record.context,
      decision: record.decision,
      alternatives: record.alternatives.join("\n"),
      consequences: record.consequences.join("\n"),
      reviewDate: record.reviewDate ?? "",
    },
  })

  const submit = (values: FormValues) => {
    onSave({
      ...record,
      title: values.title.trim(),
      status: values.status as DecisionStatus,
      context: values.context,
      decision: values.decision,
      alternatives: linesToList(values.alternatives),
      consequences: linesToList(values.consequences),
      reviewDate: values.reviewDate || undefined,
    })
  }

  // Assumption links commit immediately so checkbox state cannot drift from the
  // rest of the form draft.
  const toggleAssumption = (id: string) => {
    const next = record.assumptionIds.includes(id)
      ? record.assumptionIds.filter((existing) => existing !== id)
      : [...record.assumptionIds, id]
    onSave({ ...record, assumptionIds: next })
  }

  return (
    <form className="decision-form" onSubmit={handleSubmit(submit)}>
      <label htmlFor="decision-title">
        Title
        <Input id="decision-title" {...register("title")} />
        {errors.title && <small className="field-error">{errors.title.message}</small>}
      </label>
      <label htmlFor="decision-status">
        Status
        <select id="decision-status" {...register("status")}>
          <option value="proposed">Proposed</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="superseded">Superseded</option>
        </select>
      </label>
      <label htmlFor="decision-context">
        Context
        <textarea
          id="decision-context"
          rows={2}
          placeholder="What forces led to this decision"
          {...register("context")}
        />
      </label>
      <label htmlFor="decision-decision">
        Decision
        <textarea
          id="decision-decision"
          rows={2}
          placeholder="What was decided"
          {...register("decision")}
        />
      </label>
      <label htmlFor="decision-alternatives">
        Alternatives (one per line)
        <textarea id="decision-alternatives" rows={2} {...register("alternatives")} />
      </label>
      <label htmlFor="decision-consequences">
        Consequences (one per line)
        <textarea id="decision-consequences" rows={2} {...register("consequences")} />
      </label>
      <label htmlFor="decision-review">
        Review date
        <Input id="decision-review" type="date" {...register("reviewDate")} />
      </label>
      {assumptions.length > 0 && (
        <fieldset className="ownership-set">
          <legend>Linked assumptions</legend>
          {assumptions.map((assumption) => (
            <label className="contract-flag" key={assumption.id}>
              <input
                type="checkbox"
                checked={record.assumptionIds.includes(assumption.id)}
                onChange={() => toggleAssumption(assumption.id)}
              />
              {assumption.statement || assumption.id}
            </label>
          ))}
        </fieldset>
      )}
      {(record.relatedNodeIds.length > 0 || record.relatedEdgeIds.length > 0) && (
        <p className="goal-hint">
          Linked to {[...record.relatedNodeIds, ...record.relatedEdgeIds].join(", ")}
        </p>
      )}
      <Button className="inspector-save" type="submit">
        Save decision
      </Button>
    </form>
  )
}
