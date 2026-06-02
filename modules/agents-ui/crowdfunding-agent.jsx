import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_CAMPAIGNS = [
    { id: "CMP-001", creator: "0xD1…3F", goal: "50 ETH", raised: "52.4 ETH", backers: 128, deadline: "2026-04-15", status: "FUNDED" },
    { id: "CMP-002", creator: "0xD2…7A", goal: "20 ETH", raised: "14.8 ETH", backers: 45, deadline: "2026-05-01", status: "ACTIVE" },
    { id: "CMP-003", creator: "0xD3…4D", goal: "100 ETH", raised: "8.2 ETH", backers: 12, deadline: "2026-03-20", status: "FAILED" },
    { id: "CMP-004", creator: "0xD4…9C", goal: "10 ETH", raised: "0 ETH", backers: 0, deadline: "2026-06-01", status: "CANCELLED" },
    { id: "CMP-005", creator: "0xD5…2E", goal: "30 ETH", raised: "22.1 ETH", backers: 67, deadline: "2026-04-28", status: "ACTIVE" },
];
const STATUS_COLORS = { ACTIVE: "#10B981", FUNDED: "#3B82F6", FAILED: "#EF4444", CANCELLED: "#6B7280" };
const ABI_TEXT = `// CrowdfundingPool.sol — Key functions
createCampaign(goal, duration, descHash)
pledge(campaignId) payable
finalizeCampaign(campaignId)
withdrawFunds(campaignId)
refund(pledgeId)
cancelCampaign(campaignId)
getCampaignPledges(campaignId)
getCreatorCampaigns(creator)
isCampaignActive(campaignId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#14B8A6", accent2: "#2DD4BF", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function CrowdfundingAgent() {
    const bridge = useAgentBridge('crowdfunding');
    const [tab, setTab] = useState("campaigns");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "CMP-001 finalized — FUNDED ✓ creator can withdraw 52.4 ETH" },
        { ts: Date.now() - 60000, msg: "CMP-002 new pledge: 0.5 ETH from 0xAB…12" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "CMP-002 pledge: 1.2 ETH from 0xEE…44 — raised now 16.0 ETH",
                "CMP-005 pledge: 0.8 ETH from 0xFA…77 — 76% of goal reached",
                "CMP-003 refund processed: 2 ETH returned to 0xBB…33",
                "New campaign CMP-006 created — goal: 15 ETH, deadline: 30 days",
                "CMP-005 pledge: 3 ETH from 0xCC…21 — 84% of goal reached",
                "CMP-002 backers now 47 — 15.6 ETH raised (78%)",
                "CMP-004 cancelled by creator — all pledges refundable",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "campaigns", label: "📋 Campaigns" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🚀</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Crowdfunding<span style={{ color: S.accent }}>Pool</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Campaigns · Pledges · Refunds · Goal tracking</p>
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

            {tab === "campaigns" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_CAMPAIGNS.map(c => {
                        const pct = c.goal !== "0 ETH" ? Math.min(100, Math.round(parseFloat(c.raised) / parseFloat(c.goal) * 100)) : 0;
                        return (
                            <div key={c.id} onClick={() => setSel(c)} style={{ background: S.card, border: `1px solid ${sel?.id === c.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", alignItems: "center", gap: 12 }}>
                                    <div>
                                        <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{c.id}</div>
                                        <div style={{ fontSize: 12, color: S.muted }}>Creator: {c.creator}</div>
                                    </div>
                                    <div style={{ fontSize: 12, color: S.muted }}>Goal: {c.goal} · Raised: {c.raised} · Backers: {c.backers} · Deadline: {c.deadline}</div>
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
                    {["ACTIVE", "FUNDED", "FAILED", "CANCELLED"].map(st => (
                        <div key={st} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_COLORS[st] }} />
                                <span style={{ fontWeight: 700, fontSize: 13 }}>{st}</span>
                                <span style={{ marginLeft: "auto", fontFamily: S.mono, fontSize: 12, color: S.muted }}>{MOCK_CAMPAIGNS.filter(c => c.status === st).length}</span>
                            </div>
                            {MOCK_CAMPAIGNS.filter(c => c.status === st).map(c => (
                                <div key={c.id} style={{ background: S.bg, borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 12 }}>
                                    <span style={{ color: S.accent, fontFamily: S.mono }}>{c.id}</span> — {c.raised} / {c.goal}
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
                        { label: "Campaigns", val: "5" },
                        { label: "Total Raised", val: "97.5 ETH" },
                        { label: "Backers", val: "252" },
                        { label: "Funded", val: "1" },
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — CROWDFUNDING</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="crowdfunding" accentColor="#14B8A6" />
                </div>
            )}
        </div>
    );
}
