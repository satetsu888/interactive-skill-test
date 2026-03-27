import { useState, useEffect } from "react";
export function useAgentBridge() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [done, setDone] = useState(false);
    useEffect(() => {
        fetch("/api/data")
            .then((r) => r.json())
            .then((d) => {
            setData(d);
            setLoading(false);
        });
    }, []);
    const respond = async (action, payload) => {
        await fetch("/api/respond", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, payload }),
        });
        setDone(true);
    };
    return { data, loading, done, respond };
}
