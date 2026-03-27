import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAgentBridge } from "./hooks/useAgentBridge";
export function App() {
    const { data, loading, done, respond } = useAgentBridge();
    if (done) {
        return (_jsx("div", { style: styles.container, children: _jsxs("div", { style: styles.card, children: [_jsx("h2", { style: styles.doneTitle, children: "Complete" }), _jsx("p", { style: styles.doneText, children: "You can close this tab and return to the agent." })] }) }));
    }
    if (loading || !data) {
        return (_jsx("div", { style: styles.container, children: _jsx("p", { children: "Loading..." }) }));
    }
    return (_jsx("div", { style: styles.container, children: _jsxs("div", { style: styles.card, children: [_jsx("h1", { style: styles.title, children: data.message }), _jsx("div", { style: styles.list, children: data.items.map((item) => (_jsxs("div", { style: styles.item, children: [_jsxs("div", { children: [_jsx("strong", { children: item.title }), _jsx("p", { style: styles.description, children: item.description })] }), _jsxs("div", { style: styles.actions, children: [_jsx("button", { style: styles.approveBtn, onClick: () => respond("approve", { id: item.id }), children: "Approve" }), _jsx("button", { style: styles.rejectBtn, onClick: () => respond("reject", { id: item.id }), children: "Reject" })] })] }, item.id))) })] }) }));
}
const styles = {
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
        gap: 16,
    },
    item: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        border: "1px solid #e0e0e0",
        borderRadius: 8,
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
    approveBtn: {
        padding: "8px 16px",
        background: "#4caf50",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 14,
    },
    rejectBtn: {
        padding: "8px 16px",
        background: "#f44336",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 14,
    },
    doneTitle: {
        margin: "0 0 8px",
        fontSize: 20,
    },
    doneText: {
        margin: 0,
        color: "#666",
    },
};
