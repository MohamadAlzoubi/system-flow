import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type {
  ArchitectureAssumption,
  AssumptionImpact,
  AssumptionStatus,
} from "../../contracts"

const schema = z.object({
  statement: z.string().min(1),
  status: z.enum(["unverified", "verified", "invalid"]),
  impact: z.enum(["low", "medium", "high"]),
  evidence: z.string(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  assumption: ArchitectureAssumption
  onSave: (assumption: ArchitectureAssumption) => void
}

export function AssumptionForm({ assumption, onSave }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      statement: assumption.statement,
      status: assumption.status,
      impact: assumption.impact,
      evidence: assumption.evidence ?? "",
    },
  })

  const submit = (values: FormValues) => {
    onSave({
      ...assumption,
      statement: values.statement.trim(),
      status: values.status as AssumptionStatus,
      impact: values.impact as AssumptionImpact,
      evidence: values.evidence.trim() || undefined,
    })
  }

  return (
    <form className="decision-form" onSubmit={handleSubmit(submit)}>
      <label htmlFor="assumption-statement">
        Statement
        <textarea
          id="assumption-statement"
          rows={2}
          placeholder="Peak traffic will stay below 2,000 requests per second"
          {...register("statement")}
        />
        {errors.statement && (
          <small className="field-error">{errors.statement.message}</small>
        )}
      </label>
      <label htmlFor="assumption-status">
        Status
        <select id="assumption-status" {...register("status")}>
          <option value="unverified">Unverified</option>
          <option value="verified">Verified</option>
          <option value="invalid">Invalid — contradicted by evidence</option>
        </select>
      </label>
      <label htmlFor="assumption-impact">
        Impact if wrong
        <select id="assumption-impact" {...register("impact")}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label htmlFor="assumption-evidence">
        Evidence
        <Input
          id="assumption-evidence"
          placeholder="Link or note supporting the status"
          {...register("evidence")}
        />
      </label>
      <Button className="inspector-save" type="submit">
        Save assumption
      </Button>
    </form>
  )
}
