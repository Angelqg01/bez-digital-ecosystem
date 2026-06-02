import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_PROFILES = [
    { id: "CS-001", subject: "0xB1…3F", score: 750, tier: "PRIME", totalLoans: 8, defaults: 0, onTime: 24, late: 1, active: true },
    { id: "CS-002", subject: "0xB2…7A", score: 650, tier: "NEAR_PRIME", totalLoans: 5, defaults: 1, onTime: 12, late: 3, active: true },
    { id: "CS-003", subject: "0xB3…4D", score: 520, tier: "SUBPRIME", totalLoans: 3, defaults: 1, onTime: 6, late: 4, active: true },
    { id: "CS-004", subject: "0xB4…9C", score: 420, tier: "DEEP_SUBPRIME", totalLoans: 2, defaults: 2, onTime: 1, late: 5, active: false },
    { id: "CS-005", subject: "0xB5…2E", score: 500, tier: "SUBPRIME", totalLoans: 0, defaults: 0, onTime: 0, late: 0, active: true },
];
const TIER_COLORS = { PRIME: "#10B981", NEAR_PRIME: "#3B82F6", SUBPRIME: "#F59E0B", DEEP_SUBPRIME: "#EF4444", UNRATED: "#6B7280" };
const ABI_TEXT = `// CreditScoreOracle.sol — Key functions
createProfile(subject)
recordPayment(subject, amount, onTime, referenceHash)
recordLoan(subject, defaulted)
openDispute(reasonHash)
resolveDispute(disputeId, accepted, resolutionHash)
overrideScore(subject, newScore)
deactivateProfile(subject)
getSubjectRecords(subject)
getSubjectDisputes(subject)
getScore(subject)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#EC4899", accent2: "#F472B6", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function CreditScoreAgent() {
    const bridge = useAgentBridge('creditscore');
    const [tab, setTab] = useState("profiles");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "CS-001 payment recorded: 2.00 ETH on-time ✓ — score updated to 750" },
        { ts: Date.now() - 60000, msg: "CS-004 deactivated — persistent default pattern" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New profile CS-006 created for 0xB6…1C — initial score: 500",
                "CS-002 late payment recorded: 1.50 ETH — score recalculated to 640",
                "CS-003 dispute opened: 'Incorrect late payment record'",
                "Dispute #2 resolved: accepted — CS-002 score adjusted",
                "CS-001 loan recorded: on-time repayment — tier remains PRIME",
                "CS-005 first payment: 0.80 ETH on-time — score updated to 700",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "profiles", label: "👤 Profiles" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "tiers", label: "📊 Risk Tiers" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📈 Analytics" },
        { id: "metrics", label: "📈 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📊</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Credit<span style={{ color: S.accent }}>Score</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Credit profiles · Payment history · Risk tiers · Disputes</p>
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

            {tab === "profiles" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_PROFILES.map(p => (
                        <div key={p.id} onClick={() => setSel(p)} style={{ background: S.card, border: `1px solid ${sel?.id === p.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{p.subject}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>Score: {p.score}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>Loans: {p.totalLoans} · Defaults: {p.defaults}</div>
                            <div style={{ fontSize: 12, color: S.muted }}>On-time: {p.onTime} · Late: {p.late}</div>
                            <span style={{ background: TIER_COLORS[p.tier] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{p.tier}</span>
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

            {tab === "tiers" && (
                <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "flex-end", padding: 32 }}>
                    {[
                        { tier: "PRIME", range: "720-850", count: MOCK_PROFILES.filter(p => p.tier === "PRIME").length },
                        { tier: "NEAR_PRIME", range: "620-719", count: MOCK_PROFILES.filter(p => p.tier === "NEAR_PRIME").length },
                        { tier: "SUBPRIME", range: "500-619", count: MOCK_PROFILES.filter(p => p.tier === "SUBPRIME").length },
                        { tier: "DEEP_SUBPRIME", range: "0-499", count: MOCK_PROFILES.filter(p => p.tier === "DEEP_SUBPRIME").length },
                    ].map(t => (
                        <div key={t.tier} style={{ background: S.card, border: `2px solid ${TIER_COLORS[t.tier]}`, borderRadius: 10, padding: 20, textAlign: "center", minWidth: 140 }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: TIER_COLORS[t.tier] }}>{t.count}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: TIER_COLORS[t.tier], marginTop: 4 }}>{t.tier.replace("_", " ")}</div>
                            <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>{t.range}</div>
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
                        { label: "Total Profiles", val: "5" },
                        { label: "Active", val: "4" },
                        { label: "Avg Score", val: "568" },
                        { label: "Open Disputes", val: "0" },
                    ].map(m => (
                        <div key={m.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: S.accent }}>{m.val}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "metrics" && (
                <AgentDetailPanel agentId="creditscore" accentColor="#22C55E" />
            )}
        </div>
    );
}
