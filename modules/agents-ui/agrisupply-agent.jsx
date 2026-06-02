import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_PRODUCTS = [
    { id: "AGR-001", product: "Aguacate Hass Orgánico", farm: "Finca Los Pinos", origin: "Michoacán MX", batch: "BATCH-AVO-4401", certifications: ["USDA Organic", "GlobalGAP"], weight: 12000, unit: "kg", harvestDate: "2026-03-10", destination: "Los Angeles CA", status: "IN_TRANSIT", gps: "19.43°N, 102.06°W" },
    { id: "AGR-002", product: "Café Arábica Specialty", farm: "Finca Altura", origin: "Chiapas MX", batch: "BATCH-CAF-2205", certifications: ["Fair Trade", "Rainforest Alliance"], weight: 3200, unit: "kg", harvestDate: "2026-02-15", destination: "Seattle WA", status: "DELIVERED", gps: "15.50°N, 92.64°W" },
    { id: "AGR-003", product: "Mango Ataulfo", farm: "Rancho Tropical", origin: "Nayarit MX", batch: "BATCH-MNG-7802", certifications: ["GlobalGAP"], weight: 8500, unit: "kg", harvestDate: "2026-03-05", destination: "Tokyo JP", status: "CUSTOMS" },
    { id: "AGR-004", product: "Quinoa Real Orgánica", farm: "Cooperativa Altiplano", origin: "Oruro BO", batch: "BATCH-QUI-1103", certifications: ["EU Organic", "Fair Trade"], weight: 5000, unit: "kg", harvestDate: "2026-01-20", destination: "Berlin DE", status: "IN_TRANSIT", gps: "18.01°S, 67.12°W" },
    { id: "AGR-005", product: "Pistacho Kerman", farm: "Desert Gold Farms", origin: "Kerman CA", batch: "BATCH-PIS-6604", certifications: ["USDA Organic"], weight: 2200, unit: "kg", harvestDate: "2026-02-28", destination: "London UK", status: "PROCESSING" },
    { id: "AGR-006", product: "Vainilla Bourbon", farm: "Finca Papantla", origin: "Veracruz MX", batch: "BATCH-VAN-9905", certifications: ["Fair Trade", "Organic MX"], weight: 180, unit: "kg", harvestDate: "2026-03-12", destination: "Paris FR", status: "PACKAGED" },
];

const MOCK_EVENTS = [
    { time: "15:10:02", product: "AGR-001", event: "GPS_UPDATE", detail: "Container MSKU-7234 — 27.12°N, 109.94°W — Temp: 4.2°C" },
    { time: "14:55:20", product: "AGR-003", event: "CUSTOMS_SCAN", detail: "Phytosanitary cert verified — Narita Port JP" },
    { time: "14:32:11", product: "AGR-002", event: "DELIVERED", detail: "Received at Starbucks Reserve Roastery — Quality Score: 92/100" },
    { time: "14:10:45", product: "AGR-006", event: "PACKED", detail: "Vacuum-sealed 180kg in 0.5kg pods — Cold chain verified" },
];

const STATUS_COLORS = { PROCESSING: "#7C3AED", PACKAGED: "#3B82F6", IN_TRANSIT: "#FFD700", CUSTOMS: "#F97316", DELIVERED: "#00FF88", RECALLED: "#EF4444" };
const EVENT_COLORS = { GPS_UPDATE: "#3B82F6", CUSTOMS_SCAN: "#F97316", DELIVERED: "#00FF88", PACKED: "#7C3AED", TEMP_ALERT: "#EF4444", QUALITY_CHECK: "#FFD700" };

const CONTRACT_ABI = `// AgriSupplyChain.sol  —  BeZhas Chain
// Farm-to-table traceability with GPS proofs & certifications

struct Product {
  string   name;
  string   origin;
  string   batchId;
  address  farmer;
  uint256  weight;            // in grams
  uint256  harvestDate;
  bool     delivered;
}

struct CheckpointLog {
  uint256  productId;
  string   location;
  uint256  temperature;       // scaled 1e2 (e.g. 420 = 4.20°C)
  bytes32  gpsProof;
  uint256  timestamp;
}

struct Certification {
  uint256  productId;
  string   certName;
  address  certifier;
  uint256  issuedAt;
  bool     valid;
}

function registerProduct(
  string name, string origin, string batchId, uint256 weight, uint256 harvestDate
) external returns (uint256 productId);

function addCheckpoint(uint256 productId, string location, uint256 temp, bytes32 gpsProof) external;
function addCertification(uint256 productId, string certName) external;
function markDelivered(uint256 productId) external;`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#10B981", accent2: "#FFD700", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function AgriSupplyAgent() {
    const bridge = useAgentBridge('agrisupply');
    const [tab, setTab] = useState("products");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState(MOCK_EVENTS);

    useEffect(() => {
        const iv = setInterval(() => {
            const prod = MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)];
            const evts = ["GPS_UPDATE", "TEMP_ALERT", "QUALITY_CHECK", "CUSTOMS_SCAN"];
            const evt = evts[Math.floor(Math.random() * evts.length)];
            setEvents(p => [{
                time: new Date().toLocaleTimeString(), product: prod.id, event: evt,
                detail: evt === "GPS_UPDATE" ? `Container at ${prod.gps || "In warehouse"} — Temp: ${(Math.random() * 6 + 2).toFixed(1)}°C` : evt === "TEMP_ALERT" ? `Temperature spike: ${(Math.random() * 5 + 8).toFixed(1)}°C (max 7°C)` : `${prod.product} batch ${prod.batch} — checkpoint OK`
            }, ...p].slice(0, 30));
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "products", label: "🥑 Products" },
        { id: "tracking", label: "📡 Tracking" },
        { id: "pipeline", label: "🔄 Supply Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const inTransit = MOCK_PRODUCTS.filter(p => p.status === "IN_TRANSIT").length;
    const delivered = MOCK_PRODUCTS.filter(p => p.status === "DELIVERED").length;
    const totalWeight = MOCK_PRODUCTS.reduce((s, p) => s + p.weight, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🥑</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>AgriSupply Agent — Farm-to-Table Traceability</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>GPS-tracked supply chain · Cold chain IoT · Certification registry</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#10B98122", color: "#10B981", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● ACTIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "products" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["In Transit", inTransit, "#FFD700"], ["Delivered", delivered, "#00FF88"], ["Total Kg", totalWeight.toLocaleString(), S.accent]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Product</th><th>Origin</th><th>Destination</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_PRODUCTS.map(p => (
                                <tr key={p.id} onClick={() => setSel(p)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === p.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent2, fontSize: 11 }}>{p.id}</td>
                                    <td>{p.product}</td>
                                    <td style={{ fontSize: 12 }}>{p.origin}</td>
                                    <td style={{ fontSize: 12 }}>{p.destination}</td>
                                    <td><span style={{ color: STATUS_COLORS[p.status], fontSize: 11 }}>● {p.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.product}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>Farm: {sel.farm} · Batch: {sel.batch}</div>
                            {[["Origin", sel.origin], ["Destination", sel.destination], ["Weight", sel.weight.toLocaleString() + " " + sel.unit], ["Harvest", sel.harvestDate], ["Certifications", sel.certifications.join(", ")]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12, maxWidth: 180, textAlign: "right" }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 10 }}>
                                {sel.certifications.map(c => (
                                    <span key={c} style={{ display: "inline-block", background: S.accent + "22", color: S.accent, padding: "2px 8px", borderRadius: 6, fontSize: 11, marginRight: 4, marginBottom: 4 }}>{c}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "tracking" && (
                <div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        {[["Events", events.length, S.accent], ["GPS Updates", events.filter(e => e.event === "GPS_UPDATE").length, "#3B82F6"], ["Alerts", events.filter(e => e.event === "TEMP_ALERT").length, "#EF4444"]].map(([l, v, c]) => (
                            <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                            </div>
                        ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Product</th><th>Event</th><th>Detail</th>
                        </tr></thead>
                        <tbody>{events.map((e, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                                <td style={{ color: S.accent2 }}>{e.product}</td>
                                <td><span style={{ color: EVENT_COLORS[e.event] || S.text, fontSize: 11 }}>{e.event}</span></td>
                                <td style={{ color: S.text, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.detail}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Farm-to-Table Supply Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Harvest", "2. Process & Pack", "3. Ship & Track", "4. Customs", "5. Deliver"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["🌾", "📦", "🚢", "🛃", "✅"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    <h4 style={{ fontSize: 13, color: S.muted, marginBottom: 8 }}>Products by Status</h4>
                    {["PROCESSING", "PACKAGED", "IN_TRANSIT", "CUSTOMS", "DELIVERED"].map(status => {
                        const items = MOCK_PRODUCTS.filter(p => p.status === status);
                        if (!items.length) return null;
                        return (
                            <div key={status} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: STATUS_COLORS[status] }}>● {status} ({items.length})</div>
                                {items.map(p => (
                                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span>{p.product} — {p.origin}</span>
                                        <span style={{ fontFamily: S.mono, color: S.muted }}>{p.weight.toLocaleString()} kg → {p.destination}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>AgriSupplyChain.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Product Registration", "0.5 BEZ / product", "+120 products/mo", "🥑"],
                        ["GPS Checkpoint Logging", "0.1 BEZ / checkpoint", "+8K checkpoints/mo", "📡"],
                        ["Certification Issuance", "1.0 BEZ / cert", "+45 certs/mo", "📜"],
                        ["Cold Chain SaaS", "$599/mo per exporter", "15 exporters subscribed", "❄️"],
                        ["Traceability QR API", "0.05 BEZ / scan", "+25K scans/mo", "📱"],
                        ["Premium Farm Analytics", "$199/mo", "42 farms subscribed", "📊"],
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — AGRISUPPLY</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="agrisupply" accentColor="#10B981" />
                </div>
            )}
        </div>
    );
}
