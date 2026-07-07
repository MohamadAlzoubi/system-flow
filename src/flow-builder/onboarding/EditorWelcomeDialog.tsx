import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Gauge, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "../../components/ui/button"

const editorWelcomeStorageKey = "system-flow.editor-welcome.dismissed"

function readDismissedState() {
  try {
    return window.localStorage.getItem(editorWelcomeStorageKey) === "true"
  } catch {
    return false
  }
}

function writeDismissedState() {
  try {
    window.localStorage.setItem(editorWelcomeStorageKey, "true")
  } catch {
    // Local storage can be unavailable in private or locked-down browsers.
  }
}

export function EditorWelcomeDialog() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!readDismissedState()) setIsOpen(true)
  }, [])

  const close = () => {
    writeDismissedState()
    setIsOpen(false)
  }

  const openPracticeGuide = () => {
    writeDismissedState()
    window.location.href = "/education#34-practice-curriculum"
  }

  if (!isOpen) return null

  return (
    <div className="analysis-backdrop">
      <section
        className="editor-welcome-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-welcome-title"
      >
        <div className="editor-welcome-head">
          <div>
            <span className="editor-welcome-kicker">First editor load</span>
            <h1 id="editor-welcome-title">
              Practice backend architecture before production answers get expensive.
            </h1>
            <p>
              System Flow turns a backend idea into data contracts, typed edges,
              infrastructure responsibilities, and deterministic scenarios. Use it to
              build a design, break one assumption, and compare what changed.
            </p>
          </div>
          <button
            className="modal-close"
            type="button"
            aria-label="Close welcome guide"
            onClick={close}
          >
            <X size={16} />
          </button>
        </div>

        <div className="editor-welcome-grid">
          <section>
            <BookOpen size={18} />
            <h2>How this helps</h2>
            <ul>
              <li>Model a real backend around business events and data contracts.</li>
              <li>See how queues, databases, caches, workers, and APIs interact.</li>
              <li>Turn design choices into validation findings and repeatable labs.</li>
            </ul>
          </section>
          <section>
            <CheckCircle2 size={18} />
            <h2>Confidently test</h2>
            <ul>
              <li>Type compatibility, routing policy, invalid config, and cycles.</li>
              <li>Bottlenecks, queue growth, retries, saturation, and tail latency.</li>
              <li>Node, dependency, and region failure scenarios against baselines.</li>
            </ul>
          </section>
          <section>
            <AlertTriangle size={18} />
            <h2>Cannot prove</h2>
            <ul>
              <li>Exact production latency, cost, incidents, or cloud behavior.</li>
              <li>Packet-level networking, SQL query plans, or broker internals.</li>
              <li>Application code correctness, security posture, or live failover.</li>
            </ul>
          </section>
        </div>

        <p className="editor-welcome-note">
          Treat every result as evidence for learning and review, not as a replacement for
          load tests, telemetry, chaos drills, and production measurements.
        </p>

        <div className="editor-welcome-actions">
          <Button type="button" onClick={close}>
            <Gauge size={16} />
            Start practicing
          </Button>
          <Button type="button" variant="outline" onClick={openPracticeGuide}>
            <BookOpen size={16} />
            Open practice guide
            <ArrowRight size={15} />
          </Button>
        </div>
      </section>
    </div>
  )
}
