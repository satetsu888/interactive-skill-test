import { useMemo, useState, useCallback } from "react"
import { useAgentBridge } from "../hooks/useAgentBridge"
import type { VoxelViewData, VoxelComment } from "./types"
import { keyToPosition, positionToKey } from "./types"
import { expandOps } from "./opsExpander"
import VoxelScene from "./VoxelScene"

function computeStats(voxels: Map<string, unknown>) {
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const key of voxels.keys()) {
    const { x, y, z } = keyToPosition(key)
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
  }
  if (minX === Infinity) return { rangeX: 0, rangeY: 0, rangeZ: 0 }
  return { rangeX: maxX - minX + 1, rangeY: maxY - minY + 1, rangeZ: maxZ - minZ + 1 }
}

export function App() {
  const { data, loading, done, respond } = useAgentBridge<VoxelViewData>()

  const voxelState = useMemo(() => (data ? expandOps(data.ops) : new Map()), [data])
  const stats = useMemo(() => computeStats(voxelState), [voxelState])

  const [comments, setComments] = useState<VoxelComment[]>([])
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [pendingText, setPendingText] = useState("")
  const [showLabels, setShowLabels] = useState(true)

  const commentedKeys = useMemo(
    () => new Set(comments.map((c) => positionToKey(c.x, c.y, c.z))),
    [comments],
  )

  const handleBlockClick = useCallback((key: string) => {
    setPendingKey(key)
    setPendingText("")
  }, [])

  const addComment = () => {
    if (!pendingKey || !pendingText.trim()) return
    const { x, y, z } = keyToPosition(pendingKey)
    setComments((prev) => [
      ...prev,
      { id: crypto.randomUUID(), x, y, z, text: pendingText.trim() },
    ])
    setPendingKey(null)
    setPendingText("")
  }

  const removeComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  if (loading || !data) return <div style={styles.loading}>Loading...</div>
  if (done) {
    return (
      <div style={styles.done}>
        <div style={styles.doneIcon}>&#10003;</div>
        <div>Confirmed</div>
      </div>
    )
  }

  const pendingPos = pendingKey ? keyToPosition(pendingKey) : null

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>{data.title ?? "Voxel View"}</h2>
        <div style={styles.headerInfo}>
          Blocks: {voxelState.size} &nbsp;|&nbsp;
          {stats.rangeX}&times;{stats.rangeY}&times;{stats.rangeZ}
        </div>
      </div>
      <div style={styles.body}>
        {/* Viewport with overlays */}
        <div style={styles.viewport}>
          <VoxelScene
            voxels={voxelState}
            onBlockClick={handleBlockClick}
            commentedKeys={commentedKeys}
            pendingKey={pendingKey}
            comments={comments}
            showLabels={showLabels}
          />

          {/* Toggle labels button */}
          <button
            style={styles.toggleBtn}
            onClick={() => setShowLabels((v) => !v)}
            title={showLabels ? "Hide comment labels" : "Show comment labels"}
          >
            {showLabels ? "Labels ON" : "Labels OFF"}
          </button>

          {/* Floating comment form */}
          {pendingKey && (
            <div style={styles.floatingForm}>
              <div style={styles.floatingFormHeader}>
                <span style={styles.floatingFormCoord}>
                  Block ({pendingPos!.x}, {pendingPos!.y}, {pendingPos!.z})
                </span>
                <button style={styles.floatingCloseBtn} onClick={() => setPendingKey(null)}>
                  &times;
                </button>
              </div>
              <input
                style={styles.commentInput}
                value={pendingText}
                onChange={(e) => setPendingText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addComment()}
                placeholder="Type a comment..."
                autoFocus
              />
              <button style={styles.addBtn} onClick={addComment}>
                Add Comment
              </button>
            </div>
          )}
        </div>

        {/* Sidebar: comment list */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            Comments ({comments.length})
          </div>
          <div style={styles.commentList}>
            {comments.map((c, i) => (
              <div key={c.id} style={styles.commentItem}>
                <div style={styles.commentItemHeader}>
                  <span style={styles.commentIndex}>{i + 1}</span>
                  <span style={styles.commentCoord}>
                    ({c.x}, {c.y}, {c.z})
                  </span>
                  <button style={styles.removeBtn} onClick={() => removeComment(c.id)}>
                    &times;
                  </button>
                </div>
                <div style={styles.commentText}>{c.text}</div>
              </div>
            ))}
            {comments.length === 0 && (
              <div style={styles.emptyHint}>Click a block to add a comment</div>
            )}
          </div>
          <button
            style={styles.confirmBtn}
            onClick={() =>
              respond("submit", {
                comments: comments.map(({ x, y, z, text }) => ({ x, y, z, text })),
              })
            }
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    background: "#1a1a2e",
    color: "#e0e0e0",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 20px",
    borderBottom: "1px solid #333",
    background: "#16213e",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 600 },
  headerInfo: { fontSize: 13, color: "#aaa" },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  viewport: { flex: 1, position: "relative", overflow: "hidden" },
  sidebar: {
    width: 260,
    display: "flex",
    flexDirection: "column",
    borderLeft: "1px solid #333",
    background: "#16213e",
  },
  sidebarHeader: {
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 600,
    borderBottom: "1px solid #333",
  },
  commentList: { flex: 1, overflowY: "auto" },
  commentItem: {
    padding: "10px 16px",
    borderBottom: "1px solid #2a2a4a",
  },
  commentItemHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  commentIndex: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#f0c040",
    color: "#1a1a2e",
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  commentCoord: {
    fontSize: 12,
    color: "#aaa",
    fontFamily: "monospace",
    flex: 1,
  },
  removeBtn: {
    background: "transparent",
    border: "none",
    color: "#888",
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
    padding: 0,
  },
  commentText: {
    fontSize: 13,
    marginTop: 4,
    paddingLeft: 28,
  },
  emptyHint: {
    padding: "24px 16px",
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
  confirmBtn: {
    margin: "12px 16px",
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    background: "#4CAF50",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },

  // Viewport overlays
  toggleBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    padding: "4px 10px",
    fontSize: 12,
    background: "rgba(22, 33, 62, 0.85)",
    color: "#ccc",
    border: "1px solid #555",
    borderRadius: 4,
    cursor: "pointer",
  },
  floatingForm: {
    position: "absolute",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    width: 320,
    background: "rgba(22, 33, 62, 0.95)",
    border: "1px solid #555",
    borderRadius: 8,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
  },
  floatingFormHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  floatingFormCoord: {
    fontSize: 13,
    color: "#7fb8f0",
    fontFamily: "monospace",
  },
  floatingCloseBtn: {
    background: "transparent",
    border: "none",
    color: "#888",
    fontSize: 20,
    cursor: "pointer",
    lineHeight: 1,
    padding: 0,
  },
  commentInput: {
    width: "100%",
    padding: "8px 10px",
    fontSize: 13,
    border: "1px solid #555",
    borderRadius: 4,
    background: "#0f0f23",
    color: "#e0e0e0",
    outline: "none",
    boxSizing: "border-box",
  },
  addBtn: {
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 600,
    background: "#4CAF50",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    alignSelf: "flex-end",
  },

  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontSize: 18,
    color: "#aaa",
    background: "#1a1a2e",
  },
  done: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontSize: 24,
    color: "#4CAF50",
    background: "#1a1a2e",
    gap: 12,
  },
  doneIcon: { fontSize: 48, fontWeight: "bold" },
}
