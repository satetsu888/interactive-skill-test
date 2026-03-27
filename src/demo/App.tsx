import { useState } from "react"
import { useAgentBridge } from "../hooks/useAgentBridge"

interface Item {
  id: string
  title: string
  description: string
}

interface SkillData {
  message: string
  items: Item[]
}

type Decision = "approve" | "reject"

export function App() {
  const { data, loading, done, respond } = useAgentBridge<SkillData>()
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  const setDecision = (id: string, decision: Decision) => {
    setDecisions((prev) => ({ ...prev, [id]: decision }))
  }

  const allDecided = data?.items.every((item) => decisions[item.id]) ?? false

  const handleSubmit = () => {
    const results = data!.items.map((item) => ({
      id: item.id,
      title: item.title,
      decision: decisions[item.id],
    }))
    respond("submit", { results })
  }

  if (done) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.doneTitle}>Complete</h2>
          <p style={styles.doneText}>
            You can close this tab and return to the agent.
          </p>
        </div>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div style={styles.container}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>{data.message}</h1>
        <div style={styles.list}>
          {data.items.map((item) => {
            const decision = decisions[item.id]
            return (
              <div
                key={item.id}
                style={{
                  ...styles.item,
                  ...(decision === "approve" ? styles.itemApproved : {}),
                  ...(decision === "reject" ? styles.itemRejected : {}),
                }}
              >
                <div>
                  <strong>{item.title}</strong>
                  <p style={styles.description}>{item.description}</p>
                </div>
                <div style={styles.actions}>
                  <button
                    style={{
                      ...styles.toggleBtn,
                      ...(decision === "approve" ? styles.toggleActive : {}),
                      ...(decision === "approve"
                        ? styles.approveActive
                        : styles.approveInactive),
                    }}
                    onClick={() => setDecision(item.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    style={{
                      ...styles.toggleBtn,
                      ...(decision === "reject" ? styles.toggleActive : {}),
                      ...(decision === "reject"
                        ? styles.rejectActive
                        : styles.rejectInactive),
                    }}
                    onClick={() => setDecision(item.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <button
          style={{
            ...styles.submitBtn,
            ...(allDecided ? {} : styles.submitDisabled),
          }}
          disabled={!allDecided}
          onClick={handleSubmit}
        >
          Submit ({Object.keys(decisions).length}/{data.items.length})
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f5f5",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 32,
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    maxWidth: 600,
    width: "100%",
  },
  title: {
    margin: "0 0 24px",
    fontSize: 20,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    border: "2px solid #e0e0e0",
    borderRadius: 8,
    transition: "border-color 0.2s",
  },
  itemApproved: {
    borderColor: "#4caf50",
    background: "#f1f8e9",
  },
  itemRejected: {
    borderColor: "#f44336",
    background: "#fce4ec",
  },
  description: {
    margin: "4px 0 0",
    color: "#666",
    fontSize: 14,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexShrink: 0,
    marginLeft: 16,
  },
  toggleBtn: {
    padding: "6px 14px",
    border: "2px solid #ccc",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    background: "#fff",
    transition: "all 0.2s",
  },
  toggleActive: {
    color: "#fff",
    borderColor: "transparent",
  },
  approveActive: {
    background: "#4caf50",
    borderColor: "#4caf50",
    color: "#fff",
  },
  approveInactive: {
    color: "#4caf50",
    borderColor: "#c8e6c9",
  },
  rejectActive: {
    background: "#f44336",
    borderColor: "#f44336",
    color: "#fff",
  },
  rejectInactive: {
    color: "#f44336",
    borderColor: "#ffcdd2",
  },
  submitBtn: {
    marginTop: 24,
    width: "100%",
    padding: "12px 24px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    cursor: "pointer",
  },
  submitDisabled: {
    background: "#bdbdbd",
    cursor: "not-allowed",
  },
  doneTitle: {
    margin: "0 0 8px",
    fontSize: 20,
  },
  doneText: {
    margin: 0,
    color: "#666",
  },
}
