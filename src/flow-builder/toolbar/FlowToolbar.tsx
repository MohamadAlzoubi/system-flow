import {
  BarChart3,
  BookMarked,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileJson2,
  FilePlus2,
  FileText,
  FlaskConical,
  FolderOpen,
  Globe2,
  GraduationCap,
  Layers,
  PanelRight,
  Play,
  Trash2,
  Upload,
  Workflow,
} from "lucide-react"
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from "react"
import { Button } from "../../components/ui/button"
import { runSimulation, validateFlow } from "../../engine"
import {
  bottleneckFlow,
  chatMessageFlow,
  productViewedFlow,
  purchaseFlow,
} from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { parseFlowGraph, useFlowEditorStore } from "../../store/flow-editor.store"
import { BlueprintWorkspace } from "../blueprint/BlueprintWorkspace"
import { ContractWorkspace } from "../contracts/ContractWorkspace"
import { DecisionsWorkspace } from "../decisions/DecisionsWorkspace"
import { RegionsWorkspace } from "../regions/RegionsWorkspace"
import { ReviewPanel } from "../review/ReviewPanel"
import { ScenarioLab } from "../scenario-lab/ScenarioLab"
import { NewFlowDialog } from "./NewFlowDialog"

const examples = [productViewedFlow, purchaseFlow, chatMessageFlow, bottleneckFlow]

type ToolbarMenuKey = "workspaces" | "view" | "project"

type ToolbarMenuItemProps = {
  icon: ReactNode
  label: string
  description: string
  disabled?: boolean
  onSelect: () => void
}

function ToolbarMenuItem({
  icon,
  label,
  description,
  disabled = false,
  onSelect,
}: ToolbarMenuItemProps) {
  return (
    <button
      className="toolbar-menu-item"
      type="button"
      disabled={disabled}
      onClick={onSelect}
    >
      {icon}
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </button>
  )
}

export function FlowToolbar() {
  const graph = useFlowEditorStore((state) => state.graph)
  const isDirty = useFlowEditorStore((state) => state.isDirty)
  const setGraph = useFlowEditorStore((state) => state.setGraph)
  const setIssues = useFlowEditorStore((state) => state.setValidationIssues)
  const setResult = useFlowEditorStore((state) => state.setSimulationResult)
  const selectedNodeId = useFlowEditorStore((state) => state.selectedNodeId)
  const selectedEdgeId = useFlowEditorStore((state) => state.selectedEdgeId)
  const removeNodes = useFlowEditorStore((state) => state.removeNodes)
  const removeEdges = useFlowEditorStore((state) => state.removeEdges)
  const isInspectorOpen = useFlowEditorStore((state) => state.isInspectorOpen)
  const setInspectorOpen = useFlowEditorStore((state) => state.setInspectorOpen)
  const setAnalysisOpen = useFlowEditorStore((state) => state.setAnalysisOpen)
  const [isNewFlowOpen, setNewFlowOpen] = useState(false)
  const [isContractsOpen, setContractsOpen] = useState(false)
  const [isRegionsOpen, setRegionsOpen] = useState(false)
  const [isScenarioLabOpen, setScenarioLabOpen] = useState(false)
  const [isReviewOpen, setReviewOpen] = useState(false)
  const [isDecisionsOpen, setDecisionsOpen] = useState(false)
  const [isBlueprintOpen, setBlueprintOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<ToolbarMenuKey | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const activeScenarioId = useFlowEditorStore((state) => state.activeScenarioId)
  const activeScenario = graph.failureScenarios?.find(
    (scenario) => scenario.id === activeScenarioId,
  )

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!actionsRef.current?.contains(event.target)) setOpenMenu(null)
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null)
    }

    document.addEventListener("pointerdown", closeOnPointerDown)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [])

  const toggleMenu = (menu: ToolbarMenuKey) => {
    setOpenMenu((currentMenu) => (currentMenu === menu ? null : menu))
  }

  const closeMenus = () => setOpenMenu(null)

  const deleteSelection = () => {
    if (selectedNodeId) removeNodes([selectedNodeId])
    if (selectedEdgeId) removeEdges([selectedEdgeId])
    closeMenus()
  }

  const exportFlow = () => {
    const blob = new Blob([JSON.stringify(graph, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${graph.id}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importFlow = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file) return

    try {
      const parsed = parseFlowGraph(JSON.parse(await file.text()))
      if (!parsed) {
        window.alert("That file is not a valid System Flow project JSON.")
        return
      }
      setGraph(parsed)
      setIssues(validateFlow(parsed, nodeRegistry))
      setResult(null)
      setAnalysisOpen(false)
    } catch {
      window.alert("Could not import the selected JSON file.")
    }
  }

  return (
    <header>
      <div className="brand">
        <Workflow size={21} />
        <strong>System Flow</strong>
        <span className="flow-name" title={graph.name}>
          {graph.name}
        </span>
        <select
          aria-label="Load an example flow"
          title="Load an example flow (replaces the current canvas)"
          value=""
          onChange={(event) => {
            const example = examples.find((item) => item.id === event.target.value)
            if (example) setGraph(structuredClone(example))
          }}
        >
          <option value="" disabled>
            Examples…
          </option>
          {examples.map((example) => (
            <option value={example.id} key={example.id}>
              {example.name}
            </option>
          ))}
        </select>
        {isDirty && <span className="dirty">Saved locally</span>}
      </div>
      <div className="actions" ref={actionsRef}>
        <Button
          variant="outline"
          onClick={() => {
            closeMenus()
            setNewFlowOpen(true)
          }}
          title="Create a new flow from design goals"
        >
          <FilePlus2 size={16} />
          <span className="toolbar-button-label">New flow</span>
        </Button>

        <div className="toolbar-menu">
          <Button
            variant="outline"
            title="Open design workspaces"
            aria-haspopup="menu"
            aria-expanded={openMenu === "workspaces"}
            onClick={() => toggleMenu("workspaces")}
          >
            <Layers size={16} />
            <span className="toolbar-button-label">Workspaces</span>
            <ChevronDown className="toolbar-chevron" size={14} />
          </Button>
          {openMenu === "workspaces" && (
            <div className="toolbar-menu-popover">
              <ToolbarMenuItem
                icon={<GraduationCap size={16} />}
                label="Learn"
                description="Open the education guide"
                onSelect={() => {
                  closeMenus()
                  window.location.href = "/education"
                }}
              />
              <ToolbarMenuItem
                icon={<FileJson2 size={16} />}
                label="Contracts"
                description="Define and edit data contracts"
                onSelect={() => {
                  closeMenus()
                  setContractsOpen(true)
                }}
              />
              <ToolbarMenuItem
                icon={<Globe2 size={16} />}
                label="Regions"
                description="Create regions and assign nodes"
                onSelect={() => {
                  closeMenus()
                  setRegionsOpen(true)
                }}
              />
              <ToolbarMenuItem
                icon={<FlaskConical size={16} />}
                label="Scenario Lab"
                description="Compare baseline and failure scenarios"
                onSelect={() => {
                  closeMenus()
                  setScenarioLabOpen(true)
                }}
              />
              <ToolbarMenuItem
                icon={<ClipboardCheck size={16} />}
                label="Review"
                description="Run architecture review questions"
                onSelect={() => {
                  closeMenus()
                  setReviewOpen(true)
                }}
              />
              <ToolbarMenuItem
                icon={<BookMarked size={16} />}
                label="Decisions"
                description="Capture assumptions and trade-offs"
                onSelect={() => {
                  closeMenus()
                  setDecisionsOpen(true)
                }}
              />
              <ToolbarMenuItem
                icon={<FileText size={16} />}
                label="Handoff pack"
                description="Generate production readiness notes"
                onSelect={() => {
                  closeMenus()
                  setBlueprintOpen(true)
                }}
              />
            </div>
          )}
        </div>

        <div className="toolbar-menu">
          <Button
            variant="outline"
            title="Open view controls"
            aria-haspopup="menu"
            aria-expanded={openMenu === "view"}
            onClick={() => toggleMenu("view")}
          >
            <PanelRight size={16} />
            <span className="toolbar-button-label">View</span>
            <ChevronDown className="toolbar-chevron" size={14} />
          </Button>
          {openMenu === "view" && (
            <div className="toolbar-menu-popover toolbar-menu-popover--compact">
              <ToolbarMenuItem
                icon={<PanelRight size={16} />}
                label={isInspectorOpen ? "Close inspector" : "Open inspector"}
                description="Show or hide configuration controls"
                onSelect={() => {
                  closeMenus()
                  setInspectorOpen(!isInspectorOpen)
                }}
              />
              <ToolbarMenuItem
                icon={<BarChart3 size={16} />}
                label="Analysis"
                description="Open validation and simulation results"
                onSelect={() => {
                  closeMenus()
                  setAnalysisOpen(true)
                }}
              />
            </div>
          )}
        </div>

        <div className="toolbar-menu">
          <Button
            variant="outline"
            title="Open project actions"
            aria-haspopup="menu"
            aria-expanded={openMenu === "project"}
            onClick={() => toggleMenu("project")}
          >
            <FolderOpen size={16} />
            <span className="toolbar-button-label">Project</span>
            <ChevronDown className="toolbar-chevron" size={14} />
          </Button>
          {openMenu === "project" && (
            <div className="toolbar-menu-popover toolbar-menu-popover--compact">
              <ToolbarMenuItem
                icon={<Download size={16} />}
                label="Export"
                description="Download this flow as JSON"
                onSelect={() => {
                  closeMenus()
                  exportFlow()
                }}
              />
              <ToolbarMenuItem
                icon={<Upload size={16} />}
                label="Import"
                description="Load a System Flow project JSON"
                onSelect={() => {
                  closeMenus()
                  importInputRef.current?.click()
                }}
              />
              <ToolbarMenuItem
                icon={<Trash2 size={16} />}
                label="Delete selection"
                description="Remove the selected node or edge"
                disabled={!selectedNodeId && !selectedEdgeId}
                onSelect={deleteSelection}
              />
            </div>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => {
            closeMenus()
            setIssues(validateFlow(graph, nodeRegistry))
            setResult(null)
          }}
        >
          <CheckCircle2 size={16} />
          <span className="toolbar-button-label">Validate</span>
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void importFlow(event)
          }}
        />
        <Button
          onClick={() => {
            closeMenus()
            const result = runSimulation(graph, nodeRegistry, activeScenario)
            setIssues(result.warnings)
            setResult(result)
            setAnalysisOpen(true)
          }}
          title={
            activeScenario
              ? `Run with failure scenario: ${activeScenario.name}`
              : "Run simulation"
          }
        >
          <Play size={16} />
          <span className="toolbar-button-label">
            {activeScenario ? "Run scenario" : "Run simulation"}
          </span>
        </Button>
      </div>
      {isNewFlowOpen && <NewFlowDialog onClose={() => setNewFlowOpen(false)} />}
      {isContractsOpen && <ContractWorkspace onClose={() => setContractsOpen(false)} />}
      {isRegionsOpen && <RegionsWorkspace onClose={() => setRegionsOpen(false)} />}
      {isScenarioLabOpen && <ScenarioLab onClose={() => setScenarioLabOpen(false)} />}
      {isReviewOpen && <ReviewPanel onClose={() => setReviewOpen(false)} />}
      {isDecisionsOpen && <DecisionsWorkspace onClose={() => setDecisionsOpen(false)} />}
      {isBlueprintOpen && <BlueprintWorkspace onClose={() => setBlueprintOpen(false)} />}
    </header>
  )
}
