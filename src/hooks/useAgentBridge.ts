import { useState, useEffect } from "react"

interface AgentBridge<T = unknown> {
  data: T | null
  loading: boolean
  done: boolean
  respond: (action: string, payload?: unknown) => Promise<void>
}

export function useAgentBridge<T = unknown>(): AgentBridge<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
  }, [])

  const respond = async (action: string, payload?: unknown) => {
    await fetch("/api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    })
    setDone(true)
  }

  return { data, loading, done, respond }
}
