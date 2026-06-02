import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_LOANS = [
    { id: "LOAN-001", borrower: "0xB1…3F", principal: "5.00 ETH", interest: "5%", collateral: "1.00 ETH", status: "FUNDED", repaid: "2.25 ETH", remaining: "3.00 ETH" },
    { id: "LOAN-002", borrower: "0xB2…7A", principal: "10.00 ETH", interest: "10%", collateral: "3.00 ETH", status: "REPAYING", repaid: "8.00 ETH", remaining: "3.00 ETH" },
    { id: "LOAN-003", borrower: "0xB3…4D", principal: "2.00 ETH", interest: "3%", collateral: "0.50 ETH", status: "CLOSED", repaid: "2.06 ETH", remaining: "0" },
    { id: "LOAN-004", borrower: "0xB4…9C", principal: "8.00 ETH", interest: "8%", collateral: "2.00 ETH", status: "DEFAULTED", repaid: "0", remaining: "8.64 ETH" },
    { id: "LOAN-005", borrower: "0xB5…2E", principal: "1.00 ETH", interest: "4%", collateral: "0.30 ETH", status: "REQUESTED", repaid: "0", remaining: "1.04 ETH" },
];
const STATUS_COLORS = { REQUESTED: "#6B7280", FUNDED: "#3B82F6", REPAYING: "#F59E0B", CLOSED: "#10B981", DEFAULTED: "#EF4444", CANCELLED: "#9CA3AF" };
const ABI_TEXT = `// MicroLendingPool.sol — Key functions
requestLoan(principal, interestBps, duration) payable
fundLoan(loanId) payable
repay(loanId) payable
markDefault(loanId)
cancelLoan(loanId)
getBorrowerLoans(borrower)
getTotalOwed(loanId)
getRemainingDebt(loanId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#F59E0B", accent2: "#FBBF24", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function MicroLendingAgent() {
    const bridge = useAgentBridge('microlending');
    const [tab, setTab] = useState("loans");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "LOAN-002 repayment received: 1.50 ETH from 0xB2…7A" },
        { ts: Date.now() - 60000, msg: "LOAN-005 requested: 1.00 ETH principal, 4% interest" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New loan LOAN-006 requested: 3.00 ETH at 6% interest",
                "LOAN-001 funded by lender 0xA1…8F — principal transferred",
                "LOAN-002 partial repayment: 2.00 ETH received",
                "LOAN-004 marked as defaulted — collateral seized by lender",
                "LOAN-003 fully repaid — collateral returned to borrower",
                "Interest rate check: LOAN-005 within 5000 bps limit ✓",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "loans", label: "💰 Loans" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Lifecycle" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>💰</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>MicroLending<span style={{ color: S.accent }}>Pool</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Loan requests · Collateral · Repayments · Default management</p>
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

            {tab === "loans" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_LOANS.map(l => (
                        <div key={l.id} onClick={() => setSel(l)} style={{ background: S.card, border: `1px solid ${sel?.id === l.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{l.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{l.borrower}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>Principal: {l.principal} · Interest: {l.interest}</div>
                            <div style={{ fontSize: 12, color: S.muted }}>Repaid: {l.repaid} · Remaining: {l.remaining}</div>
                            <span style={{ background: STATUS_COLORS[l.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{l.status}</span>
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
                    {["REQUESTED", "FUNDED", "REPAYING", "CLOSED"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: STATUS_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_LOANS.filter(l => l.status === st).length}</span>
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
                        { label: "Total Loans", val: "5" },
                        { label: "Active Loans", val: "2" },
                        { label: "Total Lent", val: "26 ETH" },
                        { label: "Default Rate", val: "20%" },
                    ].map(m => (
                        <div key={m.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: S.accent }}>{m.val}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.label}</div>
                        </div>
                    ))}
                </div>
            )}
            {tab === "metrics" && (
                <div>
                    <div style={{ background: S.card, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — MICROLENDING</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="microlending" accentColor="#F59E0B" />
                </div>
            )}
        </div>
    );
}
