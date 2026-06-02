import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_POOLS = [
    { id: "SCH-001", name: "STEM Futures Fund", sponsor: "Fundación Telmex", totalFund: 500000, distributed: 312000, currency: "MXN", scholars: 85, active: true, meritBased: true, minGPA: 8.5, sector: "Engineering", region: "México" },
    { id: "SCH-002", name: "Web3 Talent Pipeline", sponsor: "BeZhas DAO", totalFund: 150000, distributed: 89000, currency: "BEZ", scholars: 42, active: true, meritBased: true, minGPA: 7.0, sector: "Computer Science", region: "LATAM" },
    { id: "SCH-003", name: "Rural Education Access", sponsor: "CONACYT", totalFund: 800000, distributed: 560000, currency: "MXN", scholars: 220, active: true, meritBased: false, minGPA: 6.0, sector: "General", region: "Rural México" },
    { id: "SCH-004", name: "Women in Blockchain", sponsor: "OpenZeppelin Grants", totalFund: 75000, distributed: 41000, currency: "USDC", scholars: 28, active: true, meritBased: true, minGPA: 8.0, sector: "Blockchain Dev", region: "Global" },
    { id: "SCH-005", name: "Agri-Tech Scholarship", sponsor: "SAGARPA Digital", totalFund: 300000, distributed: 300000, currency: "MXN", scholars: 95, active: false, meritBased: true, minGPA: 7.5, sector: "Agriculture", region: "México" },
    { id: "SCH-006", name: "AI Research Grant", sponsor: "Google.org LATAM", totalFund: 200000, distributed: 67000, currency: "USD", scholars: 15, active: true, meritBased: true, minGPA: 9.0, sector: "AI/ML", region: "LATAM" },
];

const STATUS_COLORS = { true: "#00FF88", false: "#7C3AED" };

const CONTRACT_ABI = `// ScholarshipPool.sol  —  BeZhas Chain
// DeFi scholarship pools with merit-based distribution

struct Pool {
  string   name;
  address  sponsor;
  uint256  totalFund;
  uint256  distributed;
  uint256  scholarCount;
  uint256  minScore;      // 0-100
  bool     active;
}

struct Scholar {
  uint256  poolId;
  address  student;
  uint256  gpaScore;     // 0-100
  uint256  awarded;
  uint256  appliedAt;
  bool     approved;
}

function createPool(string name, uint256 minScore) external payable returns (uint256);
function applyForScholarship(uint256 poolId, uint256 gpaScore) external returns (uint256);
function approveScholar(uint256 scholarId) external;
function distributeAward(uint256 scholarId, uint256 amount) external;
function closePool(uint256 poolId) external;`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#10B981", accent2: "#FFD700", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function ScholarPoolAgent() {
  const bridge = useAgentBridge("scholarpool");
    const [tab, setTab] = useState("pools");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { time: "15:30:00", type: "APPLICATION", pool: "SCH-002", detail: "0xB1..E4 applied — GPA 8.7" },
        { time: "15:25:00", type: "DISTRIBUTED", pool: "SCH-001", detail: "5,000 MXN awarded to scholar #72" },
        { time: "15:20:00", type: "APPROVED", pool: "SCH-004", detail: "Scholar #28 approved — Women in Blockchain" },
    ]);

    useEffect(() => {
        const EVTS = ["APPLICATION", "APPROVED", "DISTRIBUTED", "POOL_FUNDED", "GPA_UPDATED"];
        const iv = setInterval(() => {
            const p = MOCK_POOLS[Math.floor(Math.random() * MOCK_POOLS.length)];
            const ev = EVTS[Math.floor(Math.random() * EVTS.length)];
            setEvents(prev => [{ time: new Date().toLocaleTimeString(), type: ev, pool: p.id, detail: `${ev} — ${p.name} (${p.sponsor})` }, ...prev].slice(0, 30));
        }, 9000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "pools", label: "🎓 Pools" },
        { id: "live", label: "🔴 Activity" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const totalFunds = MOCK_POOLS.reduce((s, p) => s + p.totalFund, 0);
    const totalScholars = MOCK_POOLS.reduce((s, p) => s + p.scholars, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🎓</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>ScholarPool Agent — DeFi Scholarship Pools</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>Merit-based distribution · On-chain GPA verification · Sponsor pools</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#10B98122", color: "#10B981", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "pools" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Total Funds", (totalFunds / 1000).toFixed(0) + "K", S.accent2], ["Scholars", totalScholars, S.accent], ["Active Pools", MOCK_POOLS.filter(p => p.active).length, "#3B82F6"]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        {MOCK_POOLS.map(p => (
                            <div key={p.id} onClick={() => setSel(p)} style={{ background: sel?.id === p.id ? S.accent + "11" : S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8, cursor: "pointer" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                                        <span style={{ color: S.muted, fontSize: 11, marginLeft: 8 }}>{p.sponsor}</span>
                                    </div>
                                    <span style={{ color: STATUS_COLORS[p.active], fontSize: 11 }}>● {p.active ? "ACTIVE" : "CLOSED"}</span>
                                </div>
                                <div style={{ marginTop: 8, background: S.accent + "11", borderRadius: 8, overflow: "hidden" }}>
                                    <div style={{ height: 6, background: S.accent, width: ((p.distributed / p.totalFund) * 100) + "%", borderRadius: 8 }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: S.muted, marginTop: 4 }}>
                                    <span>{p.distributed.toLocaleString()} / {p.totalFund.toLocaleString()} {p.currency}</span>
                                    <span>{p.scholars} scholars</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.name}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>{sel.sponsor} · {sel.region}</div>
                            {[["Sector", sel.sector], ["Fund", sel.totalFund.toLocaleString() + " " + sel.currency], ["Distributed", sel.distributed.toLocaleString() + " " + sel.currency], ["Scholars", sel.scholars], ["Min GPA", sel.minGPA], ["Merit-Based", sel.meritBased ? "Yes" : "No"]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === "live" && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                    <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                        <th style={{ padding: 6 }}>Time</th><th>Event</th><th>Pool</th><th>Detail</th>
                    </tr></thead>
                    <tbody>{events.map((e, x) => (
                        <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                            <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                            <td style={{ color: e.type === "DISTRIBUTED" ? S.accent2 : S.accent }}>{e.type}</td>
                            <td style={{ color: "#3B82F6" }}>{e.pool}</td>
                            <td style={{ fontSize: 11 }}>{e.detail}</td>
                        </tr>
                    ))}</tbody>
                </table>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Scholarship Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Fund Pool", "2. Applications", "3. GPA Verify", "4. Approve", "5. Distribute"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["💰", "📝", "📊", "✅", "💸"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>ScholarshipPool.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Pool Creation", "2.0 BEZ / pool", "+8 pools/mo", "💰"],
                        ["Application Fee", "0.1 BEZ / apply", "+450 apps/mo", "📝"],
                        ["Distribution Fee", "0.5% of award", "+320K distributed/mo", "💸"],
                        ["Sponsor Dashboard", "$299/mo per sponsor", "18 sponsors", "🏛️"],
                        ["GPA Verification", "0.2 BEZ / verify", "+900 verifications/mo", "📊"],
                        ["Impact Reports", "5.0 BEZ / report", "+15 reports/mo", "📈"],
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
                  📊 REAL-TIME AGENT METRICS — SCHOLARPOOL
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/scholarpool/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="scholarpool" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
