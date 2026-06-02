import { useState, useEffect, useCallback } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── INSURANCE CLAIMS MOCK DATA ─────────────────────────────────────────────
const MOCK_CLAIMS = [
    { claimId: "CLM-2026-00347", patient: "Maria Garcia Lopez", patientId: "PAT-001", insurer: "MAPFRE Salud", policyNo: "SAL-28917462", diagnosisCode: "E11.9", diagnosis: "Type 2 Diabetes - Routine Mgmt", procedure: "HbA1c + Glucose Panel + Retinal Exam", amount: 420.00, status: "AI_APPROVED", aiScore: 0.97, escrowTx: "0x4a2c...9f01", submitDate: "2026-03-15", processDate: "2026-03-15", payoutDate: "2026-03-16" },
    { claimId: "CLM-2026-00346", patient: "Carlos Mendez Rivera", patientId: "PAT-002", insurer: "Sanitas", policyNo: "SAN-73820156", diagnosisCode: "I25.10", diagnosis: "Coronary Artery Disease - Stent Follow-up", procedure: "Cardiac CT Angiography + Stress Test", amount: 3850.00, status: "HUMAN_REVIEW", aiScore: 0.68, escrowTx: "0x7e1f...c33a", submitDate: "2026-03-14", processDate: null, payoutDate: null },
    { claimId: "CLM-2026-00345", patient: "Ana Torres Vidal", patientId: "PAT-003", insurer: "Adeslas", policyNo: "ADE-50182937", diagnosisCode: "Z34.03", diagnosis: "Prenatal Care - 3rd Trimester", procedure: "Ultrasound + Blood Panel + GBS Screen", amount: 680.00, status: "AI_APPROVED", aiScore: 0.99, escrowTx: "0x2b8d...a712", submitDate: "2026-03-16", processDate: "2026-03-16", payoutDate: null },
    { claimId: "CLM-2026-00344", patient: "Pedro Ruiz Fernandez", patientId: "PAT-004", insurer: "DKV Seguros", policyNo: "DKV-61049283", diagnosisCode: "G20", diagnosis: "Parkinson Disease - DBS Evaluation", procedure: "Neurologic Exam + DaTscan + MRI Brain", amount: 12400.00, status: "ESCALATED", aiScore: 0.42, escrowTx: null, submitDate: "2026-03-13", processDate: null, payoutDate: null },
    { claimId: "CLM-2026-00343", patient: "Laura Sanchez Moreno", patientId: "PAT-005", insurer: "MAPFRE Salud", policyNo: "SAL-80293746", diagnosisCode: "J45.20", diagnosis: "Moderate Persistent Asthma", procedure: "Spirometry + Peak Flow + Inhaler Rx", amount: 195.00, status: "PAID", aiScore: 0.95, escrowTx: "0x9c4e...b105", submitDate: "2026-03-12", processDate: "2026-03-12", payoutDate: "2026-03-13" },
    { claimId: "CLM-2026-00342", patient: "Jorge Navarro Diaz", patientId: "PAT-006", insurer: "Sanitas", policyNo: "SAN-42058173", diagnosisCode: "S72.001A", diagnosis: "Femoral Neck Fracture", procedure: "Emergency Hip Arthroplasty + ICU Stay 3d", amount: 28750.00, status: "FRAUD_FLAG", aiScore: 0.12, escrowTx: null, submitDate: "2026-03-11", processDate: null, payoutDate: null },
];

const STATUS_COLORS = {
    AI_APPROVED: { bg: "rgba(0,255,136,0.12)", text: "#00FF88", border: "rgba(0,255,136,0.3)" },
    HUMAN_REVIEW: { bg: "rgba(255,215,0,0.12)", text: "#FFD700", border: "rgba(255,215,0,0.3)" },
    PAID: { bg: "rgba(0,212,255,0.12)", text: "#00D4FF", border: "rgba(0,212,255,0.3)" },
    ESCALATED: { bg: "rgba(255,107,53,0.12)", text: "#FF6B35", border: "rgba(255,107,53,0.3)" },
    FRAUD_FLAG: { bg: "rgba(239,68,68,0.15)", text: "#EF4444", border: "rgba(239,68,68,0.4)" },
    DENIED: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", border: "rgba(239,68,68,0.3)" },
};

const CONTRACT_ABI = `// HealthInsuranceEscrow.sol - BeZhas Claims Processing
// Pattern: QualityEscrow.sol adapted for healthcare

struct Claim {
  string  claimId;          // Unique claim reference
  address hospital;         // Submitting hospital
  address insurer;          // Insurance company
  string  diagnosisCode;    // ICD-10 code (ZK-masked for privacy)
  bytes32 procedureHash;    // SHA-256 of procedure details
  uint256 amount;           // Claim amount in stablecoin (USDC)
  uint256 submitDate;
  uint256 processDate;
  uint256 payoutDate;
  uint8   aiConfidence;     // 0-100 AI verification score
  ClaimStatus status;
}

enum ClaimStatus {
  SUBMITTED, AI_APPROVED, HUMAN_REVIEW, PAID, ESCALATED, FRAUD_FLAG, DENIED
}

// Hospital submits claim (with ZK-masked diagnosis)
function submitClaim(
  string  calldata claimId,
  address insurer,
  bytes32 zkDiagnosisProof,   // ZK proof of valid ICD-10
  bytes32 procedureHash,
  uint256 amount
) external onlyRole(HOSPITAL_ROLE) returns (uint256 escrowId);

// AI engine sets confidence score
function setAIVerification(
  uint256 escrowId,
  uint8   confidenceScore,    // 0-100
  bytes32 aiModelHash         // Hash of model used
) external onlyRole(AI_ENGINE_ROLE);

// Auto-approve if AI score >= threshold (e.g., 85)
function autoApprove(
  uint256 escrowId
) external;

// Manual review by human adjuster
function manualReview(
  uint256 escrowId,
  bool    approved,
  string  calldata notes
) external onlyRole(ADJUSTER_ROLE);

// Release escrow to hospital
function releasePayout(
  uint256 escrowId
) external;

// Flag for fraud investigation
function flagFraud(
  uint256 escrowId,
  string  calldata reason
) external onlyRole(AI_ENGINE_ROLE);

// ZK-verify diagnosis without revealing patient data
function verifyDiagnosis(
  uint256 escrowId,
  bytes   calldata zkProof
) external view returns (bool valid);`;

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function ClaimBotAgent() {
    const bridge = useAgentBridge('claimbot');
    const [tab, setTab] = useState("queue");
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [stats, setStats] = useState({
        totalClaims: 12486, autoApproved: 9124, humanReview: 2847, fraudFlags: 78,
        avgProcessHrs: 2.4, totalPaidUSD: 4287000, escrowLockedUSD: 892000,
        aiAccuracy: 96.8,
    });
    const [bezFees, setBezFees] = useState(0);

    useEffect(() => {
        const iv = setInterval(() => {
            setBezFees(f => +(f + 0.02).toFixed(4));
            setStats(s => ({
                ...s,
                totalClaims: s.totalClaims + (Math.random() > 0.6 ? 1 : 0),
                autoApproved: s.autoApproved + (Math.random() > 0.7 ? 1 : 0),
                totalPaidUSD: s.totalPaidUSD + Math.floor(Math.random() * 500),
            }));
        }, 6000);
        return () => clearInterval(iv);
    }, []);

    const tabs = [
        { id: "queue", label: "Claims Queue", icon: "📋" },
        { id: "process", label: "AI Review", icon: "🤖" },
        { id: "escrow", label: "Escrow", icon: "🔒" },
        { id: "contracts", label: "Contracts", icon: "📜" },
        { id: "stats", label: "Analytics", icon: "📊" },
        { id: "metrics", label: "Metrics", icon: "📊" },
    ];

    const S = {
        bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
        accent: "#FFD700", accent2: "#00FF88", info: "#00D4FF", danger: "#EF4444",
        text: "#e2e8f0", muted: "#64748b",
        mono: "'JetBrains Mono','Courier New',monospace",
    };

    const getScoreColor = (score) => {
        if (score >= 0.85) return S.accent2;
        if (score >= 0.50) return S.accent;
        return S.danger;
    };

    return (
        <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.mono, color: S.text, padding: 0 }}>
            <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: `linear-gradient(rgba(255,215,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.02) 1px, transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: `1px solid ${S.border}`, paddingBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 10, letterSpacing: 4, color: S.accent, textTransform: "uppercase", marginBottom: 4 }}>Phase 3 - Healthcare</div>
                        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, background: `linear-gradient(135deg, #fff 0%, ${S.accent} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            ClaimBot Agent
                        </h1>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: S.muted }}>AI Insurance Claims - Smart Escrow + ZK-Proof Diagnosis Verification</p>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ padding: "8px 16px", background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 3, fontSize: 12 }}>
                            <span style={{ color: S.muted }}>Fees: </span><span style={{ color: S.accent, fontWeight: 700 }}>{bezFees.toFixed(4)} BEZ</span>
                        </div>
                        <div style={{ padding: "8px 16px", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 3, fontSize: 12 }}>
                            <span style={{ color: S.muted }}>Escrow: </span><span style={{ color: S.accent2, fontWeight: 700 }}>${(stats.escrowLockedUSD / 1000).toFixed(0)}K</span>
                        </div>
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

                {/* ── TAB: Claims Queue ────────────────────────────────────── */}
                {tab === "queue" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                            {[
                                { label: "Total Claims", value: stats.totalClaims.toLocaleString(), color: S.accent },
                                { label: "Auto-Approved", value: stats.autoApproved.toLocaleString(), color: S.accent2 },
                                { label: "Human Review", value: stats.humanReview.toLocaleString(), color: S.info },
                                { label: "Fraud Flags", value: stats.fraudFlags.toString(), color: S.danger },
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
                                        {["Claim ID", "Patient", "Insurer", "Diagnosis", "Amount", "AI Score", "Status", "Actions"].map(h => (
                                            <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: S.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {MOCK_CLAIMS.map(cl => {
                                        const sc = STATUS_COLORS[cl.status] || STATUS_COLORS.AI_APPROVED;
                                        return (
                                            <tr key={cl.claimId} onClick={() => setSelectedClaim(cl)} style={{ borderBottom: `1px solid ${S.border}`, cursor: "pointer", background: cl.status === "FRAUD_FLAG" ? "rgba(239,68,68,0.03)" : "transparent" }}
                                                onMouseEnter={e => e.currentTarget.style.background = cl.status === "FRAUD_FLAG" ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.03)"}
                                                onMouseLeave={e => e.currentTarget.style.background = cl.status === "FRAUD_FLAG" ? "rgba(239,68,68,0.03)" : "transparent"}>
                                                <td style={{ padding: "10px 12px", fontWeight: 700, color: S.accent }}>{cl.claimId}</td>
                                                <td style={{ padding: "10px 12px" }}>{cl.patient}</td>
                                                <td style={{ padding: "10px 12px", color: S.muted, fontSize: 10 }}>{cl.insurer}</td>
                                                <td style={{ padding: "10px 12px", fontSize: 10 }}>
                                                    <span style={{ color: S.info, fontWeight: 700 }}>{cl.diagnosisCode}</span>
                                                    <span style={{ color: S.muted, marginLeft: 6 }}>{cl.diagnosis.substring(0, 30)}...</span>
                                                </td>
                                                <td style={{ padding: "10px 12px", fontWeight: 700, color: cl.amount > 10000 ? "#FF6B35" : S.text }}>
                                                    ${cl.amount.toLocaleString()}
                                                </td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                        <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                                                            <div style={{ width: `${cl.aiScore * 100}%`, height: "100%", background: getScoreColor(cl.aiScore), borderRadius: 2 }} />
                                                        </div>
                                                        <span style={{ color: getScoreColor(cl.aiScore), fontSize: 10, fontWeight: 700 }}>{(cl.aiScore * 100).toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <span style={{ padding: "2px 8px", background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, borderRadius: 2, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{cl.status}</span>
                                                </td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <button onClick={e => e.stopPropagation()} style={{ padding: "4px 10px", background: "rgba(255,215,0,0.1)", color: S.accent, border: `1px solid rgba(255,215,0,0.3)`, borderRadius: 2, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: S.mono }}>
                                                        REVIEW
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {selectedClaim && (
                            <div style={{ marginTop: 24, padding: 20, background: S.card, border: `1px solid ${STATUS_COLORS[selectedClaim.status]?.border || S.border}`, borderRadius: 4 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                        <h3 style={{ margin: "0 0 8px", color: S.accent }}>{selectedClaim.claimId}</h3>
                                        <div style={{ display: "flex", gap: 16, fontSize: 11, color: S.muted }}>
                                            <span>Patient: {selectedClaim.patient} ({selectedClaim.patientId})</span>
                                            <span>Policy: {selectedClaim.policyNo}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedClaim(null)} style={{ background: "none", border: "none", color: S.muted, cursor: "pointer", fontSize: 18 }}>X</button>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
                                    {[
                                        { label: "ICD-10", value: selectedClaim.diagnosisCode, color: S.info },
                                        { label: "Procedure", value: selectedClaim.procedure, color: S.text },
                                        { label: "Amount", value: `$${selectedClaim.amount.toLocaleString()}`, color: S.accent },
                                        { label: "AI Confidence", value: `${(selectedClaim.aiScore * 100).toFixed(0)}%`, color: getScoreColor(selectedClaim.aiScore) },
                                    ].map((d, i) => (
                                        <div key={i} style={{ padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 3 }}>
                                            <div style={{ fontSize: 9, color: S.muted, letterSpacing: 2 }}>{d.label}</div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: d.color, marginTop: 4 }}>{d.value}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: "flex", gap: 12, marginTop: 16, fontSize: 11, color: S.muted }}>
                                    <span>Submitted: {selectedClaim.submitDate}</span>
                                    <span>Processed: {selectedClaim.processDate || "PENDING"}</span>
                                    <span>Payout: {selectedClaim.payoutDate || "PENDING"}</span>
                                    <span>Escrow: {selectedClaim.escrowTx || "NOT LOCKED"}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: AI Review ───────────────────────────────────────── */}
                {tab === "process" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                            <div style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                <h3 style={{ margin: "0 0 16px", color: S.accent, fontSize: 16 }}>AI Claim Verification Pipeline</h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
                                    {[
                                        { step: "1", label: "Document OCR", desc: "Extract ICD-10, CPT codes from medical docs" },
                                        { step: "2", label: "Diagnosis Validation", desc: "Cross-reference ICD-10 with procedure codes" },
                                        { step: "3", label: "Historical Analysis", desc: "Compare with patient history (ZK-masked)" },
                                        { step: "4", label: "Fraud Detection", desc: "Anomaly detection: upcoding, phantom billing, unbundling" },
                                        { step: "5", label: "Confidence Score", desc: ">= 85% auto-approve, < 50% flag for fraud" },
                                        { step: "6", label: "Escrow Lock", desc: "Funds locked in HealthInsuranceEscrow.sol" },
                                        { step: "7", label: "Payout Release", desc: "Auto-release after verification period" },
                                    ].map((s, i) => (
                                        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                            <div style={{ minWidth: 28, height: 28, borderRadius: "50%", background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: S.accent }}>{s.step}</div>
                                            <div>
                                                <div style={{ fontWeight: 700, color: S.text }}>{s.label}</div>
                                                <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{s.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                <h3 style={{ margin: "0 0 16px", color: S.danger, fontSize: 16 }}>Fraud Detection Patterns</h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {[
                                        { type: "Upcoding", desc: "Billing for more expensive services than provided", freq: 34, severity: "HIGH" },
                                        { type: "Phantom Billing", desc: "Charges for services never rendered", freq: 12, severity: "CRITICAL" },
                                        { type: "Unbundling", desc: "Separating bundled services for higher reimbursement", freq: 21, severity: "MEDIUM" },
                                        { type: "Duplicate Claims", desc: "Same service billed multiple times", freq: 8, severity: "HIGH" },
                                        { type: "Identity Fraud", desc: "Patient identity mismatch with SBT", freq: 3, severity: "CRITICAL" },
                                    ].map((f, i) => (
                                        <div key={i} style={{ padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 3, borderLeft: `2px solid ${f.severity === "CRITICAL" ? S.danger : f.severity === "HIGH" ? "#FF6B35" : S.accent}` }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <span style={{ fontWeight: 700, color: S.text, fontSize: 12 }}>{f.type}</span>
                                                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 2, fontWeight: 700, background: f.severity === "CRITICAL" ? "rgba(239,68,68,0.15)" : f.severity === "HIGH" ? "rgba(255,107,53,0.15)" : "rgba(255,215,0,0.15)", color: f.severity === "CRITICAL" ? S.danger : f.severity === "HIGH" ? "#FF6B35" : S.accent }}>{f.severity}</span>
                                            </div>
                                            <div style={{ fontSize: 10, color: S.muted, marginTop: 4 }}>{f.desc}</div>
                                            <div style={{ fontSize: 10, color: S.info, marginTop: 4 }}>{f.freq} detected this quarter</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB: Escrow ──────────────────────────────────────────── */}
                {tab === "escrow" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                            {[
                                { label: "Escrow Locked", value: `$${(stats.escrowLockedUSD / 1000).toFixed(0)}K`, color: S.accent },
                                { label: "Total Paid (MTD)", value: `$${(stats.totalPaidUSD / 1000000).toFixed(2)}M`, color: S.accent2 },
                                { label: "Avg Processing", value: `${stats.avgProcessHrs}hrs`, color: S.info },
                            ].map((s, i) => (
                                <div key={i} style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2, marginBottom: 4 }}>{s.label.toUpperCase()}</div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                            <h3 style={{ margin: "0 0 16px", fontSize: 14, color: S.accent, letterSpacing: 2 }}>ESCROW FLOW</h3>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
                                {["Hospital Submit", "AI Verify", "Escrow Lock", "Review Period", "Payout Release"].map((step, i) => (
                                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ padding: "8px 16px", background: i === 2 ? "rgba(255,215,0,0.1)" : S.card, border: `1px solid ${i === 2 ? "rgba(255,215,0,0.3)" : S.border}`, borderRadius: 3, color: i === 2 ? S.accent : S.text, fontWeight: 700 }}>{step}</span>
                                        {i < 4 && <span style={{ color: S.muted }}>-&gt;</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginTop: 24, overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                <thead>
                                    <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                                        {["Claim", "Amount", "Escrow Tx", "Status", "Submit", "Process", "Payout"].map(h => (
                                            <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: S.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {MOCK_CLAIMS.map(cl => {
                                        const sc = STATUS_COLORS[cl.status] || STATUS_COLORS.AI_APPROVED;
                                        return (
                                            <tr key={cl.claimId} style={{ borderBottom: `1px solid ${S.border}` }}>
                                                <td style={{ padding: "10px 12px", fontWeight: 700, color: S.accent }}>{cl.claimId}</td>
                                                <td style={{ padding: "10px 12px", fontWeight: 700 }}>${cl.amount.toLocaleString()}</td>
                                                <td style={{ padding: "10px 12px", fontSize: 10, color: cl.escrowTx ? S.info : S.muted }}>{cl.escrowTx || "NOT LOCKED"}</td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <span style={{ padding: "2px 8px", background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, borderRadius: 2, fontSize: 10, fontWeight: 700 }}>{cl.status}</span>
                                                </td>
                                                <td style={{ padding: "10px 12px", color: S.muted, fontSize: 10 }}>{cl.submitDate}</td>
                                                <td style={{ padding: "10px 12px", color: S.muted, fontSize: 10 }}>{cl.processDate || "-"}</td>
                                                <td style={{ padding: "10px 12px", color: cl.payoutDate ? S.accent2 : S.muted, fontSize: 10, fontWeight: cl.payoutDate ? 700 : 400 }}>{cl.payoutDate || "PENDING"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── TAB: Contracts ───────────────────────────────────────── */}
                {tab === "contracts" && (
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <h2 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>HealthInsuranceEscrow.sol</h2>
                            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                                {[
                                    { label: "Pattern", value: "QualityEscrow" },
                                    { label: "AI Engine", value: "Claude + GPT-4" },
                                    { label: "Privacy", value: "ZK-Proof ICD-10" },
                                    { label: "Payment", value: "USDC + BEZ" },
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
                                { label: "AI Accuracy", value: `${stats.aiAccuracy}%`, desc: "Correct claim decisions", color: S.accent2 },
                                { label: "Fraud Prevented", value: `$${(stats.fraudFlags * 8200).toLocaleString()}`, desc: "Estimated savings", color: S.danger },
                                { label: "Avg Processing", value: `${stats.avgProcessHrs}hrs`, desc: "Submit to payout", color: S.info },
                                { label: "Revenue (MTD)", value: "$52,800", desc: "Per-claim + subscription", color: S.accent },
                                { label: "Partner Insurers", value: "12", desc: "Active insurance companies", color: "#7C3AED" },
                                { label: "Hospitals Connected", value: "48", desc: "Active claim submitters", color: "#FF6B35" },
                            ].map((s, i) => (
                                <div key={i} style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2, marginBottom: 4 }}>{s.label.toUpperCase()}</div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: s.color, margin: "4px 0" }}>{s.value}</div>
                                    <p style={{ margin: 0, fontSize: 10, color: S.muted }}>{s.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: 20, background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: 4 }}>
                            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: S.accent, letterSpacing: 2 }}>REVENUE MODEL</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 12 }}>
                                {[
                                    { stream: "Per-Claim Fee", fee: "0.5 BEZ/claim", model: "Hospital pays on submit" },
                                    { stream: "Insurer SaaS", fee: "2K-20K/month", model: "Volume-based tiers" },
                                    { stream: "Fraud Detection", fee: "2% of savings", model: "Performance-based" },
                                    { stream: "ZK Verification", fee: "0.3 BEZ/proof", model: "Per-verification" },
                                    { stream: "Escrow Service", fee: "0.1% of locked", model: "Time-value fee" },
                                    { stream: "Analytics API", fee: "500 BEZ/month", model: "Data access" },
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
                {tab === "metrics" && (
                    <div>
                        <div style={{ background: S.card, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${S.border}` }}>
                            <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — CLAIMBOT</div>
                            <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                        </div>
                        <AgentDetailPanel agentId="claimbot" accentColor="#FFD700" />
                    </div>
                )}
            </div>
        </div>
    );
}
