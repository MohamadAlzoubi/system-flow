import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { ArchitectureBoundary } from "../../contracts"

const schema = z.object({
  label: z.string().min(1),
  regionCode: z
    .string()
    .min(1)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
      message: "Use lowercase letters, numbers, and hyphens.",
    }),
  owner: z.string(),
  parentId: z.string(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  region: ArchitectureBoundary
  parentOptions: ArchitectureBoundary[]
  onSave: (region: ArchitectureBoundary) => void
}

export function RegionEditorForm({ region, parentOptions, onSave }: Props) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      label: region.label,
      regionCode: region.regionCode ?? region.id,
      owner: region.owner ?? "",
      parentId: region.parentId ?? "",
    },
  })

  const submit = (values: FormValues) => {
    const result = schema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field as keyof FormValues, { message: issue.message })
        }
      }
      return
    }
    const parsed = result.data
    onSave({
      ...region,
      kind: "region",
      label: parsed.label.trim(),
      regionCode: parsed.regionCode.trim(),
      owner: parsed.owner.trim() || undefined,
      parentId: parsed.parentId || undefined,
    })
  }

  return (
    <form className="region-form" onSubmit={handleSubmit(submit)}>
      <label htmlFor="region-label">
        Region name
        <Input id="region-label" {...register("label")} />
        {errors.label && <small className="field-error">{errors.label.message}</small>}
      </label>
      <label htmlFor="region-code">
        Region code
        <Input id="region-code" placeholder="us-east-1" {...register("regionCode")} />
        {errors.regionCode ? (
          <small className="field-error">{errors.regionCode.message}</small>
        ) : (
          <small className="select-hint">
            Used for node placement and cross-region network policies.
          </small>
        )}
      </label>
      <label htmlFor="region-owner">
        Owner
        <Input id="region-owner" placeholder="platform-sre" {...register("owner")} />
      </label>
      <label htmlFor="region-parent">
        Parent boundary
        <select id="region-parent" {...register("parentId")}>
          <option value="">No parent</option>
          {parentOptions.map((boundary) => (
            <option key={boundary.id} value={boundary.id}>
              {boundary.label} ({boundary.kind})
            </option>
          ))}
        </select>
      </label>
      <Button className="inspector-save" type="submit">
        Save region
      </Button>
    </form>
  )
}
