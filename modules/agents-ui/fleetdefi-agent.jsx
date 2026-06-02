import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_FLEETS = [
    { id: "FLT-001", company: "Global Logistics Corp", vehicles: 245, leased: 180, avgMileage: 42500, monthlyPayment: 185000, escrowBalance: 520000, maintenancePool: 95000, status: "ACTIVE", type: "COMMERCIAL", country: "US" },
    { id: "FLT-002", company: "EcoDrive Mobility", vehicles: 120, leased: 120, avgMileage: 28000, monthlyPayment: 96000, escrowBalance: 288000, maintenancePool: 52000, status: "ACTIVE", type: "RIDESHARE_EV", country: "DE" },
    { id: "FLT-003", company: "MedTrans SpA", vehicles: 45, leased: 30, avgMileage: 18500, monthlyPayment: 35000, escrowBalance: 105000, maintenancePool: 28000, status: "ACTIVE", type: "MEDICAL", country: "IT" },
    { id: "FLT-004", company: "Constructora Azteca", vehicles: 78, leased: 50, avgMileage: 55000, monthlyPayment: 62000, escrowBalance: 186000, maintenancePool: 41000, status: "WARNING", type: "HEAVY_DUTY", country: "MX" },
    { id: "FLT-005", company: "SmartCity Taxis", vehicles: 300, leased: 250, avgMileage: 65000, monthlyPayment: 225000, escrowBalance: 675000, maintenancePool: 130000, status: "ACTIVE", type: "TAXI_HYBRID", country: "ES" },
];

const MOCK_PAYMENTS = [
    { time: "14:30:00", fleet: "FLT-001", amount: 185000, type: "LEASE_PAYMENT", status: "RELEASED", tx: "0x7f3a...c4e2" },
    { time: "14:15:22", fleet: "FLT-004", amount: 12500, type: "MAINTENANCE", status: "PENDING_APPROVAL", tx: "0x2b8d...f901" },
    { time: "13:45:10", fleet: "FLT-002", amount: 96000, type: "LEASE_PAYMENT", status: "RELEASED", tx: "0xa12c...8834" },
    { time: "12:20:05", fleet: "FLT-005", amount: 8200, type: "INSURANCE_CLAIM", status: "RELEASED", tx: "0x5e9f...2217" },
];

const STATUS_COLORS = { ACTIVE: "#00FF88", WARNING: "#FFD700", SUSPENDED: "#EF4444", ENDED: "#64748b" };
const TYPE_COLORS = { COMMERCIAL: "#3B82F6", RIDESHARE_EV: "#10B981", MEDICAL: "#EF4444", HEAVY_DUTY: "#F59E0B", TAXI_HYBRID: "#A78BFA" };

const CONTRACT_ABI = `// FleetLeaseEscrow.sol  -  BeZhas Chain
// Fleet leasing escrow with usage-based maintenance triggers

struct FleetLease {
  address  lessee;
  string   fleetId;
  uint256  vehicleCount;
  uint256  monthlyPayment;     // in BEZ wei
  uint256  escrowBalance;      // locked collateral
  uint256  maintenancePool;    // reserved for repairs
  uint256  startDate;
  uint256  endDate;
  bool     active;
}

struct MaintenanceClaim {
  uint256  leaseId;
  uint256  amount;
  string   description;
  bytes32  evidenceHash;
  bool     approved;
}

function createLease(
  address lessee, string fleetId, uint256 vehicleCount,
  uint256 monthly, uint256 durationMonths
) external payable onlyRole(LESSOR_ROLE) returns (uint256 leaseId);

function makePayment(uint256 leaseId) external payable;
function claimMaintenance(uint256 leaseId, uint256 amount, string desc, bytes32 evidence) external;
function approveMaintenance(uint256 claimId) external onlyRole(LESSOR_ROLE);
function terminateLease(uint256 leaseId) external;
function getLeaseHealth(uint256 leaseId) view returns (uint256 score);`;

const S = {
    bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
    accent: "#A78BFA", accent2: "#00FF88", text: "#e2e8f0", muted: "#64748b", mono: "'Courier New',monospace",
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function FleetDeFiAgent() {
  const bridge = useAgentBridge("fleetdefi");
    const [tab, setTab] = useState("fleets");
    const [sel, setSel] = useState(null);
    const [payments, setPayments] = useState(MOCK_PAYMENTS);

    useEffect(() => {
        const iv = setInterval(() => {
            const fleets = ["FLT-001", "FLT-002", "FLT-003", "FLT-004", "FLT-005"];
            const types = ["LEASE_PAYMENT", "MAINTENANCE", "INSURANCE_CLAIM"];
            const flt = fleets[Math.floor(Math.random() * fleets.length)];
            const tp = types[Math.floor(Math.random() * types.length)];
            setPayments(p => [{
                time: new Date().toLocaleTimeString(), fleet: flt,
                amount: Math.floor(Math.random() * 200000) + 5000, type: tp,
                status: Math.random() > 0.3 ? "RELEASED" : "PENDING_APPROVAL",
                tx: "0x" + Math.random().toString(16).slice(2, 10),
            }, ...p.slice(0, 19)]);
        }, 7000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "fleets", label: "Fleets" },
        { id: "payments", label: "Payments" },
        { id: "maintenance", label: "Maintenance" },
        { id: "contracts", label: "Contracts" },
        { id: "analytics", label: "Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const totalVehicles = MOCK_FLEETS.reduce((s, f) => s + f.vehicles, 0);
    const totalEscrow = MOCK_FLEETS.reduce((s, f) => s + f.escrowBalance, 0);

    return (
        <div style={{ background: S.bg, color: S.text, fontFamily: "'Inter',sans-serif", padding: 24, minHeight: "100vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <span style={{ fontSize: 28 }}>&#128666;</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20, color: S.accent }}>FleetDeFi Agent</h2>
                    <span style={{ color: S.muted, fontSize: 12 }}>Decentralized fleet leasing, maintenance escrows, usage-based insurance</span>
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

            {/* ── Fleets Tab ────────────────────────────────────────────── */}
            {tab === "fleets" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                            {[
                                ["Total Vehicles", totalVehicles, S.accent],
                                ["Total Escrow", "$" + (totalEscrow / 1000).toFixed(0) + "K", "#00FF88"],
                                ["Active Fleets", MOCK_FLEETS.filter(f => f.status === "ACTIVE").length, "#3B82F6"],
                            ].map(([label, val, c], i) => (
                                <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, textAlign: "center" }}>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{val}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{label}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                                <tr style={{ color: S.muted, borderBottom: `1px solid ${S.border}` }}>
                                    <th style={{ textAlign: "left", padding: "8px 6px" }}>Fleet</th>
                                    <th style={{ textAlign: "left", padding: "8px 6px" }}>Company</th>
                                    <th style={{ textAlign: "right", padding: "8px 6px" }}>Vehicles</th>
                                    <th style={{ textAlign: "right", padding: "8px 6px" }}>Monthly</th>
                                    <th style={{ textAlign: "center", padding: "8px 6px" }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_FLEETS.map((f, i) => (
                                    <tr key={i} onClick={() => setSel(f)} style={{
                                        cursor: "pointer", borderBottom: `1px solid ${S.border}`,
                                        background: sel?.id === f.id ? S.accent + "11" : "transparent",
                                    }}>
                                        <td style={{ padding: "8px 6px", fontFamily: S.mono, fontSize: 11, color: S.accent }}>{f.id}</td>
                                        <td style={{ padding: "8px 6px" }}>{f.company}</td>
                                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: S.mono }}>{f.vehicles}</td>
                                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: S.mono }}>${f.monthlyPayment.toLocaleString()}</td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{ color: STATUS_COLORS[f.status], fontSize: 11 }}>{f.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontSize: 16, color: S.accent }}>{sel.company}</h3>
                                <button onClick={() => setSel(null)} style={{ background: "transparent", border: "none", color: S.muted, cursor: "pointer" }}>X</button>
                            </div>
                            {[
                                ["Fleet ID", sel.id],
                                ["Vehicles Total", sel.vehicles],
                                ["Leased", sel.leased],
                                ["Avg Mileage", sel.avgMileage.toLocaleString() + " km"],
                                ["Monthly Payment", "$" + sel.monthlyPayment.toLocaleString()],
                                ["Escrow Balance", "$" + sel.escrowBalance.toLocaleString()],
                                ["Maintenance Pool", "$" + sel.maintenancePool.toLocaleString()],
                                ["Type", sel.type],
                                ["Country", sel.country],
                            ].map(([k, v], i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${S.border}`, fontSize: 12 }}>
                                    <span style={{ color: S.muted }}>{k}</span>
                                    <span style={{ fontFamily: S.mono, fontSize: 11 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 16 }}>
                                <span style={{ color: S.muted, fontSize: 11 }}>Escrow Utilization</span>
                                <div style={{ marginTop: 4, height: 6, background: S.border, borderRadius: 3 }}>
                                    <div style={{ height: "100%", width: `${(sel.maintenancePool / sel.escrowBalance * 100).toFixed(0)}%`, background: S.accent, borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 10, color: S.muted }}>{(sel.maintenancePool / sel.escrowBalance * 100).toFixed(1)}% allocated to maintenance</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Payments Tab ──────────────────────────────────────────── */}
            {tab === "payments" && (
                <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr style={{ color: S.muted, borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>Time</th>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>Fleet</th>
                                <th style={{ textAlign: "right", padding: "8px 6px" }}>Amount</th>
                                <th style={{ textAlign: "center", padding: "8px 6px" }}>Type</th>
                                <th style={{ textAlign: "center", padding: "8px 6px" }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((p, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                                    <td style={{ padding: "8px 6px", fontFamily: S.mono, color: S.muted, fontSize: 11 }}>{p.time}</td>
                                    <td style={{ padding: "8px 6px", fontFamily: S.mono, color: S.accent, fontSize: 11 }}>{p.fleet}</td>
                                    <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: S.mono }}>${p.amount.toLocaleString()}</td>
                                    <td style={{ textAlign: "center" }}>
                                        <span style={{ background: S.accent + "22", color: S.accent, padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>{p.type}</span>
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                                        <span style={{ color: p.status === "RELEASED" ? "#00FF88" : "#FFD700", fontSize: 11 }}>{p.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Maintenance Tab ───────────────────────────────────────── */}
            {tab === "maintenance" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 16, color: S.accent }}>Maintenance Trigger Pipeline</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 20 }}>
                        {["OBD-II Alert", "Claim Filed", "AI Verify", "Lessor Approve", "Escrow Release"].map((step, i) => (
                            <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{i + 1}</div>
                                <div style={{ fontSize: 10, color: S.muted }}>{step}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        {MOCK_FLEETS.map((f, i) => (
                            <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                    <span style={{ fontWeight: 600, color: S.accent }}>{f.id} - {f.company}</span>
                                    <span style={{ color: TYPE_COLORS[f.type] || S.muted, fontSize: 11 }}>{f.type}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                                    <span style={{ color: S.muted }}>Pool</span>
                                    <span>${f.maintenancePool.toLocaleString()}</span>
                                </div>
                                <div style={{ height: 4, background: S.border, borderRadius: 2 }}>
                                    <div style={{ height: "100%", width: `${Math.min(100, (f.maintenancePool / f.escrowBalance) * 100)}%`, background: f.status === "WARNING" ? "#FFD700" : S.accent2, borderRadius: 2 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Contracts Tab ─────────────────────────────────────────── */}
            {tab === "contracts" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 12, color: S.accent }}>FleetLeaseEscrow.sol</h3>
                    <pre style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, fontSize: 11, fontFamily: S.mono, color: "#00FF88", overflow: "auto", maxHeight: 400 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {/* ── Analytics Tab ─────────────────────────────────────────── */}
            {tab === "analytics" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 16, color: S.accent }}>Revenue Model &mdash; FleetDeFi</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                        {[
                            ["Lease Origination", "1% of contract value", "One-time fee when fleet lease is created on-chain"],
                            ["Monthly Escrow Fee", "0.3% of payment", "Fee on each automated lease payment release"],
                            ["Maintenance Escrow", "0.5% of claim", "Fee on approved maintenance disbursements"],
                            ["Insurance Pool", "2% premium share", "Commission on usage-based fleet insurance premiums"],
                            ["Vehicle Telematics", "0.1 BEZ / data point", "IoT data fed to on-chain maintenance triggers"],
                            ["Fleet Analytics API", "SaaS subscription", "Dashboard and API for fleet health scoring"],
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
          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: S.card || S.panel, border: "1px solid " + (S.border), borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — FLEETDEFI
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/fleetdefi/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="fleetdefi" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
