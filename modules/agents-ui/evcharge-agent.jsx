import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_STATIONS = [
    { id: "STN-EU-001", name: "Barcelona Supercharger Hub", operator: "BeZhas Energy", chargers: 24, available: 18, power: 350, type: "DC_FAST", priceKwh: 0.32, sessions24h: 142, revenue24h: 4890, lat: 41.39, lng: 2.17, status: "ONLINE" },
    { id: "STN-EU-002", name: "Madrid Solar Station", operator: "SolarCharge ES", chargers: 16, available: 12, power: 150, type: "DC_FAST", priceKwh: 0.28, sessions24h: 87, revenue24h: 2610, lat: 40.42, lng: -3.70, status: "ONLINE" },
    { id: "STN-US-003", name: "Austin EV Plaza", operator: "BeZhas Energy US", chargers: 32, available: 5, power: 350, type: "DC_ULTRA", priceKwh: 0.22, sessions24h: 210, revenue24h: 7350, lat: 30.27, lng: -97.74, status: "ONLINE" },
    { id: "STN-DE-004", name: "Munich Tech Park", operator: "E.ON x BeZhas", chargers: 20, available: 20, power: 250, type: "DC_FAST", priceKwh: 0.35, sessions24h: 0, revenue24h: 0, lat: 48.14, lng: 11.58, status: "MAINTENANCE" },
    { id: "STN-MX-005", name: "CDMX Central Hub", operator: "CFE x BeZhas", chargers: 12, available: 8, power: 150, type: "AC_L2", priceKwh: 0.18, sessions24h: 64, revenue24h: 1152, lat: 19.43, lng: -99.13, status: "ONLINE" },
    { id: "STN-JP-006", name: "Tokyo Odaiba Rapid", operator: "CHAdeMO Net", chargers: 40, available: 28, power: 400, type: "DC_ULTRA", priceKwh: 0.30, sessions24h: 315, revenue24h: 12600, lat: 35.63, lng: 139.78, status: "ONLINE" },
];

const MOCK_SESSIONS = [
    { time: "14:32:01", station: "STN-EU-001", vehicle: "VW ID.4", kwh: 45.2, cost: 14.46, duration: "28m", payment: "BEZ", tx: "0x7f3a...c4e2" },
    { time: "14:28:44", station: "STN-US-003", vehicle: "Tesla M3", kwh: 62.8, cost: 13.82, duration: "22m", payment: "BEZ", tx: "0x2b8d...f901" },
    { time: "14:15:22", station: "STN-JP-006", vehicle: "Nissan Leaf", kwh: 38.5, cost: 11.55, duration: "35m", payment: "FIAT", tx: "0xa12c...8834" },
    { time: "13:59:10", station: "STN-MX-005", vehicle: "Ford F-150L", kwh: 85.0, cost: 15.30, duration: "52m", payment: "BEZ", tx: "0x5e9f...2217" },
];

const STATUS_COLORS = { ONLINE: "#00FF88", MAINTENANCE: "#FFD700", OFFLINE: "#EF4444", OVERLOADED: "#F97316" };
const TYPE_COLORS = { DC_FAST: "#3B82F6", DC_ULTRA: "#7C3AED", AC_L2: "#10B981" };

const CONTRACT_ABI = `// EVChargeToken.sol  -  BeZhas Chain
// ERC-20 charging credits with station registry & session settlement

struct ChargingStation {
  address  operator;
  string   stationId;
  string   name;
  uint256  powerKW;
  uint256  pricePerKWh;     // in BEZ wei
  bool     active;
}

struct ChargingSession {
  uint256  stationTokenId;
  address  driver;
  uint256  kwhDelivered;
  uint256  totalCost;       // BEZ wei
  uint256  timestamp;
  bytes32  meterProof;      // hash of IoT meter reading
}

function registerStation(
  string stationId, string name, uint256 powerKW, uint256 pricePerKWh
) external returns (uint256 tokenId);

function startSession(uint256 stationId, address driver) external returns (uint256 sessionId);
function endSession(uint256 sessionId, uint256 kwhDelivered, bytes32 meterProof) external;
function settleSession(uint256 sessionId) external;
function withdrawRevenue() external;
function setStationStatus(uint256 stationId, bool active) external;`;

const S = {
    bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
    accent: "#10B981", accent2: "#00FF88", text: "#e2e8f0", muted: "#64748b", mono: "'Courier New',monospace",
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function EVChargeAgent() {
    const bridge = useAgentBridge('evcharge');
    const [tab, setTab] = useState("stations");
    const [sel, setSel] = useState(null);
    const [sessions, setSessions] = useState(MOCK_SESSIONS);

    useEffect(() => {
        const iv = setInterval(() => {
            const stns = MOCK_STATIONS.filter(s => s.status === "ONLINE");
            const vehicles = ["Tesla M3", "VW ID.4", "BMW i4", "Nissan Leaf", "Ford F-150L", "Hyundai Ioniq 5", "Polestar 2"];
            const stn = stns[Math.floor(Math.random() * stns.length)];
            const veh = vehicles[Math.floor(Math.random() * vehicles.length)];
            const kwh = (20 + Math.random() * 70).toFixed(1);
            setSessions(p => [{
                time: new Date().toLocaleTimeString(), station: stn.id, vehicle: veh,
                kwh: parseFloat(kwh), cost: parseFloat((kwh * stn.priceKwh).toFixed(2)),
                duration: Math.floor(15 + Math.random() * 45) + "m",
                payment: Math.random() > 0.3 ? "BEZ" : "FIAT",
                tx: "0x" + Math.random().toString(16).slice(2, 10),
            }, ...p.slice(0, 19)]);
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "stations", label: "Stations" },
        { id: "sessions", label: "Sessions" },
        { id: "roaming", label: "Roaming" },
        { id: "contracts", label: "Contracts" },
        { id: "analytics", label: "Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const totalRevenue = MOCK_STATIONS.reduce((s, st) => s + st.revenue24h, 0);
    const totalSessions = MOCK_STATIONS.reduce((s, st) => s + st.sessions24h, 0);

    return (
        <div style={{ background: S.bg, color: S.text, fontFamily: "'Inter',sans-serif", padding: 24, minHeight: "100vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <span style={{ fontSize: 28 }}>&#9889;</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20, color: S.accent }}>EVCharge Agent</h2>
                    <span style={{ color: S.muted, fontSize: 12 }}>Tokenized EV charging network with cross-border roaming payments</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#00FF8822", color: "#00FF88", padding: "4px 12px", borderRadius: 8, fontSize: 12 }}>ACTIVE</span>
            </div>

            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${S.border}`, paddingBottom: 8 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        background: tab === t.id ? S.accent + "22" : "transparent", color: tab === t.id ? S.accent : S.muted,
                        border: "none", padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                    }}>{t.label}</button>
                ))}
            </div>

            {/* ── Stations Tab ──────────────────────────────────────────── */}
            {tab === "stations" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
                            {[
                                ["Total Stations", MOCK_STATIONS.length, S.accent],
                                ["Online", MOCK_STATIONS.filter(s => s.status === "ONLINE").length, "#00FF88"],
                                ["Sessions (24h)", totalSessions, "#3B82F6"],
                                ["Revenue (24h)", "$" + totalRevenue.toLocaleString(), "#FFD700"],
                            ].map(([label, val, c], i) => (
                                <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, textAlign: "center" }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{val}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{label}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                                <tr style={{ color: S.muted, borderBottom: `1px solid ${S.border}` }}>
                                    <th style={{ textAlign: "left", padding: "8px 6px" }}>Station</th>
                                    <th style={{ textAlign: "left", padding: "8px 6px" }}>Operator</th>
                                    <th style={{ textAlign: "center", padding: "8px 6px" }}>Type</th>
                                    <th style={{ textAlign: "right", padding: "8px 6px" }}>Avail</th>
                                    <th style={{ textAlign: "center", padding: "8px 6px" }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_STATIONS.map((st, i) => (
                                    <tr key={i} onClick={() => setSel(st)} style={{
                                        cursor: "pointer", borderBottom: `1px solid ${S.border}`,
                                        background: sel?.id === st.id ? S.accent + "11" : "transparent",
                                    }}>
                                        <td style={{ padding: "8px 6px" }}>
                                            <div style={{ fontFamily: S.mono, fontSize: 10, color: S.accent }}>{st.id}</div>
                                            <div style={{ fontSize: 11 }}>{st.name}</div>
                                        </td>
                                        <td style={{ padding: "8px 6px", fontSize: 11 }}>{st.operator}</td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{ background: (TYPE_COLORS[st.type] || "#666") + "22", color: TYPE_COLORS[st.type] || "#999", padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>{st.type}</span>
                                        </td>
                                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: S.mono }}>{st.available}/{st.chargers}</td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{ color: STATUS_COLORS[st.status], fontSize: 11 }}>{st.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontSize: 16, color: S.accent }}>{sel.name}</h3>
                                <button onClick={() => setSel(null)} style={{ background: "transparent", border: "none", color: S.muted, cursor: "pointer" }}>X</button>
                            </div>
                            {[
                                ["Station ID", sel.id],
                                ["Operator", sel.operator],
                                ["Power", sel.power + " kW"],
                                ["Price/kWh", "$" + sel.priceKwh.toFixed(2)],
                                ["Chargers", sel.available + " / " + sel.chargers + " available"],
                                ["Sessions (24h)", sel.sessions24h],
                                ["Revenue (24h)", "$" + sel.revenue24h.toLocaleString()],
                                ["Location", sel.lat.toFixed(2) + ", " + sel.lng.toFixed(2)],
                            ].map(([k, v], i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${S.border}`, fontSize: 12 }}>
                                    <span style={{ color: S.muted }}>{k}</span>
                                    <span style={{ fontFamily: S.mono, fontSize: 11 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 16 }}>
                                <span style={{ color: S.muted, fontSize: 11 }}>Charger Utilization</span>
                                <div style={{ marginTop: 4, height: 6, background: S.border, borderRadius: 3 }}>
                                    <div style={{ height: "100%", width: `${((sel.chargers - sel.available) / sel.chargers * 100).toFixed(0)}%`, background: sel.status === "MAINTENANCE" ? "#FFD700" : S.accent, borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 10, color: S.muted }}>{((sel.chargers - sel.available) / sel.chargers * 100).toFixed(1)}% in use</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Sessions Tab ──────────────────────────────────────────── */}
            {tab === "sessions" && (
                <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr style={{ color: S.muted, borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>Time</th>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>Station</th>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>Vehicle</th>
                                <th style={{ textAlign: "right", padding: "8px 6px" }}>kWh</th>
                                <th style={{ textAlign: "right", padding: "8px 6px" }}>Cost</th>
                                <th style={{ textAlign: "center", padding: "8px 6px" }}>Duration</th>
                                <th style={{ textAlign: "center", padding: "8px 6px" }}>Payment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((s, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                                    <td style={{ padding: "8px 6px", fontFamily: S.mono, color: S.muted, fontSize: 11 }}>{s.time}</td>
                                    <td style={{ padding: "8px 6px", fontFamily: S.mono, color: S.accent, fontSize: 11 }}>{s.station}</td>
                                    <td style={{ padding: "8px 6px", fontSize: 11 }}>{s.vehicle}</td>
                                    <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: S.mono }}>{s.kwh}</td>
                                    <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: S.mono }}>${s.cost}</td>
                                    <td style={{ textAlign: "center", fontSize: 11, color: S.muted }}>{s.duration}</td>
                                    <td style={{ textAlign: "center" }}>
                                        <span style={{ color: s.payment === "BEZ" ? "#00FF88" : "#FFD700", fontSize: 11 }}>{s.payment}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Roaming Tab ───────────────────────────────────────────── */}
            {tab === "roaming" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 16, color: S.accent }}>Cross-Border EV Roaming Protocol</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 20 }}>
                        {["Driver Plugs In", "Station Auth", "BEZ Lock", "Charge & Meter", "Settle & Roam Fee"].map((step, i) => (
                            <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{i + 1}</div>
                                <div style={{ fontSize: 10, color: S.muted }}>{step}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16 }}>
                            <h4 style={{ margin: "0 0 12px", fontSize: 13, color: S.accent }}>Roaming Agreements</h4>
                            {[
                                ["EU OCPI Network", "24 operators", "#3B82F6"],
                                ["US NEVI Corridor", "12 operators", "#10B981"],
                                ["LATAM BeZhas Hub", "8 operators", "#F97316"],
                                ["Asia-Pacific OCPP", "15 operators", "#7C3AED"],
                            ].map(([net, ops, c], i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${S.border}`, fontSize: 12 }}>
                                    <span style={{ color: c }}>{net}</span>
                                    <span style={{ color: S.muted }}>{ops}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16 }}>
                            <h4 style={{ margin: "0 0 12px", fontSize: 13, color: S.accent }}>Settlement Stats</h4>
                            {[
                                ["Cross-border sessions (30d)", "4,230"],
                                ["Avg settlement time", "< 2 seconds"],
                                ["Roaming fee", "0.3% per session"],
                                ["Active drivers", "18,500"],
                            ].map(([label, val], i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${S.border}`, fontSize: 12 }}>
                                    <span style={{ color: S.muted }}>{label}</span>
                                    <span style={{ fontFamily: S.mono, fontSize: 11 }}>{val}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Contracts Tab ─────────────────────────────────────────── */}
            {tab === "contracts" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 12, color: S.accent }}>EVChargeToken.sol</h3>
                    <pre style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, fontSize: 11, fontFamily: S.mono, color: "#00FF88", overflow: "auto", maxHeight: 400 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {/* ── Analytics Tab ─────────────────────────────────────────── */}
            {tab === "analytics" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 16, color: S.accent }}>Revenue Model &mdash; EVCharge</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                        {[
                            ["Station Registration", "5 BEZ / station", "One-time fee to register on BeZhas charging network"],
                            ["Session Settlement", "0.5% per session", "Micro-fee on each kWh settlement transaction"],
                            ["Roaming Fee", "0.3% cross-border", "Fee on inter-network roaming session settlements"],
                            ["Premium Operator Tools", "SaaS subscription", "Dashboard, analytics, and smart pricing engine"],
                            ["Carbon Credit Offset", "auto-mint per MWh", "Automatic carbon credit generation from green energy"],
                            ["Driver Loyalty Program", "BEZ cashback 2%", "Incentivizes BEZ-native payments at stations"],
                        ].map(([title, fee, desc], i) => (
                            <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
                                    <span style={{ color: S.accent, fontFamily: S.mono, fontSize: 12 }}>{fee}</span>
                                </div>
                                <div style={{ color: S.muted, fontSize: 11 }}>{desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {tab === "metrics" && (
                <div>
                    <div style={{ background: S.card, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — EVCHARGE</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="evcharge" accentColor="#10B981" />
                </div>
            )}
        </div>
    );
}
