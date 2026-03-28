import { useState, Fragment } from "react"
import { useAgentBridge } from "../hooks/useAgentBridge"

interface DiffLine {
  type: "context" | "add" | "delete"
  content: string
  oldNum?: number
  newNum?: number
}

interface ReviewComment {
  id: string
  line: number
  body: string
}

interface FileReview {
  path: string
  language?: string
  hunks: {
    header: string
    lines: DiffLine[]
  }[]
  comments: ReviewComment[]
}

interface CodeReviewData {
  title: string
  description?: string
  files: FileReview[]
}

type Decision = "accept" | "deny"

interface CommentFeedback {
  commentId: string
  decision: Decision
  feedback: string
}

// How many context lines to show around comments
const CONTEXT_LINES = 5
// How many lines to reveal when clicking "expand"
const EXPAND_STEP = 10

// Segment types for folding
type Segment =
  | { type: "lines"; lines: { line: DiffLine; index: number }[] }
  | { type: "collapsed"; lines: { line: DiffLine; index: number }[]; key: string }

export function App() {
  const { data, loading, done, respond } = useAgentBridge<CodeReviewData>()
  const [feedbacks, setFeedbacks] = useState<Record<string, CommentFeedback>>({})
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [expandedRanges, setExpandedRanges] = useState<Record<string, Set<string>>>(new Set() as any)
  const [initialized, setInitialized] = useState(false)

  if (data && !initialized) {
    setExpandedFiles(new Set(data.files.map((f) => f.path)))
    setInitialized(true)
  }

  const allComments = data?.files.flatMap((f) => f.comments) ?? []
  const reviewedCount = Object.keys(feedbacks).length
  const totalComments = allComments.length

  const setDecision = (commentId: string, decision: Decision) => {
    setFeedbacks((prev) => ({
      ...prev,
      [commentId]: { ...prev[commentId], commentId, decision, feedback: prev[commentId]?.feedback ?? "" },
    }))
  }

  const setFeedbackText = (commentId: string, feedback: string) => {
    setFeedbacks((prev) => ({
      ...prev,
      [commentId]: { ...prev[commentId], commentId, feedback, decision: prev[commentId]?.decision },
    }))
  }

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const expandRange = (fileKey: string, rangeKey: string) => {
    setExpandedRanges((prev) => {
      const fileSet = new Set(prev[fileKey] || [])
      fileSet.add(rangeKey)
      return { ...prev, [fileKey]: fileSet }
    })
  }

  const handleSubmit = () => {
    const results = data!.files.map((file) => ({
      path: file.path,
      comments: file.comments.map((c) => ({
        id: c.id,
        line: c.line,
        agentComment: c.body,
        decision: feedbacks[c.id]?.decision ?? null,
        userFeedback: feedbacks[c.id]?.feedback ?? "",
      })),
    }))
    respond("submit", { files: results, reviewedCount, totalComments })
  }

  // Build segments for a hunk: visible lines near comments, collapsed otherwise
  const buildSegments = (hunkLines: DiffLine[], comments: ReviewComment[], fileKey: string, hunkIndex: number): Segment[] => {
    const commentLineNums = new Set(comments.map((c) => c.line))

    // Mark which line indices should be visible (near a comment)
    const visible = new Set<number>()
    hunkLines.forEach((line, i) => {
      if (line.newNum !== undefined && commentLineNums.has(line.newNum)) {
        // Show CONTEXT_LINES before and after
        for (let j = Math.max(0, i - CONTEXT_LINES); j <= Math.min(hunkLines.length - 1, i + CONTEXT_LINES); j++) {
          visible.add(j)
        }
      }
    })

    // If no comments in this hunk, collapse everything
    if (visible.size === 0) {
      const key = `${fileKey}-h${hunkIndex}-all`
      const items = hunkLines.map((line, index) => ({ line, index }))
      return [{ type: "collapsed", lines: items, key }]
    }

    const segments: Segment[] = []
    let collapsedBuf: { line: DiffLine; index: number }[] = []

    hunkLines.forEach((line, i) => {
      if (visible.has(i)) {
        if (collapsedBuf.length > 0) {
          const key = `${fileKey}-h${hunkIndex}-c${i}`
          segments.push({ type: "collapsed", lines: [...collapsedBuf], key })
          collapsedBuf = []
        }
        // Add to current visible segment or create new one
        const last = segments[segments.length - 1]
        if (last && last.type === "lines") {
          last.lines.push({ line, index: i })
        } else {
          segments.push({ type: "lines", lines: [{ line, index: i }] })
        }
      } else {
        collapsedBuf.push({ line, index: i })
      }
    })

    if (collapsedBuf.length > 0) {
      const key = `${fileKey}-h${hunkIndex}-end`
      segments.push({ type: "collapsed", lines: [...collapsedBuf], key })
    }

    return segments
  }

  if (done) {
    return (
      <div className="cr-center">
        <div className="cr-done-card">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1a7f37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <h2 className="cr-done-title">Review Submitted</h2>
          <p className="cr-done-text">Your feedback has been sent. You can close this tab.</p>
        </div>
        <style>{globalStyles}</style>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="cr-center">
        <div className="cr-loading-pulse" />
        <style>{globalStyles}</style>
      </div>
    )
  }

  return (
    <div className="cr-page">
      <header className="cr-topbar">
        <div className="cr-topbar-inner">
          <div className="cr-topbar-left">
            <span className="cr-topbar-label">CODE REVIEW</span>
            <h1 className="cr-topbar-title">{data.title}</h1>
          </div>
          <div className="cr-topbar-right">
            <span className="cr-topbar-stat">
              {reviewedCount}/{totalComments} reviewed
            </span>
            <button className="cr-submit-btn" onClick={handleSubmit}>
              Submit Review
            </button>
          </div>
        </div>
      </header>

      {data.description && (
        <div className="cr-description-bar">
          <div className="cr-description-inner">{data.description}</div>
        </div>
      )}

      <div className="cr-body">
        {data.files.map((file) => {
          const isExpanded = expandedFiles.has(file.path)
          const fileCommentCount = file.comments.length
          const fileReviewedCount = file.comments.filter((c) => feedbacks[c.id]).length
          const fileKey = file.path

          return (
            <div key={file.path} className="cr-file">
              <div className="cr-file-header" onClick={() => toggleFile(file.path)}>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`cr-chevron ${isExpanded ? "cr-chevron--open" : ""}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="cr-file-icon">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="cr-file-path">{file.path}</span>
                {fileCommentCount > 0 && (
                  <span className="cr-file-badge">
                    {fileReviewedCount}/{fileCommentCount}
                  </span>
                )}
              </div>

              {isExpanded && (
                <div className="cr-diff-container">
                  {file.hunks.map((hunk, hi) => {
                    const segments = buildSegments(hunk.lines, file.comments, fileKey, hi)
                    const fileExpanded = expandedRanges[fileKey] || new Set()

                    return (
                      <div key={hi}>
                        <div className="cr-hunk-header">{hunk.header}</div>
                        <table className="cr-diff-table">
                          <tbody>
                            {segments.map((seg, si) => {
                              if (seg.type === "collapsed") {
                                // Check if this range has been expanded
                                if (fileExpanded.has(seg.key)) {
                                  return seg.lines.map(({ line, index }) => (
                                    <DiffLineRow key={`${hi}-${index}`} line={line} hi={hi} li={index} file={file} feedbacks={feedbacks} setDecision={setDecision} setFeedbackText={setFeedbackText} />
                                  ))
                                }
                                return (
                                  <tr key={`collapse-${si}`} className="cr-collapsed-row">
                                    <td colSpan={4}>
                                      <button
                                        className="cr-expand-btn"
                                        onClick={() => expandRange(fileKey, seg.key)}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="7 13 12 18 17 13" /><polyline points="7 6 12 11 17 6" />
                                        </svg>
                                        Show {seg.lines.length} hidden lines
                                      </button>
                                    </td>
                                  </tr>
                                )
                              }
                              return seg.lines.map(({ line, index }) => (
                                <DiffLineRow key={`${hi}-${index}`} line={line} hi={hi} li={index} file={file} feedbacks={feedbacks} setDecision={setDecision} setFeedbackText={setFeedbackText} />
                              ))
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style>{globalStyles}</style>
    </div>
  )
}

function DiffLineRow({ line, hi, li, file, feedbacks, setDecision, setFeedbackText }: {
  line: DiffLine; hi: number; li: number; file: FileReview;
  feedbacks: Record<string, CommentFeedback>;
  setDecision: (id: string, d: Decision) => void;
  setFeedbackText: (id: string, t: string) => void;
}) {
  const lineClass = line.type === "add" ? "cr-line--add" : line.type === "delete" ? "cr-line--del" : ""
  const linePrefix = line.type === "add" ? "+" : line.type === "delete" ? "-" : " "
  const lineComments = file.comments.filter((c) => c.line === line.newNum && line.type !== "delete")

  return (
    <Fragment>
      <tr className={`cr-line ${lineClass}`}>
        <td className="cr-line-num cr-line-num--old">{line.type !== "add" ? line.oldNum : ""}</td>
        <td className="cr-line-num cr-line-num--new">{line.type !== "delete" ? line.newNum : ""}</td>
        <td className="cr-line-prefix">{linePrefix}</td>
        <td className="cr-line-content"><pre>{line.content}</pre></td>
      </tr>
      {lineComments.map((comment) => (
        <tr key={`comment-${comment.id}`} className="cr-comment-row">
          <td colSpan={4}>
            <CommentCard
              comment={comment}
              feedback={feedbacks[comment.id]}
              onDecision={(d) => setDecision(comment.id, d)}
              onFeedback={(t) => setFeedbackText(comment.id, t)}
            />
          </td>
        </tr>
      ))}
    </Fragment>
  )
}

function CommentCard({
  comment, feedback, onDecision, onFeedback,
}: {
  comment: ReviewComment; feedback?: CommentFeedback;
  onDecision: (d: Decision) => void; onFeedback: (t: string) => void;
}) {
  const decision = feedback?.decision

  return (
    <div className="cr-comment">
      <div className="cr-comment-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span className="cr-comment-author">Agent Review</span>
        <span className="cr-comment-line">Line {comment.line}</span>
      </div>
      <div className="cr-comment-body">{comment.body}</div>
      <div className="cr-comment-actions">
        <button
          className={`cr-action-btn cr-action-btn--accept ${decision === "accept" ? "cr-action-btn--selected" : ""}`}
          onClick={() => onDecision("accept")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Accept
        </button>
        <button
          className={`cr-action-btn cr-action-btn--deny ${decision === "deny" ? "cr-action-btn--selected" : ""}`}
          onClick={() => onDecision("deny")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Deny
        </button>
      </div>
      <div className="cr-comment-feedback">
        <textarea
          className="cr-feedback-input"
          placeholder="Add feedback (optional)..."
          rows={2}
          value={feedback?.feedback ?? ""}
          onChange={(e) => onFeedback(e.target.value)}
        />
      </div>
    </div>
  )
}

const globalStyles = `
  :root {
    --cr-bg: #f6f8fa;
    --cr-surface: #ffffff;
    --cr-surface-2: #f6f8fa;
    --cr-border: #d1d9e0;
    --cr-border-light: #e8ebef;
    --cr-text: #1f2328;
    --cr-text-dim: #656d76;
    --cr-text-muted: #8b949e;
    --cr-accent: #1f6feb;
    --cr-green: #1a7f37;
    --cr-green-bg: #dafbe1;
    --cr-green-line: #ccffd8;
    --cr-red: #d1242f;
    --cr-red-bg: #ffebe9;
    --cr-red-line: #ffd7d5;
    --cr-hunk-bg: #ddf4ff;
    --cr-hunk-text: #0969da;
    --cr-comment-bg: #f6f8fa;
    --cr-collapsed-bg: #f0f6fc;
    --cr-radius: 6px;
    --cr-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
    --cr-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { margin: 0; background: var(--cr-bg); }

  .cr-page {
    min-height: 100vh;
    background: var(--cr-bg);
    font-family: var(--cr-font);
    color: var(--cr-text);
  }

  .cr-topbar {
    position: sticky; top: 0; z-index: 30;
    background: rgba(255,255,255,0.85);
    border-bottom: 1px solid var(--cr-border);
    backdrop-filter: blur(12px);
  }
  .cr-topbar-inner {
    max-width: 1200px; margin: 0 auto; padding: 12px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .cr-topbar-left { display: flex; align-items: center; gap: 16px; }
  .cr-topbar-label { font-size: 10px; font-weight: 600; letter-spacing: 1.5px; color: var(--cr-accent); font-family: var(--cr-mono); }
  .cr-topbar-title { font-size: 16px; font-weight: 600; }
  .cr-topbar-right { display: flex; align-items: center; gap: 12px; }
  .cr-topbar-stat { font-size: 13px; color: var(--cr-text-dim); font-family: var(--cr-mono); }
  .cr-submit-btn {
    padding: 8px 20px; background: var(--cr-green); color: #fff; border: none;
    border-radius: var(--cr-radius); font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: var(--cr-font); transition: background 0.15s;
  }
  .cr-submit-btn:hover { background: #15803d; }

  .cr-description-bar { border-bottom: 1px solid var(--cr-border); background: var(--cr-surface); }
  .cr-description-inner { max-width: 1200px; margin: 0 auto; padding: 12px 24px; font-size: 14px; color: var(--cr-text-dim); line-height: 1.5; }

  .cr-body { max-width: 1200px; margin: 0 auto; padding: 16px 24px 48px; display: flex; flex-direction: column; gap: 12px; }

  .cr-file { border: 1px solid var(--cr-border); border-radius: var(--cr-radius); background: var(--cr-surface); overflow: hidden; }
  .cr-file-header {
    display: flex; align-items: center; gap: 8px; padding: 10px 16px;
    background: var(--cr-surface-2); border-bottom: 1px solid var(--cr-border);
    cursor: pointer; user-select: none; transition: background 0.1s;
  }
  .cr-file-header:hover { background: #eef1f5; }
  .cr-chevron { color: var(--cr-text-dim); transition: transform 0.15s; flex-shrink: 0; }
  .cr-chevron--open { transform: rotate(90deg); }
  .cr-file-icon { color: var(--cr-text-dim); flex-shrink: 0; }
  .cr-file-path { font-size: 13px; font-weight: 600; font-family: var(--cr-mono); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cr-file-badge { font-size: 11px; font-family: var(--cr-mono); font-weight: 600; padding: 1px 8px; border-radius: 10px; background: var(--cr-surface); border: 1px solid var(--cr-border); color: var(--cr-text-dim); flex-shrink: 0; }

  .cr-diff-container { overflow-x: auto; }
  .cr-hunk-header { padding: 6px 16px; background: var(--cr-hunk-bg); color: var(--cr-hunk-text); font-size: 12px; font-family: var(--cr-mono); border-bottom: 1px solid var(--cr-border-light); }
  .cr-diff-table { width: 100%; border-collapse: collapse; font-family: var(--cr-mono); font-size: 13px; line-height: 20px; }
  .cr-line td { vertical-align: top; }
  .cr-line-num { width: 48px; min-width: 48px; padding: 0 8px; text-align: right; color: var(--cr-text-muted); font-size: 12px; user-select: none; border-right: 1px solid var(--cr-border-light); }
  .cr-line-prefix { width: 20px; min-width: 20px; padding: 0 4px; text-align: center; user-select: none; color: var(--cr-text-dim); }
  .cr-line-content { padding: 0 12px; white-space: pre-wrap; word-break: break-all; }
  .cr-line-content pre { margin: 0; font: inherit; white-space: pre-wrap; word-break: break-all; }
  .cr-line--add { background: var(--cr-green-line); }
  .cr-line--add .cr-line-num { background: var(--cr-green-bg); }
  .cr-line--add .cr-line-prefix { color: var(--cr-green); }
  .cr-line--del { background: var(--cr-red-line); }
  .cr-line--del .cr-line-num { background: var(--cr-red-bg); }
  .cr-line--del .cr-line-prefix { color: var(--cr-red); }

  /* Collapsed rows */
  .cr-collapsed-row td {
    padding: 0;
    background: var(--cr-collapsed-bg);
    border-top: 1px solid var(--cr-border-light);
    border-bottom: 1px solid var(--cr-border-light);
  }
  .cr-expand-btn {
    display: flex; align-items: center; gap: 6px; width: 100%;
    padding: 4px 16px; background: transparent; border: none;
    color: var(--cr-hunk-text); font-size: 12px; font-family: var(--cr-mono);
    cursor: pointer; transition: background 0.1s;
  }
  .cr-expand-btn:hover { background: rgba(9, 105, 218, 0.08); }

  /* Comments */
  .cr-comment-row td { padding: 0; border-top: 1px solid var(--cr-border-light); }
  .cr-comment { margin: 0; padding: 14px 20px; background: var(--cr-comment-bg); border-bottom: 1px solid var(--cr-border-light); }
  .cr-comment-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; color: var(--cr-text-dim); }
  .cr-comment-author { font-size: 13px; font-weight: 600; color: var(--cr-text); }
  .cr-comment-line { font-size: 11px; font-family: var(--cr-mono); color: var(--cr-text-muted); margin-left: auto; }
  .cr-comment-body { font-size: 14px; line-height: 1.6; color: var(--cr-text); margin-bottom: 12px; padding: 10px 14px; background: var(--cr-surface); border: 1px solid var(--cr-border-light); border-radius: var(--cr-radius); }
  .cr-comment-actions { display: flex; gap: 8px; margin-bottom: 10px; }
  .cr-action-btn {
    display: inline-flex; align-items: center; gap: 5px; padding: 5px 14px;
    border: 1px solid var(--cr-border); border-radius: var(--cr-radius);
    font-size: 12px; font-weight: 500; cursor: pointer; font-family: var(--cr-font);
    background: var(--cr-surface); color: var(--cr-text-dim); transition: all 0.15s;
  }
  .cr-action-btn:hover { background: var(--cr-surface-2); }
  .cr-action-btn--accept.cr-action-btn--selected { background: var(--cr-green-bg); border-color: var(--cr-green); color: var(--cr-green); }
  .cr-action-btn--deny.cr-action-btn--selected { background: var(--cr-red-bg); border-color: var(--cr-red); color: var(--cr-red); }

  .cr-feedback-input {
    width: 100%; padding: 8px 12px; border: 1px solid var(--cr-border);
    border-radius: var(--cr-radius); font-size: 13px; font-family: var(--cr-font);
    color: var(--cr-text); background: var(--cr-surface); resize: vertical;
    box-sizing: border-box; outline: none; transition: border-color 0.15s;
  }
  .cr-feedback-input:focus { border-color: var(--cr-accent); box-shadow: 0 0 0 3px rgba(31,111,235,0.1); }
  .cr-feedback-input::placeholder { color: var(--cr-text-muted); }

  .cr-center { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--cr-bg); font-family: var(--cr-font); }
  .cr-done-card { text-align: center; padding: 48px; }
  .cr-done-title { font-size: 20px; font-weight: 600; color: var(--cr-text); margin: 16px 0 8px; }
  .cr-done-text { font-size: 14px; color: var(--cr-text-dim); }
  .cr-loading-pulse { width: 40px; height: 40px; border-radius: 50%; background: var(--cr-accent); opacity: 0.6; animation: cr-pulse 1.2s ease-in-out infinite; }
  @keyframes cr-pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 0.6; transform: scale(1); } }
`
