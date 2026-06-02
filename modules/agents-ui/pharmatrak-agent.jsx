import { useState, useEffect, useCallback } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── PHARMA SUPPLY CHAIN MOCK DATA ──────────────────────────────────────────
const MOCK_LOTS = [
    { lotId: "LOT-2026-AMX-0042", drug: "Amoxicillin 500mg", batch: "BT-A7821", manufacturer: "Laboratorios Cinfa", origin: "Pamplona, ES", destination: "Hospital Clinic Barcelona", status: "IN_TRANSIT", temp: 22.1, tempRange: [15, 25], humidity: 45, rfid: "RFID-A3F2C821", chain: ["Factory", "QC Lab", "Warehouse", "Distribution", "Transit"], currentStep: 4, ndc: "00069-1530-01", expiry: "2028-06-15", quantity: 10000, unitCost: 0.32, certHash: "0x7a2f...d193" },
    { lotId: "LOT-2026-INS-0015", drug: "Insulin Glargine 100U/mL", batch: "BT-G9014", manufacturer: "Novo Nordisk", origin: "Copenhagen, DK", destination: "Hospital La Paz Madrid", status: "COLD_CHAIN", temp: 4.2, tempRange: [2, 8], humidity: 38, rfid: "RFID-B8D1E504", chain: ["Factory", "QC Lab", "Cold Storage", "Reefer Truck", "Transit"], currentStep: 4, ndc: "00169-7501-11", expiry: "2027-03-20", quantity: 2500, unitCost: 28.50, certHash: "0x3e91...b427" },
    { lotId: "LOT-2026-ONC-0008", drug: "Trastuzumab 150mg IV", batch: "BT-H4302", manufacturer: "Roche Pharma", origin: "Basel, CH", destination: "Hospital Vall Hebron Barcelona", status: "QC_CHECK", temp: -18.5, tempRange: [-25, -15], humidity: 12, rfid: "RFID-C2A7F913", chain: ["Factory", "QC Lab", "Cryogenic Storage", "Customs", "QC Recheck"], currentStep: 4, ndc: "50242-0134-68", expiry: "2027-11-30", quantity: 200, unitCost: 1850.00, certHash: null },
    { lotId: "LOT-2026-VXN-0091", drug: "mRNA COVID Booster BA.7", batch: "BT-M2210", manufacturer: "BioNTech SE", origin: "Mainz, DE", destination: "Ministerio Sanidad Madrid", status: "COLD_CHAIN", temp: -72.4, tempRange: [-80, -60], humidity: 5, rfid: "RFID-D5E3B028", chain: ["Factory", "Ultra-Cold", "Air Freight", "Customs", "Ultra-Cold Hub"], currentStep: 3, ndc: "59267-1000-01", expiry: "2026-09-01", quantity: 50000, unitCost: 19.50, certHash: "0xbb4c...1fa8" },
    { lotId: "LOT-2026-ABX-0033", drug: "Vancomycin 1g IV", batch: "BT-V6617", manufacturer: "Pfizer Inc", origin: "New York, US", destination: "Hospital Gregorio Maranon Madrid", status: "DELIVERED", temp: 21.8, tempRange: [15, 30], humidity: 40, rfid: "RFID-E9F4A721", chain: ["Factory", "QC Lab", "Warehouse", "Air Freight", "Delivered"], currentStep: 5, ndc: "00049-0180-20", expiry: "2028-01-10", quantity: 5000, unitCost: 12.75, certHash: "0x61da...7c50" },
    { lotId: "LOT-2026-ANS-0019", drug: "Propofol 10mg/mL", batch: "BT-P1106", manufacturer: "Fresenius Kabi", origin: "Dublin, IE", destination: "Hospital del Mar Barcelona", status: "ALERT", temp: 28.7, tempRange: [15, 25], humidity: 62, rfid: "RFID-F1C2D309", chain: ["Factory", "QC Lab", "Warehouse", "Ground Transport", "TEMP ALERT"], currentStep: 4, ndc: "63323-0269-29", expiry: "2027-04-22", quantity: 3000, unitCost: 8.90, certHash: null },
];

const STATUS_COLORS = {
    IN_TRANSIT: { bg: "rgba(0,212,255,0.12)", text: "#00D4FF", border: "rgba(0,212,255,0.3)" },
    COLD_CHAIN: { bg: "rgba(59,130,246,0.12)", text: "#3B82F6", border: "rgba(59,130,246,0.3)" },
    QC_CHECK: { bg: "rgba(255,215,0,0.12)", text: "#FFD700", border: "rgba(255,215,0,0.3)" },
    DELIVERED: { bg: "rgba(0,255,136,0.12)", text: "#00FF88", border: "rgba(0,255,136,0.3)" },
    ALERT: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", border: "rgba(239,68,68,0.3)" },
    RECALLED: { bg: "rgba(239,68,68,0.20)", text: "#FF4444", border: "rgba(239,68,68,0.5)" },
};

const CONTRACT_ABI = `// PharmaTracker.sol - BeZhas Pharmaceutical Supply Chain
// Standard: BeZhas Custom + ERC-1155 (batch tokens)

struct PharmaBatch {
  string  lotId;          // Unique lot identifier
  string  ndc;            // National Drug Code
  bytes32 certHash;       // QualityOracle certificate hash
  address manufacturer;
  address currentCustodian;
  uint256 quantity;
  int16   minTemp;        // Celsius * 10
  int16   maxTemp;        // Celsius * 10
  uint256 expiryDate;
  BatchStatus status;
}

enum BatchStatus {
  IN_TRANSIT, COLD_CHAIN, QC_CHECK, DELIVERED, ALERT, RECALLED
}

struct TemperatureLog {
  uint256 timestamp;
  int16   tempCelsius;    // * 10 for one decimal
  uint8   humidity;
  bytes32 rfidSignature;  // IoT device signature
  address reporter;
}

// Register new pharmaceutical batch
function registerBatch(
  string  calldata lotId,
  string  calldata ndc,
  bytes32 certHash,
  uint256 quantity,
  int16   minTemp,
  int16   maxTemp,
  uint256 expiryDate
) external onlyRole(MANUFACTURER_ROLE) returns (uint256 batchId);

// Log temperature reading from IoT sensor
function logTemperature(
  uint256 batchId,
  int16   tempCelsius,
  uint8   humidity,
  bytes32 rfidSignature
) external onlyRole(LOGISTICS_ROLE);

// Transfer custody of batch
function transferCustody(
  uint256 batchId,
  address newCustodian,
  string  calldata location
) external;

// Trigger quality alert if temp out of range
function triggerAlert(
  uint256 batchId,
  string  calldata reason
) external;

// Verify entire chain of custody (public)
function verifyChain(
  uint256 batchId
) external view returns (TemperatureLog[] memory, address[] memory custodians);

// Anti-counterfeit: verify QualityOracle certificate
function verifyCertificate(
  uint256 batchId,
  bytes   calldata oracleSignature
) external view returns (bool authentic);`;

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function PharmaTrakAgent() {
  const bridge = useAgentBridge("pharmatrak");
    const [tab, setTab] = useState("supply");
    const [selectedLot, setSelectedLot] = useState(null);
    const [logs, setLogs] = useState([]);
    const [alerts, setAlerts] = useState(1);
    const [stats, setStats] = useState({
        activeLots: 342, deliveredMTD: 128, alerts: 7, avgTransitHrs: 48.6,
        tempBreaches: 3, antiCounterfeitScans: 1247, verifiedAuth: 1239,
    });
    const [bezFees, setBezFees] = useState(0);

    const addLog = useCallback((msg) => {
        setLogs(prev => [{ ts: new Date().toISOString().slice(0, 16).replace("T", " "), msg }, ...prev.slice(0, 49)]);
    }, []);

    useEffect(() => {
        const iv = setInterval(() => {
            setBezFees(f => +(f + 0.015).toFixed(4));
            setStats(s => ({
                ...s,
                activeLots: s.activeLots + (Math.random() > 0.8 ? 1 : 0),
                deliveredMTD: s.deliveredMTD + (Math.random() > 0.9 ? 1 : 0),
                antiCounterfeitScans: s.antiCounterfeitScans + Math.floor(Math.random() * 2),
            }));
        }, 7000);
        return () => clearInterval(iv);
    }, []);

    const tabs = [
        { id: "supply", label: "Supply Chain", icon: "💊" },
        { id: "verify", label: "Anti-Counterfeit", icon: "🔍" },
        { id: "cold", label: "Cold Chain", icon: "❄" },
        { id: "contracts", label: "Contracts", icon: "📜" },
        { id: "stats", label: "Analytics", icon: "📊" }, "metrics",
    ];

    const S = {
        bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
        accent: "#00D4FF", accent2: "#00FF88", warn: "#FFD700", danger: "#EF4444",
        text: "#e2e8f0", muted: "#64748b",
        mono: "'JetBrains Mono','Courier New',monospace",
    };

    const getTempColor = (temp, range) => {
        if (temp < range[0] || temp > range[1]) return S.danger;
        const mid = (range[0] + range[1]) / 2;
        const dist = Math.abs(temp - mid) / ((range[1] - range[0]) / 2);
        return dist > 0.7 ? S.warn : S.accent2;
    };

    return (
        <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.mono, color: S.text, padding: 0 }}>
            <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: `linear-gradient(rgba(0,212,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.02) 1px, transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: `1px solid ${S.border}`, paddingBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 10, letterSpacing: 4, color: S.accent, textTransform: "uppercase", marginBottom: 4 }}>Phase 3 - Healthcare</div>
                        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, background: `linear-gradient(135deg, #fff 0%, ${S.accent} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            PharmaTrak Agent
                        </h1>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: S.muted }}>Pharmaceutical Supply Chain - Anti-Counterfeit + Cold Chain IoT</p>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ padding: "8px 16px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 3, fontSize: 12 }}>
                            <span style={{ color: S.muted }}>Fees: </span><span style={{ color: S.accent, fontWeight: 700 }}>{bezFees.toFixed(4)} BEZ</span>
                        </div>
                        {alerts > 0 && (
                            <div style={{ padding: "8px 16px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 3, fontSize: 12, color: S.danger, fontWeight: 700, animation: "pulse 2s infinite" }}>
                                {alerts} TEMP ALERT
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            padding: "10px 20px", background: tab === t.id ? S.accent : "transparent",
                            color: tab === t.id ? "#000" : S.muted, border: `1px solid ${tab === t.id ? S.accent : S.border}`,
                            borderRadius: 3, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: S.mono,
                            letterSpacing: 1, transition: "all 0.2s",
                        }}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* ── TAB: Supply Chain ─────────────────────────────────────── */}
                {tab === "supply" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                            {[
                                { label: "Active Lots", value: stats.activeLots.toString(), color: S.accent },
                                { label: "Delivered (MTD)", value: stats.deliveredMTD.toString(), color: S.accent2 },
                                { label: "Temp Alerts", value: stats.alerts.toString(), color: S.danger },
                                { label: "Avg Transit", value: `${stats.avgTransitHrs}h`, color: S.warn },
                            ].map((s, i) => (
                                <div key={i} style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2, marginBottom: 4 }}>{s.label.toUpperCase()}</div>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                <thead>
                                    <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                                        {["Lot ID", "Drug", "Manufacturer", "Status", "Temp", "Progress", "RFID", "Actions"].map(h => (
                                            <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: S.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {MOCK_LOTS.map(lot => {
                                        const sc = STATUS_COLORS[lot.status] || STATUS_COLORS.IN_TRANSIT;
                                        const tc = getTempColor(lot.temp, lot.tempRange);
                                        return (
                                            <tr key={lot.lotId} onClick={() => setSelectedLot(lot)} style={{ borderBottom: `1px solid ${S.border}`, cursor: "pointer" }}
                                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                                <td style={{ padding: "10px 12px", fontWeight: 700, color: S.accent }}>{lot.lotId}</td>
                                                <td style={{ padding: "10px 12px", maxWidth: 160 }}>{lot.drug}</td>
                                                <td style={{ padding: "10px 12px", color: S.muted, fontSize: 10 }}>{lot.manufacturer}</td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <span style={{ padding: "2px 8px", background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, borderRadius: 2, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{lot.status}</span>
                                                </td>
                                                <td style={{ padding: "10px 12px", color: tc, fontWeight: 700 }}>
                                                    {lot.temp > 0 ? "+" : ""}{lot.temp}C
                                                    <span style={{ color: S.muted, fontSize: 9, marginLeft: 4 }}>({lot.tempRange.join("~")})</span>
                                                </td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <div style={{ display: "flex", gap: 3 }}>
                                                        {lot.chain.map((step, i) => (
                                                            <div key={i} style={{ width: 18, height: 4, borderRadius: 2, background: i < lot.currentStep ? S.accent2 : "rgba(255,255,255,0.1)" }} title={step} />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={{ padding: "10px 12px", fontSize: 9, color: S.muted }}>{lot.rfid}</td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <button onClick={e => { e.stopPropagation(); addLog(`Scanned RFID ${lot.rfid} for ${lot.lotId}`); }} style={{ padding: "4px 10px", background: "rgba(0,212,255,0.1)", color: S.accent, border: `1px solid rgba(0,212,255,0.3)`, borderRadius: 2, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: S.mono }}>
                                                        SCAN
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {selectedLot && (
                            <div style={{ marginTop: 24, padding: 20, background: S.card, border: `1px solid ${S.accent}`, borderRadius: 4 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                        <h3 style={{ margin: "0 0 8px", color: S.accent }}>{selectedLot.drug}</h3>
                                        <div style={{ display: "flex", gap: 16, fontSize: 11, color: S.muted }}>
                                            <span>Lot: {selectedLot.lotId}</span><span>NDC: {selectedLot.ndc}</span>
                                            <span>Qty: {selectedLot.quantity.toLocaleString()}</span><span>Batch: {selectedLot.batch}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedLot(null)} style={{ background: "none", border: "none", color: S.muted, cursor: "pointer", fontSize: 18 }}>X</button>
                                </div>
                                <div style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                                    {selectedLot.chain.map((step, i) => (
                                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <div style={{ padding: "8px 14px", borderRadius: 3, border: `1px solid ${i < selectedLot.currentStep ? "rgba(0,255,136,0.3)" : S.border}`, background: i < selectedLot.currentStep ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.02)", color: i < selectedLot.currentStep ? S.accent2 : S.muted, fontSize: 11, fontWeight: 700 }}>
                                                {i < selectedLot.currentStep ? "OK" : "--"} {step}
                                            </div>
                                            {i < selectedLot.chain.length - 1 && <span style={{ color: S.muted }}>-&gt;</span>}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
                                    <div style={{ padding: 10, background: "rgba(0,0,0,0.3)", borderRadius: 3 }}>
                                        <div style={{ fontSize: 9, color: S.muted, letterSpacing: 2 }}>ORIGIN</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: S.text, marginTop: 2 }}>{selectedLot.origin}</div>
                                    </div>
                                    <div style={{ padding: 10, background: "rgba(0,0,0,0.3)", borderRadius: 3 }}>
                                        <div style={{ fontSize: 9, color: S.muted, letterSpacing: 2 }}>DESTINATION</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: S.text, marginTop: 2 }}>{selectedLot.destination}</div>
                                    </div>
                                    <div style={{ padding: 10, background: "rgba(0,0,0,0.3)", borderRadius: 3 }}>
                                        <div style={{ fontSize: 9, color: S.muted, letterSpacing: 2 }}>UNIT COST</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: S.warn, marginTop: 2 }}>${selectedLot.unitCost.toFixed(2)}</div>
                                    </div>
                                    <div style={{ padding: 10, background: "rgba(0,0,0,0.3)", borderRadius: 3 }}>
                                        <div style={{ fontSize: 9, color: S.muted, letterSpacing: 2 }}>EXPIRY</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: S.text, marginTop: 2 }}>{selectedLot.expiry}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: Anti-Counterfeit ────────────────────────────────── */}
                {tab === "verify" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                            <div style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                <h3 style={{ margin: "0 0 16px", color: S.accent, fontSize: 16 }}>RFID / NFC Scan Verification</h3>
                                <p style={{ fontSize: 11, color: S.muted, lineHeight: 1.5 }}>
                                    Each pharmaceutical package carries an RFID tag signed by the manufacturer. The tag contains a SHA-256 hash linked
                                    to the on-chain QualityOracle certificate. Scanning verifies authenticity in real-time.
                                </p>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                                    <div style={{ padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 3, borderLeft: `2px solid ${S.accent2}` }}>
                                        <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2 }}>TOTAL SCANS</div>
                                        <div style={{ fontSize: 20, fontWeight: 900, color: S.accent2, marginTop: 4 }}>{stats.antiCounterfeitScans.toLocaleString()}</div>
                                    </div>
                                    <div style={{ padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 3, borderLeft: `2px solid ${S.accent}` }}>
                                        <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2 }}>VERIFIED AUTH.</div>
                                        <div style={{ fontSize: 20, fontWeight: 900, color: S.accent, marginTop: 4 }}>{stats.verifiedAuth.toLocaleString()}</div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 12, padding: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 3 }}>
                                    <div style={{ fontSize: 10, color: S.danger, fontWeight: 700, letterSpacing: 2 }}>COUNTERFEITS DETECTED</div>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: S.danger, marginTop: 4 }}>{stats.antiCounterfeitScans - stats.verifiedAuth}</div>
                                </div>
                            </div>
                            <div style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                <h3 style={{ margin: "0 0 16px", color: S.accent, fontSize: 16 }}>Verification Flow</h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
                                    {[
                                        { step: "1", label: "Scan RFID/NFC Tag", desc: "IoT reader captures encrypted tag" },
                                        { step: "2", label: "Extract Certificate Hash", desc: "SHA-256 from tag payload" },
                                        { step: "3", label: "Query PharmaTracker.sol", desc: "verifyCertificate(batchId, sig)" },
                                        { step: "4", label: "QualityOracle Verify", desc: "Cross-reference manufacturer cert" },
                                        { step: "5", label: "Result: AUTH / COUNTERFEIT", desc: "Logged on-chain immutably" },
                                    ].map((s, i) => (
                                        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                            <div style={{ minWidth: 28, height: 28, borderRadius: "50%", background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: S.accent }}>{s.step}</div>
                                            <div>
                                                <div style={{ fontWeight: 700, color: S.text }}>{s.label}</div>
                                                <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{s.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB: Cold Chain ──────────────────────────────────────── */}
                {tab === "cold" && (
                    <div>
                        <h2 style={{ margin: "0 0 16px", fontSize: 16, color: S.accent }}>Cold Chain Monitoring - IoT Sensors</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
                            {MOCK_LOTS.filter(l => l.tempRange[1] < 30).map(lot => {
                                const tc = getTempColor(lot.temp, lot.tempRange);
                                const isAlert = lot.temp < lot.tempRange[0] || lot.temp > lot.tempRange[1];
                                return (
                                    <div key={lot.lotId} style={{ padding: 16, background: S.card, border: `1px solid ${isAlert ? "rgba(239,68,68,0.4)" : S.border}`, borderRadius: 4 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{lot.drug}</div>
                                                <div style={{ fontSize: 10, color: S.muted }}>{lot.lotId}</div>
                                            </div>
                                            <span style={{ padding: "3px 10px", borderRadius: 2, fontSize: 10, fontWeight: 700, background: isAlert ? "rgba(239,68,68,0.12)" : "rgba(0,255,136,0.12)", color: isAlert ? S.danger : S.accent2, border: `1px solid ${isAlert ? "rgba(239,68,68,0.3)" : "rgba(0,255,136,0.3)"}` }}>
                                                {isAlert ? "TEMP BREACH" : "NOMINAL"}
                                            </span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                            <div style={{ fontSize: 32, fontWeight: 900, color: tc }}>{lot.temp > 0 ? "+" : ""}{lot.temp}C</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: S.muted, marginBottom: 4 }}>
                                                    <span>{lot.tempRange[0]}C</span><span>{lot.tempRange[1]}C</span>
                                                </div>
                                                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, position: "relative" }}>
                                                    <div style={{ position: "absolute", left: `${Math.max(0, Math.min(100, (lot.temp - lot.tempRange[0]) / (lot.tempRange[1] - lot.tempRange[0]) * 100))}%`, top: -2, width: 10, height: 10, borderRadius: "50%", background: tc, transform: "translateX(-50%)" }} />
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: 10, color: S.muted }}>
                                            <span>Humidity: {lot.humidity}%</span><span>RFID: {lot.rfid}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── TAB: Contracts ───────────────────────────────────────── */}
                {tab === "contracts" && (
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <h2 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>PharmaTracker.sol - Supply Chain</h2>
                            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                                {[
                                    { label: "Standard", value: "Custom + ERC-1155" },
                                    { label: "Oracle", value: "QualityOracle.sol" },
                                    { label: "IoT", value: "RFID / NFC" },
                                    { label: "Compliance", value: "EU FMD + FDA DSCSA" },
                                ].map((d, i) => (
                                    <div key={i} style={{ padding: "8px 14px", background: S.card, border: `1px solid ${S.border}`, borderRadius: 3 }}>
                                        <div style={{ fontSize: 9, color: S.muted, letterSpacing: 2 }}>{d.label.toUpperCase()}</div>
                                        <div style={{ fontSize: 12, color: S.accent, fontWeight: 700, marginTop: 2 }}>{d.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <pre style={{ padding: 20, background: "#0a0a0a", border: `1px solid ${S.border}`, borderRadius: 4, fontSize: 11, lineHeight: 1.6, color: "#93c5fd", overflow: "auto", maxHeight: 500 }}>
                            {CONTRACT_ABI}
                        </pre>
                    </div>
                )}

                {/* ── TAB: Analytics ───────────────────────────────────────── */}
                {tab === "stats" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                            {[
                                { label: "Temp Breaches (MTD)", value: stats.tempBreaches.toString(), desc: "Cold chain violations", color: S.danger },
                                { label: "Authenticity Rate", value: `${((stats.verifiedAuth / stats.antiCounterfeitScans) * 100).toFixed(1)}%`, desc: "Anti-counterfeit success", color: S.accent2 },
                                { label: "Avg Transit Time", value: `${stats.avgTransitHrs}hrs`, desc: "Factory to hospital", color: S.accent },
                                { label: "Revenue (MTD)", value: "$38,500", desc: "Tracking + verification fees", color: S.warn },
                                { label: "Active Manufacturers", value: "47", desc: "Registered partners", color: "#7C3AED" },
                                { label: "Compliance Score", value: "99.7%", desc: "EU FMD + FDA DSCSA", color: S.accent2 },
                            ].map((s, i) => (
                                <div key={i} style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2, marginBottom: 4 }}>{s.label.toUpperCase()}</div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: s.color, margin: "4px 0" }}>{s.value}</div>
                                    <p style={{ margin: 0, fontSize: 10, color: S.muted }}>{s.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: 20, background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 4 }}>
                            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: S.accent, letterSpacing: 2 }}>REVENUE MODEL</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 12 }}>
                                {[
                                    { stream: "Batch Registration", fee: "0.3 BEZ/lot", model: "Manufacturer pays" },
                                    { stream: "RFID Scan", fee: "0.05 BEZ/scan", model: "Per-verification" },
                                    { stream: "Cold Chain IoT", fee: "100 BEZ/month", model: "Sensor subscription" },
                                    { stream: "QC Oracle", fee: "0.2 BEZ/cert", model: "Certificate issuance" },
                                    { stream: "Compliance Report", fee: "50 BEZ/report", model: "Regulatory export" },
                                    { stream: "Alert System", fee: "0.5 BEZ/alert", model: "Automated notification" },
                                ].map((r, i) => (
                                    <div key={i} style={{ padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 3, borderLeft: `2px solid ${S.accent}` }}>
                                        <div style={{ fontWeight: 700, color: S.text, marginBottom: 4 }}>{r.stream}</div>
                                        <div style={{ color: S.accent, fontWeight: 700 }}>{r.fee}</div>
                                        <div style={{ color: S.muted, fontSize: 10, marginTop: 2 }}>{r.model}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: S.card || S.panel, border: "1px solid " + (S.border), borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — PHARMATRAK
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/pharmatrak/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="pharmatrak" accentColor={S.accent} />
            </div>
          )}

            </div>
        </div>
    );
}
