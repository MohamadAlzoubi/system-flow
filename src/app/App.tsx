import { EducationPage } from "../education/EducationPage"
import { FlowCanvas } from "../flow-builder/canvas/FlowCanvas"
import { NodeInspector } from "../flow-builder/inspector/NodeInspector"
import { EditorWelcomeDialog } from "../flow-builder/onboarding/EditorWelcomeDialog"
import { AnalysisPanel } from "../flow-builder/panels/AnalysisPanel"
import { NodeLibrarySidebar } from "../flow-builder/sidebar/NodeLibrarySidebar"
import { FlowToolbar } from "../flow-builder/toolbar/FlowToolbar"
import { useFlowEditorStore } from "../store/flow-editor.store"

export default function App() {
  const isInspectorOpen = useFlowEditorStore((state) => state.isInspectorOpen)
  const isAnalysisOpen = useFlowEditorStore((state) => state.isAnalysisOpen)
  if (window.location.pathname === "/education") return <EducationPage />

  return (
    <main className="editor-shell">
      <FlowToolbar />
      <div className={`workspace ${isInspectorOpen ? "" : "inspector-closed"}`}>
        <NodeLibrarySidebar />
        <FlowCanvas />
        {isInspectorOpen && <NodeInspector />}
      </div>
      {isAnalysisOpen && <AnalysisPanel />}
      <EditorWelcomeDialog />
    </main>
  )
}
