import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_CERTS = [
    { id: "QC-2026-001", product: "Precision Gear Assembly", batch: "BATCH-9401", standard: "ISO 9001:2025", inspector: "SGS Global", issueDate: "2026-03-01", expiry: "2027-03-01", score: 98, status: "VALID", defects: 0 },
    { id: "QC-2026-002", product: "Carbon Fiber Panel A3", batch: "BATCH-8220", standard: "ISO 14001:2025", inspector: "Bureau Veritas", issueDate: "2026-02-15", expiry: "2027-02-15", score: 94, status: "VALID", defects: 1 },
    { id: "QC-2026-003", product: "Li-Ion Cell Module 48V", batch: "BATCH-7715", standard: "IEC 62133-2", inspector: "TÜV Rheinland", issueDate: "2026-01-20", expiry: "2027-01-20", score: 91, status: "VALID", defects: 2 },
    { id: "QC-2026-004", product: "Hydraulic Pump HP-500", batch: "BATCH-6103", standard: "ISO 9001:2025", inspector: "DNV GL", issueDate: "2025-11-10", expiry: "2026-11-10", score: 72, status: "WARNING", defects: 5 },
    { id: "QC-2026-005", product: "Steel Bracket SB-12", batch: "BATCH-5044", standard: "ASTM A36", inspector: "SGS Global", issueDate: "2025-08-01", expiry: "2026-08-01", score: 45, status: "REVOKED", defects: 12 },
    { id: "QC-2026-006", product: "PCB Controller v4.2", batch: "BATCH-4800", standard: "IPC-A-610G", inspector: "Intertek", issueDate: "2026-03-10", expiry: "2027-03-10", score: 99, status: "VALID", defects: 0 },
];

const MOCK_INSPECTIONS = [
    { time: "14:45:01", cert: "QC-2026-006", action: "CERT_ISSUED", inspector: "Intertek", result: "99/100 — Zero Defects" },
    { time: "14:12:33", cert: "QC-2026-004", action: "DEFECT_LOGGED", inspector: "DNV GL", result: "Seal degradation on unit #47" },
    { time: "13:50:20", cert: "QC-2026-003", action: "RECERTIFIED", inspector: "TÜV Rheinland", result: "Score improved 88→91" },
    { time: "13:22:05", cert: "QC-2026-005", action: "CERT_REVOKED", inspector: "SGS Global", result: "Critical fatigue cracks found" },
];

const STATUS_COLORS = { VALID: "#00FF88", WARNING: "#FFD700", EXPIRED: "#F97316", REVOKED: "#EF4444" };
const ACTION_COLORS = { CERT_ISSUED: "#00FF88", DEFECT_LOGGED: "#EF4444", RECERTIFIED: "#3B82F6", CERT_REVOKED: "#EF4444", INSPECTION: "#FFD700" };

const CONTRACT_ABI = `// QualityCertificateNFT.sol  —  BeZhas Chain
// ERC-721 quality certificates with inspection records & scoring

struct Certificate {
  string   productName;
  string   batchId;
  string   standard;       // ISO 9001, IEC 62133, etc.
  address  inspector;
  uint256  score;           // 0-100
  uint256  issuedAt;
  bool     valid;
  string   revokeReason;
}

struct DefectReport {
  uint256  certId;
  string   description;
  uint8    severity;        // 1=minor … 5=critical
  uint256  timestamp;
}

function mintCertificate(
  string productName, string batchId, string standard, uint256 score
) external returns (uint256 certId);

function logDefect(uint256 certId, string description, uint8 severity) external;
function revokeCertificate(uint256 certId, string reason) external;
function recertify(uint256 certId, uint256 newScore) external;
function getCertificate(uint256 certId) external view returns (Certificate);`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#00FF88", accent2: "#3B82F6", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function QualityChainAgent() {
    const bridge = useAgentBridge('qualitychain');
    const [tab, setTab] = useState("certs");
    const [sel, setSel] = useState(null);
    const [inspections, setInspections] = useState(MOCK_INSPECTIONS);

    useEffect(() => {
        const iv = setInterval(() => {
            const actions = ["CERT_ISSUED", "DEFECT_LOGGED", "INSPECTION", "RECERTIFIED"];
            const cert = MOCK_CERTS[Math.floor(Math.random() * MOCK_CERTS.length)];
            const action = actions[Math.floor(Math.random() * actions.length)];
            setInspections(p => [{
                time: new Date().toLocaleTimeString(), cert: cert.id, action,
                inspector: cert.inspector, result: action === "DEFECT_LOGGED" ? "Micro-crack on sample #" + Math.floor(Math.random() * 200) : `Score ${cert.score}/100`
            }, ...p].slice(0, 30));
        }, 9000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "certs", label: "📜 Certificates" },
        { id: "inspect", label: "🔍 Inspections" },
        { id: "defects", label: "⚠️ Defect Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📈 Metrics" },
    ];

    const validCount = MOCK_CERTS.filter(c => c.status === "VALID").length;
    const avgScore = Math.round(MOCK_CERTS.reduce((s, c) => s + c.score, 0) / MOCK_CERTS.length);
    const totalDefects = MOCK_CERTS.reduce((s, c) => s + c.defects, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>📜</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>QualityChain Agent — Manufacturing QA on-chain</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>NFT-based quality certificates · ISO compliance · Defect tracking</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#00FF8822", color: "#00FF88", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● ACTIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "certs" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Valid", validCount, "#00FF88"], ["Avg Score", avgScore + "/100", "#3B82F6"], ["Defects", totalDefects, "#EF4444"]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Product</th><th>Standard</th><th>Score</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_CERTS.map(c => (
                                <tr key={c.id} onClick={() => setSel(c)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === c.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent2 }}>{c.id}</td>
                                    <td>{c.product}</td>
                                    <td style={{ fontFamily: S.mono, fontSize: 11 }}>{c.standard}</td>
                                    <td style={{ fontFamily: S.mono, color: c.score >= 90 ? "#00FF88" : c.score >= 70 ? "#FFD700" : "#EF4444" }}>{c.score}</td>
                                    <td><span style={{ color: STATUS_COLORS[c.status], fontSize: 11 }}>● {c.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.product}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>Batch: {sel.batch} · Inspector: {sel.inspector}</div>
                            {[["Standard", sel.standard], ["Score", sel.score + "/100"], ["Issued", sel.issueDate], ["Expiry", sel.expiry], ["Defects", sel.defects]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: S.bg, borderRadius: 8, padding: 10 }}>
                                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>Score Gauge</div>
                                <div style={{ background: "#0D2040", borderRadius: 6, height: 16, overflow: "hidden" }}>
                                    <div style={{ width: sel.score + "%", height: "100%", borderRadius: 6, background: sel.score >= 90 ? "#00FF88" : sel.score >= 70 ? "#FFD700" : "#EF4444" }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "inspect" && (
                <div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        {[["Today", inspections.length, S.accent], ["Defects", inspections.filter(i => i.action === "DEFECT_LOGGED").length, "#EF4444"], ["Recertified", inspections.filter(i => i.action === "RECERTIFIED").length, "#3B82F6"]].map(([l, v, c]) => (
                            <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                            </div>
                        ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Cert</th><th>Action</th><th>Inspector</th><th>Result</th>
                        </tr></thead>
                        <tbody>{inspections.map((i, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{i.time}</td>
                                <td style={{ color: S.accent2 }}>{i.cert}</td>
                                <td><span style={{ color: ACTION_COLORS[i.action] || S.text, fontSize: 11 }}>{i.action}</span></td>
                                <td>{i.inspector}</td>
                                <td style={{ color: S.text, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.result}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "defects" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent2 }}>Defect Resolution Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Detect", "2. Classify", "3. Root Cause", "4. Corrective Action", "5. Verify Fix"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["🔬", "📋", "🔍", "🔧", "✅"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    <h4 style={{ fontSize: 13, color: S.muted, marginBottom: 8 }}>Active Defect Reports</h4>
                    {MOCK_CERTS.filter(c => c.defects > 0).map(c => (
                        <div key={c.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontWeight: 600 }}>{c.product}</span>
                                <span style={{ color: c.defects > 5 ? "#EF4444" : "#FFD700", fontFamily: S.mono }}>{c.defects} defects</span>
                            </div>
                            <div style={{ fontSize: 11, color: S.muted }}>Batch: {c.batch} · Inspector: {c.inspector} · Score: {c.score}/100</div>
                            <div style={{ marginTop: 6, background: S.bg, borderRadius: 6, height: 8, overflow: "hidden" }}>
                                <div style={{ width: (100 - c.defects * 5) + "%", height: "100%", borderRadius: 6, background: c.defects > 5 ? "#EF4444" : "#FFD700" }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>QualityCertificateNFT.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Certificate Minting", "0.5 BEZ / cert", "+340 certs/mo", "🏭"],
                        ["Defect Logging", "0.2 BEZ / report", "+1,200 reports/mo", "⚠️"],
                        ["Recertification", "0.3 BEZ / recert", "+85 recerts/mo", "🔄"],
                        ["ISO Compliance SaaS", "$499/mo enterprise", "12 enterprise clients", "📋"],
                        ["Batch Verification API", "0.1 BEZ / query", "+8K queries/mo", "🔍"],
                        ["Defect Analytics Premium", "$199/mo", "28 subscribers", "📊"],
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
                <AgentDetailPanel agentId="qualitychain" accentColor="#22C55E" />
            )}
        </div>
    );
}
