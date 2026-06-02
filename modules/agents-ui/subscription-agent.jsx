import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_PLANS = [
    { id: "PLAN-001", provider: "0xA1…3F", price: "1.00 ETH", period: "30 days", name: "Basic Hosting", status: "ACTIVE", subs: 42 },
    { id: "PLAN-002", provider: "0xA2…7B", price: "3.00 ETH", period: "30 days", name: "Pro Analytics", status: "ACTIVE", subs: 18 },
    { id: "PLAN-003", provider: "0xA1…3F", price: "0.50 ETH", period: "7 days", name: "Weekly Backup", status: "PAUSED", subs: 5 },
    { id: "PLAN-004", provider: "0xA3…2E", price: "5.00 ETH", period: "90 days", name: "Enterprise SLA", status: "ACTIVE", subs: 9 },
    { id: "PLAN-005", provider: "0xA4…8C", price: "2.00 ETH", period: "30 days", name: "API Gateway", status: "RETIRED", subs: 0 },
];
const STATUS_COLORS = { ACTIVE: "#10B981", PAUSED: "#F59E0B", RETIRED: "#6B7280", EXPIRED: "#EF4444", CANCELLED: "#9CA3AF" };
const ABI_TEXT = `// SubscriptionManager.sol — Key functions
createPlan(price, period, nameHash)
pausePlan(planId)
resumePlan(planId)
retirePlan(planId)
subscribe(planId) payable
renew(subId) payable
cancelSubscription(subId)
withdrawRevenue(planId)
getSubscriberSubs(subscriber)
isSubActive(subId)
getPlanRevenue(planId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#A855F7", accent2: "#C084FC", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function SubscriptionAgent() {
    const bridge = useAgentBridge('subscription');
    const [tab, setTab] = useState("plans");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "PLAN-001 new subscriber: 0xB5…9D — 1.00 ETH paid" },
        { ts: Date.now() - 60000, msg: "SUB-034 renewed for another 30 days by 0xB2…4A" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "PLAN-002 revenue withdrawal: 12.00 ETH by provider 0xA2…7B",
                "New subscriber on PLAN-004: 0xB8…1C — Enterprise SLA",
                "SUB-019 cancelled by subscriber 0xB3…5E",
                "PLAN-001 subscriber count reached 43 — monthly high ✓",
                "PLAN-003 resumed by provider 0xA1…3F",
                "SUB-027 expired — paidUntil reached, auto-flagged",
                "PLAN-005 retired — no new subscriptions accepted",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "plans", label: "📦 Plans" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Lifecycle" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📦</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Subscription<span style={{ color: S.accent }}>Manager</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Plans · Subscriptions · Renewals · Revenue management</p>
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

            {tab === "plans" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_PLANS.map(p => (
                        <div key={p.id} onClick={() => setSel(p)} style={{ background: S.card, border: `1px solid ${sel?.id === p.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{p.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>Provider: {p.provider} · Period: {p.period}</div>
                            <div style={{ fontSize: 12, color: S.muted }}>Price: {p.price} · Subscribers: {p.subs}</div>
                            <span style={{ background: STATUS_COLORS[p.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{p.status}</span>
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
                    {["ACTIVE", "PAUSED", "RETIRED"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: STATUS_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_PLANS.filter(p => p.status === st).length}</span>
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
                        { label: "Total Plans", val: "5" },
                        { label: "Active Subs", val: "69" },
                        { label: "Monthly Revenue", val: "87 ETH" },
                        { label: "Churn Rate", val: "4.2%" },
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — SUBSCRIPTION</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="subscription" accentColor="#A855F7" />
                </div>
            )}
        </div>
    );
}
