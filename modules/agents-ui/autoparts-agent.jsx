import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_PARTS = [
    { serialNo: "BRK-2024-EU-08821", name: "Ceramic Brake Pad Set", manufacturer: "Brembo", oem: "BMW", batchId: "BATCH-EU-442", origin: "IT", status: "VERIFIED", counterfeit: false, recallId: null, tokenId: "BEZ-AP-00101", price: 285, category: "BRAKES" },
    { serialNo: "BAT-2025-CN-44010", name: "Li-Ion 75kWh Pack", manufacturer: "CATL", oem: "Tesla", batchId: "BATCH-CN-881", origin: "CN", status: "VERIFIED", counterfeit: false, recallId: null, tokenId: "BEZ-AP-00102", price: 8900, category: "BATTERY" },
    { serialNo: "ECU-2024-DE-33201", name: "Engine Control Module v4.2", manufacturer: "Bosch", oem: "Volkswagen", batchId: "BATCH-DE-220", origin: "DE", status: "VERIFIED", counterfeit: false, recallId: null, tokenId: "BEZ-AP-00103", price: 1450, category: "ELECTRONICS" },
    { serialNo: "AIR-2024-JP-99101", name: "HEPA Cabin Air Filter", manufacturer: "Denso", oem: "Toyota", batchId: "BATCH-JP-115", origin: "JP", status: "SUSPECT", counterfeit: true, recallId: null, tokenId: "BEZ-AP-00104", price: 42, category: "FILTERS" },
    { serialNo: "TRN-2025-US-55701", name: "8-Speed Auto Transmission", manufacturer: "ZF", oem: "Ford", batchId: "BATCH-US-331", origin: "US", status: "RECALLED", counterfeit: false, recallId: "RCL-2025-008", tokenId: "BEZ-AP-00105", price: 4200, category: "DRIVETRAIN" },
    { serialNo: "SEN-2025-KR-77201", name: "LiDAR Sensor Array v3", manufacturer: "Samsung SDI", oem: "Hyundai", batchId: "BATCH-KR-090", origin: "KR", status: "PENDING", counterfeit: false, recallId: null, tokenId: null, price: 3100, category: "SENSORS" },
];

const MOCK_CUSTODY = [
    { time: "14:45:12", serial: "BRK-2024...821", from: "Brembo Factory IT", to: "BMW Logistics DE", temp: "22C", humidity: "45%", tx: "0x7f3a...c4e2" },
    { time: "14:20:33", serial: "BAT-2025...010", from: "CATL Ningde CN", to: "Tesla Shanghai CN", temp: "18C", humidity: "30%", tx: "0x2b8d...f901" },
    { time: "13:58:01", serial: "ECU-2024...201", from: "Bosch Reutlingen DE", to: "VW Wolfsburg DE", temp: "21C", humidity: "42%", tx: "0xa12c...8834" },
    { time: "12:30:10", serial: "TRN-2025...701", from: "ZF Saarbrucken DE", to: "RECALL CENTER US", temp: "20C", humidity: "38%", tx: "0x5e9f...2217" },
];

const STATUS_COLORS = { VERIFIED: "#00FF88", PENDING: "#3B82F6", SUSPECT: "#EF4444", RECALLED: "#F97316" };
const CAT_COLORS = { BRAKES: "#EF4444", BATTERY: "#10B981", ELECTRONICS: "#3B82F6", FILTERS: "#A78BFA", DRIVETRAIN: "#F59E0B", SENSORS: "#06B6D4" };

const CONTRACT_ABI = `// AutoPartsRegistry.sol  -  BeZhas Chain
// Supply chain tracking with manufacturer verification & recall management

struct Part {
  string   serialNumber;
  string   name;
  address  manufacturer;
  string   batchId;
  uint256  registeredAt;
  bool     verified;
  bool     recalled;
  string   recallReason;
}

struct CustodyLog {
  address  fromEntity;
  address  toEntity;
  uint256  timestamp;
  bytes32  conditionProof; // hash of temp/humidity IoT data
}

function registerPart(
  string serialNumber, string name, string batchId
) external onlyRole(MANUFACTURER_ROLE) returns (uint256 partId);

function verifyAuthenticity(uint256 partId) external onlyRole(INSPECTOR_ROLE);
function transferCustody(uint256 partId, address to, bytes32 conditionProof) external;
function issueRecall(string batchId, string reason) external onlyRole(MANUFACTURER_ROLE);
function isCounterfeit(uint256 partId) view returns (bool);`;

const S = {
    bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
    accent: "#F97316", accent2: "#00FF88", text: "#e2e8f0", muted: "#64748b", mono: "'Courier New',monospace",
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function AutoPartsAgent() {
    const bridge = useAgentBridge('autoparts');
    const [tab, setTab] = useState("inventory");
    const [sel, setSel] = useState(null);
    const [custody, setCustody] = useState(MOCK_CUSTODY);

    useEffect(() => {
        const iv = setInterval(() => {
            const mfrs = ["Bosch", "Denso", "CATL", "ZF", "Brembo", "Continental"];
            const cats = ["BRAKES", "BATTERY", "ELECTRONICS", "FILTERS", "DRIVETRAIN", "SENSORS"];
            const mfr = mfrs[Math.floor(Math.random() * mfrs.length)];
            const cat = cats[Math.floor(Math.random() * cats.length)];
            setCustody(p => [{
                time: new Date().toLocaleTimeString(), serial: cat.slice(0, 3) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(),
                from: mfr + " Factory", to: "OEM Logistics Hub", temp: (18 + Math.floor(Math.random() * 8)) + "C",
                humidity: (30 + Math.floor(Math.random() * 25)) + "%", tx: "0x" + Math.random().toString(16).slice(2, 10),
            }, ...p.slice(0, 19)]);
        }, 9000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "inventory", label: "Inventory" },
        { id: "custody", label: "Chain of Custody" },
        { id: "recalls", label: "Recalls" },
        { id: "contracts", label: "Contracts" },
        { id: "analytics", label: "Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, fontFamily: "'Inter',sans-serif", padding: 24, minHeight: "100vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <span style={{ fontSize: 28 }}>&#9881;</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20, color: S.accent }}>AutoParts Agent</h2>
                    <span style={{ color: S.muted, fontSize: 12 }}>Anti-counterfeit supply chain with recall management</span>
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

            {/* ── Inventory Tab ──────────────────────────────────────────── */}
            {tab === "inventory" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>Parts Registry ({MOCK_PARTS.length})</span>
                            <span style={{ color: S.muted, fontSize: 11 }}>Click row for details</span>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                                <tr style={{ color: S.muted, borderBottom: `1px solid ${S.border}` }}>
                                    <th style={{ textAlign: "left", padding: "8px 6px" }}>Serial</th>
                                    <th style={{ textAlign: "left", padding: "8px 6px" }}>Part Name</th>
                                    <th style={{ textAlign: "left", padding: "8px 6px" }}>Mfr</th>
                                    <th style={{ textAlign: "center", padding: "8px 6px" }}>Category</th>
                                    <th style={{ textAlign: "center", padding: "8px 6px" }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_PARTS.map((p, i) => (
                                    <tr key={i} onClick={() => setSel(p)} style={{
                                        cursor: "pointer", borderBottom: `1px solid ${S.border}`,
                                        background: sel?.serialNo === p.serialNo ? S.accent + "11" : "transparent",
                                    }}>
                                        <td style={{ padding: "8px 6px", fontFamily: S.mono, fontSize: 10, color: S.accent }}>{p.serialNo.slice(0, 14)}...</td>
                                        <td style={{ padding: "8px 6px", fontSize: 11 }}>{p.name.length > 25 ? p.name.slice(0, 25) + "..." : p.name}</td>
                                        <td style={{ padding: "8px 6px", fontSize: 11 }}>{p.manufacturer}</td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{ background: (CAT_COLORS[p.category] || "#666") + "22", color: CAT_COLORS[p.category] || "#999", padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>{p.category}</span>
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{ color: STATUS_COLORS[p.status] || S.text, fontSize: 11 }}>{p.status}</span>
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
                                ["Serial No", sel.serialNo],
                                ["Manufacturer", sel.manufacturer],
                                ["OEM Client", sel.oem],
                                ["Batch ID", sel.batchId],
                                ["Origin", sel.origin],
                                ["Token ID", sel.tokenId || "Pending"],
                                ["Price", "$" + sel.price.toLocaleString()],
                                ["Counterfeit?", sel.counterfeit ? "SUSPECT" : "CLEAN"],
                                ["Recall ID", sel.recallId || "None"],
                            ].map(([k, v], i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${S.border}`, fontSize: 12 }}>
                                    <span style={{ color: S.muted }}>{k}</span>
                                    <span style={{ fontFamily: S.mono, fontSize: 11, color: v === "SUSPECT" ? "#EF4444" : S.text }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Chain of Custody Tab ──────────────────────────────────── */}
            {tab === "custody" && (
                <div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                        {[
                            ["Custody Logs", custody.length, S.accent],
                            ["Verified Parts", MOCK_PARTS.filter(p => p.status === "VERIFIED").length, "#00FF88"],
                            ["Suspect / Recalled", MOCK_PARTS.filter(p => p.status === "SUSPECT" || p.status === "RECALLED").length, "#EF4444"],
                        ].map(([label, val, c], i) => (
                            <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{val}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{label}</div>
                            </div>
                        ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr style={{ color: S.muted, borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>Time</th>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>Serial</th>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>From</th>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>To</th>
                                <th style={{ textAlign: "center", padding: "8px 6px" }}>Temp</th>
                                <th style={{ textAlign: "center", padding: "8px 6px" }}>Humidity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {custody.map((c, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                                    <td style={{ padding: "8px 6px", fontFamily: S.mono, color: S.muted, fontSize: 11 }}>{c.time}</td>
                                    <td style={{ padding: "8px 6px", fontFamily: S.mono, fontSize: 11, color: S.accent }}>{c.serial}</td>
                                    <td style={{ padding: "8px 6px", fontSize: 11 }}>{c.from}</td>
                                    <td style={{ padding: "8px 6px", fontSize: 11 }}>{c.to}</td>
                                    <td style={{ textAlign: "center", fontFamily: S.mono, fontSize: 11 }}>{c.temp}</td>
                                    <td style={{ textAlign: "center", fontFamily: S.mono, fontSize: 11 }}>{c.humidity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Recalls Tab ───────────────────────────────────────────── */}
            {tab === "recalls" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 16, color: S.accent }}>Active Recalls</h3>
                    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontWeight: 600, color: "#F97316" }}>RCL-2025-008</span>
                            <span style={{ color: "#EF4444", fontSize: 12 }}>ACTIVE</span>
                        </div>
                        <div style={{ fontSize: 12, marginBottom: 8 }}>ZF 8-Speed Auto Transmission - Torque converter defect</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, fontSize: 11 }}>
                            <div><span style={{ color: S.muted }}>Affected Batch:</span> BATCH-US-331</div>
                            <div><span style={{ color: S.muted }}>Units:</span> 12,400</div>
                            <div><span style={{ color: S.muted }}>Returned:</span> 3,890 (31%)</div>
                        </div>
                        <div style={{ marginTop: 8, height: 4, background: S.border, borderRadius: 2 }}>
                            <div style={{ height: "100%", width: "31%", background: "#F97316", borderRadius: 2 }} />
                        </div>
                    </div>
                    <h4 style={{ fontSize: 13, marginBottom: 12, color: S.muted }}>Anti-Counterfeit Pipeline</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                        {["NFC/RFID Scan", "Hash Compare", "AI Visual", "Oracle Verify", "Flag/Clear"].map((step, i) => (
                            <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{i + 1}</div>
                                <div style={{ fontSize: 10, color: S.muted }}>{step}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Contracts Tab ─────────────────────────────────────────── */}
            {tab === "contracts" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 12, color: S.accent }}>AutoPartsRegistry.sol</h3>
                    <pre style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, fontSize: 11, fontFamily: S.mono, color: "#00FF88", overflow: "auto", maxHeight: 400 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {/* ── Analytics Tab ─────────────────────────────────────────── */}
            {tab === "analytics" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 16, color: S.accent }}>Revenue Model &mdash; AutoParts</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                        {[
                            ["Part Registration Fee", "0.3 BEZ / part", "One-time on-chain serial number registration"],
                            ["Authenticity Verification", "0.5 BEZ / scan", "NFC + AI visual hash comparison on-chain"],
                            ["Custody Transfer Log", "0.1 BEZ / hop", "Each supply chain handoff with IoT proof"],
                            ["Recall Management", "2.0 BEZ / batch", "Batch-level recall issuance & tracking"],
                            ["Counterfeit Detection API", "1.0 BEZ / query", "AI-powered serial & visual check service"],
                            ["OEM Data Feed", "SaaS subscription", "Real-time parts telemetry for manufacturers"],
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — AUTOPARTS</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="autoparts" accentColor="#F97316" />
                </div>
            )}
        </div>
    );
}
