import { useState, useMemo, useRef, useCallback } from "react"
import { useAgentBridge } from "../hooks/useAgentBridge"

interface DataPoint {
  id: string
  [key: string]: string | number
}

interface FilterData {
  title: string
  description?: string
  xAxis: string
  yAxis: string
  labelField?: string
  data: DataPoint[]
}

type Mode = "pick" | "line"

interface Line {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function App() {
  const { data, loading, done, respond } = useAgentBridge<FilterData>()
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<Mode>("pick")
  const [divLine, setDivLine] = useState<Line | null>(null)
  const [drawingLine, setDrawingLine] = useState(false)
  const [lineStart, setLineStart] = useState({ x: 0, y: 0 })
  const [lineEnd, setLineEnd] = useState({ x: 0, y: 0 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const chartRef = useRef<SVGSVGElement>(null)

  const CHART_W = 620
  const CHART_H = 420
  const PAD = { top: 20, right: 20, bottom: 50, left: 60 }
  const plotW = CHART_W - PAD.left - PAD.right
  const plotH = CHART_H - PAD.top - PAD.bottom

  const { xExtent, yExtent } = useMemo(() => {
    if (!data) return { xExtent: [0, 1] as [number, number], yExtent: [0, 1] as [number, number] }
    const xs = data.data.map((d) => Number(d[data.xAxis]))
    const ys = data.data.map((d) => Number(d[data.yAxis]))
    const xPad = (Math.max(...xs) - Math.min(...xs)) * 0.08 || 1
    const yPad = (Math.max(...ys) - Math.min(...ys)) * 0.08 || 1
    return {
      xExtent: [Math.min(...xs) - xPad, Math.max(...xs) + xPad] as [number, number],
      yExtent: [Math.min(...ys) - yPad, Math.max(...ys) + yPad] as [number, number],
    }
  }, [data])

  const scaleX = useCallback(
    (v: number) => PAD.left + ((v - xExtent[0]) / (xExtent[1] - xExtent[0])) * plotW,
    [xExtent, plotW]
  )
  const scaleY = useCallback(
    (v: number) => PAD.top + plotH - ((v - yExtent[0]) / (yExtent[1] - yExtent[0])) * plotH,
    [yExtent, plotH]
  )
  const unscaleX = useCallback(
    (px: number) => xExtent[0] + ((px - PAD.left) / plotW) * (xExtent[1] - xExtent[0]),
    [xExtent, plotW]
  )
  const unscaleY = useCallback(
    (px: number) => yExtent[0] + ((plotH - (px - PAD.top)) / plotH) * (yExtent[1] - yExtent[0]),
    [yExtent, plotH]
  )

  // Which side of a line is a point on? Returns positive or negative.
  const sideOfLine = useCallback((px: number, py: number, line: Line) => {
    return (line.x2 - line.x1) * (py - line.y1) - (line.y2 - line.y1) * (px - line.x1)
  }, [])

  const getSvgPos = (e: React.MouseEvent) => {
    const svg = chartRef.current!
    const rect = svg.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleClick = (e: React.MouseEvent, pointId?: string) => {
    if (mode === "pick" && pointId) {
      setExcluded((prev) => {
        const next = new Set(prev)
        next.has(pointId) ? next.delete(pointId) : next.add(pointId)
        return next
      })
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== "line") return
    const pos = getSvgPos(e)
    setDrawingLine(true)
    setLineStart(pos)
    setLineEnd(pos)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawingLine) return
    setLineEnd(getSvgPos(e))
  }

  const handleMouseUp = () => {
    if (!drawingLine) return
    setDrawingLine(false)
    const dx = lineEnd.x - lineStart.x
    const dy = lineEnd.y - lineStart.y
    if (Math.sqrt(dx * dx + dy * dy) < 10) return

    // Convert to data coordinates
    const line: Line = {
      x1: unscaleX(lineStart.x),
      y1: unscaleY(lineStart.y),
      x2: unscaleX(lineEnd.x),
      y2: unscaleY(lineEnd.y),
    }
    setDivLine(line)
  }

  const applyLine = (keepSide: "positive" | "negative") => {
    if (!divLine || !data) return
    const toExclude = new Set(excluded)
    data.data.forEach((d) => {
      const x = Number(d[data.xAxis])
      const y = Number(d[data.yAxis])
      const side = sideOfLine(x, y, divLine)
      if (keepSide === "positive" && side < 0) toExclude.add(d.id)
      if (keepSide === "negative" && side > 0) toExclude.add(d.id)
    })
    setExcluded(toExclude)
    setDivLine(null)
  }

  const selectedData = useMemo(() => {
    if (!data) return []
    return data.data.filter((d) => !excluded.has(d.id))
  }, [data, excluded])

  const handleSubmit = () => {
    respond("submit", {
      selectedIds: selectedData.map((d) => d.id),
      excludedIds: Array.from(excluded),
      totalSelected: selectedData.length,
      totalItems: data!.data.length,
    })
  }

  if (done) {
    return (
      <div style={styles.center}>
        <div style={styles.doneCard}>
          <h2 style={{ margin: "0 0 8px" }}>Complete</h2>
          <p style={{ margin: 0, color: "#666" }}>You can close this tab and return to the agent.</p>
        </div>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div style={styles.center}><p>Loading...</p></div>
    )
  }

  const xTicks = makeTicks(xExtent[0], xExtent[1], 6)
  const yTicks = makeTicks(yExtent[0], yExtent[1], 6)
  const labelField = data.labelField || "id"

  // For line mode: compute which points are on which side
  const positiveSide = new Set<string>()
  const negativeSide = new Set<string>()
  if (divLine) {
    data.data.forEach((d) => {
      const x = Number(d[data.xAxis])
      const y = Number(d[data.yAxis])
      const side = sideOfLine(x, y, divLine)
      if (side >= 0) positiveSide.add(d.id)
      else negativeSide.add(d.id)
    })
  }

  // Extend dividing line to chart edges for display
  const extendedLine = divLine ? extendToChartBounds(
    scaleX(divLine.x1), scaleY(divLine.y1),
    scaleX(divLine.x2), scaleY(divLine.y2),
    PAD.left, PAD.top, CHART_W - PAD.right, CHART_H - PAD.bottom
  ) : null

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>{data.title}</h1>
            {data.description && <p style={styles.description}>{data.description}</p>}
          </div>
          <div style={styles.stats}>
            <span style={styles.statBadge}>
              {selectedData.length}/{data.data.length} selected
            </span>
            <button style={styles.resetBtn} onClick={() => { setExcluded(new Set()); setDivLine(null) }}>
              Reset
            </button>
          </div>
        </div>

        {/* Mode selector */}
        <div style={styles.modeBar}>
          <button
            style={{ ...styles.modeBtn, ...(mode === "pick" ? styles.modeBtnActive : {}) }}
            onClick={() => { setMode("pick"); setDivLine(null) }}
          >
            Pick Points
          </button>
          <button
            style={{ ...styles.modeBtn, ...(mode === "line" ? styles.modeBtnActive : {}) }}
            onClick={() => setMode("line")}
          >
            Draw Dividing Line
          </button>
          <span style={styles.modeHint}>
            {mode === "pick"
              ? "Click points to include/exclude them."
              : "Drag on the chart to draw a line, then choose which side to keep."}
          </span>
        </div>

        <div style={styles.chartLayout}>
          {/* Chart */}
          <svg
            ref={chartRef}
            width={CHART_W}
            height={CHART_H}
            style={{ cursor: mode === "line" ? "crosshair" : "default", userSelect: "none" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { if (drawingLine) setDrawingLine(false) }}
          >
            {/* Grid */}
            {xTicks.map((t) => (
              <line key={`xg${t}`} x1={scaleX(t)} x2={scaleX(t)} y1={PAD.top} y2={CHART_H - PAD.bottom} stroke="#f0f0f0" />
            ))}
            {yTicks.map((t) => (
              <line key={`yg${t}`} x1={PAD.left} x2={CHART_W - PAD.right} y1={scaleY(t)} y2={scaleY(t)} stroke="#f0f0f0" />
            ))}

            {/* Axes */}
            <line x1={PAD.left} x2={CHART_W - PAD.right} y1={CHART_H - PAD.bottom} y2={CHART_H - PAD.bottom} stroke="#ccc" />
            <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={CHART_H - PAD.bottom} stroke="#ccc" />

            {/* Tick labels */}
            {xTicks.map((t) => (
              <text key={`xl${t}`} x={scaleX(t)} y={CHART_H - PAD.bottom + 20} textAnchor="middle" fontSize={11} fill="#888">{formatTick(t)}</text>
            ))}
            {yTicks.map((t) => (
              <text key={`yl${t}`} x={PAD.left - 8} y={scaleY(t) + 4} textAnchor="end" fontSize={11} fill="#888">{formatTick(t)}</text>
            ))}

            {/* Axis labels */}
            <text x={CHART_W / 2} y={CHART_H - 5} textAnchor="middle" fontSize={13} fill="#555" fontWeight={600}>{data.xAxis}</text>
            <text x={14} y={CHART_H / 2} textAnchor="middle" fontSize={13} fill="#555" fontWeight={600} transform={`rotate(-90, 14, ${CHART_H / 2})`}>{data.yAxis}</text>

            {/* Dividing line (extended) */}
            {extendedLine && (
              <line
                x1={extendedLine.x1} y1={extendedLine.y1}
                x2={extendedLine.x2} y2={extendedLine.y2}
                stroke="#e53935" strokeWidth={2} strokeDasharray="6 3"
              />
            )}

            {/* Drawing line preview */}
            {drawingLine && (
              <line
                x1={lineStart.x} y1={lineStart.y}
                x2={lineEnd.x} y2={lineEnd.y}
                stroke="#e53935" strokeWidth={2} strokeDasharray="4 4" opacity={0.6}
              />
            )}

            {/* Data points */}
            {data.data.map((d) => {
              const x = Number(d[data.xAxis])
              const y = Number(d[data.yAxis])
              const isExcluded = excluded.has(d.id)
              const isHovered = hoveredId === d.id

              let fill = isExcluded ? "#ccc" : "#1976d2"
              let opacity = isExcluded ? 0.3 : 0.8
              let r = isHovered ? 8 : 5

              // Color by side when divLine is active
              if (divLine && !isExcluded) {
                fill = positiveSide.has(d.id) ? "#1976d2" : "#f59e0b"
              }

              return (
                <g key={d.id}>
                  {/* Larger invisible hit area */}
                  <circle
                    cx={scaleX(x)} cy={scaleY(y)} r={12}
                    fill="transparent"
                    style={{ cursor: mode === "pick" ? "pointer" : "crosshair" }}
                    onClick={(e) => handleClick(e, d.id)}
                    onMouseEnter={() => setHoveredId(d.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                  <circle
                    cx={scaleX(x)} cy={scaleY(y)} r={r}
                    fill={fill} opacity={opacity}
                    stroke={isHovered ? "#000" : isExcluded ? "transparent" : "#1565c0"}
                    strokeWidth={isHovered ? 2 : 1}
                    style={{ transition: "r 0.1s, fill 0.2s", pointerEvents: "none" }}
                  />
                  {/* Tooltip on hover */}
                  {isHovered && (
                    <g>
                      <rect
                        x={scaleX(x) + 10} y={scaleY(y) - 32}
                        width={Math.max(80, String(d[labelField]).length * 8 + 16)} height={24}
                        rx={4} fill="#333" opacity={0.9}
                      />
                      <text
                        x={scaleX(x) + 18} y={scaleY(y) - 16}
                        fontSize={12} fill="#fff"
                      >
                        {String(d[labelField])}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Right panel */}
          <div style={styles.rightPanel}>
            {/* Line action buttons */}
            {divLine && (
              <div style={styles.lineActions}>
                <p style={styles.lineActionTitle}>Keep which side?</p>
                <button
                  style={{ ...styles.sideBtn, background: "#1976d2" }}
                  onClick={() => applyLine("positive")}
                >
                  Blue side ({[...positiveSide].filter((id) => !excluded.has(id)).length})
                </button>
                <button
                  style={{ ...styles.sideBtn, background: "#f59e0b" }}
                  onClick={() => applyLine("negative")}
                >
                  Orange side ({[...negativeSide].filter((id) => !excluded.has(id)).length})
                </button>
                <button
                  style={styles.cancelLineBtn}
                  onClick={() => setDivLine(null)}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Selected items table */}
            <h3 style={styles.tableTitle}>
              Selected ({selectedData.length})
            </h3>
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{labelField}</th>
                    <th style={styles.thNum}>{data.xAxis}</th>
                    <th style={styles.thNum}>{data.yAxis}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedData.slice(0, 50).map((d) => (
                    <tr
                      key={d.id}
                      style={{
                        background: hoveredId === d.id ? "#e3f2fd" : "transparent",
                        cursor: "pointer",
                      }}
                      onMouseEnter={() => setHoveredId(d.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => handleClick({} as React.MouseEvent, d.id)}
                    >
                      <td style={styles.td}>{String(d[labelField])}</td>
                      <td style={styles.tdNum}>{formatTick(Number(d[data.xAxis]))}</td>
                      <td style={styles.tdNum}>{formatTick(Number(d[data.yAxis]))}</td>
                    </tr>
                  ))}
                  {selectedData.length > 50 && (
                    <tr>
                      <td colSpan={3} style={{ ...styles.td, color: "#aaa", textAlign: "center" }}>
                        ... and {selectedData.length - 50} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {excluded.size > 0 && (
              <p style={styles.excludedHint}>
                {excluded.size} point{excluded.size > 1 ? "s" : ""} excluded
              </p>
            )}
          </div>
        </div>

        <button style={styles.submitBtn} onClick={handleSubmit}>
          Submit Selection ({selectedData.length} items)
        </button>
      </div>
    </div>
  )
}

function makeTicks(min: number, max: number, count: number): number[] {
  const step = (max - min) / count
  return Array.from({ length: count + 1 }, (_, i) => min + step * i)
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "k"
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(1)
}

// Extend a line segment to fill the chart bounds using parametric clipping
function extendToChartBounds(
  x1: number, y1: number, x2: number, y2: number,
  xMin: number, yMin: number, xMax: number, yMax: number
): { x1: number; y1: number; x2: number; y2: number } | null {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return null

  const tValues: number[] = []
  if (dx !== 0) {
    tValues.push((xMin - x1) / dx, (xMax - x1) / dx)
  }
  if (dy !== 0) {
    tValues.push((yMin - y1) / dy, (yMax - y1) / dy)
  }

  const valid = tValues.filter((t) => {
    const x = x1 + t * dx
    const y = y1 + t * dy
    return x >= xMin - 1 && x <= xMax + 1 && y >= yMin - 1 && y <= yMax + 1
  })

  if (valid.length < 2) return null
  const tMin = Math.min(...valid)
  const tMax = Math.max(...valid)
  return {
    x1: x1 + tMin * dx,
    y1: y1 + tMin * dy,
    x2: x1 + tMax * dx,
    y2: y1 + tMax * dy,
  }
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f2f5",
    fontFamily: "system-ui, sans-serif",
    padding: 24,
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 12,
    padding: 28,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: { margin: 0, fontSize: 22 },
  description: { margin: "4px 0 0", color: "#666", fontSize: 14 },
  stats: { display: "flex", alignItems: "center", gap: 8 },
  statBadge: {
    padding: "4px 12px",
    background: "#e3f2fd",
    color: "#1976d2",
    borderRadius: 16,
    fontSize: 13,
    fontWeight: 600,
  },
  resetBtn: {
    padding: "4px 12px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
    color: "#555",
  },
  modeBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: "1px solid #eee",
  },
  modeBtn: {
    padding: "6px 16px",
    border: "2px solid #e0e0e0",
    borderRadius: 8,
    background: "#fff",
    fontSize: 13,
    cursor: "pointer",
    color: "#555",
    fontWeight: 500,
    fontFamily: "inherit",
  },
  modeBtnActive: {
    borderColor: "#1976d2",
    color: "#1976d2",
    background: "#e3f2fd",
  },
  modeHint: {
    fontSize: 12,
    color: "#aaa",
    marginLeft: 8,
  },
  chartLayout: { display: "flex", gap: 20 },
  rightPanel: {
    flex: 1,
    minWidth: 220,
    display: "flex",
    flexDirection: "column",
  },
  lineActions: {
    background: "#fff3e0",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  lineActionTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: "#555",
  },
  sideBtn: {
    padding: "8px 12px",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 600,
    fontFamily: "inherit",
  },
  cancelLineBtn: {
    padding: "6px 12px",
    background: "transparent",
    border: "1px solid #ccc",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
    color: "#888",
    fontFamily: "inherit",
  },
  tableTitle: { margin: "0 0 8px", fontSize: 14, color: "#555" },
  tableScroll: {
    flex: 1,
    maxHeight: 340,
    overflowY: "auto",
    border: "1px solid #eee",
    borderRadius: 6,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    padding: "6px 10px",
    textAlign: "left",
    borderBottom: "2px solid #eee",
    color: "#555",
    fontWeight: 600,
    fontSize: 12,
    position: "sticky",
    top: 0,
    background: "#fff",
  },
  thNum: {
    padding: "6px 10px",
    textAlign: "right",
    borderBottom: "2px solid #eee",
    color: "#555",
    fontWeight: 600,
    fontSize: 12,
    position: "sticky",
    top: 0,
    background: "#fff",
  },
  td: {
    padding: "5px 10px",
    borderBottom: "1px solid #f5f5f5",
    color: "#333",
  },
  tdNum: {
    padding: "5px 10px",
    borderBottom: "1px solid #f5f5f5",
    color: "#333",
    textAlign: "right",
    fontFamily: "monospace",
  },
  excludedHint: {
    margin: "8px 0 0",
    fontSize: 12,
    color: "#999",
  },
  submitBtn: {
    marginTop: 20,
    width: "100%",
    padding: "12px 24px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    cursor: "pointer",
    fontWeight: 600,
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
