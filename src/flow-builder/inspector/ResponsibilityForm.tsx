import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { ArchitectureBoundary, NodeInstance } from "../../contracts"

const schema = z.object({
  boundaryId: z.string(),
  owner: z.string(),
  deploymentRegion: z.string(),
  stateful: z.enum(["default", "stateful", "stateless"]),
  sourceOfTruth: z.boolean(),
  dataClassification: z.enum(["", "public", "internal", "confidential", "regulated"]),
  implementationStatus: z.enum([
    "",
    "planned",
    "in-progress",
    "implemented",
    "deprecated",
  ]),
  notes: z.string(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  node: NodeInstance
  boundaries: ArchitectureBoundary[]
  onSave: (
    boundaryId: NodeInstance["boundaryId"],
    responsibility: NodeInstance["responsibility"],
  ) => void
}

export function ResponsibilityForm({ node, boundaries, onSave }: Props) {
  const responsibility = node.responsibility
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      boundaryId: node.boundaryId ?? "",
      owner: responsibility?.owner ?? "",
      deploymentRegion: responsibility?.deploymentRegion ?? "",
      stateful:
        responsibility?.stateful === undefined
          ? "default"
          : responsibility.stateful
            ? "stateful"
            : "stateless",
      sourceOfTruth: responsibility?.sourceOfTruth ?? false,
      dataClassification: responsibility?.dataClassification ?? "",
      implementationStatus: responsibility?.implementationStatus ?? "",
      notes: responsibility?.notes ?? "",
    },
  })

  const submit = (values: FormValues) => {
    const next: NodeInstance["responsibility"] = {
      owner: values.owner.trim() || undefined,
      deploymentRegion: values.deploymentRegion.trim() || undefined,
      stateful:
        values.stateful === "default" ? undefined : values.stateful === "stateful",
      sourceOfTruth: values.sourceOfTruth || undefined,
      dataClassification: values.dataClassification || undefined,
      implementationStatus: values.implementationStatus || undefined,
      notes: values.notes.trim() || undefined,
      decisionRecordIds: responsibility?.decisionRecordIds,
    }
    const empty = Object.values(next).every((value) => value === undefined)
    onSave(values.boundaryId || undefined, empty ? undefined : next)
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <label htmlFor="responsibility-boundary">
        Boundary
        <select id="responsibility-boundary" {...register("boundaryId")}>
          <option value="">None</option>
          {boundaries.map((boundary) => (
            <option key={boundary.id} value={boundary.id}>
              {boundary.label} ({boundary.kind})
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="responsibility-owner">
        Owner or team
        <Input
          id="responsibility-owner"
          placeholder="Who answers for this component"
          {...register("owner")}
        />
      </label>
      <label htmlFor="responsibility-region">
        Deployment region
        <Input
          id="responsibility-region"
          placeholder="eu-west, us-east, …"
          {...register("deploymentRegion")}
        />
      </label>
      <label htmlFor="responsibility-stateful">
        State
        <select id="responsibility-stateful" {...register("stateful")}>
          <option value="default">Default for this component type</option>
          <option value="stateful">Stateful — holds data that must survive</option>
          <option value="stateless">Stateless — safe to replace anytime</option>
        </select>
      </label>
      <label className="contract-flag" htmlFor="responsibility-sot">
        <input id="responsibility-sot" type="checkbox" {...register("sourceOfTruth")} />
        Source of truth for the data it owns
      </label>
      <label htmlFor="responsibility-classification">
        Data classification
        <select id="responsibility-classification" {...register("dataClassification")}>
          <option value="">Undecided</option>
          <option value="public">Public</option>
          <option value="internal">Internal</option>
          <option value="confidential">Confidential</option>
          <option value="regulated">Regulated</option>
        </select>
      </label>
      <label htmlFor="responsibility-status">
        Implementation status
        <select id="responsibility-status" {...register("implementationStatus")}>
          <option value="">Undecided</option>
          <option value="planned">Planned</option>
          <option value="in-progress">In progress</option>
          <option value="implemented">Implemented</option>
          <option value="deprecated">Deprecated</option>
        </select>
      </label>
      <label htmlFor="responsibility-notes">
        Notes
        <Input
          id="responsibility-notes"
          placeholder="Decisions, links, caveats"
          {...register("notes")}
        />
      </label>
      <Button className="inspector-save" type="submit">
        Apply responsibility
      </Button>
    </form>
  )
}
