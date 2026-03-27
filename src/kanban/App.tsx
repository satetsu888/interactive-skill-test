import { useState, useRef } from "react"
import { useAgentBridge } from "../hooks/useAgentBridge"

interface Item {
  id: string
  title: string
  description?: string
}

interface KanbanData {
  title: string
  columns: string[]
  items: Item[]
}

export function App() {
  const { data, loading, done, respond } = useAgentBridge<KanbanData>()
  const [board, setBoard] = useState<Record<string, Item[]> | null>(null)
  const dragItem = useRef<{ id: string; fromColumn: string } | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // Initialize board from data
  if (data && !board) {
    const initial: Record<string, Item[]> = {}
    data.columns.forEach((col) => (initial[col] = []))
    // Put all items in the first column initially
    initial[data.columns[0]] = [...data.items]
    setBoard(initial)
  }

  const handleDragStart = (item: Item, fromColumn: string) => {
    dragItem.current = { id: item.id, fromColumn }
  }

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault()
    setDragOverColumn(column)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e: React.DragEvent, toColumn: string) => {
    e.preventDefault()
    setDragOverColumn(null)
    if (!dragItem.current || !board) return

    const { id, fromColumn } = dragItem.current
    if (fromColumn === toColumn) return

    const item = board[fromColumn].find((i) => i.id === id)
    if (!item) return

    setBoard({
      ...board,
      [fromColumn]: board[fromColumn].filter((i) => i.id !== id),
      [toColumn]: [...board[toColumn], item],
    })
    dragItem.current = null
  }

  const handleSubmit = () => {
    if (!board) return
    const result: Record<string, { id: string; title: string }[]> = {}
    for (const [column, items] of Object.entries(board)) {
      result[column] = items.map((i) => ({ id: i.id, title: i.title }))
    }
    respond("submit", { board: result })
  }

  if (done) {
    return (
      <div style={styles.doneContainer}>
        <div style={styles.doneCard}>
          <h2 style={{ margin: "0 0 8px" }}>Complete</h2>
          <p style={{ margin: 0, color: "#666" }}>
            You can close this tab and return to the agent.
          </p>
        </div>
      </div>
    )
  }

  if (loading || !data || !board) {
    return (
      <div style={styles.doneContainer}>
        <p>Loading...</p>
      </div>
    )
  }

  const firstColumn = data.columns[0]
  const unassigned = board[firstColumn]?.length ?? 0
  const total = data.items.length
  const assigned = total - unassigned

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>{data.title}</h1>
        <p style={styles.subtitle}>
          Drag items to organize them into columns.
        </p>
      </div>
      <div style={styles.board}>
        {data.columns.map((column) => (
          <div
            key={column}
            style={{
              ...styles.column,
              ...(dragOverColumn === column ? styles.columnDragOver : {}),
            }}
            onDragOver={(e) => handleDragOver(e, column)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column)}
          >
            <div style={styles.columnHeader}>
              <span style={styles.columnTitle}>{column}</span>
              <span style={styles.columnCount}>{board[column].length}</span>
            </div>
            <div style={styles.columnBody}>
              {board[column].map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(item, column)}
                  style={styles.card}
                >
                  <strong style={styles.cardTitle}>{item.title}</strong>
                  {item.description && (
                    <p style={styles.cardDesc}>{item.description}</p>
                  )}
                </div>
              ))}
              {board[column].length === 0 && (
                <div style={styles.empty}>Drop items here</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={styles.footer}>
        <span style={styles.progress}>
          {assigned}/{total} items assigned
        </span>
        <button style={styles.submitBtn} onClick={handleSubmit}>
          Submit
        </button>
      </div>
    </div>
  )
}

const COLUMN_COLORS = ["#e3f2fd", "#e8f5e9", "#fff3e0", "#fce4ec", "#f3e5f5"]

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f2f5",
    fontFamily: "system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "24px 32px 0",
  },
  title: {
    margin: 0,
    fontSize: 22,
    color: "#1a1a1a",
  },
  subtitle: {
    margin: "4px 0 0",
    color: "#888",
    fontSize: 14,
  },
  board: {
    display: "flex",
    gap: 16,
    padding: "20px 32px",
    flex: 1,
    overflowX: "auto",
  },
  column: {
    flex: 1,
    minWidth: 220,
    background: "#fff",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    border: "2px solid transparent",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  columnDragOver: {
    borderColor: "#1976d2",
    boxShadow: "0 0 0 3px rgba(25,118,210,0.15)",
  },
  columnHeader: {
    padding: "14px 16px 10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #eee",
  },
  columnTitle: {
    fontWeight: 700,
    fontSize: 14,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    color: "#555",
  },
  columnCount: {
    background: "#e0e0e0",
    borderRadius: 10,
    padding: "2px 8px",
    fontSize: 12,
    fontWeight: 600,
    color: "#666",
  },
  columnBody: {
    padding: 10,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 100,
  },
  card: {
    background: "#fafafa",
    border: "1px solid #e8e8e8",
    borderRadius: 8,
    padding: "10px 12px",
    cursor: "grab",
    transition: "box-shadow 0.15s, transform 0.1s",
    userSelect: "none" as const,
  },
  cardTitle: {
    fontSize: 14,
    color: "#1a1a1a",
  },
  cardDesc: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#888",
    lineHeight: 1.4,
  },
  empty: {
    padding: 20,
    textAlign: "center" as const,
    color: "#bbb",
    fontSize: 13,
    border: "2px dashed #e0e0e0",
    borderRadius: 8,
  },
  footer: {
    padding: "12px 32px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progress: {
    fontSize: 14,
    color: "#888",
  },
  submitBtn: {
    padding: "10px 32px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    cursor: "pointer",
    fontWeight: 600,
  },
  doneContainer: {
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
