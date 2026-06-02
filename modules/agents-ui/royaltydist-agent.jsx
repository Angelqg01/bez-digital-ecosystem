import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_CONTENT = [
    { id: "CTN-001", title: "Neon Dreams Album", type: "MUSIC", creator: "DJ Azteca", beneficiaries: 3, revenue: 45200, distributed: 38500, currency: "BEZ", status: "ACTIVE", streams: "2.1M" },
    { id: "CTN-002", title: "Midnight in CDMX", type: "FILM", creator: "Cine Soberano", beneficiaries: 5, revenue: 128000, distributed: 95000, currency: "BEZ", status: "ACTIVE", streams: "890K" },
    { id: "CTN-003", title: "Crypto Art Collection", type: "ART", creator: "PixelVerde Studio", beneficiaries: 2, revenue: 18700, distributed: 18700, currency: "BEZ", status: "ACTIVE", streams: "340K" },
    { id: "CTN-004", title: "Web3 Unplugged Podcast", type: "PODCAST", creator: "BeZhas Media", beneficiaries: 4, revenue: 8900, distributed: 6200, currency: "BEZ", status: "ACTIVE", streams: "1.5M" },
    { id: "CTN-005", title: "Aztec Quest (Game)", type: "GAME", creator: "Indie MX Games", beneficiaries: 6, revenue: 67400, distributed: 52000, currency: "BEZ", status: "ACTIVE", streams: "450K" },
    { id: "CTN-006", title: "Cumbia Electronica EP", type: "MUSIC", creator: "Sonido Digital", beneficiaries: 2, revenue: 12300, distributed: 0, currency: "BEZ", status: "PENDING", streams: "78K" },
];

const TYPE_COLORS = { MUSIC: "#E040FB", FILM: "#3B82F6", ART: "#FFD700", PODCAST: "#00FF88", GAME: "#EF4444" };
const STATUS_COLORS = { ACTIVE: "#00FF88", PENDING: "#FFD700", PAUSED: "#7C3AED", EXPIRED: "#EF4444" };

const CONTRACT_ABI = `// RoyaltyDistributor.sol  --  BeZhas Chain
// Automated royalty splits for content creators

struct Content {
  string      title;
  ContentType contentType;   // MUSIC, VIDEO, ART, PODCAST, GAME
  address     creator;
  uint256     registeredAt;
  uint256     totalRevenue;
  uint256     totalDistributed;
  bool        active;
}

struct Split {
  address beneficiary;
  uint256 shareBps;         // basis points (total = 10000)
}

function registerContent(string title, ContentType contentType) external returns (uint256);
function configureSplits(uint256 contentId, address[] beneficiaries, uint256[] sharesBps) external;
function depositRevenue(uint256 contentId) external payable;
function distributeRoyalties(uint256 contentId, uint256 amount) external;
function withdraw() external;`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#E040FB", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function RoyaltyDistAgent() {
  const bridge = useAgentBridge("royaltydist");
    const [tab, setTab] = useState("content");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { time: "14:45:00", type: "REVENUE_DEPOSIT", content: "CTN-001", detail: "1,200 BEZ deposited for Neon Dreams Album" },
        { time: "14:40:00", type: "ROYALTY_SPLIT", content: "CTN-002", detail: "5,000 BEZ distributed to 5 beneficiaries" },
        { time: "14:35:00", type: "WITHDRAWAL", content: "CTN-003", detail: "PixelVerde withdrew 3,400 BEZ" },
    ]);

    useEffect(() => {
        const EVTS = ["REVENUE_DEPOSIT", "ROYALTY_SPLIT", "WITHDRAWAL", "CONTENT_REGISTERED", "SPLITS_CONFIGURED"];
        const iv = setInterval(() => {
            const c = MOCK_CONTENT[Math.floor(Math.random() * MOCK_CONTENT.length)];
            const ev = EVTS[Math.floor(Math.random() * EVTS.length)];
            setEvents(p => [{ time: new Date().toLocaleTimeString(), type: ev, content: c.id, detail: `${ev} -- ${c.title} (${c.creator})` }, ...p].slice(0, 30));
        }, 9000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "content", label: "🎵 Content" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const totalRevenue = MOCK_CONTENT.reduce((s, c) => s + c.revenue, 0);
    const totalDistributed = MOCK_CONTENT.reduce((s, c) => s + c.distributed, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🎵</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>RoyaltyDist Agent -- Automated Royalty Splits</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>Content registry - Revenue splits - Creator payouts</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#E040FB22", color: "#E040FB", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "content" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Total Revenue", totalRevenue.toLocaleString() + " BEZ", S.accent], ["Distributed", totalDistributed.toLocaleString() + " BEZ", S.accent2], ["Content IPs", MOCK_CONTENT.length, "#FFD700"]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Title</th><th>Type</th><th>Revenue</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_CONTENT.map(c => (
                                <tr key={c.id} onClick={() => setSel(c)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === c.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent, fontSize: 11 }}>{c.id}</td>
                                    <td style={{ fontSize: 12 }}>{c.title}</td>
                                    <td><span style={{ color: TYPE_COLORS[c.type], fontSize: 11 }}>{c.type}</span></td>
                                    <td style={{ fontFamily: S.mono, fontSize: 11 }}>{c.revenue.toLocaleString()}</td>
                                    <td><span style={{ color: STATUS_COLORS[c.status], fontSize: 11 }}>● {c.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.title}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>{sel.creator} - {sel.type}</div>
                            {[["Revenue", sel.revenue.toLocaleString() + " " + sel.currency], ["Distributed", sel.distributed.toLocaleString() + " " + sel.currency], ["Pending", (sel.revenue - sel.distributed).toLocaleString() + " " + sel.currency], ["Beneficiaries", sel.beneficiaries], ["Streams", sel.streams]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: S.accent + "11", borderRadius: 8, overflow: "hidden" }}>
                                <div style={{ height: 6, background: S.accent2, width: (sel.distributed / sel.revenue * 100) + "%", borderRadius: 8 }} />
                            </div>
                            <div style={{ textAlign: "center", color: S.muted, fontSize: 11, marginTop: 4 }}>Distributed: {(sel.distributed / sel.revenue * 100).toFixed(1)}%</div>
                        </div>
                    )}
                </div>
            )}

            {tab === "live" && (
                <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Event</th><th>Content</th><th>Detail</th>
                        </tr></thead>
                        <tbody>{events.map((e, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                                <td style={{ color: e.type === "ROYALTY_SPLIT" ? S.accent2 : S.accent }}>{e.type}</td>
                                <td style={{ color: "#FFD700" }}>{e.content}</td>
                                <td style={{ fontSize: 11 }}>{e.detail}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Royalty Distribution Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Register Content", "2. Configure Splits", "3. Deposit Revenue", "4. Distribute", "5. Withdraw"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📝", "✂️", "💰", "📤", "🏦"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    {["ACTIVE", "PENDING"].map(status => {
                        const items = MOCK_CONTENT.filter(c => c.status === status);
                        if (!items.length) return null;
                        return (
                            <div key={status} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: STATUS_COLORS[status] }}>● {status} ({items.length})</div>
                                {items.map(c => (
                                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span>{c.title} -- {c.creator}</span>
                                        <span style={{ fontFamily: S.mono, color: S.muted }}>{c.revenue.toLocaleString()} rev - {c.beneficiaries} splits</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>RoyaltyDistributor.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Content Registration", "1.0 BEZ / registration", "+120 contents/mo", "📝"],
                        ["Royalty Distribution", "0.5% per distribution", "+$280K distributed/mo", "💸"],
                        ["Creator Dashboard", "$149/mo per creator", "85 creators", "🎨"],
                        ["Label/Studio SaaS", "$999/mo per label", "12 labels", "🏢"],
                        ["Streaming Analytics", "$199/mo per dashboard", "42 dashboards", "📊"],
                        ["DRM Verification", "0.1 BEZ / verify", "+8K verifications/mo", "🔐"],
                    ].map(([t, fee, vol, ic]) => (
                        <div key={t} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14 }}>
                            <div style={{ fontSize: 20, marginBottom: 4 }}>{ic}</div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{t}</div>
                            <div style={{ fontFamily: S.mono, color: S.accent, fontSize: 13, marginTop: 4 }}>{fee}</div>
                            <div style={{ color: S.muted, fontSize: 11 }}>{vol}</div>
                        </div>
                    ))}
                </div>
            )}
          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: S.card || S.panel, border: "1px solid " + (S.border), borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — ROYALTYDIST
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/royaltydist/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="royaltydist" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
