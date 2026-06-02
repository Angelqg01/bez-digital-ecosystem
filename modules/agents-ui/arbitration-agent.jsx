import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_DISPUTES = [
    { id: "ARB-001", claimant: "Acme Corp", respondent: "Beta LLC", category: "CONTRACT", status: "RESOLVED", ruling: "FAVOR_CLAIMANT", stake: "0.5 ETH", panel: 3 },
    { id: "ARB-002", claimant: "Jane Doe", respondent: "Epsilon Tech", category: "EMPLOYMENT", status: "DELIBERATION", ruling: "NONE", stake: "1.0 ETH", panel: 5 },
    { id: "ARB-003", claimant: "Gamma IP", respondent: "Delta Media", category: "IP_INFRINGEMENT", status: "PANEL_ASSIGNED", ruling: "NONE", stake: "2.0 ETH", panel: 3 },
    { id: "ARB-004", claimant: "Zeta Co", respondent: "Eta SA", category: "TORT", status: "FILED", ruling: "NONE", stake: "0.1 ETH", panel: 0 },
    { id: "ARB-005", claimant: "Theta Ltd", respondent: "Iota Inc", category: "REGULATORY", status: "APPEALED", ruling: "FAVOR_RESPONDENT", stake: "1.5 ETH", panel: 3 },
];
const STATUS_COLORS = { FILED: "#F59E0B", PANEL_ASSIGNED: "#3B82F6", DELIBERATION: "#8B5CF6", RESOLVED: "#10B981", APPEALED: "#EF4444" };
const CONTRACT_ABI = `// ArbitrationDAO.sol — Key functions
fileDispute(respondent, category, descriptionHash) payable
assignPanel(disputeId, arbitrators[])
startDeliberation(disputeId)
castVote(disputeId, favorClaimant)
resolveDispute(disputeId)
fileAppeal(disputeId, reasonHash) payable
withdrawStake(disputeId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#F59E0B", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function ArbitrationDAOAgent() {
    const bridge = useAgentBridge('arbitration');
    const [tab, setTab] = useState("disputes");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "Dispute ARB-002 entered deliberation — 5-member panel" },
        { ts: Date.now() - 30000, msg: "Vote cast on ARB-002 by arbiter 0xA1… (favor claimant)" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New dispute ARB-006 filed: CONTRACT category, 0.5 ETH stake",
                "Panel of 3 assigned to ARB-004 — deliberation begins",
                "Arbiter 0xA2… voted on ARB-002 (favor respondent)",
                "Dispute ARB-003 resolved: FAVOR_CLAIMANT — stake released",
                "Appeal filed on ARB-001 by Beta LLC — 0.5 ETH stake",
                "Stake of 1.0 ETH withdrawn by claimant on ARB-002",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "disputes", label: "⚖️ Disputes" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "grid", placeItems: "center", fontSize: 20 }}>⚖️</div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>ArbitrationDAO Agent</div>
                    <div style={{ fontSize: 12, color: S.muted }}>Decentralized dispute resolution • Arbitrator panels • Stake-based voting</div>
                </div>
                <span style={{ marginLeft: "auto", background: "#10B981", color: "#000", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 999 }}>ACTIVE</span>
            </div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${S.border}`, paddingBottom: 8 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent : "transparent", color: tab === t.id ? "#fff" : S.muted, border: "none", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{t.label}</button>
                ))}
            </div>
            {/* Content */}
            {tab === "disputes" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_DISPUTES.map(d => (
                        <div key={d.id} onClick={() => setSel(sel === d.id ? null : d.id)} style={{ background: S.card, border: `1px solid ${sel === d.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontWeight: 700 }}>{d.id}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: STATUS_COLORS[d.status] + "22", color: STATUS_COLORS[d.status] }}>{d.status}</span>
                            </div>
                            <div style={{ fontSize: 14, marginBottom: 6 }}>{d.claimant} vs {d.respondent}</div>
                            <div style={{ display: "flex", gap: 16, fontSize: 12, color: S.muted }}>
                                <span>Category: {d.category}</span>
                                <span>Stake: {d.stake}</span>
                                <span>Panel: {d.panel || "—"}</span>
                                <span>Ruling: {d.ruling}</span>
                            </div>
                            {sel === d.id && (
                                <div style={{ marginTop: 12, padding: 12, background: S.bg, borderRadius: 8, fontSize: 12, fontFamily: S.mono }}>
                                    <div>claimant: {d.claimant} | respondent: {d.respondent}</div>
                                    <div>category: CaseCategory.{d.category}</div>
                                    <div>panelSize: {d.panel} | ruling: Ruling.{d.ruling}</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {tab === "live" && (
                <div style={{ display: "grid", gap: 6 }}>
                    {events.map((e, i) => (
                        <div key={i} style={{ background: S.card, padding: "10px 14px", borderRadius: 8, fontSize: 13, borderLeft: `3px solid ${S.accent}` }}>
                            <span style={{ color: S.muted, fontFamily: S.mono, fontSize: 11, marginRight: 10 }}>{new Date(e.ts).toLocaleTimeString()}</span>{e.msg}
                        </div>
                    ))}
                </div>
            )}
            {tab === "pipeline" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
                    {[{ s: "FILED", n: 4, c: STATUS_COLORS.FILED }, { s: "PANEL", n: 3, c: STATUS_COLORS.PANEL_ASSIGNED }, { s: "DELIBERATION", n: 6, c: STATUS_COLORS.DELIBERATION }, { s: "RESOLVED", n: 12, c: STATUS_COLORS.RESOLVED }, { s: "APPEALED", n: 2, c: STATUS_COLORS.APPEALED }].map(p => (
                        <div key={p.s} style={{ background: S.card, borderRadius: 10, padding: 20, textAlign: "center", borderTop: `3px solid ${p.c}` }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: p.c }}>{p.n}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{p.s}</div>
                        </div>
                    ))}
                </div>
            )}
            {tab === "abi" && (
                <pre style={{ background: S.card, borderRadius: 10, padding: 20, fontSize: 13, fontFamily: S.mono, color: S.accent, whiteSpace: "pre-wrap", border: `1px solid ${S.border}` }}>{CONTRACT_ABI}</pre>
            )}
            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                    {[{ l: "Total Disputes", v: "27" }, { l: "Resolved", v: "18" }, { l: "Appealed", v: "3" }, { l: "Avg Panel Size", v: "3.4" }, { l: "Total Staked", v: "14.5 ETH" }, { l: "Avg Resolution", v: "5.2 days" }].map(m => (
                        <div key={m.l} style={{ background: S.card, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: S.accent }}>{m.v}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.l}</div>
                        </div>
                    ))}
                </div>
            )}
            {tab === "metrics" && (
                <div>
                    <div style={{ background: S.card, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — ARBITRATION</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="arbitration" accentColor="#F59E0B" />
                </div>
            )}
        </div>
    );
}
