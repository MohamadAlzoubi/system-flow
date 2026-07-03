import { Trash2 } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { ContractField, DataContract } from "../../contracts"
import { buildContractExample } from "../../engine"

const fieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "object", "array", "timestamp"]),
  required: z.boolean(),
  description: z.string().optional(),
  example: z.string().optional(),
  sensitive: z.boolean().optional(),
})

const schema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  kind: z.enum(["command", "event", "request", "response", "record"]),
  description: z.string(),
  fields: z.array(fieldSchema).min(1),
  estimatedSizeBytes: z.number().positive(),
  idempotencyKey: z.string().optional(),
  correlationKey: z.string().optional(),
  partitionKey: z.string().optional(),
  retentionSeconds: z.number().positive().optional(),
  compatibility: z.enum(["backward", "forward", "full", "none"]),
})

type FormValues = z.infer<typeof schema>

function toFormValues(contract: DataContract): FormValues {
  return {
    ...contract,
    fields: contract.fields.map((field) => ({
      ...field,
      description: field.description ?? "",
      example:
        field.example === undefined
          ? ""
          : typeof field.example === "string"
            ? field.example
            : JSON.stringify(field.example),
      sensitive: field.sensitive ?? false,
    })),
    idempotencyKey: contract.idempotencyKey ?? "",
    correlationKey: contract.correlationKey ?? "",
    partitionKey: contract.partitionKey ?? "",
  }
}

function parseExample(value: string | undefined): unknown {
  if (!value) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function toContract(values: FormValues): DataContract {
  const fields: ContractField[] = values.fields.map((field) => ({
    name: field.name,
    type: field.type,
    required: field.required,
    description: field.description || undefined,
    example: parseExample(field.example),
    sensitive: field.sensitive || undefined,
  }))
  return {
    name: values.name.trim(),
    version: values.version.trim(),
    kind: values.kind,
    description: values.description,
    fields,
    estimatedSizeBytes: values.estimatedSizeBytes,
    idempotencyKey: values.idempotencyKey || undefined,
    correlationKey: values.correlationKey || undefined,
    partitionKey: values.partitionKey || undefined,
    retentionSeconds: values.retentionSeconds,
    compatibility: values.compatibility,
  }
}

type Props = {
  contract: DataContract
  onSave: (contract: DataContract) => void
}

export function ContractEditorForm({ contract, onSave }: Props) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: toFormValues(contract) })
  const { fields, append, remove } = useFieldArray({ control, name: "fields" })
  const watchedFields = watch("fields")
  const fieldNames = watchedFields.map((field) => field.name).filter(Boolean)
  const preview = buildContractExample({
    fields: watchedFields.map((field) => ({
      name: field.name,
      type: field.type,
      required: field.required,
      example: parseExample(field.example),
    })),
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
    onSave(toContract(result.data))
  }

  return (
    <form className="contract-editor" onSubmit={handleSubmit(submit)}>
      <div className="contract-editor-grid">
        <label htmlFor="contract-name">
          Name
          <Input id="contract-name" {...register("name")} />
          {errors.name && <small className="field-error">{errors.name.message}</small>}
        </label>
        <label htmlFor="contract-version">
          Version
          <Input id="contract-version" {...register("version")} />
        </label>
        <label htmlFor="contract-kind">
          Kind
          <select id="contract-kind" {...register("kind")}>
            <option value="command">Command — asks for an action</option>
            <option value="event">Event — states a fact</option>
            <option value="request">Request</option>
            <option value="response">Response</option>
            <option value="record">Record — stored state</option>
          </select>
        </label>
        <label htmlFor="contract-compatibility">
          Compatibility
          <select id="contract-compatibility" {...register("compatibility")}>
            <option value="backward">Backward — new readers accept old data</option>
            <option value="forward">Forward — old readers accept new data</option>
            <option value="full">Full — both directions</option>
            <option value="none">None — no evolution checks</option>
          </select>
        </label>
        <label htmlFor="contract-size">
          Estimated size (bytes)
          <Input
            id="contract-size"
            type="number"
            {...register("estimatedSizeBytes", { valueAsNumber: true })}
          />
        </label>
        <label htmlFor="contract-retention">
          Retention (seconds, optional)
          <Input
            id="contract-retention"
            type="number"
            {...register("retentionSeconds", {
              setValueAs: (value) =>
                value === "" || value === null ? undefined : Number(value),
            })}
          />
        </label>
      </div>
      <label htmlFor="contract-description">
        Description
        <Input
          id="contract-description"
          placeholder="What this data means and when it is produced"
          {...register("description")}
        />
      </label>

      <div className="contract-fields-head">
        <strong>Fields</strong>
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ name: "", type: "string", required: true })}
        >
          Add field
        </Button>
      </div>
      {errors.fields && (
        <small className="field-error">Declare at least one named field.</small>
      )}
      {fields.map((row, index) => (
        <div className="contract-field-row" key={row.id}>
          <Input
            aria-label="Field name"
            placeholder="fieldName"
            {...register(`fields.${index}.name`)}
          />
          <select aria-label="Field type" {...register(`fields.${index}.type`)}>
            {["string", "number", "boolean", "object", "array", "timestamp"].map(
              (type) => (
                <option key={type}>{type}</option>
              ),
            )}
          </select>
          <label className="contract-flag">
            <input type="checkbox" {...register(`fields.${index}.required`)} />
            required
          </label>
          <label className="contract-flag">
            <input type="checkbox" {...register(`fields.${index}.sensitive`)} />
            sensitive
          </label>
          <Input
            aria-label="Field description"
            placeholder="What this field means"
            {...register(`fields.${index}.description`)}
          />
          <Input
            aria-label="Field example"
            placeholder="Example"
            {...register(`fields.${index}.example`)}
          />
          <button
            type="button"
            className="contract-field-remove"
            aria-label="Remove field"
            onClick={() => remove(index)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div className="contract-editor-grid">
        {(
          [
            ["idempotencyKey", "Idempotency key"],
            ["correlationKey", "Correlation key"],
            ["partitionKey", "Partition key"],
          ] as const
        ).map(([key, label]) => (
          <label htmlFor={`contract-${key}`} key={key}>
            {label}
            <select id={`contract-${key}`} {...register(key)}>
              <option value="">None</option>
              {fieldNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="contract-preview">
        <strong>Example payload</strong>
        <pre>{JSON.stringify(preview, null, 2)}</pre>
      </div>

      <Button className="inspector-save" type="submit">
        Save contract
      </Button>
    </form>
  )
}
