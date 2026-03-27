import { useState, useRef, useCallback } from "react"
import { useAgentBridge } from "../hooks/useAgentBridge"

interface GridData {
  title: string
  description?: string
  rows: string[]
  columns: string[]
  preselected?: string[] // ["row:col", ...]
}

export function App() {
  const { data, loading, done, respond } = useAgentBridge<GridData>()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)
  const [painting, setPainting] = useState(false)
  const paintMode = useRef<boolean>(true) // true = selecting, false = deselecting

  if (data && !initialized) {
    setSelected(new Set(data.preselected || []))
    setInitialized(true)
  }

  const cellKey = (row: string, col: string) => `${row}:${col}`

  const handleMouseDown = useCallback(
    (row: string, col: string) => {
      const key = cellKey(row, col)
      const willSelect = !selected.has(key)
      paintMode.current = willSelect
      setPainting(true)
      setSelected((prev) => {
        const next = new Set(prev)
        willSelect ? next.add(key) : next.delete(key)
        return next
      })
    },
    [selected]
  )

  const handleMouseEnter = useCallback(
    (row: string, col: string) => {
      if (!painting) return
      const key = cellKey(row, col)
      setSelected((prev) => {
        const next = new Set(prev)
        paintMode.current ? next.add(key) : next.delete(key)
        return next
      })
    },
    [painting]
  )

  const handleMouseUp = useCallback(() => {
    setPainting(false)
  }, [])

  const handleSubmit = () => {
    const result: Record<string, string[]> = {}
    data!.rows.forEach((row) => {
      const cols = data!.columns.filter((col) => selected.has(cellKey(row, col)))
      if (cols.length > 0) result[row] = cols
    })
    respond("submit", {
      selected: Array.from(selected),
      byRow: result,
      totalSelected: selected.size,
    })
  }

  const handleClear = () => setSelected(new Set())

  const handleSelectAll = () => {
    const all = new Set<string>()
    data!.rows.forEach((row) =>
      data!.columns.forEach((col) => all.add(cellKey(row, col)))
    )
    setSelected(all)
  }

  const selectRow = (row: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const allSelected = data!.columns.every((col) =>
        next.has(cellKey(row, col))
      )
      data!.columns.forEach((col) => {
        const key = cellKey(row, col)
        allSelected ? next.delete(key) : next.add(key)
      })
      return next
    })
  }

  const selectCol = (col: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const allSelected = data!.rows.every((row) =>
        next.has(cellKey(row, col))
      )
      data!.rows.forEach((row) => {
        const key = cellKey(row, col)
        allSelected ? next.delete(key) : next.add(key)
      })
      return next
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

  if (loading || !data || !initialized) {
    return (
      <div style={styles.center}>
        <p>Loading...</p>
      </div>
    )
  }

  const total = data.rows.length * data.columns.length

  return (
    <div style={styles.page} onMouseUp={handleMouseUp}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>{data.title}</h1>
          {data.description && (
            <p style={styles.description}>{data.description}</p>
          )}
          <div style={styles.toolbar}>
            <span style={styles.count}>
              {selected.size}/{total} selected
            </span>
            <button style={styles.toolBtn} onClick={handleSelectAll}>
              Select All
            </button>
            <button style={styles.toolBtn} onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>

        <div style={styles.gridWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cornerCell} />
                {data.columns.map((col) => (
                  <th
                    key={col}
                    style={styles.colHeader}
                    onClick={() => selectCol(col)}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row}>
                  <td
                    style={styles.rowHeader}
                    onClick={() => selectRow(row)}
                  >
                    {row}
                  </td>
                  {data.columns.map((col) => {
                    const key = cellKey(row, col)
                    const isSelected = selected.has(key)
                    return (
                      <td
                        key={key}
                        style={{
                          ...styles.cell,
                          ...(isSelected ? styles.cellSelected : {}),
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleMouseDown(row, col)
                        }}
                        onMouseEnter={() => handleMouseEnter(row, col)}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={styles.hint}>
          Click and drag to select. Click row/column headers to toggle
          entire rows/columns.
        </div>

        <button style={styles.submitBtn} onClick={handleSubmit}>
          Submit Selection
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f2f5",
    fontFamily: "system-ui, sans-serif",
    padding: 32,
    userSelect: "none",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 12,
    padding: 32,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    margin: "0 0 8px",
    fontSize: 22,
  },
  description: {
    margin: "0 0 16px",
    color: "#666",
    fontSize: 14,
    lineHeight: 1.5,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  count: {
    fontSize: 13,
    color: "#888",
    marginRight: "auto",
  },
  toolBtn: {
    padding: "4px 12px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
    color: "#555",
  },
  gridWrapper: {
    overflowX: "auto",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
  },
  cornerCell: {
    width: 100,
    minWidth: 100,
  },
  colHeader: {
    padding: "8px 4px",
    fontSize: 12,
    fontWeight: 600,
    color: "#555",
    textAlign: "center",
    cursor: "pointer",
    borderBottom: "2px solid #e0e0e0",
    whiteSpace: "nowrap",
  },
  rowHeader: {
    padding: "4px 12px 4px 0",
    fontSize: 13,
    fontWeight: 600,
    color: "#555",
    textAlign: "right",
    cursor: "pointer",
    borderRight: "2px solid #e0e0e0",
    whiteSpace: "nowrap",
  },
  cell: {
    width: 36,
    height: 36,
    minWidth: 36,
    border: "1px solid #eee",
    background: "#fafafa",
    cursor: "pointer",
    transition: "background 0.1s",
  },
  cellSelected: {
    background: "#1976d2",
    borderColor: "#1565c0",
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
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
