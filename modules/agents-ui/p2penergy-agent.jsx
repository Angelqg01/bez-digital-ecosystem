import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_PROSUMERS = [
    { id: "PROS-001", name: "Casa Solar Martinez", type: "RESIDENTIAL", capacity: 8.4, generation: 6.2, consumption: 3.1, surplus: 3.1, price: 0.082, location: "Valencia, ES", meter: "SM-0x7f3a", wallet: "0x8a1e...f3b2", status: "SELLING", gridZone: "ES-VLC-01" },
    { id: "PROS-002", name: "Nave Industrial GreenTech", type: "COMMERCIAL", capacity: 120.0, generation: 95.4, consumption: 78.2, surplus: 17.2, price: 0.071, location: "Barcelona, ES", meter: "SM-0x2b8d", wallet: "0x3EfC...8a3E", status: "SELLING", gridZone: "ES-BCN-03" },
    { id: "PROS-003", name: "Comunidad Energetica Sol Norte", type: "COMMUNITY", capacity: 45.0, generation: 32.8, consumption: 41.5, surplus: -8.7, price: 0.075, location: "Madrid, ES", meter: "SM-0xa12c", wallet: "0x52Df...044E", status: "BUYING", gridZone: "ES-MAD-02" },
    { id: "PROS-004", name: "Granja Fotovoltaica Levante", type: "FARM", capacity: 350.0, generation: 280.6, consumption: 12.0, surplus: 268.6, price: 0.065, location: "Murcia, ES", meter: "SM-0x5e9f", wallet: "0x89c2...d12A", status: "SELLING", gridZone: "ES-MUR-01" },
    { id: "PROS-005", name: "Edificio Passivhaus Eco", type: "RESIDENTIAL", capacity: 22.0, generation: 16.1, consumption: 14.8, surplus: 1.3, price: 0.079, location: "Bilbao, ES", meter: "SM-0xc81f", wallet: "0x219F...cc01", status: "SELLING", gridZone: "ES-BIO-01" },
    { id: "PROS-006", name: "Hospital San Carlos", type: "COMMERCIAL", capacity: 0, generation: 0, consumption: 185.4, surplus: -185.4, price: 0.088, location: "Madrid, ES", meter: "SM-0xd92a", wallet: "0xB41e...9a2F", status: "BUYING", gridZone: "ES-MAD-02" },
];

const MOCK_MATCHES = [
    { id: "M-0001", seller: "PROS-004", buyer: "PROS-006", kWh: 85.2, price: 0.072, total: 6.13, time: "14:32:01", status: "SETTLED", tx: "0x7f3a...c4e2" },
    { id: "M-0002", seller: "PROS-001", buyer: "PROS-003", kWh: 3.1, price: 0.078, total: 0.24, time: "14:28:44", status: "SETTLED", tx: "0x2b8d...f901" },
    { id: "M-0003", seller: "PROS-002", buyer: "PROS-006", kWh: 17.2, price: 0.071, total: 1.22, time: "14:15:22", status: "PENDING", tx: null },
    { id: "M-0004", seller: "PROS-005", buyer: "PROS-003", kWh: 1.3, price: 0.077, total: 0.10, time: "13:59:10", status: "SETTLED", tx: "0x5e9f...2217" },
];

const STATUS_COLORS = { SELLING: "#00FF88", BUYING: "#FFD700", OFFLINE: "#64748b", SETTLED: "#00FF88", PENDING: "#FFD700", FAILED: "#EF4444" };

const CONTRACT_ABI = `// P2PEnergyMarket.sol  -  BeZhas Chain
// Peer-to-peer energy trading with automated settlement

struct Prosumer {
  address wallet;
  string  meterId;        // Smart meter ID
  string  gridZone;       // Microgrid zone
  uint256 capacityKW;     // Installed capacity
  bool    isActive;
}

struct EnergyOffer {
  uint256 offerId;
  address seller;
  uint256 kWh;            // Energy offered (in Wh for precision)
  uint256 pricePerKWh;    // Price in BEZ wei
  uint256 expiry;         // Offer expiration timestamp
  bool    filled;
}

struct Settlement {
  uint256 matchId;
  address seller;
  address buyer;
  uint256 kWh;
  uint256 totalPrice;     // Total BEZ paid
  uint256 timestamp;
  bytes32 meterProof;     // Smart meter signed reading
}

function registerProsumer(string meterId, string gridZone, uint256 cap) external;
function createOffer(uint256 kWh, uint256 pricePerKWh, uint256 duration) external;
function matchAndSettle(uint256 offerId, uint256 kWh, bytes meterProof) external;
function withdrawEarnings() external;
function getGridZoneStats(string gridZone) view returns (GridStats);`;

const S = {
    bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
    accent: "#00D4FF", accent2: "#00FF88", text: "#e2e8f0", muted: "#64748b", mono: "'Courier New',monospace",
};

export default function P2PEnergyAgent() {
  const bridge = useAgentBridge("p2penergy");
    const [tab, setTab] = useState("grid");
    const [sel, setSel] = useState(null);
    const [matches, setMatches] = useState(MOCK_MATCHES);

    useEffect(() => {
        const iv = setInterval(() => {
            const sellers = MOCK_PROSUMERS.filter(p => p.status === "SELLING");
            const buyers = MOCK_PROSUMERS.filter(p => p.status === "BUYING");
            if (sellers.length && buyers.length) {
                const s = sellers[Math.floor(Math.random() * sellers.length)];
                const b = buyers[Math.floor(Math.random() * buyers.length)];
                const kWh = +(Math.random() * 50 + 1).toFixed(1);
                const price = +(Math.random() * 0.03 + 0.065).toFixed(3);
                setMatches(p => [{
                    id: `M-${String(p.length + 1).padStart(4, "0")}`, seller: s.id, buyer: b.id, kWh, price, total: +(kWh * price).toFixed(2),
                    time: new Date().toLocaleTimeString(), status: Math.random() > 0.2 ? "SETTLED" : "PENDING",
                    tx: Math.random() > 0.2 ? `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}` : null,
                }, ...p].slice(0, 25));
            }
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const tabs = ["grid", "matching", "meters", "contracts", "analytics", "metrics"];
    const totalGen = MOCK_PROSUMERS.reduce((s, p) => s + p.generation, 0);
    const totalCons = MOCK_PROSUMERS.reduce((s, p) => s + p.consumption, 0);
    const totalSurplus = MOCK_PROSUMERS.reduce((s, p) => s + Math.max(0, p.surplus), 0);

    return (
        <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.mono, color: S.text, padding: 24 }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                    <span style={{ fontSize: 28 }}>&#9889;</span>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, color: S.accent }}>P2P Energy Agent</h1>
                        <p style={{ margin: 0, fontSize: 11, color: S.muted, letterSpacing: 2 }}>PEER-TO-PEER MICROGRID TRADING</p>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 11 }}>
                        <span style={{ color: S.accent2 }}>{totalGen.toFixed(1)} kW GENERATING</span>
                        <span style={{ color: S.accent }}>{totalSurplus.toFixed(1)} kW TRADEABLE</span>
                        <span style={{ color: "#FFD700" }}>{matches.filter(m => m.status === "SETTLED").length} SETTLED</span>
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

                {tab === "grid" && (
                    <div style={{ display: "grid", gridTemplateColumns: sel !== null ? "1fr 1fr" : "1fr", gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, letterSpacing: 2 }}>PROSUMER NETWORK</div>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                <thead><tr style={{ borderBottom: `1px solid ${S.border}`, color: S.muted }}>
                                    <th style={{ textAlign: "left", padding: 8 }}>ID</th><th>NAME</th><th>TYPE</th>
                                    <th>GEN kW</th><th>SURPLUS</th><th>STATUS</th>
                                </tr></thead>
                                <tbody>{MOCK_PROSUMERS.map((p, i) => (
                                    <tr key={i} onClick={() => setSel(i)} style={{
                                        borderBottom: `1px solid ${S.border}`, cursor: "pointer",
                                        background: sel === i ? "rgba(0,212,255,0.08)" : "transparent"
                                    }}>
                                        <td style={{ padding: 8, color: S.accent }}>{p.id}</td>
                                        <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                                        <td><span style={{ padding: "2px 6px", background: "rgba(0,212,255,0.12)", color: S.accent, borderRadius: 2, fontSize: 10 }}>{p.type}</span></td>
                                        <td style={{ textAlign: "right" }}>{p.generation.toFixed(1)}</td>
                                        <td style={{ textAlign: "right", color: p.surplus >= 0 ? S.accent2 : "#FFD700" }}>{p.surplus >= 0 ? "+" : ""}{p.surplus.toFixed(1)}</td>
                                        <td><span style={{ color: STATUS_COLORS[p.status], fontSize: 10 }}>{p.status}</span></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                        {sel !== null && (() => {
                            const p = MOCK_PROSUMERS[sel]; return (
                                <div style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 11, color: S.muted, letterSpacing: 2, marginBottom: 12 }}>PROSUMER DETAIL</div>
                                    <h3 style={{ margin: "0 0 8px", fontSize: 16, color: S.accent }}>{p.name}</h3>
                                    {[
                                        ["Type", p.type], ["Location", p.location], ["Grid Zone", p.gridZone],
                                        ["Capacity", `${p.capacity} kW`], ["Generation", `${p.generation} kW`],
                                        ["Consumption", `${p.consumption} kW`], ["Surplus", `${p.surplus >= 0 ? "+" : ""}${p.surplus} kW`],
                                        ["Offer Price", `EUR ${p.price}/kWh`], ["Smart Meter", p.meter], ["Wallet", p.wallet],
                                    ].map(([k, v], j) => (
                                        <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}`, fontSize: 11 }}>
                                            <span style={{ color: S.muted }}>{k}</span><span>{v}</span>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ fontSize: 10, color: S.muted, marginBottom: 4 }}>CAPACITY UTILIZATION</div>
                                        <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                                            <div style={{ width: `${p.capacity > 0 ? (p.generation / p.capacity * 100) : 0}%`, height: "100%", background: S.accent2 }} />
                                        </div>
                                        <div style={{ fontSize: 10, color: S.muted, textAlign: "right", marginTop: 2 }}>{p.capacity > 0 ? (p.generation / p.capacity * 100).toFixed(0) : 0}%</div>
                                    </div>
                                </div>);
                        })()}
                    </div>
                )}

                {tab === "matching" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                            {[
                                { label: "Total Matched", val: `${matches.length} trades`, color: S.accent },
                                { label: "Energy Traded", val: `${matches.reduce((s, m) => s + m.kWh, 0).toFixed(1)} kWh`, color: S.accent2 },
                                { label: "BEZ Volume", val: `${matches.reduce((s, m) => s + m.total, 0).toFixed(2)} BEZ`, color: "#FFD700" },
                                { label: "Avg Price", val: `EUR ${(matches.reduce((s, m) => s + m.price, 0) / matches.length).toFixed(3)}/kWh`, color: "#F97316" },
                            ].map((m, i) => (
                                <div key={i} style={{ padding: 14, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, textAlign: "center" }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 1, marginBottom: 4 }}>{m.label}</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.val}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead><tr style={{ borderBottom: `1px solid ${S.border}`, color: S.muted }}>
                                <th style={{ textAlign: "left", padding: 8 }}>TIME</th><th>SELLER</th><th>BUYER</th>
                                <th>kWh</th><th>PRICE</th><th>TOTAL</th><th>STATUS</th>
                            </tr></thead>
                            <tbody>{matches.map((m, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                                    <td style={{ padding: 8 }}>{m.time}</td>
                                    <td style={{ color: S.accent2 }}>{m.seller}</td>
                                    <td style={{ color: "#FFD700" }}>{m.buyer}</td>
                                    <td style={{ textAlign: "right" }}>{m.kWh}</td>
                                    <td style={{ textAlign: "right" }}>EUR {m.price}</td>
                                    <td style={{ textAlign: "right", fontWeight: 700 }}>{m.total} BEZ</td>
                                    <td><span style={{ color: STATUS_COLORS[m.status], fontSize: 10 }}>{m.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}

                {tab === "meters" && (
                    <div>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 12, letterSpacing: 2 }}>SMART METER IoT NETWORK</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                            {[
                                { label: "Connected Meters", val: MOCK_PROSUMERS.length, color: S.accent, icon: "📡" },
                                { label: "Grid Zones", val: [...new Set(MOCK_PROSUMERS.map(p => p.gridZone))].length, color: S.accent2, icon: "🗺️" },
                                { label: "Readings/min", val: "360", color: "#FFD700", icon: "📊" },
                            ].map((m, i) => (
                                <div key={i} style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, textAlign: "center" }}>
                                    <div style={{ fontSize: 24, marginBottom: 8 }}>{m.icon}</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.val}</div>
                                    <div style={{ fontSize: 10, color: S.muted, marginTop: 4 }}>{m.label}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, marginBottom: 16 }}>
                            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: S.accent }}>Meter Verification Flow</h3>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {["IoT Reading", "Sign w/ Meter Key", "Submit to Oracle", "On-Chain Verify", "Settlement Trigger"].map((s, i) => (
                                    <div key={i} style={{ flex: 1, minWidth: 110, padding: 10, background: "rgba(0,0,0,0.3)", border: `1px solid ${S.border}`, borderRadius: 4, textAlign: "center" }}>
                                        <div style={{ fontSize: 10, color: S.accent, marginBottom: 4 }}>STEP {i + 1}</div>
                                        <div style={{ fontSize: 10, color: S.text }}>{s}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {MOCK_PROSUMERS.map((p, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, marginBottom: 6 }}>
                                <span style={{ fontSize: 10, color: S.accent, fontWeight: 700, width: 70 }}>{p.meter}</span>
                                <span style={{ flex: 1, fontSize: 11 }}>{p.name}</span>
                                <span style={{ fontSize: 10, color: S.muted }}>{p.gridZone}</span>
                                <span style={{ fontSize: 11, color: p.generation > 0 ? S.accent2 : S.muted }}>{p.generation} kW</span>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.generation > 0 ? S.accent2 : S.muted }} />
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
                                { label: "Matching Fee", val: "0.5% per trade", desc: "Fee on each P2P energy match and settlement", color: S.accent },
                                { label: "Meter Registration", val: "0.1 BEZ/meter", desc: "One-time smart meter on-chain registration", color: S.accent2 },
                                { label: "Grid Zone License", val: "SaaS monthly", desc: "Communities and DSOs pay for grid zone management", color: "#FFD700" },
                                { label: "Settlement Gas", val: "0.01 BEZ/tx", desc: "Micro-fee for each automated settlement transaction", color: "#F97316" },
                                { label: "Data Analytics", val: "API B2B", desc: "Grid consumption patterns sold to utilities and DSOs", color: "#7C3AED" },
                                { label: "Prosumer Rewards", val: "BEZ staking", desc: "Prosumers earn BEZ rewards for surplus energy contributions", color: "#EC4899" },
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
                  📊 REAL-TIME AGENT METRICS — P2PENERGY
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/p2penergy/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="p2penergy" accentColor={S.accent} />
            </div>
          )}

            </div>
        </div>
    );
}
