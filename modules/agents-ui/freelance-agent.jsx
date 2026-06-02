import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_GIGS = [
    { id: "GIG-001", client: "0xC1…3F", freelancer: "0xF1…9A", budget: "5.00 ETH", milestones: "3/3", status: "COMPLETED", desc: "Smart Contract Audit" },
    { id: "GIG-002", client: "0xC2…7B", freelancer: "0xF2…4D", budget: "8.00 ETH", milestones: "1/4", status: "IN_PROGRESS", desc: "DeFi Dashboard UI" },
    { id: "GIG-003", client: "0xC3…1E", freelancer: "—", budget: "2.50 ETH", milestones: "0/2", status: "OPEN", desc: "API Integration" },
    { id: "GIG-004", client: "0xC4…5C", freelancer: "0xF3…8B", budget: "12.00 ETH", milestones: "2/5", status: "DISPUTED", desc: "L2 Bridge Development" },
    { id: "GIG-005", client: "0xC5…2A", freelancer: "0xF4…6F", budget: "3.00 ETH", milestones: "2/2", status: "DELIVERED", desc: "Token Logo Design" },
];
const STATUS_COLORS = { OPEN: "#6B7280", ASSIGNED: "#3B82F6", IN_PROGRESS: "#F59E0B", DELIVERED: "#8B5CF6", COMPLETED: "#10B981", DISPUTED: "#EF4444", CANCELLED: "#9CA3AF" };
const ABI_TEXT = `// FreelanceMarketplace.sol — Key functions
createGig(descHash, milestoneCount) payable
assignFreelancer(gigId, freelancer)
addMilestone(gigId, amount, deliverableHash)
deliverMilestone(milestoneId)
approveMilestone(milestoneId)
raiseDispute(gigId)
resolveDispute(gigId, winner)
cancelGig(gigId)
getGigMilestones(gigId)
getClientGigs(client)
getFreelancerGigs(freelancer)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#06B6D4", accent2: "#22D3EE", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function FreelanceAgent() {
    const bridge = useAgentBridge('freelance');
    const [tab, setTab] = useState("gigs");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "GIG-002 milestone 1 approved — 2.00 ETH released to 0xF2…4D" },
        { ts: Date.now() - 60000, msg: "GIG-003 posted: API Integration — 2.50 ETH budget" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New gig GIG-006 posted: 4.00 ETH — Backend Optimization",
                "GIG-002 milestone 2 delivered by 0xF2…4D — awaiting approval",
                "GIG-004 dispute raised by client 0xC4…5C",
                "GIG-005 all milestones approved — gig auto-completed ✓",
                "GIG-003 assigned to freelancer 0xF5…7E",
                "GIG-001 client left 5-star review for 0xF1…9A",
                "Arbiter resolved GIG-004 dispute — 8.00 ETH to freelancer",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "gigs", label: "📋 Gigs" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Lifecycle" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📋</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Freelance<span style={{ color: S.accent }}>Marketplace</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Gigs · Milestones · Escrow · Dispute resolution</p>
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

            {tab === "gigs" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_GIGS.map(g => (
                        <div key={g.id} onClick={() => setSel(g)} style={{ background: S.card, border: `1px solid ${sel?.id === g.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{g.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{g.desc}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>Client: {g.client} · Freelancer: {g.freelancer}</div>
                            <div style={{ fontSize: 12, color: S.muted }}>Budget: {g.budget} · Milestones: {g.milestones}</div>
                            <span style={{ background: STATUS_COLORS[g.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{g.status}</span>
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
                    {["OPEN", "ASSIGNED", "IN_PROGRESS", "DELIVERED", "COMPLETED"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: STATUS_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_GIGS.filter(g => g.status === st).length}</span>
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
                        { label: "Total Gigs", val: "5" },
                        { label: "Active", val: "2" },
                        { label: "Total Value", val: "30.5 ETH" },
                        { label: "Disputes", val: "1" },
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — FREELANCE</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="freelance" accentColor="#06B6D4" />
                </div>
            )}
        </div>
    );
}
