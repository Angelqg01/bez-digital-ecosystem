import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_CAUSES = [
    { id: "CSE-001", beneficiary: "0xF1…3F", name: "Clean Water Africa", goal: "100 ETH", raised: "104.2 ETH", donors: 312, status: "COMPLETED" },
    { id: "CSE-002", beneficiary: "0xF2…7A", name: "Tech for Schools", goal: "50 ETH", raised: "32.8 ETH", donors: 89, status: "ACTIVE" },
    { id: "CSE-003", beneficiary: "0xF3…4D", name: "Disaster Relief", goal: "200 ETH", raised: "45.0 ETH", donors: 156, status: "ACTIVE" },
    { id: "CSE-004", beneficiary: "0xF4…9C", name: "Animal Shelter", goal: "30 ETH", raised: "12.5 ETH", donors: 44, status: "PAUSED" },
    { id: "CSE-005", beneficiary: "0xF5…2E", name: "Open Source Fund", goal: "25 ETH", raised: "0 ETH", donors: 0, status: "CANCELLED" },
];
const STATUS_COLORS = { ACTIVE: "#10B981", PAUSED: "#F59E0B", COMPLETED: "#3B82F6", CANCELLED: "#6B7280" };
const ABI_TEXT = `// CharityVault.sol — Key functions
createCause(beneficiary, goal, nameHash)
donate(causeId, messageHash) payable
withdrawFunds(causeId, amount)
pauseCause(causeId)
resumeCause(causeId)
getCauseDonations(causeId)
getDonorHistory(donor)
getAvailableFunds(causeId)
getCauseProgress(causeId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#EC4899", accent2: "#F472B6", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function CharityVaultAgent() {
    const bridge = useAgentBridge('charityvault');
    const [tab, setTab] = useState("causes");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "CSE-001 goal reached — status auto-completed ✓" },
        { ts: Date.now() - 60000, msg: "CSE-002 donation: 1.5 ETH from 0xAA…12 — 'For the kids'" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "CSE-002 donation: 2.0 ETH from 0xBB…33 — 70% of goal",
                "CSE-003 donation: 5.0 ETH from 0xCC…44 — 25% of goal",
                "CSE-001 withdrawal: 20 ETH by beneficiary 0xF1…3F",
                "CSE-004 paused by manager — review in progress",
                "New cause CSE-006: 'Reforestation Brazil' — goal 75 ETH",
                "CSE-002 donors now 91 — 34.3 ETH raised (68.6%)",
                "CSE-003 donation: 0.5 ETH from 0xDD…55 — 'Stay strong'",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "causes", label: "💖 Causes" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>💖</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Charity<span style={{ color: S.accent }}>Vault</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Causes · Donations · Withdrawals · Impact tracking</p>
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

            {tab === "causes" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_CAUSES.map(c => {
                        const pct = c.goal !== "0 ETH" ? Math.min(100, Math.round(parseFloat(c.raised) / parseFloat(c.goal) * 100)) : 0;
                        return (
                            <div key={c.id} onClick={() => setSel(c)} style={{ background: S.card, border: `1px solid ${sel?.id === c.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", alignItems: "center", gap: 12 }}>
                                    <div>
                                        <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{c.id}</div>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                                    </div>
                                    <div style={{ fontSize: 12, color: S.muted }}>Goal: {c.goal} · Raised: {c.raised} · Donors: {c.donors} · To: {c.beneficiary}</div>
                                    <span style={{ background: STATUS_COLORS[c.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{c.status}</span>
                                </div>
                                <div style={{ marginTop: 10, background: S.border, borderRadius: 4, height: 6, overflow: "hidden" }}>
                                    <div style={{ width: `${pct}%`, height: "100%", background: S.accent, borderRadius: 4 }} />
                                </div>
                                <div style={{ fontSize: 11, color: S.muted, marginTop: 4, textAlign: "right" }}>{pct}% funded</div>
                            </div>
                        );
                    })}
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                    {["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"].map(st => (
                        <div key={st} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_COLORS[st] }} />
                                <span style={{ fontWeight: 700, fontSize: 13 }}>{st}</span>
                                <span style={{ marginLeft: "auto", fontFamily: S.mono, fontSize: 12, color: S.muted }}>{MOCK_CAUSES.filter(c => c.status === st).length}</span>
                            </div>
                            {MOCK_CAUSES.filter(c => c.status === st).map(c => (
                                <div key={c.id} style={{ background: S.bg, borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 12 }}>
                                    <span style={{ color: S.accent, fontFamily: S.mono }}>{c.id}</span> — {c.name}
                                </div>
                            ))}
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
                        { label: "Causes", val: "5" },
                        { label: "Total Raised", val: "194.5 ETH" },
                        { label: "Donors", val: "601" },
                        { label: "Completed", val: "1" },
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — CHARITYVAULT</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="charityvault" accentColor="#E91E63" />
                </div>
            )}
        </div>
    );
}
