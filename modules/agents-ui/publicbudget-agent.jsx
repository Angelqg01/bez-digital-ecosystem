import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_PROPOSALS = [
    { id: "PRP-001", title: "Bridge Repair Fund", category: "INFRASTRUCTURE", amount: "5.0 ETH", status: "EXECUTED", votesFor: 12, votesAgainst: 3, created: "2026-01-20" },
    { id: "PRP-002", title: "New School Building", category: "EDUCATION", amount: "15.0 ETH", status: "APPROVED", votesFor: 18, votesAgainst: 2, created: "2026-02-05" },
    { id: "PRP-003", title: "Hospital Equipment", category: "HEALTH", amount: "8.0 ETH", status: "OPEN", votesFor: 5, votesAgainst: 1, created: "2026-03-01" },
    { id: "PRP-004", title: "Park Restoration", category: "ENVIRONMENT", amount: "3.0 ETH", status: "DRAFT", votesFor: 0, votesAgainst: 0, created: "2026-03-14" },
    { id: "PRP-005", title: "Police Station Upgrade", category: "SECURITY", amount: "10.0 ETH", status: "REJECTED", votesFor: 4, votesAgainst: 11, created: "2026-02-18" },
];
const STATUS_COLORS = { DRAFT: "#6B7280", OPEN: "#3B82F6", APPROVED: "#10B981", REJECTED: "#EF4444", EXECUTED: "#7C3AED", CANCELLED: "#9CA3AF" };
const ABI_TEXT = `// PublicBudgetDAO.sol — Key functions
createProposal(titleHash, descHash, category, amount, beneficiary)
openProposal(proposalId, votingDuration)
castVote(proposalId, support)
tallyVotes(proposalId)
executeProposal(proposalId)
cancelProposal(proposalId)
getProposalStatus(proposalId)
getProposalVotes(proposalId)
getProposalCore(proposalId)
treasuryBalance()`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#EAB308", accent2: "#FFD700", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function PublicBudgetAgent() {
  const bridge = useAgentBridge("publicbudget");
    const [tab, setTab] = useState("proposals");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "Proposal PRP-003 received 2 new votes (FOR)" },
        { ts: Date.now() - 60000, msg: "PRP-002 execution authorized — 15 ETH released" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New proposal PRP-006 created: 'Solar Panel Installation' — 7.5 ETH",
                "Council member 0xA1… voted FOR on PRP-003",
                "PRP-004 opened for voting — 7-day deadline",
                "Treasury deposit received: 20 ETH from municipal fund",
                "PRP-001 fund disbursement confirmed — beneficiary received 5 ETH",
                "Proposal PRP-005 tally completed — REJECTED (4 vs 11)",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "proposals", label: "📋 Proposals" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📋</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Public<span style={{ color: S.accent }}>Budget</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Budget proposals · Council voting · Fund allocation</p>
                </div>
                <span style={{ marginLeft: "auto", background: "#10B981", color: "#000", borderRadius: 8, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>● LIVE</span>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${S.border}`, paddingBottom: 8 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        style={{ background: tab === t.id ? S.accent : "transparent", color: tab === t.id ? "#000" : S.muted, border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Proposals Tab ── */}
            {tab === "proposals" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_PROPOSALS.map(p => (
                        <div key={p.id} onClick={() => setSel(p)} style={{ background: S.card, border: `1px solid ${sel?.id === p.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{p.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.title}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>{p.category} · {p.amount}</div>
                            <div style={{ fontSize: 12, color: S.muted }}>👍 {p.votesFor} 👎 {p.votesAgainst}</div>
                            <span style={{ background: STATUS_COLORS[p.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{p.status}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Live Feed ── */}
            {tab === "live" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, maxHeight: 500, overflowY: "auto" }}>
                    {events.map((e, i) => (
                        <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
                            <span style={{ color: S.accent, fontFamily: S.mono, marginRight: 10 }}>{new Date(e.ts).toLocaleTimeString()}</span>{e.msg}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Pipeline ── */}
            {tab === "pipeline" && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", padding: 32 }}>
                    {["DRAFT", "OPEN", "APPROVED", "EXECUTED"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: STATUS_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_PROPOSALS.filter(p => p.status === st).length}</span>
                            </div>
                            {i < a.length - 1 && <span style={{ color: S.muted, fontSize: 20 }}>→</span>}
                        </div>
                    ))}
                </div>
            )}

            {/* ── ABI ── */}
            {tab === "abi" && (
                <pre style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, fontFamily: S.mono, fontSize: 13, color: S.accent, whiteSpace: "pre-wrap", overflowX: "auto" }}>{ABI_TEXT}</pre>
            )}

            {/* ── Analytics ── */}
            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                    {[
                        { label: "Total Proposals", val: "5" },
                        { label: "Active Voting", val: "1" },
                        { label: "Executed", val: "1" },
                        { label: "Treasury", val: "50 ETH" },
                    ].map(m => (
                        <div key={m.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: S.accent }}>{m.val}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.label}</div>
                        </div>
                    ))}
                </div>
            )}
          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: S.card || S.panel, border: "1px solid " + (S.border), borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — PUBLICBUDGET
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/publicbudget/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="publicbudget" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
