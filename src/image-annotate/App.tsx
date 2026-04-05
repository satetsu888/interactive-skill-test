import { useState, useRef, useEffect, useCallback } from "react"
import { useAgentBridge } from "../hooks/useAgentBridge"

interface Annotation {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
  color: string
}

interface AnnotateData {
  title: string
  imageUrl: string
  labels?: string[]
}

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"]

export function App() {
  const { data, loading, done, respond } = useAgentBridge<AnnotateData>()
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentRect, setCurrentRect] = useState<{
    x: number; y: number; width: number; height: number
  } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedLabel, setSelectedLabel] = useState("")
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const labels = data?.labels || ["Bug", "Improvement", "Question", "Note"]

  useEffect(() => {
    if (data && !selectedLabel && labels.length > 0) {
      setSelectedLabel(labels[0])
    }
  }, [data, selectedLabel, labels])

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (editingId) return
    const pos = getRelativePos(e)
    setStartPos(pos)
    setDrawing(true)
    setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 })
  }, [editingId, getRelativePos])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing) return
    const pos = getRelativePos(e)
    setCurrentRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
    })
  }, [drawing, startPos, getRelativePos])

  const handleMouseUp = useCallback(() => {
    if (!drawing || !currentRect) return
    setDrawing(false)
    if (currentRect.width < 1 || currentRect.height < 1) {
      setCurrentRect(null)
      return
    }
    const id = crypto.randomUUID()
    const colorIndex = annotations.length % COLORS.length
    setAnnotations((prev) => [
      ...prev,
      { id, ...currentRect, label: selectedLabel, color: COLORS[colorIndex] },
    ])
    setCurrentRect(null)
    setEditingId(id)
  }, [drawing, currentRect, selectedLabel, annotations.length])

  const updateLabel = (id: string, label: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, label } : a))
    )
  }

  const removeAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const handleImageLoad = () => {
    if (imgRef.current) {
      setImageSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      })
    }
  }

  const handleSubmit = () => {
    respond("submit", {
      annotations: annotations.map((a) => ({
        label: a.label,
        region: {
          x: Math.round(a.x * 100) / 100,
          y: Math.round(a.y * 100) / 100,
          width: Math.round(a.width * 100) / 100,
          height: Math.round(a.height * 100) / 100,
        },
      })),
      imageSize,
    })
  }

  if (done) {
    return (
      <div style={styles.center}>
        <div style={styles.doneCard}>
          <h2 style={{ margin: "0 0 8px" }}>Complete</h2>
          <p style={{ margin: 0, color: "#666" }}>
            You can close this tab and return to the agent.
          </p>
        </div>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div style={styles.center}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>{data.title}</h1>
        <p style={styles.hint}>
          Draw rectangles on the image to annotate. Click an annotation to edit
          its label.
        </p>
      </div>

      <div style={styles.layout}>
        <div style={styles.canvasArea}>
          {/* Label selector */}
          <div style={styles.labelBar}>
            <span style={{ fontSize: 13, color: "#666", marginRight: 8 }}>
              Label:
            </span>
            {labels.map((label) => (
              <button
                key={label}
                style={{
                  ...styles.labelBtn,
                  ...(selectedLabel === label ? styles.labelBtnActive : {}),
                }}
                onClick={() => setSelectedLabel(label)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Image + annotations */}
          <div
            ref={containerRef}
            style={styles.imageContainer}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (drawing) {
                setDrawing(false)
                setCurrentRect(null)
              }
            }}
          >
            <img
              ref={imgRef}
              src={data.imageUrl}
              alt="annotate target"
              style={styles.image}
              onLoad={handleImageLoad}
              draggable={false}
            />
            {/* Existing annotations */}
            {annotations.map((a) => (
              <div
                key={a.id}
                style={{
                  ...styles.rect,
                  left: `${a.x}%`,
                  top: `${a.y}%`,
                  width: `${a.width}%`,
                  height: `${a.height}%`,
                  borderColor: a.color,
                  background: `${a.color}15`,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingId(editingId === a.id ? null : a.id)
                }}
              >
                <span
                  style={{ ...styles.rectLabel, background: a.color }}
                >
                  {a.label}
                </span>
              </div>
            ))}
            {/* Currently drawing */}
            {currentRect && (
              <div
                style={{
                  ...styles.rect,
                  left: `${currentRect.x}%`,
                  top: `${currentRect.y}%`,
                  width: `${currentRect.width}%`,
                  height: `${currentRect.height}%`,
                  borderColor: COLORS[annotations.length % COLORS.length],
                  borderStyle: "dashed",
                }}
              />
            )}
          </div>
        </div>

        {/* Sidebar: annotation list */}
        <div style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>
            Annotations ({annotations.length})
          </h3>
          {annotations.length === 0 && (
            <p style={{ color: "#aaa", fontSize: 13 }}>
              Draw on the image to add annotations.
            </p>
          )}
          {annotations.map((a, i) => (
            <div
              key={a.id}
              style={{
                ...styles.annotationItem,
                borderLeftColor: a.color,
                ...(editingId === a.id ? styles.annotationItemActive : {}),
              }}
              onClick={() => setEditingId(editingId === a.id ? null : a.id)}
            >
              <div style={styles.annotationHeader}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>#{i + 1}</span>
                <button
                  style={styles.removeBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAnnotation(a.id)
                  }}
                >
                  x
                </button>
              </div>
              {editingId === a.id ? (
                <select
                  value={a.label}
                  onChange={(e) => updateLabel(a.id, e.target.value)}
                  style={styles.labelSelect}
                  onClick={(e) => e.stopPropagation()}
                >
                  {labels.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: 13, color: "#555" }}>{a.label}</span>
              )}
            </div>
          ))}

          <button
            style={{
              ...styles.submitBtn,
              ...(annotations.length === 0 ? styles.submitDisabled : {}),
            }}
            disabled={annotations.length === 0}
            onClick={handleSubmit}
          >
            Submit ({annotations.length} annotations)
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f2f5",
    fontFamily: "system-ui, sans-serif",
    padding: 24,
  },
  header: {
    maxWidth: 1100,
    margin: "0 auto 16px",
  },
  title: {
    margin: 0,
    fontSize: 22,
  },
  hint: {
    margin: "4px 0 0",
    color: "#888",
    fontSize: 13,
  },
  layout: {
    display: "flex",
    gap: 20,
    maxWidth: 1100,
    margin: "0 auto",
  },
  canvasArea: {
    flex: 1,
  },
  labelBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  labelBtn: {
    padding: "4px 12px",
    border: "1px solid #ddd",
    borderRadius: 16,
    background: "#fff",
    fontSize: 12,
    cursor: "pointer",
    color: "#555",
  },
  labelBtnActive: {
    background: "#1976d2",
    color: "#fff",
    borderColor: "#1976d2",
  },
  imageContainer: {
    position: "relative",
    background: "#000",
    borderRadius: 8,
    overflow: "hidden",
    cursor: "crosshair",
    userSelect: "none",
  },
  image: {
    display: "block",
    width: "100%",
    height: "auto",
    pointerEvents: "none",
  },
  rect: {
    position: "absolute",
    border: "2px solid",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  rectLabel: {
    position: "absolute",
    top: -1,
    left: -1,
    padding: "1px 6px",
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    borderRadius: "0 0 4px 0",
    whiteSpace: "nowrap",
  },
  sidebar: {
    width: 250,
    flexShrink: 0,
    background: "#fff",
    borderRadius: 10,
    padding: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    alignSelf: "flex-start",
    position: "sticky",
    top: 24,
  },
  sidebarTitle: {
    margin: "0 0 12px",
    fontSize: 15,
    color: "#333",
  },
  annotationItem: {
    padding: "8px 10px",
    borderLeft: "3px solid",
    marginBottom: 8,
    borderRadius: "0 6px 6px 0",
    background: "#fafafa",
    cursor: "pointer",
  },
  annotationItemActive: {
    background: "#e3f2fd",
  },
  annotationHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 14,
    padding: "0 4px",
    lineHeight: 1,
  },
  labelSelect: {
    width: "100%",
    padding: "4px 8px",
    border: "1px solid #ddd",
    borderRadius: 4,
    fontSize: 13,
  },
  submitBtn: {
    marginTop: 16,
    width: "100%",
    padding: "10px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
    fontWeight: 600,
  },
  submitDisabled: {
    background: "#bdbdbd",
    cursor: "not-allowed",
  },
  center: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f2f5",
    fontFamily: "system-ui, sans-serif",
  },
  doneCard: {
    background: "#fff",
    borderRadius: 12,
    padding: 32,
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
  },
}
