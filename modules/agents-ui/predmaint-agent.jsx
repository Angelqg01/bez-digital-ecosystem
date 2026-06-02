import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_EQUIPMENT = [
    { id: "EQ-001", name: "CNC Lathe HL-500", serial: "HAAS-500-A1", plant: "Monterrey MX", sensor: "IoT-001", rul: 2450, nextMaint: "2026-04-12", lastMaint: "2026-01-15", temp: 42, vibration: 0.12, hours: 8200, status: "HEALTHY" },
    { id: "EQ-002", name: "Hydraulic Press HP-300", serial: "SCHULER-300-B7", plant: "Querétaro MX", sensor: "IoT-002", rul: 380, nextMaint: "2026-03-22", lastMaint: "2025-12-20", temp: 68, vibration: 0.95, hours: 15400, status: "WARNING" },
    { id: "EQ-003", name: "Robot Welder AW-200", serial: "ABB-IRB-C3", plant: "Stuttgart DE", sensor: "IoT-003", rul: 5200, nextMaint: "2026-07-01", lastMaint: "2026-02-28", temp: 35, vibration: 0.05, hours: 3100, status: "HEALTHY" },
    { id: "EQ-004", name: "Conveyor Belt CB-50", serial: "INTRALOX-50-D9", plant: "Austin TX", sensor: "IoT-004", rul: 120, nextMaint: "2026-03-18", lastMaint: "2025-09-10", temp: 55, vibration: 1.80, hours: 22000, status: "CRITICAL" },
    { id: "EQ-005", name: "Injection Mold IM-200T", serial: "ENGL-200T-E5", plant: "Guadalajara MX", sensor: "IoT-005", rul: 1800, nextMaint: "2026-05-15", lastMaint: "2026-01-30", temp: 185, vibration: 0.34, hours: 6700, status: "HEALTHY" },
    { id: "EQ-006", name: "Compressor AC-150", serial: "ATLAS-150-F2", plant: "Monterrey MX", sensor: "IoT-006", rul: 60, nextMaint: "2026-03-17", lastMaint: "2025-06-01", temp: 92, vibration: 2.40, hours: 28500, status: "CRITICAL" },
];

const MOCK_ALERTS = [
    { time: "15:02:11", equipment: "EQ-006", severity: "CRITICAL", message: "Vibration 2.40mm/s exceeds 1.5 limit — immediate shutdown recommended", prediction: "Bearing failure in ~60 hours" },
    { time: "14:48:30", equipment: "EQ-004", severity: "CRITICAL", message: "Belt tension anomaly — thermal signature +12°C above baseline", prediction: "Belt snap in ~120 hours" },
    { time: "14:25:05", equipment: "EQ-002", severity: "WARNING", message: "Hydraulic pressure oscillation detected — seal wear suspected", prediction: "Seal failure in ~380 hours" },
    { time: "13:50:20", equipment: "EQ-001", severity: "INFO", message: "Routine telemetry nominal — all thresholds within range", prediction: "Next maintenance in 2,450 hours" },
];

const STATUS_COLORS = { HEALTHY: "#00FF88", WARNING: "#FFD700", CRITICAL: "#EF4444", MAINTENANCE: "#F97316", OFFLINE: "#3D5E80" };
const SEVERITY_COLORS = { CRITICAL: "#EF4444", WARNING: "#FFD700", INFO: "#3B82F6" };

const CONTRACT_ABI = `// PredictiveMaintenanceLog.sol  —  BeZhas Chain
// IoT sensor logging with threshold alerts & RUL predictions

struct Equipment {
  string   serialNumber;
  string   name;
  address  owner;
  uint256  registeredAt;
  bool     active;
  uint256  totalOperatingHours;
}

struct SensorReading {
  uint256  equipmentId;
  uint256  temperature;       // scaled 1e2
  uint256  vibration;         // scaled 1e4
  uint256  pressure;          // scaled 1e2
  uint256  timestamp;
  bytes32  sensorProof;
  bool     alertTriggered;
}

struct MaintenanceRecord {
  uint256  equipmentId;
  string   description;
  uint256  cost;              // in BEZ wei
  uint256  performedAt;
  address  technician;
  bytes32  evidenceHash;
}

function registerEquipment(
  string serialNumber, string name
) external returns (uint256 equipmentId);

function logSensorReading(
  uint256 equipmentId, uint256 temp, uint256 vibration, uint256 pressure, bytes32 proof
) external returns (bool alertTriggered);

function setThresholds(uint256 equipmentId, uint256 maxTemp, uint256 maxVibration, uint256 maxPressure) external;
function recordMaintenance(uint256 equipmentId, string description, uint256 cost, bytes32 evidence) external;
function getEquipmentHealth(uint256 equipmentId) external view returns (uint256 score);`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#EF4444", accent2: "#FFD700", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function PredMaintAgent() {
  const bridge = useAgentBridge("predmaint");
    const [tab, setTab] = useState("equipment");
    const [sel, setSel] = useState(null);
    const [alerts, setAlerts] = useState(MOCK_ALERTS);

    useEffect(() => {
        const iv = setInterval(() => {
            const eq = MOCK_EQUIPMENT[Math.floor(Math.random() * MOCK_EQUIPMENT.length)];
            const severities = ["INFO", "WARNING", "CRITICAL"];
            const sev = eq.status === "CRITICAL" ? "CRITICAL" : eq.status === "WARNING" ? "WARNING" : severities[Math.floor(Math.random() * 3)];
            setAlerts(p => [{
                time: new Date().toLocaleTimeString(), equipment: eq.id, severity: sev,
                message: sev === "CRITICAL" ? `${eq.name}: vibration ${eq.vibration}mm/s — shutdown advised` : sev === "WARNING" ? `${eq.name}: temp ${eq.temp}°C trending up` : `${eq.name}: telemetry nominal`,
                prediction: `RUL: ${eq.rul} hours`
            }, ...p].slice(0, 30));
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "equipment", label: "🏭 Equipment" },
        { id: "alerts", label: "🚨 Alerts" },
        { id: "schedule", label: "📅 Maintenance" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const healthyCount = MOCK_EQUIPMENT.filter(e => e.status === "HEALTHY").length;
    const criticalCount = MOCK_EQUIPMENT.filter(e => e.status === "CRITICAL").length;
    const avgRul = Math.round(MOCK_EQUIPMENT.reduce((s, e) => s + e.rul, 0) / MOCK_EQUIPMENT.length);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🔧</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>PredMaint Agent — Predictive Maintenance AI</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>IoT sensor analysis · RUL prediction · Automated scheduling</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#EF444422", color: "#EF4444", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● {criticalCount} CRITICAL</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "equipment" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Healthy", healthyCount, "#00FF88"], ["Critical", criticalCount, "#EF4444"], ["Avg RUL", avgRul + "h", S.accent2]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Equipment</th><th>RUL</th><th>Temp</th><th>Vib</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_EQUIPMENT.map(e => (
                                <tr key={e.id} onClick={() => setSel(e)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === e.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent2 }}>{e.id}</td>
                                    <td>{e.name}</td>
                                    <td style={{ fontFamily: S.mono, color: e.rul < 200 ? "#EF4444" : e.rul < 1000 ? "#FFD700" : "#00FF88" }}>{e.rul}h</td>
                                    <td style={{ fontFamily: S.mono }}>{e.temp}°C</td>
                                    <td style={{ fontFamily: S.mono, color: e.vibration > 1.5 ? "#EF4444" : e.vibration > 0.5 ? "#FFD700" : "#00FF88" }}>{e.vibration}</td>
                                    <td><span style={{ color: STATUS_COLORS[e.status], fontSize: 11 }}>● {e.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.name}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>Serial: {sel.serial} · Plant: {sel.plant} · Sensor: {sel.sensor}</div>
                            {[["RUL", sel.rul + " hours"], ["Operating Hours", sel.hours.toLocaleString()], ["Temperature", sel.temp + "°C"], ["Vibration", sel.vibration + " mm/s"], ["Next Maintenance", sel.nextMaint], ["Last Maintenance", sel.lastMaint]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: S.bg, borderRadius: 8, padding: 10 }}>
                                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>Remaining Useful Life</div>
                                <div style={{ background: "#0D2040", borderRadius: 6, height: 16, overflow: "hidden" }}>
                                    <div style={{ width: Math.min(100, (sel.rul / 5000) * 100) + "%", height: "100%", borderRadius: 6, background: sel.rul > 1000 ? "#00FF88" : sel.rul > 200 ? "#FFD700" : "#EF4444" }} />
                                </div>
                            </div>
                            <div style={{ marginTop: 8, background: S.bg, borderRadius: 8, padding: 10 }}>
                                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>Vibration (max 1.5 mm/s)</div>
                                <div style={{ background: "#0D2040", borderRadius: 6, height: 16, overflow: "hidden" }}>
                                    <div style={{ width: Math.min(100, (sel.vibration / 3.0) * 100) + "%", height: "100%", borderRadius: 6, background: sel.vibration > 1.5 ? "#EF4444" : sel.vibration > 0.5 ? "#FFD700" : "#00FF88" }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "alerts" && (
                <div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        {[["Critical", alerts.filter(a => a.severity === "CRITICAL").length, "#EF4444"], ["Warning", alerts.filter(a => a.severity === "WARNING").length, "#FFD700"], ["Info", alerts.filter(a => a.severity === "INFO").length, "#3B82F6"]].map(([l, v, c]) => (
                            <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                            </div>
                        ))}
                    </div>
                    {alerts.map((a, x) => (
                        <div key={x} style={{ background: S.card, border: `1px solid ${SEVERITY_COLORS[a.severity]}33`, borderRadius: 10, padding: 12, marginBottom: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ color: SEVERITY_COLORS[a.severity], fontWeight: 700, fontSize: 12 }}>● {a.severity}</span>
                                <span style={{ color: S.muted, fontSize: 11, fontFamily: S.mono }}>{a.time} · {a.equipment}</span>
                            </div>
                            <div style={{ fontSize: 13, marginTop: 4 }}>{a.message}</div>
                            <div style={{ fontSize: 11, color: S.accent2, marginTop: 2, fontFamily: S.mono }}>AI Prediction: {a.prediction}</div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "schedule" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent2 }}>Maintenance Scheduling Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. IoT Monitor", "2. AI Predict", "3. Schedule", "4. Execute", "5. Verify & Log"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 2 ? S.accent + "22" : S.card, border: `1px solid ${i < 2 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📡", "🤖", "📅", "🔧", "✅"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    <h4 style={{ fontSize: 13, color: S.muted, marginBottom: 8 }}>Upcoming Maintenance</h4>
                    {MOCK_EQUIPMENT.sort((a, b) => a.rul - b.rul).map(e => (
                        <div key={e.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontWeight: 600 }}>{e.name}</span>
                                <span style={{ color: STATUS_COLORS[e.status], fontFamily: S.mono, fontSize: 12 }}>RUL: {e.rul}h</span>
                            </div>
                            <div style={{ fontSize: 11, color: S.muted }}>Plant: {e.plant} · Next: {e.nextMaint} · Hours: {e.hours.toLocaleString()}</div>
                            <div style={{ marginTop: 6, background: S.bg, borderRadius: 6, height: 8, overflow: "hidden" }}>
                                <div style={{ width: Math.min(100, (e.rul / 5000) * 100) + "%", height: "100%", borderRadius: 6, background: e.rul > 1000 ? "#00FF88" : e.rul > 200 ? "#FFD700" : "#EF4444" }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>PredictiveMaintenanceLog.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Equipment Registration", "1.0 BEZ / equipment", "+45 registered/mo", "🏭"],
                        ["Sensor Logging", "0.05 BEZ / reading", "+120K readings/mo", "📡"],
                        ["AI Prediction Engine", "$1,499/mo per plant", "6 plants subscribed", "🤖"],
                        ["Maintenance Records", "0.3 BEZ / record", "+280 records/mo", "🔧"],
                        ["Downtime Prevention", "Est. $2.1M saved/yr", "avg 34% fewer failures", "💰"],
                        ["Compliance Reports", "$199/mo premium", "15 enterprise clients", "📊"],
                    ].map(([t, fee, vol, ic]) => (
                        <div key={t} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14 }}>
                            <div style={{ fontSize: 20, marginBottom: 4 }}>{ic}</div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{t}</div>
                            <div style={{ fontFamily: S.mono, color: S.accent2, fontSize: 13, marginTop: 4 }}>{fee}</div>
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
                  📊 REAL-TIME AGENT METRICS — PREDMAINT
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/predmaint/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="predmaint" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
