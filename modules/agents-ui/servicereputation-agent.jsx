import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_PROVIDERS = [
    { id: "PRV-001", wallet: "0xB1…3F", name: "Acme Dev", reviews: 28, avgScore: "4.80", jobs: 52, disputes: 1, badge: "PLATINUM" },
    { id: "PRV-002", wallet: "0xB2…7A", name: "CloudBase", reviews: 15, avgScore: "4.20", jobs: 30, disputes: 3, badge: "GOLD" },
    { id: "PRV-003", wallet: "0xB3…4D", name: "QuickFix", reviews: 8, avgScore: "3.60", jobs: 12, disputes: 0, badge: "SILVER" },
    { id: "PRV-004", wallet: "0xB4…9C", name: "NewStart", reviews: 2, avgScore: "3.00", jobs: 4, disputes: 1, badge: "BRONZE" },
    { id: "PRV-005", wallet: "0xB5…2E", name: "TechPro", reviews: 0, avgScore: "—", jobs: 1, disputes: 0, badge: "NONE" },
];
const BADGE_COLORS = { NONE: "#6B7280", BRONZE: "#CD7F32", SILVER: "#C0C0C0", GOLD: "#FFD700", PLATINUM: "#E5E4E2" };
const ABI_TEXT = `// ServiceReputationNFT.sol — Key functions
registerProvider(wallet, nameHash)
submitReview(provider, score, commentHash)
recordJobCompleted(provider)
recordDispute(provider)
deactivateProvider(provider)
getProviderReviews(provider)
getAverageScore(provider)
getProviderCount()
getBadge(provider)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#F97316", accent2: "#FB923C", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function ServiceReputationAgent() {
  const bridge = useAgentBridge("servicereputation");
    const [tab, setTab] = useState("providers");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "PRV-001 received 5-star review — badge remains PLATINUM" },
        { ts: Date.now() - 60000, msg: "PRV-004 completed job #5 — checking badge upgrade" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "PRV-002 new review: 4 stars — avg score updated to 4.22",
                "PRV-003 completed job #13 — badge check: SILVER → SILVER",
                "PRV-001 dispute recorded — now 2 disputes total",
                "New provider registered: PRV-006 (DataSync Solutions)",
                "PRV-004 review submitted: 3 stars — badge stays BRONZE",
                "PRV-002 dispute resolved — gold badge retained ✓",
                "PRV-005 first review: 4 stars — checking BRONZE eligibility",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "providers", label: "🏆 Providers" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "badges", label: "🎖️ Badge Tiers" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏆</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Service<span style={{ color: S.accent }}>Reputation</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Reviews · Badges · Job tracking · Provider reputation</p>
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

            {tab === "providers" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_PROVIDERS.map(p => (
                        <div key={p.id} onClick={() => setSel(p)} style={{ background: S.card, border: `1px solid ${sel?.id === p.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{p.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>Jobs: {p.jobs} · Reviews: {p.reviews} · Avg: {p.avgScore}</div>
                            <div style={{ fontSize: 12, color: S.muted }}>Disputes: {p.disputes} · Wallet: {p.wallet}</div>
                            <span style={{ background: BADGE_COLORS[p.badge] || S.muted, color: p.badge === "GOLD" ? "#000" : "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{p.badge}</span>
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

            {tab === "badges" && (
                <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", padding: 32, flexWrap: "wrap" }}>
                    {[
                        { level: "NONE", req: "New provider" },
                        { level: "BRONZE", req: "3+ jobs, avg ≥ 3.0" },
                        { level: "SILVER", req: "10+ jobs, avg ≥ 3.5" },
                        { level: "GOLD", req: "25+ jobs, avg ≥ 4.0, ≤5 disputes" },
                        { level: "PLATINUM", req: "50+ jobs, avg ≥ 4.5, ≤2 disputes" },
                    ].map((b, i, a) => (
                        <div key={b.level} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: BADGE_COLORS[b.level], color: b.level === "GOLD" ? "#000" : "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center", minWidth: 100 }}>
                                {b.level}<br /><span style={{ fontSize: 10, fontWeight: 400 }}>{b.req}</span>
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
                        { label: "Providers", val: "5" },
                        { label: "Total Reviews", val: "53" },
                        { label: "Avg Score", val: "4.12" },
                        { label: "Platinum", val: "1" },
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
                  📊 REAL-TIME AGENT METRICS — SERVICEREPUTATION
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/servicereputation/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="servicereputation" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
