import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { NodeDefinition, NodeInstance } from "../../contracts"

type ConfigFormProps = {
  node: NodeInstance
  definition: NodeDefinition
  onSave: (config: Record<string, unknown>) => void
}

export function ConfigForm({ node, definition, onSave }: ConfigFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setError,
  } = useForm<Record<string, unknown>>({ defaultValues: node.config })

  useEffect(() => reset(node.config), [node, reset])

  const submit = (values: Record<string, unknown>) => {
    const result = definition.configSchema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field, { message: issue.message })
        }
      }
      return
    }
    onSave(result.data as Record<string, unknown>)
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      {Object.entries(node.config).map(([key, value]) => (
        <label htmlFor={`config-${key}`} key={key}>
          <span>{key.replace(/([A-Z])/g, " $1")}</span>
          {typeof value === "boolean" ? (
            <input id={`config-${key}`} type="checkbox" {...register(key)} />
          ) : typeof value === "object" ? (
            <textarea
              id={`config-${key}`}
              defaultValue={JSON.stringify(value, null, 2)}
              onChange={(event) => {
                try {
                  const parsed = JSON.parse(event.target.value)
                  register(key).onChange({
                    target: { name: key, value: parsed },
                  })
                } catch {
                  setError(key, { message: "Enter valid JSON" })
                }
              }}
            />
          ) : (
            <Input
              id={`config-${key}`}
              type={typeof value === "number" ? "number" : "text"}
              step={typeof value === "number" ? "any" : undefined}
              {...register(key, {
                valueAsNumber: typeof value === "number",
              })}
            />
          )}
          {errors[key]?.message && (
            <small className="field-error">{String(errors[key]?.message)}</small>
          )}
        </label>
      ))}
      <Button className="inspector-save" type="submit">
        Apply changes
      </Button>
    </form>
  )
}
