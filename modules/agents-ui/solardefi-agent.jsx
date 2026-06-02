import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_FARMS = [
    { id: "SF-001", name: "Andalucia Solar Park Alpha", type: "SOLAR", location: "Sevilla, ES", capacityMW: 150, productionMWh: 2850, tokenSupply: 1500000, tokenPrice: 1.42, apy: 8.4, investors: 1247, status: "PRODUCING", lastPayout: "2026-03-15", fundedPct: 100 },
    { id: "WF-002", name: "Galicia Wind Farm Breeze", type: "WIND", location: "A Coruna, ES", capacityMW: 80, productionMWh: 1620, tokenSupply: 800000, tokenPrice: 2.15, apy: 9.1, investors: 892, status: "PRODUCING", lastPayout: "2026-03-15", fundedPct: 100 },
    { id: "SF-003", name: "Extremadura Mega Solar", type: "SOLAR", location: "Badajoz, ES", capacityMW: 300, productionMWh: 0, tokenSupply: 3000000, tokenPrice: 1.00, apy: 0, investors: 341, status: "FUNDING", lastPayout: null, fundedPct: 68 },
    { id: "WF-004", name: "Canarias Offshore Wind", type: "WIND", location: "Lanzarote, ES", capacityMW: 200, productionMWh: 3100, tokenSupply: 2000000, tokenPrice: 1.89, apy: 11.2, investors: 2031, status: "PRODUCING", lastPayout: "2026-03-15", fundedPct: 100 },
    { id: "HY-005", name: "Pyrenees Hydro Micro", type: "HYDRO", location: "Huesca, ES", capacityMW: 12, productionMWh: 245, tokenSupply: 120000, tokenPrice: 3.40, apy: 6.8, investors: 156, status: "PRODUCING", lastPayout: "2026-03-14", fundedPct: 100 },
];

const MOCK_PAYOUTS = [
    { date: "2026-03-15", farm: "SF-001", totalBEZ: 42500, perToken: 0.0283, holders: 1247, tx: "0x7f3a...c4e2" },
    { date: "2026-03-15", farm: "WF-002", totalBEZ: 31200, perToken: 0.0390, holders: 892, tx: "0x2b8d...f901" },
    { date: "2026-03-15", farm: "WF-004", totalBEZ: 68900, perToken: 0.0345, holders: 2031, tx: "0xa12c...8834" },
    { date: "2026-03-14", farm: "HY-005", totalBEZ: 4800, perToken: 0.0400, holders: 156, tx: "0x5e9f...2217" },
];

const STATUS_COLORS = { PRODUCING: "#00FF88", FUNDING: "#FFD700", CONSTRUCTION: "#00D4FF", MAINTENANCE: "#F97316", OFFLINE: "#EF4444" };
const TYPE_ICONS = { SOLAR: "☀️", WIND: "🌬️", HYDRO: "💧" };

const CONTRACT_ABI = `// SolarFarmToken.sol  -  BeZhas Chain
// ERC-1155 fractionalized renewable energy assets

struct EnergyFarm {
  string  name;
  string  farmType;       // SOLAR, WIND, HYDRO
  string  location;
  uint256 capacityMW;     // Megawatt capacity
  uint256 tokenSupply;    // Total fractions
  uint256 tokenPrice;     // Initial price in BEZ wei
  uint256 fundingGoal;    // BEZ needed to fund
  uint256 fundedAmount;   // BEZ collected so far
  FarmStatus status;
}

enum FarmStatus { FUNDING, CONSTRUCTION, PRODUCING, MAINTENANCE, OFFLINE }

struct DividendPayout {
  uint256 farmId;
  uint256 totalAmount;    // BEZ distributed
  uint256 perToken;       // BEZ per token
  uint256 timestamp;
}

function registerFarm(
  string name, string farmType, string location,
  uint256 capacityMW, uint256 tokenSupply, uint256 tokenPrice
) external onlyRole(OPERATOR_ROLE) returns (uint256 farmId);

function investInFarm(uint256 farmId, uint256 tokens) external payable;
function distributeDividends(uint256 farmId) external onlyRole(OPERATOR_ROLE);
function claimDividends(uint256 farmId) external;
function redeemTokens(uint256 farmId, uint256 tokens) external;`;

const S = {
    bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
    accent: "#F97316", accent2: "#00FF88", text: "#e2e8f0", muted: "#64748b", mono: "'Courier New',monospace",
};

export default function SolarDeFiAgent() {
  const bridge = useAgentBridge("solardefi");
    const [tab, setTab] = useState("farms");
    const [sel, setSel] = useState(null);
    const [payouts, setPayouts] = useState(MOCK_PAYOUTS);

    useEffect(() => {
        const iv = setInterval(() => {
            const farms = MOCK_FARMS.filter(f => f.status === "PRODUCING");
            if (farms.length) {
                const f = farms[Math.floor(Math.random() * farms.length)];
                const total = Math.floor(Math.random() * 50000) + 5000;
                const perTk = +(total / f.tokenSupply).toFixed(4);
                setPayouts(p => [{
                    date: new Date().toISOString().split("T")[0], farm: f.id, totalBEZ: total, perToken: perTk,
                    holders: f.investors, tx: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`
                }, ...p].slice(0, 20));
            }
        }, 10000);
        return () => clearInterval(iv);
    }, []);

    const tabs = ["farms", "dividends", "invest", "contracts", "analytics", "metrics"];
    const totalCapacity = MOCK_FARMS.reduce((s, f) => s + f.capacityMW, 0);
    const totalProduction = MOCK_FARMS.reduce((s, f) => s + f.productionMWh, 0);
    const totalInvestors = MOCK_FARMS.reduce((s, f) => s + f.investors, 0);

    return (
        <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.mono, color: S.text, padding: 24 }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                    <span style={{ fontSize: 28 }}>☀️</span>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, color: S.accent }}>Solar DeFi Agent</h1>
                        <p style={{ margin: 0, fontSize: 11, color: S.muted, letterSpacing: 2 }}>FRACTIONALIZED RENEWABLE ENERGY ASSETS</p>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 11 }}>
                        <span style={{ color: S.accent2 }}>{totalCapacity} MW CAPACITY</span>
                        <span style={{ color: S.accent }}>{totalProduction.toLocaleString()} MWh/mo</span>
                        <span style={{ color: "#00D4FF" }}>{totalInvestors.toLocaleString()} INVESTORS</span>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
                    {tabs.map(t => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: "8px 16px", background: tab === t ? S.accent : "transparent", color: tab === t ? "#000" : S.muted,
                            border: `1px solid ${tab === t ? S.accent : S.border}`, borderRadius: 2, cursor: "pointer", fontSize: 11,
                            fontFamily: S.mono, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                        }}>{t}</button>
                    ))}
                </div>

                {tab === "farms" && (
                    <div style={{ display: "grid", gridTemplateColumns: sel !== null ? "1fr 1fr" : "1fr", gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, letterSpacing: 2 }}>ENERGY FARM PORTFOLIO</div>
                            {MOCK_FARMS.map((f, i) => (
                                <div key={i} onClick={() => setSel(i)} style={{
                                    padding: 16, background: sel === i ? "rgba(249,115,22,0.08)" : S.card,
                                    border: `1px solid ${sel === i ? S.accent : S.border}`, borderRadius: 4, marginBottom: 8, cursor: "pointer",
                                    transition: "all 0.2s",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: 18 }}>{TYPE_ICONS[f.type]}</span>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700 }}>{f.name}</div>
                                                <div style={{ fontSize: 10, color: S.muted }}>{f.location}</div>
                                            </div>
                                        </div>
                                        <span style={{ padding: "2px 8px", fontSize: 10, fontWeight: 700, color: STATUS_COLORS[f.status], border: `1px solid ${STATUS_COLORS[f.status]}33`, borderRadius: 2 }}>{f.status}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
                                        <span style={{ color: S.muted }}>Cap: <span style={{ color: S.text }}>{f.capacityMW} MW</span></span>
                                        <span style={{ color: S.muted }}>APY: <span style={{ color: S.accent2 }}>{f.apy}%</span></span>
                                        <span style={{ color: S.muted }}>Price: <span style={{ color: S.accent }}>{f.tokenPrice} BEZ</span></span>
                                        <span style={{ color: S.muted }}>Investors: <span style={{ color: S.text }}>{f.investors.toLocaleString()}</span></span>
                                    </div>
                                    {f.status === "FUNDING" && (
                                        <div style={{ marginTop: 8 }}>
                                            <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                                                <div style={{ width: `${f.fundedPct}%`, height: "100%", background: "#FFD700" }} />
                                            </div>
                                            <div style={{ fontSize: 10, color: S.muted, textAlign: "right", marginTop: 2 }}>{f.fundedPct}% funded</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {sel !== null && (() => {
                            const f = MOCK_FARMS[sel]; return (
                                <div style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 11, color: S.muted, letterSpacing: 2, marginBottom: 12 }}>FARM DETAIL</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                        <span style={{ fontSize: 24 }}>{TYPE_ICONS[f.type]}</span>
                                        <h3 style={{ margin: 0, fontSize: 16, color: S.accent }}>{f.name}</h3>
                                    </div>
                                    {[
                                        ["Type", f.type], ["Location", f.location], ["Capacity", `${f.capacityMW} MW`],
                                        ["Production", `${f.productionMWh.toLocaleString()} MWh/mo`],
                                        ["Token Supply", f.tokenSupply.toLocaleString()], ["Token Price", `${f.tokenPrice} BEZ`],
                                        ["APY", `${f.apy}%`], ["Investors", f.investors.toLocaleString()],
                                        ["Last Payout", f.lastPayout || "N/A"], ["Funded", `${f.fundedPct}%`],
                                    ].map(([k, v], j) => (
                                        <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}`, fontSize: 11 }}>
                                            <span style={{ color: S.muted }}>{k}</span>
                                            <span style={{ color: k === "APY" ? S.accent2 : k === "Token Price" ? S.accent : S.text }}>{v}</span>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: 16, padding: 12, background: "rgba(0,255,136,0.06)", border: `1px solid rgba(0,255,136,0.2)`, borderRadius: 4 }}>
                                        <div style={{ fontSize: 10, color: S.accent2, fontWeight: 700, marginBottom: 4 }}>ESTIMATED ANNUAL RETURN</div>
                                        <div style={{ fontSize: 22, fontWeight: 700, color: S.accent2 }}>{f.apy > 0 ? `${(f.tokenPrice * f.apy / 100).toFixed(4)} BEZ/token` : "Pending"}</div>
                                    </div>
                                </div>);
                        })()}
                    </div>
                )}

                {tab === "dividends" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                            {[
                                { label: "Total Distributed", val: `${payouts.reduce((s, p) => s + p.totalBEZ, 0).toLocaleString()} BEZ`, color: S.accent },
                                { label: "Payouts This Month", val: payouts.length, color: S.accent2 },
                                { label: "Avg Per Token", val: `${(payouts.reduce((s, p) => s + p.perToken, 0) / payouts.length).toFixed(4)} BEZ`, color: "#00D4FF" },
                                { label: "Unique Holders", val: totalInvestors.toLocaleString(), color: "#FFD700" },
                            ].map((m, i) => (
                                <div key={i} style={{ padding: 14, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, textAlign: "center" }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 1, marginBottom: 4 }}>{m.label}</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.val}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead><tr style={{ borderBottom: `1px solid ${S.border}`, color: S.muted }}>
                                <th style={{ textAlign: "left", padding: 8 }}>DATE</th><th>FARM</th><th>TOTAL BEZ</th>
                                <th>PER TOKEN</th><th>HOLDERS</th><th>TX</th>
                            </tr></thead>
                            <tbody>{payouts.map((p, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                                    <td style={{ padding: 8 }}>{p.date}</td>
                                    <td style={{ color: S.accent }}>{p.farm}</td>
                                    <td style={{ textAlign: "right", fontWeight: 700 }}>{p.totalBEZ.toLocaleString()}</td>
                                    <td style={{ textAlign: "right", color: S.accent2 }}>{p.perToken}</td>
                                    <td style={{ textAlign: "right" }}>{p.holders.toLocaleString()}</td>
                                    <td style={{ color: "#00D4FF" }}>{p.tx}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}

                {tab === "invest" && (
                    <div>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 12, letterSpacing: 2 }}>INVESTMENT PIPELINE</div>
                        <div style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, marginBottom: 20 }}>
                            <h3 style={{ margin: "0 0 16px", fontSize: 14, color: S.accent }}>Investment Flow</h3>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {["1. KYC/AML Verify", "2. Select Farm", "3. Buy Tokens", "4. Earn Dividends", "5. Trade or Redeem"].map((s, i) => (
                                    <div key={i} style={{ flex: 1, minWidth: 120, padding: 12, background: "rgba(0,0,0,0.3)", border: `1px solid ${S.border}`, borderRadius: 4, textAlign: "center" }}>
                                        <div style={{ fontSize: 10, color: S.accent, marginBottom: 4 }}>STEP {i + 1}</div>
                                        <div style={{ fontSize: 11, color: S.text }}>{s.split(". ")[1]}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, letterSpacing: 2 }}>OPEN FUNDING ROUNDS</div>
                        {MOCK_FARMS.filter(f => f.status === "FUNDING").map((f, i) => (
                            <div key={i} style={{ padding: 16, background: S.card, border: `1px solid #FFD70044`, borderRadius: 4, marginBottom: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700 }}>{TYPE_ICONS[f.type]} {f.name}</div>
                                        <div style={{ fontSize: 10, color: S.muted }}>{f.location} | {f.capacityMW} MW</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: "#FFD700" }}>{f.tokenPrice} BEZ/token</div>
                                        <div style={{ fontSize: 10, color: S.muted }}>{f.tokenSupply.toLocaleString()} tokens total</div>
                                    </div>
                                </div>
                                <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                                    <div style={{ width: `${f.fundedPct}%`, height: "100%", background: "linear-gradient(90deg,#FFD700,#F97316)" }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: S.muted, marginTop: 4 }}>
                                    <span>{f.fundedPct}% funded</span><span>{f.investors} investors</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === "contracts" && (
                    <div>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, letterSpacing: 2 }}>SMART CONTRACT ABI</div>
                        <pre style={{ padding: 16, background: "rgba(0,0,0,0.4)", border: `1px solid ${S.border}`, borderRadius: 4, fontSize: 11, color: S.accent2, overflow: "auto", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{CONTRACT_ABI}</pre>
                    </div>
                )}

                {tab === "analytics" && (
                    <div>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 12, letterSpacing: 2 }}>REVENUE MODEL</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                            {[
                                { label: "Management Fee", val: "1.5% AUM/yr", desc: "Annual management fee on total assets under management", color: S.accent },
                                { label: "Carried Interest", val: "10% profits", desc: "Performance fee on dividends exceeding projected APY", color: S.accent2 },
                                { label: "Token Minting", val: "2% issuance", desc: "Fee on initial farm token issuance during funding round", color: "#00D4FF" },
                                { label: "Secondary Trading", val: "0.3% per trade", desc: "DEX spread on farm token secondary market", color: "#FFD700" },
                                { label: "Redemption Fee", val: "0.5%", desc: "Fee when token holders redeem for underlying asset value", color: "#7C3AED" },
                                { label: "Data Licensing", val: "B2B SaaS", desc: "Energy production data licensed to utilities and grid operators", color: "#EC4899" },
                            ].map((r, i) => (
                                <div key={i} style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 1, marginBottom: 4 }}>{r.label}</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: r.color, marginBottom: 6 }}>{r.val}</div>
                                    <div style={{ fontSize: 10, color: S.muted, lineHeight: 1.4 }}>{r.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: S.card || S.panel, border: "1px solid " + (S.border), borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — SOLARDEFI
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/solardefi/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="solardefi" accentColor={S.accent} />
            </div>
          )}

            </div>
        </div>
    );
}
