import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Boxes,
  CircleHelp,
  Github,
  Lightbulb,
  Menu,
  Search,
  Wrench,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import educationMarkdown from "../../education.md?raw"

const markdown = educationMarkdown.replace(/^---[\s\S]*?---\s*/, "")

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

const sections = [...markdown.matchAll(/^## (.+)$/gm)].map((match) => ({
  title: match[1],
  id: slugify(match[1]),
}))

function textFromChildren(children: unknown): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children)
  }
  if (Array.isArray(children)) return children.map(textFromChildren).join("")
  if (
    children &&
    typeof children === "object" &&
    "props" in children &&
    children.props &&
    typeof children.props === "object" &&
    "children" in children.props
  ) {
    return textFromChildren(children.props.children)
  }
  return ""
}

export function EducationPage() {
  const [query, setQuery] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const filteredSections = useMemo(
    () =>
      sections.filter((section) =>
        section.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  )

  useEffect(() => {
    const updateProgress = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight
      setProgress(available > 0 ? (window.scrollY / available) * 100 : 0)
    }
    updateProgress()
    window.addEventListener("scroll", updateProgress, { passive: true })
    return () => window.removeEventListener("scroll", updateProgress)
  }, [])

  return (
    <div className="education-shell">
      <div className="reading-progress" style={{ width: `${progress}%` }} />
      <header className="education-header">
        <a className="education-brand" href="/">
          <span>
            <Boxes size={18} />
          </span>
          System Flow
          <small>Learn</small>
        </a>
        <nav aria-label="Education navigation">
          <a href="#1-the-mental-model">Foundations</a>
          <a href="#7-ingress">Components</a>
          <a href="#18-system-design-concepts">Concepts</a>
          <a href="#16-guided-learning-labs">Labs</a>
        </nav>
        <a className="open-editor" href="/">
          Open editor <ArrowRight size={15} />
        </a>
        <button
          className="education-menu-button"
          type="button"
          aria-label="Open table of contents"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={20} />
        </button>
      </header>

      <div className="education-layout">
        <aside className={`education-sidebar ${menuOpen ? "is-open" : ""}`}>
          <div className="sidebar-heading">
            <strong>On this page</strong>
            <button
              type="button"
              aria-label="Close table of contents"
              onClick={() => setMenuOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <label className="education-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a topic..."
            />
          </label>
          <div className="toc-links">
            {filteredSections.map((section) => (
              <a
                href={`#${section.id}`}
                key={section.id}
                onClick={() => setMenuOpen(false)}
              >
                {section.title}
              </a>
            ))}
            {filteredSections.length === 0 && <small>No matching sections</small>}
          </div>
          <div className="sidebar-card">
            <BookOpen size={18} />
            <strong>Learn by changing things</strong>
            <p>Run a baseline, break one assumption, then compare what moved.</p>
            <a href="#16-guided-learning-labs">Start a lab →</a>
          </div>
        </aside>

        {menuOpen && (
          <button
            className="education-overlay"
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <main className="education-main">
          <section className="education-hero">
            <div className="hero-copy">
              <span className="eyebrow">System Flow handbook</span>
              <h1>Learn how backend systems fit together.</h1>
              <p>
                Start with the purpose of each component, learn when it belongs in a
                design, then use the controls to test your understanding.
              </p>
              <div className="hero-actions">
                <a className="hero-primary" href="#1-the-mental-model">
                  Begin with the basics <ArrowRight size={16} />
                </a>
                <a className="hero-secondary" href="/">
                  <ArrowLeft size={16} /> Back to editor
                </a>
              </div>
            </div>
            <div className="learning-path">
              <div>
                <CircleHelp size={18} />
                <span>01</span>
                <strong>Understand</strong>
                <p>What the component does and which problem it solves.</p>
              </div>
              <div>
                <Lightbulb size={18} />
                <span>02</span>
                <strong>Choose</strong>
                <p>When to use it—and when a simpler option is better.</p>
              </div>
              <div>
                <Wrench size={18} />
                <span>03</span>
                <strong>Experiment</strong>
                <p>Change controls, simulate failure, and compare results.</p>
              </div>
            </div>
          </section>

          <article className="education-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: () => null,
                h2: ({ children }) => {
                  const text = textFromChildren(children)
                  return <h2 id={slugify(text)}>{children}</h2>
                },
                h3: ({ children }) => {
                  const text = textFromChildren(children)
                  return <h3 id={slugify(text)}>{children}</h3>
                },
                a: ({ children, href }) => <a href={href}>{children}</a>,
                table: ({ children }) => (
                  <div className="education-table-wrap">
                    <table>{children}</table>
                  </div>
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </article>

          <footer className="education-footer">
            <div>
              <Boxes size={20} />
              <strong>System Flow</strong>
              <span>Design with evidence.</span>
            </div>
            <a href="/">
              Open editor <ArrowRight size={14} />
            </a>
            <a href="https://github.com" aria-label="GitHub">
              <Github size={17} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  )
}
