import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_MEMBERS = [
    { id: "MBR-001", wallet: "0xC1…3F", name: "Alice", points: 12400, lifetime: 105000, tier: "DIAMOND", active: true },
    { id: "MBR-002", wallet: "0xC2…7A", name: "Bob", points: 6300, lifetime: 52000, tier: "PLATINUM", active: true },
    { id: "MBR-003", wallet: "0xC3…4D", name: "Carol", points: 2100, lifetime: 22000, tier: "GOLD", active: true },
    { id: "MBR-004", wallet: "0xC4…9C", name: "Dave", points: 800, lifetime: 6000, tier: "SILVER", active: true },
    { id: "MBR-005", wallet: "0xC5…2E", name: "Eve", points: 150, lifetime: 1500, tier: "BRONZE", active: false },
];
const TIER_COLORS = { BRONZE: "#CD7F32", SILVER: "#C0C0C0", GOLD: "#FFD700", PLATINUM: "#E5E4E2", DIAMOND: "#B9F2FF" };
const ABI_TEXT = `// LoyaltyRewards.sol — Key functions
registerMember(wallet, nameHash)
issuePoints(wallet, amount)
redeemPoints(wallet, points, rewardHash)
deactivateMember(wallet)
getMemberCount()
getMemberTier(wallet)
getPoints(wallet)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#FBBF24", accent2: "#F59E0B", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function LoyaltyAgent() {
    const bridge = useAgentBridge('loyalty');
    const [tab, setTab] = useState("members");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "MBR-001 earned 500 pts — tier DIAMOND retained ✓" },
        { ts: Date.now() - 60000, msg: "MBR-004 redeemed 200 pts for REWARD-012" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "MBR-002 earned 1,200 pts — lifetime now 53,200",
                "MBR-003 redeemed 500 pts for REWARD-045 (Gift Card)",
                "MBR-001 upgrade check: DIAMOND tier confirmed",
                "New member registered: MBR-006 (Frank) — BRONZE",
                "MBR-004 earned 3,000 pts — tier upgrade SILVER → GOLD",
                "MBR-005 deactivated by admin",
                "MBR-002 redeemed 1,000 pts for REWARD-089 (VIP Access)",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "members", label: "👥 Members" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "tiers", label: "🏅 Tier Ladder" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏅</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Loyalty<span style={{ color: S.accent }}>Rewards</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Points · Tiers · Redemptions · Member mgmt</p>
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

            {tab === "members" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_MEMBERS.map(m => (
                        <div key={m.id} onClick={() => setSel(m)} style={{ background: S.card, border: `1px solid ${sel?.id === m.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{m.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>Points: {m.points.toLocaleString()} · Lifetime: {m.lifetime.toLocaleString()}</div>
                            <div style={{ fontSize: 12, color: S.muted }}>Wallet: {m.wallet} · {m.active ? "Active" : "Inactive"}</div>
                            <span style={{ background: TIER_COLORS[m.tier] || S.muted, color: ["GOLD", "SILVER", "DIAMOND"].includes(m.tier) ? "#000" : "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{m.tier}</span>
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
                <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", padding: 32, flexWrap: "wrap" }}>
                    {[
                        { level: "BRONZE", req: "0 – 4,999 pts" },
                        { level: "SILVER", req: "5,000 – 19,999 pts" },
                        { level: "GOLD", req: "20,000 – 49,999 pts" },
                        { level: "PLATINUM", req: "50,000 – 99,999 pts" },
                        { level: "DIAMOND", req: "100,000+ pts" },
                    ].map((b, i, a) => (
                        <div key={b.level} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: TIER_COLORS[b.level], color: ["GOLD", "SILVER", "DIAMOND"].includes(b.level) ? "#000" : "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center", minWidth: 100 }}>
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
                        { label: "Members", val: "5" },
                        { label: "Total Points", val: "21,750" },
                        { label: "Redemptions", val: "34" },
                        { label: "Diamond", val: "1" },
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — LOYALTY</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="loyalty" accentColor="#FBBF24" />
                </div>
            )}
        </div>
    );
}
