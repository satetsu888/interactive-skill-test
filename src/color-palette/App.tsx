import { useState } from "react"
import { useAgentBridge } from "../hooks/useAgentBridge"

interface ColorSlot {
  label: string
  defaultValue?: string
}

interface ColorData {
  title: string
  description?: string
  slots: ColorSlot[]
}

export function App() {
  const { data, loading, done, respond } = useAgentBridge<ColorData>()
  const [colors, setColors] = useState<Record<string, string>>({})
  const [initialized, setInitialized] = useState(false)

  if (data && !initialized) {
    const initial: Record<string, string> = {}
    data.slots.forEach((slot) => {
      initial[slot.label] = slot.defaultValue || "#6366f1"
    })
    setColors(initial)
    setInitialized(true)
  }

  const setColor = (label: string, value: string) => {
    setColors((prev) => ({ ...prev, [label]: value }))
  }

  const handleSubmit = () => {
    respond("submit", { colors })
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

  return (
    <div style={styles.page}>
      <div style={styles.layout}>
        {/* Left: Controls */}
        <div style={styles.controls}>
          <h1 style={styles.title}>{data.title}</h1>
          {data.description && (
            <p style={styles.description}>{data.description}</p>
          )}
          <div style={styles.slotList}>
            {data.slots.map((slot) => (
              <div key={slot.label} style={styles.slotRow}>
                <div style={styles.slotInfo}>
                  <span style={styles.slotLabel}>{slot.label}</span>
                  <code style={styles.hexCode}>{colors[slot.label]}</code>
                </div>
                <div style={styles.pickerWrapper}>
                  <input
                    type="color"
                    value={colors[slot.label]}
                    onChange={(e) => setColor(slot.label, e.target.value)}
                    style={styles.colorInput}
                  />
                  <div
                    style={{
                      ...styles.swatch,
                      background: colors[slot.label],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button style={styles.submitBtn} onClick={handleSubmit}>
            Submit Colors
          </button>
        </div>

        {/* Right: Preview */}
        <div style={styles.preview}>
          <h3 style={styles.previewTitle}>Preview</h3>

          {/* Palette bar */}
          <div style={styles.paletteBar}>
            {data.slots.map((slot) => (
              <div
                key={slot.label}
                style={{
                  ...styles.paletteChip,
                  background: colors[slot.label],
                }}
                title={slot.label}
              />
            ))}
          </div>

          {/* Mock UI preview */}
          <div
            style={{
              ...styles.mockCard,
              borderColor: colors[data.slots[0]?.label] || "#6366f1",
            }}
          >
            <div
              style={{
                ...styles.mockHeader,
                background: colors[data.slots[0]?.label] || "#6366f1",
              }}
            >
              <span style={{ color: "#fff", fontWeight: 600 }}>
                Sample Header
              </span>
            </div>
            <div style={styles.mockBody}>
              <p style={{ margin: "0 0 12px", color: "#333" }}>
                This is a preview of how the colors look together in a UI
                context.
              </p>
              <button
                style={{
                  ...styles.mockBtn,
                  background:
                    colors[data.slots[1]?.label] ||
                    colors[data.slots[0]?.label] ||
                    "#6366f1",
                }}
              >
                Primary Action
              </button>
              {data.slots.length > 2 && (
                <button
                  style={{
                    ...styles.mockBtnOutline,
                    color: colors[data.slots[2]?.label] || "#666",
                    borderColor: colors[data.slots[2]?.label] || "#666",
                  }}
                >
                  Secondary Action
                </button>
              )}
            </div>
          </div>

          {/* Text on background combinations */}
          <div style={styles.contrastGrid}>
            {data.slots.map((slot) => (
              <div
                key={slot.label}
                style={{
                  ...styles.contrastCell,
                  background: colors[slot.label],
                }}
              >
                <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>
                  White
                </span>
                <span
                  style={{ color: "#000", fontSize: 12, fontWeight: 600 }}
                >
                  Black
                </span>
                <span
                  style={{
                    color: "#fff",
                    fontSize: 10,
                    opacity: 0.7,
                    position: "absolute",
                    bottom: 4,
                    left: 6,
                  }}
                >
                  {slot.label}
                </span>
              </div>
            ))}
          </div>
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
    padding: 32,
  },
  layout: {
    display: "flex",
    gap: 32,
    maxWidth: 1000,
    margin: "0 auto",
  },
  controls: {
    flex: "0 0 360px",
  },
  title: {
    margin: "0 0 8px",
    fontSize: 22,
  },
  description: {
    margin: "0 0 24px",
    color: "#666",
    fontSize: 14,
    lineHeight: 1.5,
  },
  slotList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  slotRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#fff",
    borderRadius: 10,
    padding: "12px 16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  slotInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  slotLabel: {
    fontWeight: 600,
    fontSize: 14,
  },
  hexCode: {
    fontSize: 12,
    color: "#888",
    fontFamily: "monospace",
  },
  pickerWrapper: {
    position: "relative",
    width: 48,
    height: 48,
  },
  colorInput: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 10,
    border: "2px solid #e0e0e0",
    pointerEvents: "none",
  },
  submitBtn: {
    marginTop: 24,
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
  preview: {
    flex: 1,
  },
  previewTitle: {
    margin: "0 0 16px",
    fontSize: 16,
    color: "#555",
  },
  paletteBar: {
    display: "flex",
    gap: 0,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20,
    height: 48,
  },
  paletteChip: {
    flex: 1,
    transition: "background 0.2s",
  },
  mockCard: {
    borderRadius: 10,
    overflow: "hidden",
    border: "2px solid",
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  mockHeader: {
    padding: "14px 18px",
  },
  mockBody: {
    padding: 18,
    background: "#fff",
  },
  mockBtn: {
    padding: "8px 20px",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    cursor: "pointer",
    marginRight: 8,
  },
  mockBtnOutline: {
    padding: "8px 20px",
    background: "transparent",
    border: "2px solid",
    borderRadius: 6,
    fontSize: 13,
    cursor: "pointer",
  },
  contrastGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
    gap: 8,
  },
  contrastCell: {
    position: "relative",
    borderRadius: 8,
    padding: "12px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "center",
    minHeight: 60,
    transition: "background 0.2s",
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
