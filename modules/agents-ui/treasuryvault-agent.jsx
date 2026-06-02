import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_WITHDRAWALS = [
    { id: "WD-001", requester: "0xA1…8F", recipient: "0xC1…2A", amount: "10.00 ETH", approvals: 2, status: "EXECUTED", reason: "Q1 Salaries" },
    { id: "WD-002", requester: "0xA1…8F", recipient: "0xC2…5D", amount: "25.00 ETH", approvals: 1, status: "PENDING", reason: "Infrastructure" },
    { id: "WD-003", requester: "0xA1…8F", recipient: "0xC3…8B", amount: "5.00 ETH", approvals: 2, status: "APPROVED", reason: "Marketing" },
    { id: "WD-004", requester: "0xA1…8F", recipient: "0xC4…1E", amount: "50.00 ETH", approvals: 0, status: "REJECTED", reason: "Consulting" },
    { id: "WD-005", requester: "0xA1…8F", recipient: "0xC5…6F", amount: "8.00 ETH", approvals: 0, status: "PENDING", reason: "Emergency" },
];
const STATUS_COLORS = { PENDING: "#F59E0B", APPROVED: "#3B82F6", EXECUTED: "#10B981", REJECTED: "#EF4444" };
const ABI_TEXT = `// TreasuryVault.sol — Key functions
deposit() payable
requestWithdrawal(recipient, amount, reasonHash)
approveWithdrawal(withdrawalId)
rejectWithdrawal(withdrawalId)
executeWithdrawal(withdrawalId)
setDailyLimit(newLimit)
setRequiredApprovals(newRequired)
getVaultBalance()
getDailyRemaining()`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#10B981", accent2: "#34D399", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function TreasuryVaultAgent() {
    const bridge = useAgentBridge('treasuryvault');
    const [tab, setTab] = useState("withdrawals");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "WD-001 executed: 10.00 ETH sent to 0xC1…2A" },
        { ts: Date.now() - 60000, msg: "Deposit received: 50.00 ETH from 0xD1…3B" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "WD-002 approved by approver 0xA2…4C (1/2 approvals)",
                "New withdrawal WD-006 requested: 15.00 ETH for Operations",
                "WD-003 execution pending — daily limit check passed",
                "Deposit: 20.00 ETH received from 0xD2…7F",
                "Daily spend reset: 0/50 ETH available today",
                "WD-005 rejected by approver 0xA3…1B",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "withdrawals", label: "🏦 Withdrawals" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Lifecycle" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📈 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏦</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Treasury<span style={{ color: S.accent }}>Vault</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Deposits · Multi-sig approvals · Spending limits · Withdrawals</p>
                </div>
                <span style={{ marginLeft: "auto", background: "#10B981", color: "#000", borderRadius: 8, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${S.border}`, paddingBottom: 8 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        style={{ background: tab === t.id ? S.accent : "transparent", color: tab === t.id ? "#000" : S.muted, border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "withdrawals" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_WITHDRAWALS.map(w => (
                        <div key={w.id} onClick={() => setSel(w)} style={{ background: S.card, border: `1px solid ${sel?.id === w.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{w.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{w.reason}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>Amount: {w.amount} · To: {w.recipient}</div>
                            <div style={{ fontSize: 12, color: S.muted }}>Approvals: {w.approvals}/2</div>
                            <span style={{ background: STATUS_COLORS[w.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{w.status}</span>
                        </div>
                    ))}
                </div>
            )}

            {tab === "live" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, maxHeight: 500, overflowY: "auto" }}>
                    {events.map((e, i) => (
                        <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
                            <span style={{ color: S.accent, fontFamily: S.mono, marginRight: 10 }}>{new Date(e.ts).toLocaleTimeString()}</span>{e.msg}
                        </div>
                    ))}
                </div>
            )}

            {tab === "pipeline" && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", padding: 32 }}>
                    {["PENDING", "APPROVED", "EXECUTED"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: STATUS_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_WITHDRAWALS.filter(w => w.status === st).length}</span>
                            </div>
                            {i < a.length - 1 && <span style={{ color: S.muted, fontSize: 20 }}>→</span>}
                        </div>
                    ))}
                </div>
            )}

            {tab === "abi" && (
                <pre style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, fontFamily: S.mono, fontSize: 13, color: S.accent, whiteSpace: "pre-wrap", overflowX: "auto" }}>{ABI_TEXT}</pre>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                    {[
                        { label: "Vault Balance", val: "120 ETH" },
                        { label: "Daily Remaining", val: "40 ETH" },
                        { label: "Pending", val: "2" },
                        { label: "Executed Today", val: "1" },
                    ].map(m => (
                        <div key={m.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: S.accent }}>{m.val}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "metrics" && (
                <AgentDetailPanel agentId="treasuryvault" accentColor="#7C3AED" />
            )}
        </div>
    );
}
