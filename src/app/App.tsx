import { FlowCanvas } from "../flow-builder/canvas/FlowCanvas"
import { NodeInspector } from "../flow-builder/inspector/NodeInspector"
import { AnalysisPanel } from "../flow-builder/panels/AnalysisPanel"
import { NodeLibrarySidebar } from "../flow-builder/sidebar/NodeLibrarySidebar"
import { FlowToolbar } from "../flow-builder/toolbar/FlowToolbar"

export default function App() {
  return (
    <main>
      <FlowToolbar />
      <div className="workspace">
        <NodeLibrarySidebar />
        <FlowCanvas />
        <NodeInspector />
      </div>
      <AnalysisPanel />
    </main>
  )
}
