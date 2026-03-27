import { useState } from "react"
import { useAgentBridge } from "../hooks/useAgentBridge"

interface Choice {
  label: string
  text: string
}

interface Question {
  id: string
  question: string
  choices: Choice[]
  answer: string // label of the correct choice
  explanation: string
}

interface QuizData {
  title: string
  description?: string
  questions: Question[]
}

interface Answer {
  questionId: string
  selected: string
  correct: boolean
}

export function App() {
  const { data, loading, done, respond } = useAgentBridge<QuizData>()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)

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

  const totalQuestions = data.questions.length
  const isFinished = currentIndex >= totalQuestions && !reviewMode
  const correctCount = answers.filter((a) => a.correct).length

  const handleSelect = (label: string) => {
    if (revealed) return
    setSelected(label)
  }

  const handleConfirm = () => {
    if (!selected) return
    const question = data.questions[currentIndex]
    const isCorrect = selected === question.answer
    setAnswers((prev) => [
      ...prev,
      { questionId: question.id, selected, correct: isCorrect },
    ])
    setRevealed(true)
    setShowExplanation(true)
  }

  const handleNext = () => {
    setSelected(null)
    setRevealed(false)
    setShowExplanation(false)
    setCurrentIndex((prev) => prev + 1)
  }

  const handleSubmit = () => {
    respond("submit", {
      score: correctCount,
      total: totalQuestions,
      percentage: Math.round((correctCount / totalQuestions) * 100),
      details: answers.map((a) => {
        const q = data.questions.find((q) => q.id === a.questionId)!
        return {
          questionId: a.questionId,
          question: q.question,
          selected: a.selected,
          correct: a.correct,
          correctAnswer: q.answer,
        }
      }),
    })
  }

  // Review mode: browse answered questions
  if (reviewMode) {
    const q = data.questions[reviewIndex]
    const ans = answers[reviewIndex]
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.reviewHeader}>
            <button
              style={styles.backBtn}
              onClick={() => setReviewMode(false)}
            >
              Back to Results
            </button>
            <span style={styles.reviewNav}>
              {reviewIndex + 1} / {totalQuestions}
            </span>
          </div>

          <div style={styles.questionTag}>
            {ans.correct ? (
              <span style={styles.correctTag}>Correct</span>
            ) : (
              <span style={styles.incorrectTag}>Incorrect</span>
            )}
          </div>

          <h2 style={styles.questionText}>{q.question}</h2>

          <div style={styles.choiceList}>
            {q.choices.map((choice) => {
              const isCorrectChoice = choice.label === q.answer
              const isSelected = choice.label === ans.selected
              let style = { ...styles.choice }
              if (isCorrectChoice)
                style = { ...style, ...styles.choiceCorrect }
              if (isSelected && !isCorrectChoice)
                style = { ...style, ...styles.choiceWrong }
              return (
                <div key={choice.label} style={style}>
                  <span style={styles.choiceLabel}>{choice.label}</span>
                  <span>{choice.text}</span>
                  {isCorrectChoice && (
                    <span style={styles.correctMark}>correct</span>
                  )}
                  {isSelected && !isCorrectChoice && (
                    <span style={styles.wrongMark}>your answer</span>
                  )}
                </div>
              )
            })}
          </div>

          <div style={styles.explanationBox}>
            <h4 style={styles.explanationTitle}>Explanation</h4>
            <p style={styles.explanationText}>{q.explanation}</p>
          </div>

          <div style={styles.reviewNavBtns}>
            <button
              style={styles.navBtn}
              disabled={reviewIndex === 0}
              onClick={() => setReviewIndex((i) => i - 1)}
            >
              Previous
            </button>
            <button
              style={styles.navBtn}
              disabled={reviewIndex === totalQuestions - 1}
              onClick={() => setReviewIndex((i) => i + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Results screen
  if (isFinished) {
    const pct = Math.round((correctCount / totalQuestions) * 100)
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.resultsTitle}>Results</h1>

          <div style={styles.scoreCircle}>
            <div style={styles.scoreNumber}>
              {correctCount}/{totalQuestions}
            </div>
            <div style={styles.scorePct}>{pct}%</div>
          </div>

          <div style={styles.resultList}>
            {data.questions.map((q, i) => {
              const ans = answers[i]
              return (
                <div
                  key={q.id}
                  style={{
                    ...styles.resultRow,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setReviewMode(true)
                    setReviewIndex(i)
                  }}
                >
                  <span
                    style={{
                      ...styles.resultDot,
                      background: ans.correct ? "#4caf50" : "#f44336",
                    }}
                  />
                  <span style={styles.resultQuestion}>
                    Q{i + 1}. {q.question.slice(0, 60)}
                    {q.question.length > 60 ? "..." : ""}
                  </span>
                  <span style={styles.resultArrow}>›</span>
                </div>
              )
            })}
          </div>

          <div style={styles.resultsActions}>
            <button
              style={styles.reviewBtn}
              onClick={() => {
                setReviewMode(true)
                setReviewIndex(0)
              }}
            >
              Review All
            </button>
            <button style={styles.submitBtn} onClick={handleSubmit}>
              Submit Results
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Question screen
  const question = data.questions[currentIndex]

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>{data.title}</h1>
          {data.description && (
            <p style={styles.description}>{data.description}</p>
          )}
        </div>

        {/* Progress */}
        <div style={styles.progressRow}>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${(currentIndex / totalQuestions) * 100}%`,
              }}
            />
          </div>
          <span style={styles.progressText}>
            {currentIndex + 1} / {totalQuestions}
          </span>
        </div>

        {/* Question */}
        <h2 style={styles.questionText}>{question.question}</h2>

        {/* Choices */}
        <div style={styles.choiceList}>
          {question.choices.map((choice) => {
            let choiceStyle = { ...styles.choice }

            if (revealed) {
              if (choice.label === question.answer) {
                choiceStyle = { ...choiceStyle, ...styles.choiceCorrect }
              } else if (
                choice.label === selected &&
                choice.label !== question.answer
              ) {
                choiceStyle = { ...choiceStyle, ...styles.choiceWrong }
              } else {
                choiceStyle = { ...choiceStyle, ...styles.choiceDimmed }
              }
            } else if (choice.label === selected) {
              choiceStyle = { ...choiceStyle, ...styles.choiceSelected }
            }

            return (
              <div
                key={choice.label}
                style={choiceStyle}
                onClick={() => handleSelect(choice.label)}
              >
                <span style={styles.choiceLabel}>{choice.label}</span>
                <span>{choice.text}</span>
                {revealed && choice.label === question.answer && (
                  <span style={styles.correctMark}>correct</span>
                )}
                {revealed &&
                  choice.label === selected &&
                  choice.label !== question.answer && (
                    <span style={styles.wrongMark}>your answer</span>
                  )}
              </div>
            )
          })}
        </div>

        {/* Explanation */}
        {revealed && showExplanation && (
          <div style={styles.explanationBox}>
            <h4 style={styles.explanationTitle}>Explanation</h4>
            <p style={styles.explanationText}>{question.explanation}</p>
          </div>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          {!revealed ? (
            <button
              style={{
                ...styles.confirmBtn,
                ...(selected ? {} : styles.btnDisabled),
              }}
              disabled={!selected}
              onClick={handleConfirm}
            >
              Answer
            </button>
          ) : (
            <div style={styles.revealedActions}>
              {!showExplanation && (
                <button
                  style={styles.explainBtn}
                  onClick={() => setShowExplanation(true)}
                >
                  Show Explanation
                </button>
              )}
              <button style={styles.nextBtn} onClick={handleNext}>
                {currentIndex < totalQuestions - 1 ? "Next Question" : "See Results"}
              </button>
            </div>
          )}
        </div>

        {/* Mini score */}
        {answers.length > 0 && (
          <div style={styles.miniScore}>
            {answers.map((a, i) => (
              <span
                key={i}
                style={{
                  ...styles.miniDot,
                  background: a.correct ? "#4caf50" : "#f44336",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f2f5",
    fontFamily: "system-ui, sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    background: "#fff",
    borderRadius: 14,
    padding: 36,
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    maxWidth: 640,
    width: "100%",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 20,
    color: "#333",
  },
  description: {
    margin: "4px 0 0",
    color: "#888",
    fontSize: 14,
  },
  progressRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  progressBar: {
    flex: 1,
    height: 6,
    background: "#e8e8e8",
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
    color: "#999",
    whiteSpace: "nowrap",
  },
  questionText: {
    fontSize: 18,
    lineHeight: 1.5,
    color: "#1a1a1a",
    margin: "0 0 20px",
  },
  choiceList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  choice: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 18px",
    border: "2px solid #e8e8e8",
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.15s",
    fontSize: 15,
    color: "#333",
  },
  choiceSelected: {
    borderColor: "#1976d2",
    background: "#e3f2fd",
  },
  choiceCorrect: {
    borderColor: "#4caf50",
    background: "#e8f5e9",
    cursor: "default",
  },
  choiceWrong: {
    borderColor: "#f44336",
    background: "#ffebee",
    cursor: "default",
  },
  choiceDimmed: {
    opacity: 0.4,
    cursor: "default",
  },
  choiceLabel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#f0f0f0",
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    color: "#555",
  },
  correctMark: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: 600,
    color: "#4caf50",
  },
  wrongMark: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: 600,
    color: "#f44336",
  },
  explanationBox: {
    marginTop: 18,
    padding: "14px 18px",
    background: "#f5f5f5",
    borderRadius: 10,
    borderLeft: "4px solid #1976d2",
  },
  explanationTitle: {
    margin: "0 0 6px",
    fontSize: 13,
    fontWeight: 700,
    color: "#555",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  explanationText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: "#444",
  },
  actions: {
    marginTop: 24,
  },
  confirmBtn: {
    width: "100%",
    padding: "12px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnDisabled: {
    background: "#bdbdbd",
    cursor: "not-allowed",
  },
  revealedActions: {
    display: "flex",
    gap: 10,
  },
  explainBtn: {
    flex: 1,
    padding: "12px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
    color: "#555",
    fontFamily: "inherit",
  },
  nextBtn: {
    flex: 1,
    padding: "12px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  miniScore: {
    display: "flex",
    gap: 6,
    justifyContent: "center",
    marginTop: 20,
  },
  miniDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },
  // Results
  resultsTitle: {
    margin: "0 0 24px",
    fontSize: 22,
    textAlign: "center",
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: "50%",
    background: "#e3f2fd",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px",
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1976d2",
  },
  scorePct: {
    fontSize: 14,
    color: "#666",
  },
  resultList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 24,
  },
  resultRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 8,
    background: "#fafafa",
    transition: "background 0.1s",
  },
  resultDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  resultQuestion: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  resultArrow: {
    color: "#ccc",
    fontSize: 18,
  },
  resultsActions: {
    display: "flex",
    gap: 12,
  },
  reviewBtn: {
    flex: 1,
    padding: "12px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
    color: "#555",
    fontFamily: "inherit",
  },
  submitBtn: {
    flex: 1,
    padding: "12px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  // Review mode
  reviewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backBtn: {
    padding: "6px 14px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 13,
    cursor: "pointer",
    color: "#555",
    fontFamily: "inherit",
  },
  reviewNav: {
    fontSize: 13,
    color: "#999",
  },
  questionTag: {
    marginBottom: 12,
  },
  correctTag: {
    padding: "3px 10px",
    background: "#e8f5e9",
    color: "#4caf50",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  incorrectTag: {
    padding: "3px 10px",
    background: "#ffebee",
    color: "#f44336",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  reviewNavBtns: {
    display: "flex",
    gap: 10,
    marginTop: 20,
  },
  navBtn: {
    flex: 1,
    padding: "10px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
    color: "#555",
    fontFamily: "inherit",
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
