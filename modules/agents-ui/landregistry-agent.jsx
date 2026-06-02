import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_PARCELS = [
    { id: "LAND-001", title: "Rancho San Felipe", area: 245, unit: "hectáreas", location: "Jalisco MX", gps: "20.66°N, 103.35°W", soilType: "Vertisol", owner: "José García R.", tokenId: "#4401", value: 12500000, currency: "MXN", status: "REGISTERED", crops: ["Agave Azul", "Maíz"], certDate: "2025-08-15" },
    { id: "LAND-002", title: "Finca La Esperanza", area: 80, unit: "hectáreas", location: "Chiapas MX", gps: "15.50°N, 92.64°W", soilType: "Andosol", owner: "María López V.", tokenId: "#4402", value: 4200000, currency: "MXN", status: "REGISTERED", crops: ["Café", "Cacao"], certDate: "2025-09-01" },
    { id: "LAND-003", title: "Parcela Río Dulce", area: 320, unit: "hectáreas", location: "Córdoba AR", gps: "31.42°S, 64.18°W", soilType: "Molisol", owner: "Coop. Pampa Nueva", tokenId: "#4403", value: 85000, currency: "USD", status: "REGISTERED", crops: ["Soja", "Trigo"], certDate: "2025-07-20" },
    { id: "LAND-004", title: "Terreno Costa Esmeralda", area: 15, unit: "hectáreas", location: "Veracruz MX", gps: "19.52°N, 96.38°W", soilType: "Luvisol", owner: "Inmobiliaria Costera SA", tokenId: "#4404", value: 22000000, currency: "MXN", status: "PENDING", crops: ["Vainilla"], certDate: null },
    { id: "LAND-005", title: "Niigata Rice Fields", area: 55, unit: "hectáreas", location: "Niigata JP", gps: "37.90°N, 139.02°E", soilType: "Fluvisol", owner: "Tanaka Agricultural Co.", tokenId: "#4405", value: 280000000, currency: "JPY", status: "REGISTERED", crops: ["Arroz Koshihikari"], certDate: "2025-10-10" },
    { id: "LAND-006", title: "Viñedo Valle de Guadalupe", area: 42, unit: "hectáreas", location: "Baja California MX", gps: "32.08°N, 116.62°W", soilType: "Aridisol", owner: "Bodegas Valle DO", tokenId: "#4406", value: 35000000, currency: "MXN", status: "DISPUTE", crops: ["Cabernet Sauvignon", "Nebbiolo"], certDate: "2025-06-01" },
];

const MOCK_SOIL_LOGS = [
    { time: "2026-03-14", parcel: "LAND-001", nitrogen: 42, phosphorus: 18, potassium: 155, organicMatter: 3.8, moisture: 28 },
    { time: "2026-03-14", parcel: "LAND-003", nitrogen: 55, phosphorus: 24, potassium: 180, organicMatter: 5.2, moisture: 34 },
    { time: "2026-03-13", parcel: "LAND-005", nitrogen: 38, phosphorus: 15, potassium: 140, organicMatter: 4.1, moisture: 45 },
    { time: "2026-03-12", parcel: "LAND-002", nitrogen: 48, phosphorus: 22, potassium: 165, organicMatter: 6.0, moisture: 38 },
];

const STATUS_COLORS = { REGISTERED: "#00FF88", PENDING: "#FFD700", DISPUTE: "#EF4444", TRANSFERRED: "#3B82F6", FRACTIONALIZED: "#7C3AED" };

const CONTRACT_ABI = `// LandTitleNFT.sol  —  BeZhas Chain
// ERC-721 land title registry with soil data

struct LandParcel {
  string   title;
  string   location;
  uint256  area;             // in m² (1 hectárea = 10000 m²)
  string   soilType;
  address  owner;
  bytes32  gpsBounds;
  uint256  registeredAt;
  bool     active;
}

struct SoilDataLog {
  uint256  parcelId;
  uint256  nitrogen;         // mg/kg
  uint256  phosphorus;       // mg/kg
  uint256  potassium;        // mg/kg
  uint256  organicMatter;    // scaled 1e2 (380 = 3.80%)
  uint256  moisture;         // percentage
  uint256  timestamp;
}

function mintTitle(
  string title, string location, uint256 area, string soilType, bytes32 gpsBounds
) external returns (uint256 tokenId);

function updateSoilData(uint256 tokenId, uint256 n, uint256 p, uint256 k, uint256 om, uint256 moisture) external;
function transferTitle(uint256 tokenId, address newOwner) external;
function fractionalizeTitle(uint256 tokenId, uint256 fractions) external;`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#A78BFA", accent2: "#FFD700", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function LandRegistryAgent() {
    const bridge = useAgentBridge('landregistry');
    const [tab, setTab] = useState("parcels");
    const [sel, setSel] = useState(null);
    const [soilLogs, setSoilLogs] = useState(MOCK_SOIL_LOGS);

    useEffect(() => {
        const iv = setInterval(() => {
            const parcel = MOCK_PARCELS[Math.floor(Math.random() * MOCK_PARCELS.length)];
            setSoilLogs(p => [{
                time: new Date().toISOString().split("T")[0],
                parcel: parcel.id,
                nitrogen: Math.round(30 + Math.random() * 30),
                phosphorus: Math.round(10 + Math.random() * 20),
                potassium: Math.round(120 + Math.random() * 80),
                organicMatter: parseFloat((2.5 + Math.random() * 4).toFixed(1)),
                moisture: Math.round(20 + Math.random() * 30),
            }, ...p].slice(0, 30));
        }, 10000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "parcels", label: "🏞️ Parcels" },
        { id: "soil", label: "🧪 Soil Data" },
        { id: "pipeline", label: "🔄 Registry Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const registered = MOCK_PARCELS.filter(p => p.status === "REGISTERED").length;
    const totalArea = MOCK_PARCELS.reduce((s, p) => s + p.area, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🏞️</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>LandRegistry Agent — Tokenized Land Titles & Soil NFTs</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>ERC-721 parcels · Soil data oracle · Fractionalized ownership</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#A78BFA22", color: "#A78BFA", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● ACTIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "parcels" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Registered", registered, "#00FF88"], ["Total Parcels", MOCK_PARCELS.length, S.accent], ["Total Area", totalArea + " ha", S.accent2]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>Token</th><th>Title</th><th>Area</th><th>Location</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_PARCELS.map(p => (
                                <tr key={p.id} onClick={() => setSel(p)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === p.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent2, fontSize: 11 }}>{p.tokenId}</td>
                                    <td>{p.title}</td>
                                    <td style={{ fontFamily: S.mono, fontSize: 12 }}>{p.area} {p.unit}</td>
                                    <td style={{ fontSize: 12 }}>{p.location}</td>
                                    <td><span style={{ color: STATUS_COLORS[p.status], fontSize: 11 }}>● {p.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.title}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>Owner: {sel.owner} · Token {sel.tokenId}</div>
                            {[["Location", sel.location], ["GPS", sel.gps], ["Area", sel.area + " " + sel.unit], ["Soil Type", sel.soilType], ["Value", sel.value.toLocaleString() + " " + sel.currency], ["Crops", sel.crops.join(", ")], ["Cert Date", sel.certDate || "Pending"]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12, maxWidth: 180, textAlign: "right" }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 10 }}>
                                {sel.crops.map(c => (
                                    <span key={c} style={{ display: "inline-block", background: S.accent + "22", color: S.accent, padding: "2px 8px", borderRadius: 6, fontSize: 11, marginRight: 4 }}>{c}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "soil" && (
                <div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        {[["Soil Logs", soilLogs.length, S.accent], ["Avg Nitrogen", Math.round(soilLogs.reduce((s, l) => s + l.nitrogen, 0) / soilLogs.length) + " mg/kg", "#00FF88"], ["Avg Moisture", Math.round(soilLogs.reduce((s, l) => s + l.moisture, 0) / soilLogs.length) + "%", "#3B82F6"]].map(([l, v, c]) => (
                            <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                            </div>
                        ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Date</th><th>Parcel</th><th>N</th><th>P</th><th>K</th><th>Org%</th><th>Moisture</th>
                        </tr></thead>
                        <tbody>{soilLogs.map((l, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{l.time}</td>
                                <td style={{ color: S.accent }}>{l.parcel}</td>
                                <td>{l.nitrogen}</td>
                                <td>{l.phosphorus}</td>
                                <td>{l.potassium}</td>
                                <td>{l.organicMatter}%</td>
                                <td>{l.moisture}%</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Land Registry Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Survey & GPS", "2. Soil Analysis", "3. Mint NFT", "4. Register Title", "5. Fractionalize"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📐", "🧪", "🪙", "📜", "🧩"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    <h4 style={{ fontSize: 13, color: S.muted, marginBottom: 8 }}>Parcels by Status</h4>
                    {["REGISTERED", "PENDING", "DISPUTE", "TRANSFERRED", "FRACTIONALIZED"].map(status => {
                        const items = MOCK_PARCELS.filter(p => p.status === status);
                        if (!items.length) return null;
                        return (
                            <div key={status} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: STATUS_COLORS[status] }}>● {status} ({items.length})</div>
                                {items.map(p => (
                                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span>{p.title} — {p.location}</span>
                                        <span style={{ fontFamily: S.mono, color: S.muted }}>{p.area} ha · {p.value.toLocaleString()} {p.currency}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>LandTitleNFT.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Title Minting", "2.0 BEZ / title", "+35 titles/mo", "🪙"],
                        ["Soil Data Logging", "0.3 BEZ / log", "+500 logs/mo", "🧪"],
                        ["Fractionalization", "5.0 BEZ / split", "+12 fractionalizations/mo", "🧩"],
                        ["Title Transfer", "1.5 BEZ / transfer", "+25 transfers/mo", "📜"],
                        ["Registry SaaS", "$799/mo per municipality", "8 municipalities", "🏛️"],
                        ["Land Valuation API", "0.1 BEZ / query", "+15K queries/mo", "💰"],
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — LANDREGISTRY</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="landregistry" accentColor="#A78BFA" />
                </div>
            )}
        </div>
    );
}
