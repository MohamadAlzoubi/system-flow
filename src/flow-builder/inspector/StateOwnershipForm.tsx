import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { FlowGraph, NodeInstance, StateOwnership } from "../../contracts"

const schema = z.object({
  dataOwned: z.array(z.string()),
  allowedWriterIds: z.array(z.string()),
  transactionBoundary: z.string(),
  consistencyModel: z.enum(["strong", "read-after-write", "eventual"]),
  conflictResolution: z.enum(["", "single-writer", "last-write-wins", "merge", "manual"]),
  cacheInvalidation: z.enum([
    "",
    "none",
    "ttl",
    "event-driven",
    "write-through",
    "manual",
  ]),
  freshnessToleranceMs: z.number().nonnegative().optional(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  node: NodeInstance
  graph: FlowGraph
  onSave: (stateOwnership: StateOwnership | undefined) => void
}

export function StateOwnershipForm({ node, graph, onSave }: Props) {
  const ownership = node.stateOwnership
  const contractNames = [...new Set(graph.dataContracts.map((contract) => contract.name))]
  // Writers worth listing: components already sending data in, plus any
  // node the current policy names.
  const writerCandidates = [
    ...new Set([
      ...graph.edges
        .filter((edge) => edge.toNodeId === node.id)
        .map((edge) => edge.fromNodeId),
      ...(ownership?.allowedWriterIds ?? []),
    ]),
  ]
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      dataOwned: ownership?.dataOwned ?? [],
      allowedWriterIds: ownership?.allowedWriterIds ?? [],
      transactionBoundary: ownership?.transactionBoundary ?? "",
      consistencyModel: ownership?.consistencyModel ?? "strong",
      conflictResolution: ownership?.conflictResolution ?? "",
      cacheInvalidation: ownership?.cacheInvalidation ?? "",
      freshnessToleranceMs: ownership?.freshnessToleranceMs,
    },
  })

  const submit = (values: FormValues) => {
    onSave({
      dataOwned: values.dataOwned,
      allowedWriterIds: values.allowedWriterIds,
      readConsumerIds: ownership?.readConsumerIds,
      transactionBoundary: values.transactionBoundary.trim() || undefined,
      consistencyModel: values.consistencyModel,
      conflictResolution: values.conflictResolution || undefined,
      cacheInvalidation: values.cacheInvalidation || undefined,
      freshnessToleranceMs: values.freshnessToleranceMs,
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <fieldset className="ownership-set">
        <legend>Data owned</legend>
        {contractNames.length === 0 && (
          <small className="goal-hint">Define contracts to declare ownership.</small>
        )}
        {contractNames.map((name) => (
          <label className="contract-flag" key={name}>
            <input type="checkbox" value={name} {...register("dataOwned")} />
            {name}
          </label>
        ))}
      </fieldset>
      <fieldset className="ownership-set">
        <legend>Allowed writers</legend>
        {writerCandidates.length === 0 && (
          <small className="goal-hint">Connect a producer to allow writers.</small>
        )}
        {writerCandidates.map((writerId) => (
          <label className="contract-flag" key={writerId}>
            <input type="checkbox" value={writerId} {...register("allowedWriterIds")} />
            {writerId}
          </label>
        ))}
      </fieldset>
      <label htmlFor="ownership-transaction">
        Transaction boundary
        <Input
          id="ownership-transaction"
          placeholder="What changes atomically in one write"
          {...register("transactionBoundary")}
        />
      </label>
      <label htmlFor="ownership-consistency">
        Consistency model
        <select id="ownership-consistency" {...register("consistencyModel")}>
          <option value="strong">Strong — reads always see the latest write</option>
          <option value="read-after-write">
            Read-after-write — writers see their own writes
          </option>
          <option value="eventual">Eventual — reads may lag</option>
        </select>
      </label>
      <label htmlFor="ownership-conflict">
        Conflict resolution
        <select id="ownership-conflict" {...register("conflictResolution")}>
          <option value="">Undecided</option>
          <option value="single-writer">Single writer — conflicts impossible</option>
          <option value="last-write-wins">Last write wins</option>
          <option value="merge">Merge concurrent changes</option>
          <option value="manual">Manual review</option>
        </select>
      </label>
      <label htmlFor="ownership-invalidation">
        Cache invalidation
        <select id="ownership-invalidation" {...register("cacheInvalidation")}>
          <option value="">Not a cache</option>
          <option value="none">None — entries never refresh</option>
          <option value="ttl">TTL expiry</option>
          <option value="event-driven">Event-driven</option>
          <option value="write-through">Write-through</option>
          <option value="manual">Manual</option>
        </select>
      </label>
      <label htmlFor="ownership-freshness">
        Freshness tolerance (ms)
        <Input
          id="ownership-freshness"
          type="number"
          {...register("freshnessToleranceMs", {
            setValueAs: (value) =>
              value === "" || value === null ? undefined : Number(value),
          })}
        />
      </label>
      <Button className="inspector-save" type="submit">
        Apply state ownership
      </Button>
      {ownership && (
        <Button type="button" variant="ghost" onClick={() => onSave(undefined)}>
          Remove state ownership
        </Button>
      )}
    </form>
  )
}
