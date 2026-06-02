import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_TWINS = [
    { id: "DT-001", name: "CNC Lathe HL-500", serial: "HAAS-500-2024-A1", type: "CNC_MACHINE", plant: "Monterrey MX", health: 96, uptime: 99.2, lastSync: "2s ago", status: "RUNNING", temp: 42, vibration: 0.12, rpm: 3400 },
    { id: "DT-002", name: "Injection Mold IM-200T", serial: "ENGL-200T-2025-B3", type: "INJECTION_MOLD", plant: "Querétaro MX", health: 88, uptime: 97.5, lastSync: "5s ago", status: "RUNNING", temp: 185, vibration: 0.34, rpm: 0 },
    { id: "DT-003", name: "Robot Arm KUKA KR-60", serial: "KUKA-KR60-2024-C7", type: "ROBOT_ARM", plant: "Stuttgart DE", health: 72, uptime: 92.1, lastSync: "12s ago", status: "WARNING", temp: 55, vibration: 0.78, rpm: 0 },
    { id: "DT-004", name: "3D Printer SLM-280", serial: "SLM-280-2025-D2", type: "3D_PRINTER", plant: "Austin TX", health: 100, uptime: 99.8, lastSync: "1s ago", status: "RUNNING", temp: 680, vibration: 0.02, rpm: 0 },
    { id: "DT-005", name: "Press Brake PB-300", serial: "TRUMP-PB300-E9", type: "PRESS_BRAKE", plant: "Monterrey MX", health: 45, uptime: 78.3, lastSync: "3m ago", status: "MAINTENANCE", temp: 38, vibration: 2.10, rpm: 0 },
    { id: "DT-006", name: "SMT Pick & Place", serial: "JUKI-RS1-2025-F4", type: "SMT_LINE", plant: "Guadalajara MX", health: 94, uptime: 98.7, lastSync: "4s ago", status: "RUNNING", temp: 28, vibration: 0.08, rpm: 0 },
];

const MOCK_EVENTS = [
    { time: "14:55:02", twin: "DT-001", event: "TELEMETRY", detail: "Temp 42°C · Vib 0.12mm/s · RPM 3400" },
    { time: "14:52:10", twin: "DT-003", event: "ALERT", detail: "Vibration exceeded threshold: 0.78mm/s (max 0.50)" },
    { time: "14:48:33", twin: "DT-005", event: "MAINTENANCE", detail: "Scheduled hydraulic oil change — triggered by IoT" },
    { time: "14:40:11", twin: "DT-004", event: "MILESTONE", detail: "10,000th print cycle completed — NFT badge minted" },
];

const STATUS_COLORS = { RUNNING: "#00FF88", WARNING: "#FFD700", MAINTENANCE: "#F97316", OFFLINE: "#EF4444", IDLE: "#3D5E80" };
const TYPE_ICONS = { CNC_MACHINE: "⚙️", INJECTION_MOLD: "🏭", ROBOT_ARM: "🤖", "3D_PRINTER": "🖨️", PRESS_BRAKE: "🔨", SMT_LINE: "📟" };

const CONTRACT_ABI = `// DigitalTwinRegistry.sol  —  BeZhas Chain
// NFT-based digital twins for manufacturing equipment

struct DigitalTwin {
  string   serialNumber;
  string   name;
  string   twinType;
  address  owner;
  uint256  createdAt;
  bool     active;
  uint256  healthScore;       // 0-100
}

struct TelemetryLog {
  uint256  twinId;
  uint256  temperature;       // scaled 1e2 (e.g. 4200 = 42.00°C)
  uint256  vibration;         // scaled 1e4 (e.g. 1200 = 0.12mm/s)
  uint256  rpm;
  uint256  timestamp;
  bytes32  sensorProof;       // IoT hash
}

function mintTwin(
  string serialNumber, string name, string twinType
) external returns (uint256 twinId);

function logTelemetry(
  uint256 twinId, uint256 temp, uint256 vibration, uint256 rpm, bytes32 proof
) external;

function updateHealth(uint256 twinId, uint256 score) external;
function decommission(uint256 twinId) external;`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#7C3AED", accent2: "#00D4FF", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function DigitalTwinAgent() {
    const bridge = useAgentBridge('digitaltwin');
    const [tab, setTab] = useState("twins");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState(MOCK_EVENTS);

    useEffect(() => {
        const iv = setInterval(() => {
            const twin = MOCK_TWINS[Math.floor(Math.random() * MOCK_TWINS.length)];
            const evts = ["TELEMETRY", "ALERT", "MILESTONE", "SYNC"];
            const evt = evts[Math.floor(Math.random() * evts.length)];
            setEvents(p => [{
                time: new Date().toLocaleTimeString(), twin: twin.id, event: evt,
                detail: evt === "TELEMETRY" ? `Temp ${twin.temp}°C · Vib ${twin.vibration}mm/s` : evt === "ALERT" ? `Health dropped to ${twin.health - 3}%` : `IoT heartbeat OK — ${twin.name}`
            }, ...p].slice(0, 30));
        }, 7000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "twins", label: "🏭 Digital Twins" },
        { id: "telemetry", label: "📡 Telemetry" },
        { id: "lifecycle", label: "🔄 Lifecycle" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const runningCount = MOCK_TWINS.filter(t => t.status === "RUNNING").length;
    const avgHealth = Math.round(MOCK_TWINS.reduce((s, t) => s + t.health, 0) / MOCK_TWINS.length);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🏭</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>DigitalTwin Agent — Equipment NFT Lifecycle</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>IoT-linked digital twins · Telemetry on-chain · Health scoring</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#7C3AED22", color: "#7C3AED", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● ACTIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "twins" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Running", runningCount, "#00FF88"], ["Avg Health", avgHealth + "%", S.accent], ["Twins", MOCK_TWINS.length, S.accent2]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Name</th><th>Type</th><th>Health</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_TWINS.map(t => (
                                <tr key={t.id} onClick={() => setSel(t)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === t.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent2 }}>{t.id}</td>
                                    <td>{TYPE_ICONS[t.type] || "🏭"} {t.name}</td>
                                    <td style={{ fontSize: 11, fontFamily: S.mono }}>{t.type}</td>
                                    <td style={{ fontFamily: S.mono, color: t.health >= 90 ? "#00FF88" : t.health >= 70 ? "#FFD700" : "#EF4444" }}>{t.health}%</td>
                                    <td><span style={{ color: STATUS_COLORS[t.status], fontSize: 11 }}>● {t.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{TYPE_ICONS[sel.type]} {sel.name}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>Serial: {sel.serial} · Plant: {sel.plant}</div>
                            {[["Health", sel.health + "%"], ["Uptime", sel.uptime + "%"], ["Temp", sel.temp + "°C"], ["Vibration", sel.vibration + " mm/s"], ["RPM", sel.rpm], ["Last Sync", sel.lastSync]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: S.bg, borderRadius: 8, padding: 10 }}>
                                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>Health Score</div>
                                <div style={{ background: "#0D2040", borderRadius: 6, height: 16, overflow: "hidden" }}>
                                    <div style={{ width: sel.health + "%", height: "100%", borderRadius: 6, background: sel.health >= 90 ? "#00FF88" : sel.health >= 70 ? "#FFD700" : "#EF4444" }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "telemetry" && (
                <div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        {[["Events", events.length, S.accent], ["Alerts", events.filter(e => e.event === "ALERT").length, "#EF4444"], ["Syncs/min", "~8.5", S.accent2]].map(([l, v, c]) => (
                            <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                            </div>
                        ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Twin</th><th>Event</th><th>Detail</th>
                        </tr></thead>
                        <tbody>{events.map((e, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                                <td style={{ color: S.accent2 }}>{e.twin}</td>
                                <td><span style={{ color: e.event === "ALERT" ? "#EF4444" : e.event === "TELEMETRY" ? "#00FF88" : "#FFD700", fontSize: 11 }}>{e.event}</span></td>
                                <td style={{ color: S.text, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.detail}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "lifecycle" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Equipment Lifecycle Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Commission", "2. Twin Mint", "3. Production", "4. Maintenance", "5. Decommission"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📦", "🔗", "🏭", "🔧", "♻️"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    <h4 style={{ fontSize: 13, color: S.muted, marginBottom: 8 }}>Equipment by Plant</h4>
                    {["Monterrey MX", "Stuttgart DE", "Austin TX", "Querétaro MX", "Guadalajara MX"].map(plant => {
                        const items = MOCK_TWINS.filter(t => t.plant === plant);
                        if (!items.length) return null;
                        return (
                            <div key={plant} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 6 }}>📍 {plant} ({items.length})</div>
                                {items.map(t => (
                                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span>{TYPE_ICONS[t.type]} {t.name}</span>
                                        <span style={{ color: STATUS_COLORS[t.status], fontFamily: S.mono }}>{t.status} · {t.health}%</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>DigitalTwinRegistry.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Twin Minting", "1.0 BEZ / twin", "+120 twins/mo", "🏭"],
                        ["Telemetry Logging", "0.05 BEZ / log", "+45K logs/mo", "📡"],
                        ["Health Scoring", "0.2 BEZ / update", "+3K updates/mo", "❤️"],
                        ["Enterprise Twin SaaS", "$999/mo per plant", "8 plants onboarded", "🏢"],
                        ["Decommission Audit", "2.0 BEZ / audit", "+15 audits/mo", "♻️"],
                        ["Predictive Analytics API", "$299/mo", "22 subscribers", "📊"],
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — DIGITALTWIN</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="digitaltwin" accentColor="#7C3AED" />
                </div>
            )}
        </div>
    );
}
