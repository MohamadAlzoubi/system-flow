import { Download, X } from "lucide-react"
import { useEffect, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "../../components/ui/button"
import {
  generateBlueprint,
  renderBlueprintHtml,
  renderBlueprintMarkdown,
} from "../../engine"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"

function downloadInBrowser(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

async function exportFile(filename: string, content: string, type: string) {
  try {
    const response = await fetch("/__system-flow/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, content }),
    })
    if (response.ok) return
  } catch {
    // Production builds do not expose the dev-server file writer.
  }
  downloadInBrowser(filename, content, type)
}

type Props = {
  onClose: () => void
}

export function BlueprintWorkspace({ onClose }: Props) {
  const graph = useFlowEditorStore((state) => state.graph)
  const blueprint = useMemo(() => generateBlueprint(graph, nodeRegistry), [graph])
  const markdown = useMemo(() => renderBlueprintMarkdown(blueprint), [blueprint])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const slug = graph.id || "flow"

  return (
    <div className="analysis-backdrop">
      <section
        className="results analysis-modal blueprint-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blueprint-title"
      >
        <div className="results-head">
          <strong id="blueprint-title">Production readiness pack</strong>
          <span>{blueprint.components.length} components</span>
          <div className="blueprint-actions">
            <Button
              variant="outline"
              onClick={() =>
                void exportFile(`${slug}-readiness-pack.md`, markdown, "text/markdown")
              }
            >
              <Download size={14} />
              Markdown
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void exportFile(
                  `${slug}-readiness-pack.html`,
                  renderBlueprintHtml(blueprint),
                  "text/html",
                )
              }
            >
              <Download size={14} />
              HTML
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void exportFile(
                  `${slug}-readiness-pack.json`,
                  JSON.stringify(blueprint, null, 2),
                  "application/json",
                )
              }
            >
              <Download size={14} />
              Pack JSON
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void exportFile(
                  `${slug}.json`,
                  JSON.stringify(graph, null, 2),
                  "application/json",
                )
              }
            >
              <Download size={14} />
              Project JSON
            </Button>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close blueprint"
          >
            <X size={16} />
          </button>
        </div>
        <div className="blueprint-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      </section>
    </div>
  )
}
