import { useState, useMemo } from "react"
import { useAgentBridge } from "../hooks/useAgentBridge"

// --- Types ---

interface Chunk {
  id: string
  a: string
  b: string
  type: "unchanged" | "modified" | "added" | "removed"
}

interface DiffMergeData {
  title: string
  description?: string
  labelA?: string
  labelB?: string
  chunks?: Chunk[]
  textA?: string
  textB?: string
  defaultSelection?: "a" | "b"
}

type Selection = "a" | "b"
type Selections = Record<string, Selection>

// --- Helpers ---

function deriveChunks(textA: string, textB: string): Chunk[] {
  const linesA = textA.split("\n")
  const linesB = textB.split("\n")
  const maxLen = Math.max(linesA.length, linesB.length)
  const chunks: Chunk[] = []

  for (let i = 0; i < maxLen; i++) {
    const a = i < linesA.length ? linesA[i] : ""
    const b = i < linesB.length ? linesB[i] : ""
    const hasA = i < linesA.length
    const hasB = i < linesB.length

    let type: Chunk["type"]
    if (!hasA) type = "added"
    else if (!hasB) type = "removed"
    else if (a === b) type = "unchanged"
    else type = "modified"

    chunks.push({ id: String(i), a, b, type })
  }
  return chunks
}

function initSelections(chunks: Chunk[], defaultSel: Selection): Selections {
  const sel: Selections = {}
  for (const chunk of chunks) {
    if (chunk.type === "added") {
      sel[chunk.id] = "b"
    } else if (chunk.type === "removed") {
      sel[chunk.id] = "a"
    } else {
      sel[chunk.id] = defaultSel
    }
  }
  return sel
}

// --- Styles ---

const globalCss = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #1a1a1a; }

  .container { max-width: 960px; margin: 0 auto; padding: 16px; padding-bottom: 280px; }

  .header { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .header h1 { font-size: 20px; margin-bottom: 4px; }
  .header-desc { color: #666; font-size: 14px; margin-bottom: 12px; }
  .header-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .stats { font-size: 13px; color: #888; }

  .bulk-bar { display: flex; gap: 8px; margin-bottom: 16px; }
  .bulk-btn { padding: 6px 14px; border-radius: 6px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 13px; transition: background 0.15s; }
  .bulk-btn:hover { background: #f0f0f0; }

  .submit-btn { padding: 8px 20px; border-radius: 6px; border: none; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; font-size: 14px; transition: background 0.15s; }
  .submit-btn:hover { background: #1d4ed8; }

  .chunk-card { background: #fff; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.06); overflow: hidden; }

  .chunk-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 12px; background: #fafafa; border-bottom: 1px solid #eee; color: #999; display: flex; align-items: center; gap: 8px; }
  .chunk-type-badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; }
  .badge-modified { background: #fef3c7; color: #92400e; }
  .badge-added { background: #d1fae5; color: #065f46; }
  .badge-removed { background: #fee2e2; color: #991b1b; }

  .chunk-sides { display: flex; }
  .chunk-side { flex: 1; padding: 12px; cursor: pointer; border-left: 3px solid transparent; transition: all 0.15s; min-height: 48px; position: relative; }
  .chunk-side:first-child { border-right: 1px solid #f0f0f0; }
  .chunk-side pre { white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.6; font-family: "SF Mono", "Fira Code", monospace; }
  .chunk-side:hover { background: #fafafa; }

  .side-selected-a .chunk-side:first-child { border-left-color: #3b82f6; background: #eff6ff; }
  .side-selected-a .chunk-side:last-child { opacity: 0.45; }
  .side-selected-b .chunk-side:last-child { border-left-color: #3b82f6; background: #eff6ff; }
  .side-selected-b .chunk-side:first-child { opacity: 0.45; }

  .side-label { font-size: 11px; font-weight: 600; color: #aaa; margin-bottom: 4px; }
  .side-selected-a .chunk-side:first-child .side-label,
  .side-selected-b .chunk-side:last-child .side-label { color: #3b82f6; }

  .chunk-unchanged { cursor: default; }
  .chunk-unchanged .chunk-label { background: #f8f8f8; color: #ccc; cursor: pointer; }
  .chunk-unchanged .chunk-sides { display: none; }
  .chunk-unchanged.expanded .chunk-sides { display: flex; }
  .chunk-unchanged .chunk-side { cursor: default; opacity: 0.6; }


  .empty-text { color: #ccc; font-style: italic; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

  .preview-panel { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 2px solid #e5e7eb; box-shadow: 0 -4px 12px rgba(0,0,0,0.08); z-index: 100; transition: max-height 0.2s; }
  .preview-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; cursor: pointer; user-select: none; }
  .preview-header h3 { font-size: 13px; color: #666; }
  .preview-toggle { background: none; border: none; font-size: 16px; cursor: pointer; color: #888; }
  .preview-body { max-height: 200px; overflow-y: auto; padding: 0 16px 12px; }
  .preview-body pre { white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.6; font-family: "SF Mono", "Fira Code", monospace; color: #333; }

  .done-screen { text-align: center; padding: 60px 20px; }
  .done-screen h2 { font-size: 24px; margin-bottom: 8px; color: #16a34a; }
  .done-screen p { color: #666; }

  .loading { text-align: center; padding: 60px; color: #888; }
`

// --- Components ---

function ChunkCard({
  chunk,
  selection,
  onSelect,
  labelA,
  labelB,
}: {
  chunk: Chunk
  selection: Selection
  onSelect: (sel: Selection) => void
  labelA: string
  labelB: string
}) {
  const [expanded, setExpanded] = useState(false)

  if (chunk.type === "unchanged") {
    return (
      <div className={`chunk-card chunk-unchanged ${expanded ? "expanded" : ""}`}>
        <div className="chunk-label" onClick={() => setExpanded(!expanded)}>
          <span>{expanded ? "\u25BC" : "\u25B6"}</span>
          <span>Unchanged</span>
          <span style={{ fontWeight: 400, color: "#bbb", fontSize: 12, fontFamily: '"SF Mono", monospace' }}>
            {chunk.a.length > 80 ? chunk.a.slice(0, 80) + "..." : chunk.a}
          </span>
        </div>
        <div className="chunk-sides">
          <div className="chunk-side">
            <div className="side-label">{labelA}</div>
            <pre>{chunk.a}</pre>
          </div>
          <div className="chunk-side">
            <div className="side-label">{labelB}</div>
            <pre>{chunk.b}</pre>
          </div>
        </div>
      </div>
    )
  }

  const sideClass =
    selection === "a"
      ? "side-selected-a"
      : "side-selected-b"

  const badgeClass =
    chunk.type === "modified"
      ? "badge-modified"
      : chunk.type === "added"
        ? "badge-added"
        : "badge-removed"

  const typeLabel =
    chunk.type === "modified"
      ? "Modified"
      : chunk.type === "added"
        ? "Added"
        : "Removed"

  return (
    <div className={`chunk-card ${sideClass}`}>
      <div className="chunk-label">
        <span className={`chunk-type-badge ${badgeClass}`}>{typeLabel}</span>
      </div>
      <div className="chunk-sides">
        <div className="chunk-side" onClick={() => onSelect("a")}>
          <div className="side-label">{labelA}</div>
          {chunk.a ? <pre>{chunk.a}</pre> : <div className="empty-text">(not add)</div>}
        </div>
        <div className="chunk-side" onClick={() => onSelect("b")}>
          <div className="side-label">{labelB}</div>
          {chunk.b ? <pre>{chunk.b}</pre> : <div className="empty-text">(not add)</div>}
        </div>
      </div>
    </div>
  )
}

export function App() {
  const { data, loading, done, respond } = useAgentBridge<DiffMergeData>()
  const [selections, setSelections] = useState<Selections>({})
  const [initialized, setInitialized] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)

  const chunks = useMemo(() => {
    if (!data) return []
    if (data.chunks) return data.chunks
    if (data.textA != null && data.textB != null) return deriveChunks(data.textA, data.textB)
    return []
  }, [data])

  const defaultSel = data?.defaultSelection ?? "a"
  const labelA = data?.labelA ?? "Version A"
  const labelB = data?.labelB ?? "Version B"

  if (!initialized && chunks.length > 0) {
    setSelections(initSelections(chunks, defaultSel))
    setInitialized(true)
  }

  const mergedText = useMemo(() => {
    return chunks
      .map((chunk) => {
        const sel = selections[chunk.id] ?? "a"
        return sel === "a" ? chunk.a : chunk.b
      })
      .filter((t) => t !== "")
      .join("\n")
  }, [chunks, selections])

  const stats = useMemo(() => {
    let selectedA = 0
    let selectedB = 0
    let unchanged = 0
    for (const chunk of chunks) {
      if (chunk.type === "unchanged") {
        unchanged++
      } else if (selections[chunk.id] === "b") {
        selectedB++
      } else {
        selectedA++
      }
    }
    return { totalChunks: chunks.length, selectedA, selectedB, unchanged }
  }, [chunks, selections])

  const handleSelect = (chunkId: string, sel: Selection) => {
    setSelections((prev) => ({ ...prev, [chunkId]: sel }))
  }

  const handleSelectAll = (sel: Selection) => {
    setSelections((prev) => {
      const next = { ...prev }
      for (const chunk of chunks) {
        if (chunk.type === "modified") {
          next[chunk.id] = sel
        }
      }
      return next
    })
  }

  const handleSubmit = () => {
    respond("submit", {
      mergedText,
      selections: chunks.map((c) => ({
        chunkId: c.id,
        selected: selections[c.id] ?? "a",
        type: c.type,
      })),
      stats,
    })
  }

  if (loading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
        <div className="loading">Loading...</div>
      </>
    )
  }

  if (done) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
        <div className="done-screen">
          <h2>Merge submitted</h2>
          <p>Your selections have been sent. You can close this window.</p>
        </div>
      </>
    )
  }

  const modifiedCount = chunks.filter((c) => c.type !== "unchanged").length

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      <div className="container">
        <div className="header">
          <h1>{data?.title ?? "Diff Merge"}</h1>
          {data?.description && <div className="header-desc">{data.description}</div>}
          <div className="header-bar">
            <div className="stats">
              {modifiedCount} chunks to review / {stats.selectedA} {labelA} / {stats.selectedB} {labelB} / {stats.unchanged} unchanged
            </div>
            <button className="submit-btn" onClick={handleSubmit}>
              Submit Merge
            </button>
          </div>
        </div>

        <div className="bulk-bar">
          <button className="bulk-btn" onClick={() => handleSelectAll("a")}>
            Select All {labelA}
          </button>
          <button className="bulk-btn" onClick={() => handleSelectAll("b")}>
            Select All {labelB}
          </button>
        </div>

        {chunks.map((chunk) => (
          <ChunkCard
            key={chunk.id}
            chunk={chunk}
            selection={selections[chunk.id] ?? "a"}
            onSelect={(sel) => handleSelect(chunk.id, sel)}
            labelA={labelA}
            labelB={labelB}
          />
        ))}
      </div>

      <div className="preview-panel">
        <div className="preview-header" onClick={() => setPreviewOpen(!previewOpen)}>
          <h3>Merged Preview</h3>
          <button className="preview-toggle">{previewOpen ? "\u25BC" : "\u25B2"}</button>
        </div>
        {previewOpen && (
          <div className="preview-body">
            <pre>{mergedText || "(empty)"}</pre>
          </div>
        )}
      </div>
    </>
  )
}
