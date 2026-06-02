import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_PARAMETRICS = [
    { id: "PAR-001", name: "Drought Shield — Sinaloa", trigger: "Drought Index > 80", oracle: "Weather Oracle", premium: 900, payout: 500000, currency: "MXN", holder: "Coop. Agrícola Sinaloa", region: "Sinaloa MX", startDate: "2026-01-01", endDate: "2026-12-31", status: "TRIGGERED", lastReading: 87.3 },
    { id: "PAR-002", name: "Earthquake Guard — CDMX", trigger: "Richter ≥ 6.0", oracle: "Seismic Oracle", premium: 5000, payout: 2000000, currency: "MXN", holder: "Plaza San Ángel SA", region: "CDMX MX", startDate: "2026-01-01", endDate: "2027-01-01", status: "ACTIVE", lastReading: 2.1 },
    { id: "PAR-003", name: "Hurricane Cover — Quintana Roo", trigger: "Wind > 120 km/h", oracle: "Weather Oracle", premium: 3200, payout: 1500000, currency: "MXN", holder: "Hotel Riviera Maya", region: "Quintana Roo MX", startDate: "2026-06-01", endDate: "2026-11-30", status: "ACTIVE", lastReading: 45 },
    { id: "PAR-004", name: "Flood Index — Buenos Aires", trigger: "River Level > 4.5m", oracle: "Hydro Oracle", premium: 2100, payout: 800000, currency: "ARS", holder: "Puerto Madero Devs", region: "Buenos Aires AR", startDate: "2026-01-01", endDate: "2026-12-31", status: "ACTIVE", lastReading: 3.2 },
    { id: "PAR-005", name: "Frost Protection — Mendoza", trigger: "Temp < -5°C for 24h", oracle: "Weather Oracle", premium: 1500, payout: 600000, currency: "ARS", holder: "Viñedos Mendocinos", region: "Mendoza AR", startDate: "2026-04-01", endDate: "2026-09-30", status: "EXPIRED", lastReading: -2.1 },
    { id: "PAR-006", name: "Rainfall Excess — Veracruz", trigger: "Rain > 300mm/48h", oracle: "Weather Oracle", premium: 1800, payout: 750000, currency: "MXN", holder: "Finca Papantla", region: "Veracruz MX", startDate: "2026-01-01", endDate: "2026-12-31", status: "ACTIVE", lastReading: 125 },
];

const MOCK_READINGS = [
    { time: "15:35:00", parametric: "PAR-001", oracle: "Weather Oracle", value: "87.3", unit: "Drought Index", triggered: true },
    { time: "15:30:00", parametric: "PAR-002", oracle: "Seismic Oracle", value: "2.1", unit: "Richter", triggered: false },
    { time: "15:25:00", parametric: "PAR-003", oracle: "Weather Oracle", value: "45", unit: "km/h", triggered: false },
    { time: "15:20:00", parametric: "PAR-004", oracle: "Hydro Oracle", value: "3.2", unit: "meters", triggered: false },
];

const STATUS_COLORS = { ACTIVE: "#00FF88", TRIGGERED: "#EF4444", EXPIRED: "#7C3AED", PAID: "#3B82F6", PENDING: "#FFD700" };

const CONTRACT_ABI = `// ParametricInsurance.sol  —  BeZhas Chain
// Index-based insurance with oracle-triggered payouts

struct ParametricPolicy {
  string   name;
  string   region;
  string   triggerCondition;
  uint256  triggerValue;      // scaled 1e2
  uint256  premiumBez;
  uint256  payoutAmount;
  address  holder;
  address  oracle;
  uint256  startDate;
  uint256  endDate;
  bool     triggered;
  bool     paid;
}

struct OracleReading {
  uint256  policyId;
  uint256  value;             // scaled 1e2
  uint256  timestamp;
  bool     triggerMet;
}

function createParametric(
  string name, string region, string triggerCondition,
  uint256 triggerValue, uint256 payout, uint256 startDate, uint256 endDate
) external payable returns (uint256 policyId);

function submitReading(uint256 policyId, uint256 value) external;
function triggerPayout(uint256 policyId) external;
function expirePolicy(uint256 policyId) external;`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#EF4444", accent2: "#FFD700", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function ParametricInsuranceAgent() {
  const bridge = useAgentBridge("parametric");
    const [tab, setTab] = useState("parametrics");
    const [sel, setSel] = useState(null);
    const [readings, setReadings] = useState(MOCK_READINGS);

    useEffect(() => {
        const iv = setInterval(() => {
            const par = MOCK_PARAMETRICS[Math.floor(Math.random() * MOCK_PARAMETRICS.length)];
            const val = (par.lastReading + (Math.random() - 0.5) * par.lastReading * 0.2).toFixed(1);
            const trigMet = par.id === "PAR-001" ? parseFloat(val) > 80 : par.id === "PAR-002" ? parseFloat(val) >= 6.0 : false;
            setReadings(p => [{
                time: new Date().toLocaleTimeString(), parametric: par.id, oracle: par.oracle,
                value: val, unit: par.trigger.split(" ")[0], triggered: trigMet
            }, ...p].slice(0, 30));
        }, 7000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "parametrics", label: "⚡ Policies" },
        { id: "oracle", label: "📡 Oracle Feed" },
        { id: "pipeline", label: "🔄 Trigger Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
    ];

    const activeCount = MOCK_PARAMETRICS.filter(p => p.status === "ACTIVE").length;
    const triggeredCount = MOCK_PARAMETRICS.filter(p => p.status === "TRIGGERED").length;
    const totalPremium = MOCK_PARAMETRICS.reduce((s, p) => s + p.premium, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>⚡</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>ParametricInsurance Agent — Oracle-Triggered Coverage</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>Index-based policies · Weather/seismic/hydro oracles · Auto-payout</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#EF444422", color: "#EF4444", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "parametrics" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Active", activeCount, "#00FF88"], ["Triggered", triggeredCount, "#EF4444"], ["Premiums", totalPremium.toLocaleString() + " BEZ", S.accent2]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Name</th><th>Trigger</th><th>Region</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_PARAMETRICS.map(p => (
                                <tr key={p.id} onClick={() => setSel(p)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === p.id ? S.accent + "11" : p.status === "TRIGGERED" ? "#EF444411" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent2, fontSize: 11 }}>{p.id}</td>
                                    <td style={{ fontSize: 12 }}>{p.name}</td>
                                    <td style={{ fontSize: 11, fontFamily: S.mono }}>{p.trigger}</td>
                                    <td style={{ fontSize: 12 }}>{p.region}</td>
                                    <td><span style={{ color: STATUS_COLORS[p.status], fontSize: 11 }}>● {p.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${sel.status === "TRIGGERED" ? "#EF4444" : S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.name}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>Holder: {sel.holder} · Oracle: {sel.oracle}</div>
                            {[["Trigger", sel.trigger], ["Last Reading", sel.lastReading], ["Premium", sel.premium + " BEZ"], ["Payout", sel.payout.toLocaleString() + " " + sel.currency], ["Period", sel.startDate + " → " + sel.endDate], ["Region", sel.region]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                            {sel.status === "TRIGGERED" && (
                                <div style={{ marginTop: 12, background: "#EF444422", padding: 10, borderRadius: 8, textAlign: "center", color: "#EF4444", fontSize: 13, fontWeight: 600 }}>
                                    🚨 TRIGGER CONDITION MET — AUTO-PAYOUT IN PROGRESS
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {tab === "oracle" && (
                <div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        {[["Readings", readings.length, S.accent2], ["Normal", readings.filter(r => !r.triggered).length, "#00FF88"], ["Triggered", readings.filter(r => r.triggered).length, "#EF4444"]].map(([l, v, c]) => (
                            <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                            </div>
                        ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Policy</th><th>Oracle</th><th>Value</th><th>Status</th>
                        </tr></thead>
                        <tbody>{readings.map((r, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11`, background: r.triggered ? "#EF444411" : "transparent" }}>
                                <td style={{ padding: 6, color: S.muted }}>{r.time}</td>
                                <td style={{ color: S.accent2 }}>{r.parametric}</td>
                                <td>{r.oracle}</td>
                                <td>{r.value} {r.unit}</td>
                                <td>{r.triggered ? <span style={{ color: "#EF4444" }}>🚨 TRIGGERED</span> : <span style={{ color: "#00FF88" }}>OK</span>}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Parametric Insurance Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Define Trigger", "2. Pay Premium", "3. Oracle Monitor", "4. Trigger Event", "5. Auto-Payout"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📐", "💳", "📡", "⚡", "💰"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    {["TRIGGERED", "ACTIVE", "EXPIRED", "PAID"].map(status => {
                        const items = MOCK_PARAMETRICS.filter(p => p.status === status);
                        if (!items.length) return null;
                        return (
                            <div key={status} style={{ background: S.card, border: `1px solid ${status === "TRIGGERED" ? "#EF4444" : S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: STATUS_COLORS[status] }}>● {status} ({items.length})</div>
                                {items.map(p => (
                                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span>{p.name} — {p.region}</span>
                                        <span style={{ fontFamily: S.mono, color: S.muted }}>{p.trigger} · {p.payout.toLocaleString()} {p.currency}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>ParametricInsurance.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Policy Creation", "3.0 BEZ / policy", "+25 parametrics/mo", "⚡"],
                        ["Oracle Feed", "0.05 BEZ / reading", "+180K readings/mo", "📡"],
                        ["Auto-Payout", "1.0% of payout", "+1.8M payout/mo", "💰"],
                        ["Trigger Monitoring SaaS", "$799/mo per client", "18 clients", "🔍"],
                        ["Weather Data API", "0.02 BEZ / query", "+90K queries/mo", "🌦️"],
                        ["Risk Modeling", "5.0 BEZ / model", "+40 models/mo", "📈"],
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
                  📊 REAL-TIME AGENT METRICS — PARAMETRIC
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/parametric/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="parametric" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
