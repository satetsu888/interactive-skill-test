import { useState, useMemo } from "react"
import { useAgentBridge } from "../hooks/useAgentBridge"

interface Item {
  id: string
  title: string
  description?: string
}

interface PairwiseData {
  title: string
  description?: string
  items: Item[]
}

interface Pair {
  a: Item
  b: Item
}

function generatePairs(items: Item[]): Pair[] {
  const pairs: Pair[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push({ a: items[i], b: items[j] })
    }
  }
  // Shuffle for fairness
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }
  // Randomly swap a/b in each pair
  return pairs.map((p) =>
    Math.random() > 0.5 ? p : { a: p.b, b: p.a }
  )
}

export function App() {
  const { data, loading, done, respond } = useAgentBridge<PairwiseData>()
  const [scores, setScores] = useState<Record<string, number>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [history, setHistory] = useState<string[]>([]) // winner ids

  const pairs = useMemo(() => {
    if (!data) return []
    return generatePairs(data.items)
  }, [data])

  const handleChoose = (winnerId: string) => {
    setScores((prev) => ({
      ...prev,
      [winnerId]: (prev[winnerId] || 0) + 1,
    }))
    setHistory((prev) => [...prev, winnerId])
    setCurrentIndex((prev) => prev + 1)
  }

  const handleUndo = () => {
    if (history.length === 0) return
    const lastWinner = history[history.length - 1]
    setScores((prev) => ({
      ...prev,
      [lastWinner]: (prev[lastWinner] || 0) - 1,
    }))
    setHistory((prev) => prev.slice(0, -1))
    setCurrentIndex((prev) => prev - 1)
  }

  const handleSubmit = () => {
    const ranking = data!.items
      .map((item) => ({
        id: item.id,
        title: item.title,
        score: scores[item.id] || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }))

    respond("submit", { ranking, totalComparisons: pairs.length })
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

  const isComplete = currentIndex >= pairs.length
  const pair = !isComplete ? pairs[currentIndex] : null

  // Build current ranking for sidebar
  const ranking = data.items
    .map((item) => ({
      ...item,
      score: scores[item.id] || 0,
    }))
    .sort((a, b) => b.score - a.score)

  const maxScore = Math.max(...ranking.map((r) => r.score), 1)

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>{data.title}</h1>
        {data.description && (
          <p style={styles.description}>{data.description}</p>
        )}
      </div>

      <div style={styles.layout}>
        {/* Main comparison area */}
        <div style={styles.mainArea}>
          {/* Progress bar */}
          <div style={styles.progressContainer}>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${(currentIndex / pairs.length) * 100}%`,
                }}
              />
            </div>
            <span style={styles.progressText}>
              {currentIndex}/{pairs.length}
            </span>
            {currentIndex > 0 && (
              <button style={styles.undoBtn} onClick={handleUndo}>
                Undo
              </button>
            )}
          </div>

          {isComplete ? (
            <div style={styles.completeCard}>
              <h2 style={{ margin: "0 0 16px", fontSize: 20 }}>
                All comparisons complete!
              </h2>
              <div style={styles.finalRanking}>
                {ranking.map((item, i) => (
                  <div key={item.id} style={styles.finalRankItem}>
                    <span style={styles.rankBadge}>#{i + 1}</span>
                    <span style={styles.rankTitle}>{item.title}</span>
                    <span style={styles.rankScore}>
                      {item.score} wins
                    </span>
                  </div>
                ))}
              </div>
              <button style={styles.submitBtn} onClick={handleSubmit}>
                Submit Ranking
              </button>
            </div>
          ) : pair ? (
            <div style={styles.versus}>
              <button
                style={styles.choiceCard}
                onClick={() => handleChoose(pair.a.id)}
              >
                <h3 style={styles.choiceTitle}>{pair.a.title}</h3>
                {pair.a.description && (
                  <p style={styles.choiceDesc}>{pair.a.description}</p>
                )}
              </button>

              <div style={styles.vsCircle}>VS</div>

              <button
                style={styles.choiceCard}
                onClick={() => handleChoose(pair.b.id)}
              >
                <h3 style={styles.choiceTitle}>{pair.b.title}</h3>
                {pair.b.description && (
                  <p style={styles.choiceDesc}>{pair.b.description}</p>
                )}
              </button>
            </div>
          ) : null}
        </div>

        {/* Sidebar: live ranking */}
        <div style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>Live Ranking</h3>
          {ranking.map((item, i) => (
            <div key={item.id} style={styles.rankRow}>
              <span style={styles.rankNum}>{i + 1}</span>
              <div style={styles.rankInfo}>
                <span style={styles.rankName}>{item.title}</span>
                <div style={styles.rankBarBg}>
                  <div
                    style={{
                      ...styles.rankBarFill,
                      width: `${(item.score / maxScore) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <span style={styles.rankScoreSide}>{item.score}</span>
            </div>
          ))}
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
    maxWidth: 1000,
    margin: "0 auto 20px",
  },
  title: {
    margin: 0,
    fontSize: 22,
  },
  description: {
    margin: "4px 0 0",
    color: "#666",
    fontSize: 14,
  },
  layout: {
    display: "flex",
    gap: 24,
    maxWidth: 1000,
    margin: "0 auto",
  },
  mainArea: {
    flex: 1,
  },
  progressContainer: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  progressBar: {
    flex: 1,
    height: 6,
    background: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#1976d2",
    borderRadius: 3,
    transition: "width 0.3s ease",
  },
  progressText: {
    fontSize: 13,
    color: "#888",
    whiteSpace: "nowrap",
  },
  undoBtn: {
    padding: "4px 12px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
    color: "#555",
  },
  versus: {
    display: "flex",
    gap: 20,
    alignItems: "stretch",
  },
  choiceCard: {
    flex: 1,
    padding: 32,
    background: "#fff",
    border: "2px solid #e0e0e0",
    borderRadius: 12,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "border-color 0.2s, box-shadow 0.2s, transform 0.1s",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    fontFamily: "inherit",
  },
  choiceTitle: {
    margin: 0,
    fontSize: 18,
    color: "#1a1a1a",
  },
  choiceDesc: {
    margin: "8px 0 0",
    color: "#666",
    fontSize: 14,
    lineHeight: 1.5,
  },
  vsCircle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "#1a1a1a",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
    alignSelf: "center",
  },
  completeCard: {
    background: "#fff",
    borderRadius: 12,
    padding: 32,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  finalRanking: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 20,
  },
  finalRankItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    background: "#fafafa",
    borderRadius: 8,
  },
  rankBadge: {
    fontWeight: 700,
    fontSize: 14,
    color: "#1976d2",
    width: 32,
  },
  rankTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: 500,
  },
  rankScore: {
    fontSize: 13,
    color: "#888",
  },
  sidebar: {
    width: 240,
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
    margin: "0 0 14px",
    fontSize: 15,
    color: "#333",
  },
  rankRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  rankNum: {
    width: 20,
    fontSize: 12,
    fontWeight: 700,
    color: "#999",
    textAlign: "center",
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 13,
    fontWeight: 500,
    display: "block",
    marginBottom: 3,
  },
  rankBarBg: {
    height: 4,
    background: "#eee",
    borderRadius: 2,
    overflow: "hidden",
  },
  rankBarFill: {
    height: "100%",
    background: "#1976d2",
    borderRadius: 2,
    transition: "width 0.3s ease",
    minWidth: 2,
  },
  rankScoreSide: {
    fontSize: 12,
    color: "#888",
    width: 20,
    textAlign: "right",
  },
  submitBtn: {
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
