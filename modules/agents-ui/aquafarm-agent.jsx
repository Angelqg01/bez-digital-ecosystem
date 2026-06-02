import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_TANKS = [
    { id: "TK-001", name: "Estanque Alpha", species: "Tilapia Nilótica", capacity: 15000, current: 12400, waterTemp: 28.3, ph: 7.2, dissolvedO2: 6.8, ammonia: 0.02, location: "Tabasco MX", status: "OPTIMAL" },
    { id: "TK-002", name: "Estanque Bravo", species: "Camarón Blanco", capacity: 8000, current: 6900, waterTemp: 26.1, ph: 7.8, dissolvedO2: 5.9, ammonia: 0.05, location: "Sinaloa MX", status: "OPTIMAL" },
    { id: "TK-003", name: "Hydro Bay 1", species: "Salmón Atlántico", capacity: 20000, current: 18200, waterTemp: 12.5, ph: 6.9, dissolvedO2: 8.1, ammonia: 0.01, location: "Bergen NO", status: "OPTIMAL" },
    { id: "TK-004", name: "Estanque Delta", species: "Trucha Arcoíris", capacity: 10000, current: 9100, waterTemp: 14.8, ph: 7.0, dissolvedO2: 7.4, ammonia: 0.03, location: "Patagonia AR", status: "WARNING" },
    { id: "TK-005", name: "Hydro Rack A", species: "Lechuga Hidropónica", capacity: 5000, current: 4800, waterTemp: 22.0, ph: 6.2, dissolvedO2: 5.5, ammonia: 0.00, location: "Querétaro MX", status: "OPTIMAL" },
    { id: "TK-006", name: "Shrimp Pod 3", species: "Langostino Azul", capacity: 6000, current: 2100, waterTemp: 25.7, ph: 8.1, dissolvedO2: 4.2, ammonia: 0.09, location: "Guayaquil EC", status: "ALERT" },
];

const MOCK_READINGS = [
    { time: "15:15:00", tank: "TK-001", ph: 7.2, temp: 28.3, o2: 6.8, ammonia: 0.02, alert: false },
    { time: "15:14:45", tank: "TK-006", ph: 8.1, temp: 25.7, o2: 4.2, ammonia: 0.09, alert: true },
    { time: "15:14:30", tank: "TK-003", ph: 6.9, temp: 12.5, o2: 8.1, ammonia: 0.01, alert: false },
    { time: "15:14:00", tank: "TK-004", ph: 7.0, temp: 14.8, o2: 7.4, ammonia: 0.03, alert: false },
];

const STATUS_COLORS = { OPTIMAL: "#00FF88", WARNING: "#FFD700", ALERT: "#EF4444", HARVESTED: "#3B82F6", MAINTENANCE: "#7C3AED" };

const CONTRACT_ABI = `// AquaFarmMonitor.sol  —  BeZhas Chain
// Aquaculture & hydroponics IoT monitoring

struct FarmTank {
  string   name;
  string   species;
  uint256  capacity;
  uint256  currentStock;
  address  operator;
  bool     active;
}

struct SensorReading {
  uint256  tankId;
  uint256  ph;              // scaled 1e2 (720 = 7.20)
  uint256  dissolvedO2;     // scaled 1e2 (680 = 6.80 mg/L)
  uint256  temperature;     // scaled 1e2 (2830 = 28.30°C)
  uint256  ammonia;         // scaled 1e4 (200 = 0.0200 mg/L)
  uint256  timestamp;
}

struct AlertThreshold {
  uint256  tankId;
  uint256  maxTemp;
  uint256  minO2;
  uint256  maxAmmonia;
  uint256  minPh;
  uint256  maxPh;
}

function registerTank(string name, string species, uint256 capacity) external returns (uint256);
function logReading(uint256 tankId, uint256 ph, uint256 o2, uint256 temp, uint256 ammonia) external;
function setThresholds(uint256 tankId, uint256 maxTemp, uint256 minO2, uint256 maxAmm, uint256 minPh, uint256 maxPh) external;
function harvestTank(uint256 tankId, uint256 quantity) external;`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#06B6D4", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function AquaFarmAgent() {
    const bridge = useAgentBridge('aquafarm');
    const [tab, setTab] = useState("tanks");
    const [sel, setSel] = useState(null);
    const [readings, setReadings] = useState(MOCK_READINGS);

    useEffect(() => {
        const iv = setInterval(() => {
            const tank = MOCK_TANKS[Math.floor(Math.random() * MOCK_TANKS.length)];
            const ph = (tank.ph + (Math.random() - 0.5) * 0.3).toFixed(2);
            const temp = (tank.waterTemp + (Math.random() - 0.5) * 1.5).toFixed(1);
            const o2 = (tank.dissolvedO2 + (Math.random() - 0.5) * 1.0).toFixed(1);
            const ammonia = (tank.ammonia + (Math.random() - 0.3) * 0.02).toFixed(3);
            const alert = parseFloat(ammonia) > 0.06 || parseFloat(o2) < 5.0;
            setReadings(p => [{ time: new Date().toLocaleTimeString(), tank: tank.id, ph, temp, o2, ammonia, alert }, ...p].slice(0, 40));
        }, 7000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "tanks", label: "🐟 Tanks" },
        { id: "sensors", label: "📡 Sensors" },
        { id: "pipeline", label: "🔄 Harvest Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const optimalCount = MOCK_TANKS.filter(t => t.status === "OPTIMAL").length;
    const alertCount = MOCK_TANKS.filter(t => t.status === "ALERT").length;
    const totalStock = MOCK_TANKS.reduce((s, t) => s + t.current, 0);

    const pctFill = (t) => Math.round(t.current / t.capacity * 100);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🐟</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>AquaFarm Agent — Aquaculture & Hydroponics IoT</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>Water quality monitoring · Sensor oracle · Harvest tracking</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#06B6D422", color: "#06B6D4", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "tanks" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Optimal", optimalCount, "#00FF88"], ["Alerts", alertCount, "#EF4444"], ["Total Stock", totalStock.toLocaleString(), S.accent]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Tank</th><th>Species</th><th>Fill</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_TANKS.map(t => (
                                <tr key={t.id} onClick={() => setSel(t)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === t.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent, fontSize: 11 }}>{t.id}</td>
                                    <td>{t.name}</td>
                                    <td style={{ fontSize: 12 }}>{t.species}</td>
                                    <td><div style={{ width: 60, height: 6, background: S.border, borderRadius: 3 }}>
                                        <div style={{ width: `${pctFill(t)}%`, height: "100%", background: pctFill(t) > 90 ? "#FFD700" : S.accent2, borderRadius: 3 }} />
                                    </div><span style={{ fontSize: 10, color: S.muted }}>{pctFill(t)}%</span></td>
                                    <td><span style={{ color: STATUS_COLORS[t.status], fontSize: 11 }}>● {t.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.name}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>{sel.species} · {sel.location}</div>
                            {[["Capacity", sel.capacity.toLocaleString()], ["Current Stock", sel.current.toLocaleString()], ["Water Temp", sel.waterTemp + "°C"], ["pH", sel.ph], ["Dissolved O₂", sel.dissolvedO2 + " mg/L"], ["Ammonia", sel.ammonia + " mg/L"]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: sel.status === "ALERT" ? "#EF444422" : S.accent + "22", padding: 8, borderRadius: 8, textAlign: "center", color: sel.status === "ALERT" ? "#EF4444" : S.accent, fontSize: 12 }}>
                                {sel.status === "ALERT" ? "⚠ AMMONIA ABOVE SAFE THRESHOLD" : sel.status === "WARNING" ? "⚡ MONITORING CLOSELY" : "✅ ALL PARAMETERS NOMINAL"}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "sensors" && (
                <div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        {[["Readings", readings.length, S.accent], ["Normal", readings.filter(r => !r.alert).length, "#00FF88"], ["Alerts", readings.filter(r => r.alert).length, "#EF4444"]].map(([l, v, c]) => (
                            <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                            </div>
                        ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Tank</th><th>pH</th><th>Temp</th><th>O₂</th><th>NH₃</th><th>Status</th>
                        </tr></thead>
                        <tbody>{readings.map((r, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11`, background: r.alert ? "#EF444411" : "transparent" }}>
                                <td style={{ padding: 6, color: S.muted }}>{r.time}</td>
                                <td style={{ color: S.accent }}>{r.tank}</td>
                                <td>{r.ph}</td>
                                <td>{r.temp}°C</td>
                                <td>{r.o2}</td>
                                <td style={{ color: parseFloat(r.ammonia) > 0.06 ? "#EF4444" : S.accent2 }}>{r.ammonia}</td>
                                <td>{r.alert ? <span style={{ color: "#EF4444" }}>⚠ ALERT</span> : <span style={{ color: "#00FF88" }}>OK</span>}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Aquaculture Harvest Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Stock Tank", "2. IoT Monitor", "3. Growth Cycle", "4. Harvest", "5. Process & Ship"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["🐟", "📡", "🌊", "🎣", "🚢"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    <h4 style={{ fontSize: 13, color: S.muted, marginBottom: 8 }}>Water Quality Summary</h4>
                    {MOCK_TANKS.map(tank => (
                        <div key={tank.id} style={{ background: S.card, border: `1px solid ${tank.status === "ALERT" ? "#EF4444" : S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontWeight: 600 }}>{tank.name} — {tank.species}</span>
                                <span style={{ color: STATUS_COLORS[tank.status], fontSize: 12, fontFamily: S.mono }}>● {tank.status}</span>
                            </div>
                            <div style={{ display: "flex", gap: 16, fontSize: 12, fontFamily: S.mono }}>
                                <span>pH: {tank.ph}</span>
                                <span>Temp: {tank.waterTemp}°C</span>
                                <span style={{ color: tank.dissolvedO2 < 5 ? "#EF4444" : S.accent2 }}>O₂: {tank.dissolvedO2}</span>
                                <span style={{ color: tank.ammonia > 0.06 ? "#EF4444" : S.accent2 }}>NH₃: {tank.ammonia}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>AquaFarmMonitor.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Tank Registration", "1.0 BEZ / tank", "+28 tanks/mo", "🐟"],
                        ["Sensor Oracle Feed", "0.05 BEZ / reading", "+120K readings/mo", "📡"],
                        ["Alert Response SLA", "0.2 BEZ / alert", "+450 alerts handled/mo", "⚠️"],
                        ["Harvest Certification", "2.0 BEZ / harvest", "+60 harvests/mo", "🎣"],
                        ["Hydroponics SaaS", "$399/mo per farm", "22 farms subscribed", "🌱"],
                        ["Water Quality API", "0.02 BEZ / query", "+50K queries/mo", "💧"],
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — AQUAFARM</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="aquafarm" accentColor="#06B6D4" />
                </div>
            )}
        </div>
    );
}
