import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_CROPS = [
    { id: "CRP-2026-001", crop: "Maíz Amarillo", variety: "Pioneer P3015", farm: "Rancho El Sol", region: "Sinaloa MX", hectares: 480, estYield: 12.5, unit: "ton/ha", harvestDate: "2026-06-15", price: 245, futureId: "FUT-MAZ-Q2", status: "GROWING" },
    { id: "CRP-2026-002", crop: "Trigo Harinero", variety: "Borlaug 100", farm: "Hacienda del Valle", region: "Sonora MX", hectares: 320, estYield: 6.8, unit: "ton/ha", harvestDate: "2026-05-01", price: 310, futureId: "FUT-TRI-Q2", status: "HARVESTING" },
    { id: "CRP-2026-003", crop: "Aguacate Hass", variety: "Mendez Clone", farm: "Finca Los Pinos", region: "Michoacán MX", hectares: 85, estYield: 10.2, unit: "ton/ha", harvestDate: "2026-08-20", price: 2800, futureId: "FUT-AGU-Q3", status: "GROWING" },
    { id: "CRP-2026-004", crop: "Café Arábica", variety: "SL-28 Washed", farm: "Finca Altura", region: "Chiapas MX", hectares: 42, estYield: 1.8, unit: "ton/ha", harvestDate: "2026-11-01", price: 5200, futureId: "FUT-CAF-Q4", status: "FLOWERING" },
    { id: "CRP-2026-005", crop: "Soja Non-GMO", variety: "Don Mario 5958", farm: "Estancia Pampa", region: "Córdoba AR", hectares: 1200, estYield: 3.4, unit: "ton/ha", harvestDate: "2026-04-10", price: 420, futureId: "FUT-SOJ-Q2", status: "MATURE" },
    { id: "CRP-2026-006", crop: "Arroz Japónica", variety: "Koshihikari", farm: "Tanaka Farms", region: "Niigata JP", hectares: 65, estYield: 5.5, unit: "ton/ha", harvestDate: "2026-09-20", price: 890, futureId: "FUT-ARR-Q3", status: "PLANTING" },
];

const MOCK_TRADES = [
    { time: "15:02:11", future: "FUT-MAZ-Q2", action: "BUY", qty: "50 tons", price: "$245/ton", buyer: "ADM Global", tx: "0x8a1f...b4c2" },
    { time: "14:48:30", future: "FUT-SOJ-Q2", action: "SELL", qty: "200 tons", price: "$420/ton", buyer: "Cargill SA", tx: "0x3d7e...a891" },
    { time: "14:25:05", future: "FUT-AGU-Q3", action: "BUY", qty: "10 tons", price: "$2,800/ton", buyer: "Mission Produce", tx: "0xc5b2...f103" },
    { time: "13:50:20", future: "FUT-CAF-Q4", action: "SETTLE", qty: "5 tons", price: "$5,200/ton", buyer: "Starbucks Corp", tx: "0x91a4...d7e8" },
];

const STATUS_COLORS = { PLANTING: "#3B82F6", GROWING: "#00FF88", FLOWERING: "#EC4899", MATURE: "#FFD700", HARVESTING: "#F97316", STORED: "#7C3AED" };
const ACTION_COLORS = { BUY: "#00FF88", SELL: "#EF4444", SETTLE: "#FFD700", HEDGE: "#7C3AED" };

const CONTRACT_ABI = `// CropTokenFutures.sol  —  BeZhas Chain
// Tokenized crop futures with harvest oracle certification

struct CropFuture {
  string   cropName;
  string   variety;
  address  farmer;
  uint256  hectares;
  uint256  estimatedYield;    // scaled 1e2 (ton/ha)
  uint256  pricePerTon;       // in BEZ wei
  uint256  harvestDate;
  bool     certified;
  bool     settled;
}

struct HarvestCertificate {
  uint256  futureId;
  uint256  actualYield;
  uint256  qualityScore;      // 0-100
  bytes32  inspectionProof;
  uint256  certifiedAt;
}

function createFuture(
  string cropName, string variety, uint256 hectares, uint256 estYield, uint256 price, uint256 harvestDate
) external returns (uint256 futureId);

function certifyHarvest(uint256 futureId, uint256 actualYield, uint256 quality, bytes32 proof) external;
function buyFuture(uint256 futureId) external payable;
function settleFuture(uint256 futureId) external;`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#00FF88", accent2: "#FFD700", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function CropTokenAgent() {
    const bridge = useAgentBridge('croptoken');
    const [tab, setTab] = useState("crops");
    const [sel, setSel] = useState(null);
    const [trades, setTrades] = useState(MOCK_TRADES);

    useEffect(() => {
        const iv = setInterval(() => {
            const crop = MOCK_CROPS[Math.floor(Math.random() * MOCK_CROPS.length)];
            const actions = ["BUY", "SELL", "HEDGE"];
            const action = actions[Math.floor(Math.random() * actions.length)];
            const qty = Math.floor(Math.random() * 100) + 5;
            setTrades(p => [{
                time: new Date().toLocaleTimeString(), future: crop.futureId, action,
                qty: `${qty} tons`, price: `$${crop.price}/ton`, buyer: ["ADM Global", "Cargill SA", "Bunge Ltd", "Louis Dreyfus"][Math.floor(Math.random() * 4)],
                tx: "0x" + Math.random().toString(16).slice(2, 6) + "..." + Math.random().toString(16).slice(2, 6)
            }, ...p].slice(0, 30));
        }, 9000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "crops", label: "🌽 Crop Futures" },
        { id: "trades", label: "📈 Trades" },
        { id: "harvest", label: "🌾 Harvest Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const totalHectares = MOCK_CROPS.reduce((s, c) => s + c.hectares, 0);
    const totalValue = MOCK_CROPS.reduce((s, c) => s + c.hectares * c.estYield * c.price, 0);
    const activeCount = MOCK_CROPS.filter(c => c.status === "GROWING" || c.status === "FLOWERING").length;

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🌽</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>CropToken Agent — Tokenized Crop Futures</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>Crop futures on-chain · Harvest oracle · Commodity settlements</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#00FF8822", color: "#00FF88", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● ACTIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "crops" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Hectares", totalHectares.toLocaleString(), S.accent], ["Est. Value", "$" + Math.round(totalValue / 1e6) + "M", S.accent2], ["Active", activeCount, "#3B82F6"]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>Future</th><th>Crop</th><th>Region</th><th>Ha</th><th>Price</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_CROPS.map(c => (
                                <tr key={c.id} onClick={() => setSel(c)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === c.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent2, fontSize: 11 }}>{c.futureId}</td>
                                    <td>{c.crop}</td>
                                    <td style={{ fontSize: 12 }}>{c.region}</td>
                                    <td style={{ fontFamily: S.mono }}>{c.hectares}</td>
                                    <td style={{ fontFamily: S.mono, color: S.accent }}>${c.price}</td>
                                    <td><span style={{ color: STATUS_COLORS[c.status], fontSize: 11 }}>● {c.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>🌾 {sel.crop}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>Variety: {sel.variety} · Farm: {sel.farm}</div>
                            {[["Future ID", sel.futureId], ["Hectares", sel.hectares], ["Est. Yield", sel.estYield + " " + sel.unit], ["Price/ton", "$" + sel.price], ["Harvest", sel.harvestDate], ["Est. Revenue", "$" + Math.round(sel.hectares * sel.estYield * sel.price).toLocaleString()]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: S.bg, borderRadius: 8, padding: 10 }}>
                                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>Growth Progress</div>
                                <div style={{ background: "#0D2040", borderRadius: 6, height: 16, overflow: "hidden" }}>
                                    <div style={{ width: ({ PLANTING: 15, GROWING: 45, FLOWERING: 65, MATURE: 85, HARVESTING: 95, STORED: 100 }[sel.status] || 0) + "%", height: "100%", borderRadius: 6, background: STATUS_COLORS[sel.status] }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "trades" && (
                <div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        {[["Trades", trades.length, S.accent], ["Buys", trades.filter(t => t.action === "BUY").length, "#00FF88"], ["Sells", trades.filter(t => t.action === "SELL").length, "#EF4444"]].map(([l, v, c]) => (
                            <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                            </div>
                        ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Future</th><th>Action</th><th>Qty</th><th>Price</th><th>Buyer</th><th>Tx</th>
                        </tr></thead>
                        <tbody>{trades.map((t, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{t.time}</td>
                                <td style={{ color: S.accent2 }}>{t.future}</td>
                                <td><span style={{ color: ACTION_COLORS[t.action] || S.text }}>{t.action}</span></td>
                                <td>{t.qty}</td>
                                <td style={{ color: S.accent }}>{t.price}</td>
                                <td>{t.buyer}</td>
                                <td style={{ color: S.muted }}>{t.tx}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "harvest" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Harvest Certification Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Plant & Register", "2. IoT Monitor", "3. Harvest", "4. Oracle Certify", "5. Settle Futures"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["🌱", "📡", "🌾", "✅", "💰"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    <h4 style={{ fontSize: 13, color: S.muted, marginBottom: 8 }}>Upcoming Harvests</h4>
                    {MOCK_CROPS.sort((a, b) => new Date(a.harvestDate) - new Date(b.harvestDate)).map(c => (
                        <div key={c.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontWeight: 600 }}>🌾 {c.crop} — {c.farm}</span>
                                <span style={{ color: STATUS_COLORS[c.status], fontFamily: S.mono, fontSize: 12 }}>{c.status}</span>
                            </div>
                            <div style={{ fontSize: 11, color: S.muted }}>Harvest: {c.harvestDate} · {c.hectares} ha · Est: {c.estYield} {c.unit}</div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>CropTokenFutures.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Future Creation", "1.0 BEZ / future", "+85 futures/mo", "🌽"],
                        ["Harvest Certification", "2.0 BEZ / cert", "+40 certs/mo", "🌾"],
                        ["Future Trading", "0.3% per trade", "+$2.4M volume/mo", "📈"],
                        ["Settlement Engine", "0.5% per settle", "+$1.8M settled/mo", "💰"],
                        ["Farm Analytics SaaS", "$299/mo per farm", "28 farms subscribed", "📊"],
                        ["Commodity Oracle Feed", "$499/mo enterprise", "12 traders connected", "📡"],
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
            {tab === "metrics" && (
                <div>
                    <div style={{ background: S.card, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — CROPTOKEN</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="croptoken" accentColor="#00FF88" />
                </div>
            )}
        </div>
    );
}
