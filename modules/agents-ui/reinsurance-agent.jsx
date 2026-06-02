import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_POOLS = [
    { id: "RPOOL-001", name: "Marine Cargo Reinsurance", tvl: 12500000, currency: "BEZ", investors: 48, riskTier: "Medium", yield: 8.5, maxLoss: 2500000, activePolicies: 34, status: "OPEN", sector: "Logistics" },
    { id: "RPOOL-002", name: "Agri Parametric Pool", tvl: 5200000, currency: "BEZ", investors: 92, riskTier: "High", yield: 14.2, maxLoss: 3000000, activePolicies: 120, status: "OPEN", sector: "Agriculture" },
    { id: "RPOOL-003", name: "Fleet Liability Pool", tvl: 8800000, currency: "BEZ", investors: 65, riskTier: "Low", yield: 5.8, maxLoss: 1500000, activePolicies: 55, status: "OPEN", sector: "Automotive" },
    { id: "RPOOL-004", name: "Equipment Breakdown", tvl: 3100000, currency: "BEZ", investors: 28, riskTier: "Low", yield: 6.2, maxLoss: 800000, activePolicies: 18, status: "OPEN", sector: "Energy" },
    { id: "RPOOL-005", name: "Clinical Trial Pool", tvl: 15000000, currency: "BEZ", investors: 15, riskTier: "High", yield: 18.5, maxLoss: 10000000, activePolicies: 6, status: "CAPPED", sector: "Healthcare" },
    { id: "RPOOL-006", name: "Cyber Risk Pool", tvl: 7400000, currency: "BEZ", investors: 38, riskTier: "Medium", yield: 11.0, maxLoss: 4000000, activePolicies: 22, status: "OPEN", sector: "Technology" },
];

const MOCK_EVENTS = [
    { time: "15:28:00", pool: "RPOOL-002", event: "DEPOSIT", detail: "50,000 BEZ deposited — investor 0x4a2f...b8c1" },
    { time: "15:15:22", pool: "RPOOL-003", event: "CLAIM_PAID", detail: "45,000 BEZ payout — Fleet collision claim CLM-002" },
    { time: "14:58:10", pool: "RPOOL-001", event: "YIELD_DIST", detail: "Monthly yield 8.5% APY — 88,542 BEZ distributed" },
    { time: "14:40:05", pool: "RPOOL-005", event: "POOL_CAPPED", detail: "Max capacity 15M BEZ reached — no new deposits" },
];

const STATUS_COLORS = { OPEN: "#00FF88", CAPPED: "#FFD700", LOCKED: "#F97316", UNWINDING: "#EF4444" };
const RISK_COLORS = { Low: "#00FF88", Medium: "#FFD700", High: "#EF4444" };
const EVENT_COLORS = { DEPOSIT: "#00FF88", WITHDRAW: "#F97316", CLAIM_PAID: "#EF4444", YIELD_DIST: "#3B82F6", POOL_CAPPED: "#FFD700" };

const CONTRACT_ABI = `// ReinsurancePool.sol  —  BeZhas Chain
// DeFi reinsurance pools with risk tokenization

struct Pool {
  string   name;
  string   sector;
  uint256  tvl;              // total value locked in BEZ
  uint256  maxCapacity;
  uint256  maxLossPerEvent;
  uint8    riskTier;         // 1=Low, 2=Medium, 3=High
  uint256  yieldBps;         // APY in basis points (850 = 8.50%)
  uint256  investorCount;
  bool     open;
}

struct Deposit {
  uint256  poolId;
  address  investor;
  uint256  amount;
  uint256  depositedAt;
  uint256  lastYieldClaim;
}

function createPool(
  string name, string sector, uint256 maxCapacity,
  uint256 maxLoss, uint8 riskTier, uint256 yieldBps
) external returns (uint256 poolId);

function deposit(uint256 poolId) external payable;
function withdraw(uint256 poolId, uint256 amount) external;
function claimYield(uint256 poolId) external;
function payClaimFromPool(uint256 poolId, uint256 claimId, uint256 amount) external;
function capPool(uint256 poolId) external;`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#7C3AED", accent2: "#FFD700", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function ReinsurancePoolAgent() {
  const bridge = useAgentBridge("reinsurance");
    const [tab, setTab] = useState("pools");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState(MOCK_EVENTS);

    useEffect(() => {
        const iv = setInterval(() => {
            const pool = MOCK_POOLS[Math.floor(Math.random() * MOCK_POOLS.length)];
            const evts = ["DEPOSIT", "WITHDRAW", "YIELD_DIST", "CLAIM_PAID"];
            const evt = evts[Math.floor(Math.random() * evts.length)];
            const amt = Math.round(Math.random() * 50000 + 5000);
            setEvents(p => [{
                time: new Date().toLocaleTimeString(), pool: pool.id, event: evt,
                detail: evt === "DEPOSIT" ? `${amt.toLocaleString()} BEZ deposited` : evt === "WITHDRAW" ? `${amt.toLocaleString()} BEZ withdrawn` : `${pool.name} — ${evt.replace("_", " ").toLowerCase()}`
            }, ...p].slice(0, 30));
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "pools", label: "🏦 Pools" },
        { id: "activity", label: "📡 Activity" },
        { id: "pipeline", label: "🔄 Risk Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const totalTVL = MOCK_POOLS.reduce((s, p) => s + p.tvl, 0);
    const totalInvestors = MOCK_POOLS.reduce((s, p) => s + p.investors, 0);
    const avgYield = (MOCK_POOLS.reduce((s, p) => s + p.yield, 0) / MOCK_POOLS.length).toFixed(1);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🏦</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>ReinsurancePool Agent — DeFi Risk Pools</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>Risk tokenization · Yield distribution · Claim pooling · Capacity management</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#7C3AED22", color: "#7C3AED", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● ACTIVE</span>
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
                            {[["Total TVL", (totalTVL / 1e6).toFixed(1) + "M BEZ", S.accent], ["Investors", totalInvestors, "#00FF88"], ["Avg Yield", avgYield + "% APY", S.accent2]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Pool</th><th>TVL</th><th>Yield</th><th>Risk</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_POOLS.map(p => (
                                <tr key={p.id} onClick={() => setSel(p)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === p.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent2, fontSize: 11 }}>{p.id}</td>
                                    <td>{p.name}</td>
                                    <td style={{ fontFamily: S.mono, fontSize: 12 }}>{(p.tvl / 1e6).toFixed(1)}M</td>
                                    <td style={{ fontFamily: S.mono, fontSize: 12, color: S.accent2 }}>{p.yield}%</td>
                                    <td><span style={{ color: RISK_COLORS[p.riskTier], fontSize: 11 }}>● {p.riskTier}</span></td>
                                    <td><span style={{ color: STATUS_COLORS[p.status], fontSize: 11 }}>● {p.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.name}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>Sector: {sel.sector} · {sel.investors} investors</div>
                            {[["TVL", sel.tvl.toLocaleString() + " BEZ"], ["Max Loss/Event", sel.maxLoss.toLocaleString() + " BEZ"], ["Yield APY", sel.yield + "%"], ["Active Policies", sel.activePolicies], ["Risk Tier", sel.riskTier]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: sel.riskTier === "High" ? "#EF444422" : S.accent + "22", padding: 8, borderRadius: 8, textAlign: "center", fontSize: 12 }}>
                                <span style={{ color: sel.riskTier === "High" ? "#EF4444" : S.accent }}>
                                    {sel.riskTier === "High" ? "⚠ HIGH RISK — HIGHER YIELD" : sel.riskTier === "Medium" ? "⚡ BALANCED RISK/REWARD" : "✅ CONSERVATIVE POOL"}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "activity" && (
                <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Pool</th><th>Event</th><th>Detail</th>
                        </tr></thead>
                        <tbody>{events.map((e, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                                <td style={{ color: S.accent2 }}>{e.pool}</td>
                                <td><span style={{ color: EVENT_COLORS[e.event] || S.text, fontSize: 11 }}>{e.event}</span></td>
                                <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.detail}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Reinsurance Pool Lifecycle</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Create Pool", "2. Collect Deposits", "3. Underwrite Risk", "4. Yield/Claims", "5. Unwind/Renew"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["🏦", "💰", "📝", "📊", "🔄"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    {MOCK_POOLS.map(pool => (
                        <div key={pool.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontWeight: 600 }}>{pool.name}</span>
                                <span style={{ color: STATUS_COLORS[pool.status], fontSize: 12, fontFamily: S.mono }}>● {pool.status}</span>
                            </div>
                            <div style={{ width: "100%", height: 8, background: S.border, borderRadius: 4 }}>
                                <div style={{ width: `${Math.min(100, (pool.tvl / 15000000) * 100)}%`, height: "100%", background: S.accent, borderRadius: 4 }} />
                            </div>
                            <div style={{ display: "flex", gap: 16, fontSize: 11, color: S.muted, marginTop: 4, fontFamily: S.mono }}>
                                <span>TVL: {(pool.tvl / 1e6).toFixed(1)}M</span>
                                <span>Yield: {pool.yield}%</span>
                                <span>Policies: {pool.activePolicies}</span>
                                <span style={{ color: RISK_COLORS[pool.riskTier] }}>Risk: {pool.riskTier}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>ReinsurancePool.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Pool Creation", "10.0 BEZ / pool", "+5 pools/mo", "🏦"],
                        ["Deposit Fees", "0.5% of deposit", "+3.2M BEZ/mo in deposits", "💰"],
                        ["Yield Distribution", "0.3% mgmt fee", "+4.5M BEZ/yr distributed", "📊"],
                        ["Claim Settlement", "1.0% of payout", "+450K BEZ/mo settled", "📋"],
                        ["Risk Analytics API", "0.2 BEZ / query", "+22K queries/mo", "📈"],
                        ["Institutional SaaS", "$2,999/mo", "6 reinsurers subscribed", "🏢"],
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
                  📊 REAL-TIME AGENT METRICS — REINSURANCE
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/reinsurance/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="reinsurance" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
