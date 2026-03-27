import { useState, useRef, useCallback, useEffect, memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useAgentBridge } from "../hooks/useAgentBridge"

interface PlanReviewData {
  title: string
  body: string
}

interface CommentPosition {
  offset: number
  length: number
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

interface Comment {
  id: string
  targetText: string
  content: string
  contextBefore: string
  contextAfter: string
  position: CommentPosition
}

interface SelectionInfo {
  text: string
  x: number
  y: number
  contextBefore: string
  contextAfter: string
  position: CommentPosition
}

const MarkdownBody = memo(function MarkdownBody({ body }: { body: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {body}
    </ReactMarkdown>
  )
})

export function App() {
  const { data, loading, done, respond } = useAgentBridge<PlanReviewData>()
  const [comments, setComments] = useState<Comment[]>([])
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [isCommenting, setIsCommenting] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // --- Text selection helpers ---

  const findAllOccurrences = useCallback((text: string, search: string): number[] => {
    const indices: number[] = []
    let idx = 0
    while ((idx = text.indexOf(search, idx)) !== -1) {
      indices.push(idx)
      idx += 1
    }
    return indices
  }, [])

  const getCharacterOffsetInContainer = useCallback((container: Node, targetNode: Node, targetOffset: number): number => {
    let offset = 0
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
    let node: Node | null
    while ((node = walker.nextNode())) {
      if (node === targetNode) return offset + targetOffset
      offset += (node as Text).textContent?.length || 0
    }
    return offset
  }, [])

  const offsetToLineCol = useCallback((text: string, offset: number): { line: number; column: number } => {
    let line = 1
    let column = 1
    for (let i = 0; i < offset && i < text.length; i++) {
      if (text[i] === "\n") { line++; column = 1 } else { column++ }
    }
    return { line, column }
  }, [])

  const extractContext = useCallback((targetText: string, occurrenceIndex: number): { contextBefore: string; contextAfter: string; position: CommentPosition } => {
    const empty = { contextBefore: "", contextAfter: "", position: { offset: -1, length: targetText.length, startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 } }
    if (!data) return empty
    const body = data.body
    const len = 100
    const occurrences = findAllOccurrences(body, targetText)
    if (occurrenceIndex >= 0 && occurrenceIndex < occurrences.length) {
      const pos = occurrences[occurrenceIndex]
      const start = offsetToLineCol(body, pos)
      const end = offsetToLineCol(body, pos + targetText.length)
      return {
        contextBefore: body.substring(Math.max(0, pos - len), pos),
        contextAfter: body.substring(pos + targetText.length, pos + targetText.length + len),
        position: { offset: pos, length: targetText.length, startLine: start.line, startColumn: start.column, endLine: end.line, endColumn: end.column },
      }
    }
    return empty
  }, [data, findAllOccurrences, offsetToLineCol])

  // --- Selection handling ---

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isCommenting) return
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      const text = sel.toString().trim()
      if (!text || text.length < 2 || text.includes("\n")) { setSelection(null); return }
      const range = sel.getRangeAt(0)
      if (!contentRef.current?.contains(range.commonAncestorContainer)) { setSelection(null); return }
      const ancestor = range.commonAncestorContainer
      const ancestorEl = ancestor.nodeType === Node.ELEMENT_NODE ? ancestor as Element : ancestor.parentElement
      if (ancestorEl === contentRef.current) { setSelection(null); return }
      const blockTags = ["UL", "OL", "TABLE", "TBODY", "THEAD", "TR"]
      if (ancestorEl && blockTags.includes(ancestorEl.tagName)) { setSelection(null); return }
      const fullText = contentRef.current.textContent || ""
      const charOffset = getCharacterOffsetInContainer(contentRef.current, range.startContainer, range.startOffset)
      const textBefore = fullText.substring(0, charOffset)
      const occIdx = findAllOccurrences(textBefore, text).length
      const { contextBefore, contextAfter, position } = extractContext(text, occIdx)
      const containerRect = containerRef.current?.getBoundingClientRect()
      setSelection({
        text,
        x: e.clientX - (containerRect?.left || 0),
        y: e.clientY - (containerRect?.top || 0),
        contextBefore, contextAfter, position,
      })
    }, 10)
  }, [isCommenting, getCharacterOffsetInContainer, findAllOccurrences, extractContext])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (selection && !isCommenting && !t.closest(".selection-popup")) setSelection(null)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [selection, isCommenting])

  // --- Highlighting ---

  useEffect(() => {
    if (!contentRef.current) return
    contentRef.current.querySelectorAll(".comment-hl").forEach((el) => {
      const p = el.parentNode
      if (p) { p.replaceChild(document.createTextNode(el.textContent || ""), el); p.normalize() }
    })
    const fullText = contentRef.current.textContent || ""
    const getTextNodes = (root: Node) => {
      const result: { node: Text; start: number; end: number }[] = []
      let pos = 0
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
      let n: Node | null
      while ((n = walker.nextNode())) {
        const len = (n as Text).textContent?.length || 0
        result.push({ node: n as Text, start: pos, end: pos + len })
        pos += len
      }
      return result
    }
    for (const comment of comments) {
      const occurrences = findAllOccurrences(fullText, comment.targetText)
      let matchPos = occurrences[0]
      if (comment.contextBefore || comment.contextAfter) {
        for (const pos of occurrences) {
          const before = fullText.substring(Math.max(0, pos - 100), pos)
          if (comment.contextBefore && before.includes(comment.contextBefore.slice(-30))) { matchPos = pos; break }
        }
      }
      if (matchPos === undefined) continue
      const startPos = matchPos
      const endPos = startPos + comment.targetText.length
      const textNodes = getTextNodes(contentRef.current!)
      for (const { node, start, end } of textNodes) {
        if (end <= startPos || start >= endPos) continue
        const hlStart = Math.max(0, startPos - start)
        const hlEnd = Math.min(node.textContent!.length, endPos - start)
        const before = node.textContent!.substring(0, hlStart)
        const highlighted = node.textContent!.substring(hlStart, hlEnd)
        const after = node.textContent!.substring(hlEnd)
        const mark = document.createElement("mark")
        mark.className = "comment-hl"
        mark.setAttribute("data-comment-id", comment.id)
        mark.textContent = highlighted
        const isActive = activeCommentId === comment.id
        mark.style.cssText = `
          background: ${isActive ? "rgba(255, 213, 79, 0.5)" : "rgba(255, 213, 79, 0.25)"};
          border-bottom: 2px solid ${isActive ? "#d4a72c" : "#e3b341"};
          cursor: pointer;
          padding: 1px 0;
          transition: all 0.2s ease;
          border-radius: 2px;
        `
        const parent = node.parentNode!
        const frag = document.createDocumentFragment()
        if (before) frag.appendChild(document.createTextNode(before))
        frag.appendChild(mark)
        if (after) frag.appendChild(document.createTextNode(after))
        parent.replaceChild(frag, node)
        break
      }
    }
  }, [comments, activeCommentId, findAllOccurrences])

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const hl = target.closest(".comment-hl") as HTMLElement | null
    const commentId = hl?.getAttribute("data-comment-id")
    if (commentId) {
      e.stopPropagation()
      setActiveCommentId(activeCommentId === commentId ? null : commentId)
    }
  }, [activeCommentId])

  // --- Comment actions ---

  const handleStartComment = () => {
    setIsCommenting(true)
    setCommentText("")
    setTimeout(() => textareaRef.current?.focus(), 50)
  }
  const handleCancelComment = () => { setIsCommenting(false); setSelection(null); setCommentText("") }
  const handleAddComment = () => {
    if (!selection || !commentText.trim()) return
    setComments((prev) => [...prev, {
      id: crypto.randomUUID(),
      targetText: selection.text,
      content: commentText.trim(),
      contextBefore: selection.contextBefore,
      contextAfter: selection.contextAfter,
      position: selection.position,
    }])
    setIsCommenting(false); setSelection(null); setCommentText("")
  }
  const handleDeleteComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
    if (activeCommentId === id) setActiveCommentId(null)
  }
  const handleSubmit = () => {
    respond("submit", {
      comments: comments.map((c) => ({
        targetText: c.targetText,
        comment: c.content,
        position: { offset: c.position.offset, length: c.position.length, startLine: c.position.startLine, startColumn: c.position.startColumn, endLine: c.position.endLine, endColumn: c.position.endColumn },
      })),
      totalComments: comments.length,
    })
  }

  // --- Render ---

  if (done) {
    return (
      <div className="pr-done">
        <div className="pr-done-card">
          <div className="pr-done-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1a7f37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="pr-done-title">Review Submitted</h2>
          <p className="pr-done-text">Your comments have been sent. You can close this tab.</p>
        </div>
        <style>{globalStyles}</style>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="pr-done">
        <div className="pr-loading-pulse" />
        <style>{globalStyles}</style>
      </div>
    )
  }

  return (
    <div className="pr-page">
      {/* Top bar */}
      <header className="pr-topbar">
        <div className="pr-topbar-inner">
          <div className="pr-topbar-left">
            <span className="pr-topbar-label">PLAN REVIEW</span>
            <h1 className="pr-topbar-title">{data.title}</h1>
          </div>
          <div className="pr-topbar-right">
            {comments.length > 0 && (
              <span className="pr-comment-count">
                {comments.length}
              </span>
            )}
            <button
              className="pr-submit-btn"
              onClick={handleSubmit}
            >
              Submit Review
            </button>
          </div>
        </div>
      </header>

      <div className="pr-layout" ref={containerRef}>
        {/* Main content */}
        <main className="pr-main">
          <div
            ref={contentRef}
            className="pr-content plan-content"
            onMouseUp={handleMouseUp}
            onClick={handleContentClick}
          >
            <MarkdownBody body={data.body} />
          </div>

          {/* Selection popup */}
          {selection && !isCommenting && (
            <div
              className="selection-popup pr-sel-popup"
              style={{ top: selection.y + 8, left: selection.x }}
            >
              <button className="pr-sel-btn" onClick={handleStartComment}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Comment
              </button>
            </div>
          )}

          {/* Comment form */}
          {selection && isCommenting && (
            <div
              className="selection-popup pr-comment-form"
              style={{ top: selection.y + 8, left: Math.min(selection.x, 400) }}
            >
              <div className="pr-form-quote">
                <span className="pr-form-quote-label">L{selection.position.startLine}</span>
                <span className="pr-form-quote-text">{selection.text}</span>
              </div>
              <textarea
                ref={textareaRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write your feedback..."
                className="pr-form-textarea"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddComment()
                  if (e.key === "Escape") handleCancelComment()
                }}
              />
              <div className="pr-form-footer">
                <span className="pr-form-hint">Cmd+Enter to send</span>
                <div className="pr-form-actions">
                  <button className="pr-form-cancel" onClick={handleCancelComment}>Cancel</button>
                  <button
                    className={`pr-form-send ${!commentText.trim() ? "pr-form-send--disabled" : ""}`}
                    disabled={!commentText.trim()}
                    onClick={handleAddComment}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="pr-sidebar">
          <div className="pr-sidebar-header">
            <h3 className="pr-sidebar-title">Comments</h3>
          </div>

          {comments.length === 0 ? (
            <div className="pr-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 12 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="pr-empty-text">Select text in the document<br />to leave feedback</p>
            </div>
          ) : (
            <div className="pr-comment-list">
              {comments.map((c, i) => (
                <div
                  key={c.id}
                  className={`pr-card ${activeCommentId === c.id ? "pr-card--active" : ""}`}
                  onClick={() => {
                    const nextId = activeCommentId === c.id ? null : c.id
                    setActiveCommentId(nextId)
                    if (nextId) {
                      setTimeout(() => {
                        const hl = contentRef.current?.querySelector(`.comment-hl[data-comment-id="${nextId}"]`)
                        hl?.scrollIntoView({ behavior: "smooth", block: "center" })
                      }, 50)
                    }
                  }}
                >
                  <div className="pr-card-header">
                    <span className="pr-card-line">L{c.position.startLine}</span>
                    <span className="pr-card-num">#{i + 1}</span>
                    <button
                      className="pr-card-delete"
                      onClick={(e) => { e.stopPropagation(); handleDeleteComment(c.id) }}
                      title="Delete comment"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <div className="pr-card-quote">{c.targetText}</div>
                  <p className="pr-card-body">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <style>{globalStyles}</style>
    </div>
  )
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --pr-bg: #f6f8fa;
    --pr-surface: #ffffff;
    --pr-surface-2: #f6f8fa;
    --pr-border: #d1d9e0;
    --pr-border-light: #b8c0c8;
    --pr-text: #1f2328;
    --pr-text-dim: #656d76;
    --pr-text-muted: #8b949e;
    --pr-accent: #1f6feb;
    --pr-accent-soft: rgba(31, 111, 235, 0.1);
    --pr-accent-glow: rgba(31, 111, 235, 0.05);
    --pr-green: #1a7f37;
    --pr-green-soft: rgba(26, 127, 55, 0.1);
    --pr-doc-bg: #ffffff;
    --pr-doc-text: #1f2328;
    --pr-doc-text-dim: #656d76;
    --pr-doc-border: #d1d9e0;
    --pr-doc-code-bg: rgba(175, 184, 193, 0.12);
    --pr-radius: 6px;
    --pr-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
    --pr-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { margin: 0; background: var(--pr-bg); }

  .pr-page {
    min-height: 100vh;
    background: var(--pr-bg);
    font-family: var(--pr-font);
    color: var(--pr-text);
  }

  /* Top bar */
  .pr-topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    background: rgba(255,255,255,0.85);
    border-bottom: 1px solid var(--pr-border);
    backdrop-filter: blur(12px);
  }
  .pr-topbar-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 12px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .pr-topbar-left { display: flex; align-items: center; gap: 16px; }
  .pr-topbar-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    color: var(--pr-accent);
    font-family: var(--pr-mono);
  }
  .pr-topbar-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--pr-text);
  }
  .pr-topbar-right { display: flex; align-items: center; gap: 12px; }
  .pr-comment-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 8px;
    background: var(--pr-doc-code-bg);
    color: var(--pr-text);
    font-size: 12px;
    font-weight: 600;
    border-radius: 12px;
    font-family: var(--pr-mono);
    border: 1px solid var(--pr-border);
  }
  .pr-submit-btn {
    padding: 8px 20px;
    background: var(--pr-green);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--pr-font);
    transition: background 0.15s, transform 0.1s;
  }
  .pr-submit-btn:hover { background: #15803d; }
  .pr-submit-btn:active { transform: scale(0.98); }

  /* Layout */
  .pr-layout {
    max-width: 1280px;
    margin: 0 auto;
    padding: 24px 32px;
    display: flex;
    gap: 24px;
    position: relative;
  }
  .pr-main {
    flex: 1;
    min-width: 0;
    position: relative;
  }

  /* Document content */
  .pr-content {
    background: var(--pr-doc-bg);
    border-radius: 12px;
    padding: 40px 48px;
    min-height: 400px;
    font-size: 15px;
    line-height: 1.8;
    color: var(--pr-doc-text);
    overflow-x: hidden;
    word-break: break-word;
    border: 1px solid var(--pr-border);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }

  /* Markdown styles */
  .plan-content h1 {
    font-size: 1.6em;
    font-weight: 700;
    margin: 1.4em 0 0.6em;
    color: var(--pr-doc-text);
    letter-spacing: -0.02em;
    border-bottom: 2px solid var(--pr-doc-border);
    padding-bottom: 0.4em;
  }
  .plan-content h1:first-child { margin-top: 0; }
  .plan-content h2 {
    font-size: 1.3em;
    font-weight: 700;
    margin: 1.2em 0 0.5em;
    color: var(--pr-doc-text);
    letter-spacing: -0.01em;
  }
  .plan-content h3 {
    font-weight: 600;
    margin: 1em 0 0.4em;
    color: var(--pr-doc-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: 0.85em;
  }
  .plan-content p { margin: 0.6em 0; line-height: 1.8; }
  .plan-content ul, .plan-content ol { margin: 0.6em 0; padding-left: 1.6em; }
  .plan-content li { margin: 0.35em 0; line-height: 1.7; }
  .plan-content li::marker { color: var(--pr-doc-text-dim); }
  .plan-content code {
    background: var(--pr-doc-code-bg);
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 0.88em;
    font-family: var(--pr-mono);
    color: var(--pr-doc-text);
  }
  .plan-content pre {
    background: #24292f;
    padding: 20px 24px;
    border-radius: var(--pr-radius);
    overflow-x: auto;
    margin: 1.2em 0;
    max-width: 100%;
  }
  .plan-content pre code {
    background: none;
    padding: 0;
    color: #e7e5e4;
    font-size: 13px;
    line-height: 1.6;
  }
  .plan-content blockquote {
    border-left: 3px solid var(--pr-border);
    margin: 0.8em 0;
    padding: 0.5em 1.2em;
    color: var(--pr-doc-text-dim);
    background: var(--pr-doc-code-bg);
    border-radius: 0 var(--pr-radius) var(--pr-radius) 0;
  }
  .plan-content table { border-collapse: collapse; margin: 1em 0; width: 100%; display: block; overflow-x: auto; }
  .plan-content th, .plan-content td { border: 1px solid var(--pr-doc-border); padding: 10px 14px; text-align: left; font-size: 14px; }
  .plan-content th { background: var(--pr-doc-code-bg); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--pr-doc-text-dim); }
  .plan-content a { color: var(--pr-accent); text-decoration: none; }
  .plan-content a:hover { text-decoration: underline; }
  .plan-content hr { border: none; border-top: 1px solid var(--pr-doc-border); margin: 2em 0; }
  .plan-content strong { font-weight: 600; color: var(--pr-doc-text); }

  /* Selection popup */
  .pr-sel-popup { position: absolute; z-index: 10; }
  .pr-sel-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: var(--pr-surface);
    color: var(--pr-text);
    border: 1px solid var(--pr-border);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--pr-font);
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    transition: background 0.15s, border-color 0.15s;
  }
  .pr-sel-btn:hover { background: var(--pr-surface-2); border-color: var(--pr-border-light); }

  /* Comment form */
  .pr-comment-form {
    position: absolute;
    z-index: 10;
    background: var(--pr-surface);
    border: 1px solid var(--pr-border);
    border-radius: 10px;
    padding: 16px;
    width: 340px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  }
  .pr-form-quote {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 12px;
    padding: 8px 10px;
    background: var(--pr-accent-glow);
    border-left: 3px solid var(--pr-accent);
    border-radius: 0 6px 6px 0;
  }
  .pr-form-quote-label {
    font-family: var(--pr-mono);
    font-size: 11px;
    color: var(--pr-accent);
    font-weight: 500;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .pr-form-quote-text {
    font-size: 13px;
    color: var(--pr-text-dim);
    font-style: italic;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .pr-form-textarea {
    width: 100%;
    padding: 10px 12px;
    background: var(--pr-surface-2);
    border: 1px solid var(--pr-border);
    border-radius: 6px;
    font-size: 14px;
    font-family: var(--pr-font);
    color: var(--pr-text);
    resize: vertical;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s;
  }
  .pr-form-textarea:focus { border-color: var(--pr-accent); }
  .pr-form-textarea::placeholder { color: var(--pr-text-muted); }
  .pr-form-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 10px;
  }
  .pr-form-hint { font-size: 11px; color: var(--pr-text-muted); font-family: var(--pr-mono); }
  .pr-form-actions { display: flex; gap: 6px; }
  .pr-form-cancel {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--pr-border);
    border-radius: 5px;
    font-size: 13px;
    color: var(--pr-text-dim);
    cursor: pointer;
    font-family: var(--pr-font);
    transition: background 0.15s;
  }
  .pr-form-cancel:hover { background: var(--pr-surface-2); }
  .pr-form-send {
    padding: 6px 16px;
    background: var(--pr-green);
    border: none;
    border-radius: 5px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    font-family: var(--pr-font);
    transition: opacity 0.15s;
  }
  .pr-form-send:hover { opacity: 0.85; }
  .pr-form-send--disabled { background: var(--pr-border); color: var(--pr-text-muted); cursor: not-allowed; }

  /* Sidebar */
  .pr-sidebar {
    width: 300px;
    flex-shrink: 0;
    position: sticky;
    top: 80px;
    align-self: flex-start;
    max-height: calc(100vh - 104px);
    display: flex;
    flex-direction: column;
  }
  .pr-sidebar-header {
    padding-bottom: 12px;
    border-bottom: 1px solid var(--pr-border);
    margin-bottom: 12px;
  }
  .pr-sidebar-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--pr-text-dim);
    font-family: var(--pr-mono);
  }

  /* Empty state */
  .pr-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 20px;
    text-align: center;
  }
  .pr-empty-text {
    font-size: 13px;
    color: var(--pr-text-muted);
    line-height: 1.6;
  }

  /* Comment list */
  .pr-comment-list {
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
  }
  .pr-comment-list::-webkit-scrollbar { width: 4px; }
  .pr-comment-list::-webkit-scrollbar-track { background: transparent; }
  .pr-comment-list::-webkit-scrollbar-thumb { background: var(--pr-border); border-radius: 2px; }

  /* Comment card */
  .pr-card {
    background: var(--pr-surface);
    border: 1px solid var(--pr-border);
    border-radius: var(--pr-radius);
    padding: 12px 14px;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .pr-card:hover { border-color: var(--pr-border-light); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .pr-card--active {
    border-color: var(--pr-accent) !important;
    box-shadow: 0 0 0 3px var(--pr-accent-soft) !important;
  }
  .pr-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .pr-card-line {
    font-family: var(--pr-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--pr-accent);
    background: var(--pr-accent-soft);
    padding: 1px 6px;
    border-radius: 3px;
  }
  .pr-card-num {
    font-family: var(--pr-mono);
    font-size: 11px;
    color: var(--pr-text-muted);
  }
  .pr-card-delete {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--pr-text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    display: flex;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s;
  }
  .pr-card:hover .pr-card-delete { opacity: 1; }
  .pr-card-delete:hover { color: #ef4444; }
  .pr-card-quote {
    font-size: 12px;
    color: var(--pr-text-muted);
    font-style: italic;
    margin-bottom: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pr-card-body {
    font-size: 13px;
    color: var(--pr-text);
    line-height: 1.5;
    margin: 0;
  }

  /* Done state */
  .pr-done {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--pr-bg);
    font-family: var(--pr-font);
  }
  .pr-done-card {
    text-align: center;
    padding: 48px;
  }
  .pr-done-icon { margin-bottom: 20px; }
  .pr-done-title { font-size: 20px; font-weight: 600; color: var(--pr-text); margin-bottom: 8px; }
  .pr-done-text { font-size: 14px; color: var(--pr-text-dim); }

  .pr-loading-pulse {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--pr-accent);
    opacity: 0.6;
    animation: pr-pulse 1.2s ease-in-out infinite;
  }
  @keyframes pr-pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1); }
  }
`
