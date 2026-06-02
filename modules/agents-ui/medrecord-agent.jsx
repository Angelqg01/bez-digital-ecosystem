import { useState, useEffect, useCallback } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── HL7 FHIR PATIENT RECORDS (replace with real FHIR R4 endpoint) ───────────
// Real endpoint: GET https://fhir.hospital.example/Patient/{id}/$everything
// Headers: { "Authorization": "Bearer {token}", "Accept": "application/fhir+json" }
const MOCK_PATIENTS = [
    { id: "PAT-001", name: "Maria Garcia Lopez", dob: "1985-04-12", nhi: "ES-SNS-928174625", gender: "F", bloodType: "A+", allergies: ["Penicillin", "Latex"], conditions: ["Type 2 Diabetes", "Hypertension"], hospital: "Hospital Clinic Barcelona", lastVisit: "2026-03-14", sbtTokenId: "BEZ-MED-00128", status: "ACTIVE", accessLog: 12, zkProof: "0x8a3f...c2e1" },
    { id: "PAT-002", name: "Carlos Mendez Rivera", dob: "1972-09-28", nhi: "ES-SNS-381726490", gender: "M", bloodType: "O-", allergies: ["Sulfonamides"], conditions: ["Coronary Artery Disease", "COPD"], hospital: "Hospital La Paz Madrid", lastVisit: "2026-03-15", sbtTokenId: "BEZ-MED-00127", status: "ACTIVE", accessLog: 8, zkProof: "0x2b7d...f914" },
    { id: "PAT-003", name: "Ana Torres Vidal", dob: "1993-01-05", nhi: "ES-SNS-562043891", gender: "F", bloodType: "B+", allergies: [], conditions: ["Pregnancy (32w)"], hospital: "Hospital del Mar Barcelona", lastVisit: "2026-03-16", sbtTokenId: "BEZ-MED-00126", status: "ACTIVE", accessLog: 22, zkProof: "0x5e1a...8b03" },
    { id: "PAT-004", name: "Pedro Ruiz Fernandez", dob: "1958-11-20", nhi: "ES-SNS-174920563", gender: "M", bloodType: "AB+", allergies: ["Ibuprofen", "Aspirin"], conditions: ["Parkinson Disease", "Osteoarthritis"], hospital: "Hospital Gregorio Maranon", lastVisit: "2026-03-12", sbtTokenId: "BEZ-MED-00125", status: "CONSENT_PENDING", accessLog: 5, zkProof: null },
    { id: "PAT-005", name: "Laura Sanchez Moreno", dob: "2001-07-15", nhi: "ES-SNS-809347162", gender: "F", bloodType: "O+", allergies: ["Codeine"], conditions: ["Asthma"], hospital: "Hospital Vall Hebron", lastVisit: "2026-03-16", sbtTokenId: "BEZ-MED-00124", status: "ACTIVE", accessLog: 3, zkProof: "0xf1c9...44a2" },
];

const MOCK_ACCESS_LOG = [
    { ts: "2026-03-16 08:42", actor: "Dr. Elena Vives (Cardiology)", action: "READ", patient: "PAT-002", fields: "ECG Results, Lab CBC", txHash: "0x7a3b...e4f1", verified: true },
    { ts: "2026-03-16 07:15", actor: "Lab Technician M. Rojas", action: "WRITE", patient: "PAT-003", fields: "Glucose Panel, HbA1c", txHash: "0x2d8e...91c3", verified: true },
    { ts: "2026-03-15 22:30", actor: "ER System (Auto)", action: "EMERGENCY_READ", patient: "PAT-001", fields: "Allergies, Medications, Blood Type", txHash: "0x9f11...b820", verified: true },
    { ts: "2026-03-15 16:45", actor: "Insurance Bot (MAPFRE)", action: "ZK_VERIFY", patient: "PAT-002", fields: "Diagnosis Code (ZK-masked)", txHash: "0x4c5a...d732", verified: true },
    { ts: "2026-03-15 14:20", actor: "Dr. Ana Costa (Neurology)", action: "READ", patient: "PAT-004", fields: "MRI Brain, Movement Assessment", txHash: "0xb3f7...8e09", verified: true },
    { ts: "2026-03-15 11:00", actor: "Unknown IP 45.33.xx.xx", action: "READ_ATTEMPT", patient: "PAT-005", fields: "BLOCKED - No consent signature", txHash: null, verified: false },
];

const STATUS_COLORS = {
    ACTIVE: { bg: "rgba(0,255,136,0.12)", text: "#00FF88", border: "rgba(0,255,136,0.3)" },
    CONSENT_PENDING: { bg: "rgba(255,215,0,0.12)", text: "#FFD700", border: "rgba(255,215,0,0.3)" },
    REVOKED: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", border: "rgba(239,68,68,0.3)" },
    EMERGENCY: { bg: "rgba(239,68,68,0.12)", text: "#FF6B6B", border: "rgba(239,68,68,0.3)" },
};

// ─── SBT SMART CONTRACT ABI (MedRecordSBT.sol) ──────────────────────────────
const CONTRACT_ABI = `// MedRecordSBT.sol - BeZhas Healthcare Registry
// Deployed: Polygon 0x[deployed_address]
// Standard: ERC-5192 (Soulbound Token)

struct PatientRecord {
  string  patientId;        // National Health ID (encrypted)
  bytes32 dataHash;         // SHA-256 of FHIR bundle
  bytes32 consentHash;      // SHA-256 of signed consent
  uint256 createdAt;        // Block timestamp
  uint256 lastUpdated;      // Last modification
  address guardian;         // Patient wallet (consent signer)
  RecordStatus status;
}

enum RecordStatus {
  ACTIVE, CONSENT_PENDING, REVOKED, EMERGENCY_OVERRIDE
}

// Mint SBT for new patient (hospital only)
function mintMedRecord(
  string  calldata patientId,
  bytes32 dataHash,
  bytes32 consentHash,
  address patientWallet
) external onlyRole(HOSPITAL_ROLE) returns (uint256 tokenId);

// Patient grants read access to a doctor
function grantAccess(
  uint256 tokenId,
  address doctor,
  string[] calldata fieldScopes,
  uint256 expiresAt
) external onlyPatient(tokenId);

// ZK-proof verification (insurance can verify diagnosis without seeing data)
function verifyWithZKProof(
  uint256 tokenId,
  bytes   calldata zkProof,
  bytes32 expectedOutput
) external view returns (bool valid);

// Emergency override (ER system with multi-sig)
function emergencyAccess(
  uint256 tokenId,
  address erDoctor,
  bytes   calldata multiSigApproval
) external onlyRole(EMERGENCY_ROLE);

// Patient revokes all access
function revokeAllAccess(
  uint256 tokenId
) external onlyPatient(tokenId);`;

// ─── FHIR RESOURCE TYPES ─────────────────────────────────────────────────────
const FHIR_RESOURCES = [
    { type: "Patient", count: 5, desc: "Demographics, identifiers, contacts" },
    { type: "Condition", count: 12, desc: "Active diagnoses (ICD-10 coded)" },
    { type: "MedicationRequest", count: 28, desc: "Active prescriptions" },
    { type: "Observation", count: 156, desc: "Lab results, vitals, measurements" },
    { type: "AllergyIntolerance", count: 8, desc: "Known allergies & reactions" },
    { type: "Procedure", count: 15, desc: "Surgical & diagnostic procedures" },
    { type: "DiagnosticReport", count: 34, desc: "Imaging, pathology reports" },
    { type: "Immunization", count: 47, desc: "Vaccination records" },
    { type: "Encounter", count: 89, desc: "Hospital visits & admissions" },
    { type: "Consent", count: 5, desc: "Patient data sharing consents" },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function MedRecordAgent() {
    const bridge = useAgentBridge('medrecord');
    const [tab, setTab] = useState("registry");
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [logs, setLogs] = useState(MOCK_ACCESS_LOG);
    const [stats, setStats] = useState({
        totalRecords: 5247, activeSBTs: 4891, accessGrants: 12480,
        zkVerifications: 3892, breachAttempts: 14, avgResponseMs: 42,
    });
    const [bezFees, setBezFees] = useState(0);

    const addLog = useCallback((msg) => {
        setLogs(prev => [{ ts: new Date().toISOString().slice(0, 16).replace("T", " "), actor: "SYSTEM", action: "LOG", patient: "-", fields: msg, txHash: null, verified: true }, ...prev.slice(0, 49)]);
    }, []);

    // Simulated live activity
    useEffect(() => {
        const iv = setInterval(() => {
            setBezFees(f => +(f + 0.01).toFixed(4));
            setStats(s => ({
                ...s,
                totalRecords: s.totalRecords + (Math.random() > 0.7 ? 1 : 0),
                accessGrants: s.accessGrants + Math.floor(Math.random() * 3),
                zkVerifications: s.zkVerifications + (Math.random() > 0.5 ? 1 : 0),
            }));
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const tabs = [
        { id: "registry", label: "Registry", icon: "📋" },
        { id: "access", label: "Access Log", icon: "🔐" },
        { id: "fhir", label: "FHIR Sync", icon: "🏥" },
        { id: "contracts", label: "Contracts", icon: "📜" },
        { id: "stats", label: "Analytics", icon: "📊" },
        { id: "metrics", label: "Metrics", icon: "📈" },
    ];

    const S = {
        bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
        accent: "#00FF88", accent2: "#00D4FF", text: "#e2e8f0", muted: "#64748b",
        mono: "'JetBrains Mono','Courier New',monospace",
        glow: "rgba(0,255,136,0.15)",
    };

    return (
        <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.mono, color: S.text, padding: 0 }}>
            {/* Grid bg */}
            <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: `linear-gradient(rgba(0,255,136,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.02) 1px, transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: `1px solid ${S.border}`, paddingBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 10, letterSpacing: 4, color: S.accent, textTransform: "uppercase", marginBottom: 4 }}>Phase 3 - Healthcare</div>
                        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, background: `linear-gradient(135deg, #fff 0%, ${S.accent} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            MedRecord Agent
                        </h1>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: S.muted }}>Soulbound Token Medical Records - HL7 FHIR R4 + ZK-Proofs</p>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ padding: "8px 16px", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 3, fontSize: 12 }}>
                            <span style={{ color: S.muted }}>Fees: </span><span style={{ color: S.accent, fontWeight: 700 }}>{bezFees.toFixed(4)} BEZ</span>
                        </div>
                        <div style={{ padding: "8px 16px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 3, fontSize: 12 }}>
                            <span style={{ color: S.muted }}>SBTs: </span><span style={{ color: S.accent2, fontWeight: 700 }}>{stats.activeSBTs.toLocaleString()}</span>
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

                {/* ── TAB: Registry ────────────────────────────────────────── */}
                {tab === "registry" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                            {[
                                { label: "Total Records", value: stats.totalRecords.toLocaleString(), icon: "📋", color: S.accent },
                                { label: "Active SBTs", value: stats.activeSBTs.toLocaleString(), icon: "🔗", color: S.accent2 },
                                { label: "Access Grants", value: stats.accessGrants.toLocaleString(), icon: "🔓", color: "#FFD700" },
                                { label: "ZK Verifications", value: stats.zkVerifications.toLocaleString(), icon: "🛡", color: "#7C3AED" },
                            ].map((s, i) => (
                                <div key={i} style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2, marginBottom: 4 }}>{s.icon} {s.label.toUpperCase()}</div>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                    <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                                        {["Patient ID", "Name", "Hospital", "Status", "SBT Token", "Access Log", "ZK Proof", "Actions"].map(h => (
                                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: S.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {MOCK_PATIENTS.map(p => {
                                        const sc = STATUS_COLORS[p.status] || STATUS_COLORS.ACTIVE;
                                        return (
                                            <tr key={p.id} onClick={() => setSelectedPatient(p)} style={{ borderBottom: `1px solid ${S.border}`, cursor: "pointer", transition: "background 0.15s" }}
                                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                                <td style={{ padding: "12px 16px", fontWeight: 700, color: S.accent }}>{p.id}</td>
                                                <td style={{ padding: "12px 16px" }}>{p.name}</td>
                                                <td style={{ padding: "12px 16px", color: S.muted, fontSize: 11 }}>{p.hospital}</td>
                                                <td style={{ padding: "12px 16px" }}>
                                                    <span style={{ padding: "3px 10px", background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, borderRadius: 2, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{p.status}</span>
                                                </td>
                                                <td style={{ padding: "12px 16px", fontFamily: S.mono, fontSize: 10, color: S.accent2 }}>{p.sbtTokenId}</td>
                                                <td style={{ padding: "12px 16px", textAlign: "center" }}>{p.accessLog} reads</td>
                                                <td style={{ padding: "12px 16px", fontFamily: S.mono, fontSize: 10, color: p.zkProof ? "#7C3AED" : S.muted }}>{p.zkProof || "PENDING"}</td>
                                                <td style={{ padding: "12px 16px" }}>
                                                    <button onClick={e => { e.stopPropagation(); addLog(`Minted SBT for ${p.id} via MedRecordSBT.sol`); }} style={{ padding: "4px 12px", background: "rgba(0,255,136,0.1)", color: S.accent, border: `1px solid rgba(0,255,136,0.3)`, borderRadius: 2, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: S.mono }}>
                                                        MINT SBT
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Patient Detail Panel */}
                        {selectedPatient && (
                            <div style={{ marginTop: 24, padding: 20, background: S.card, border: `1px solid ${S.accent}`, borderRadius: 4 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                        <h3 style={{ margin: "0 0 8px", color: S.accent, fontSize: 18 }}>{selectedPatient.name}</h3>
                                        <div style={{ display: "flex", gap: 16, fontSize: 11, color: S.muted }}>
                                            <span>DOB: {selectedPatient.dob}</span><span>NHI: {selectedPatient.nhi}</span>
                                            <span>Blood: {selectedPatient.bloodType}</span><span>Gender: {selectedPatient.gender}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedPatient(null)} style={{ background: "none", border: "none", color: S.muted, cursor: "pointer", fontSize: 18 }}>X</button>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2, marginBottom: 6 }}>ALLERGIES</div>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            {selectedPatient.allergies.length > 0 ? selectedPatient.allergies.map((a, i) => (
                                                <span key={i} style={{ padding: "3px 10px", background: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 2, fontSize: 10 }}>{a}</span>
                                            )) : <span style={{ color: S.muted, fontSize: 11 }}>None known</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2, marginBottom: 6 }}>CONDITIONS (ICD-10)</div>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            {selectedPatient.conditions.map((c, i) => (
                                                <span key={i} style={{ padding: "3px 10px", background: "rgba(0,212,255,0.12)", color: S.accent2, border: "1px solid rgba(0,212,255,0.3)", borderRadius: 2, fontSize: 10 }}>{c}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: Access Log ──────────────────────────────────────── */}
                {tab === "access" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h2 style={{ margin: 0, fontSize: 18, color: S.accent }}>On-Chain Access Audit Trail</h2>
                            <div style={{ padding: "6px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 3, fontSize: 11, color: "#EF4444", fontWeight: 700 }}>
                                {stats.breachAttempts} Unauthorized Attempts Blocked
                            </div>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                                    {["Timestamp", "Actor", "Action", "Patient", "Fields Accessed", "Tx Hash", "Valid"].map(h => (
                                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: S.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.slice(0, 20).map((l, i) => (
                                    <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, background: !l.verified ? "rgba(239,68,68,0.05)" : "transparent" }}>
                                        <td style={{ padding: "10px 12px", color: S.muted, fontSize: 10 }}>{l.ts}</td>
                                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>{l.actor}</td>
                                        <td style={{ padding: "10px 12px" }}>
                                            <span style={{
                                                padding: "2px 8px", borderRadius: 2, fontSize: 10, fontWeight: 700, letterSpacing: 1,
                                                background: l.action === "READ" ? "rgba(0,212,255,0.12)" : l.action === "WRITE" ? "rgba(0,255,136,0.12)" : l.action === "EMERGENCY_READ" ? "rgba(255,107,53,0.12)" : l.action === "ZK_VERIFY" ? "rgba(124,58,237,0.12)" : "rgba(239,68,68,0.12)",
                                                color: l.action === "READ" ? S.accent2 : l.action === "WRITE" ? S.accent : l.action === "EMERGENCY_READ" ? "#FF6B35" : l.action === "ZK_VERIFY" ? "#7C3AED" : "#EF4444",
                                            }}>{l.action}</span>
                                        </td>
                                        <td style={{ padding: "10px 12px", color: S.accent, fontWeight: 700 }}>{l.patient}</td>
                                        <td style={{ padding: "10px 12px", color: S.muted, fontSize: 10 }}>{l.fields}</td>
                                        <td style={{ padding: "10px 12px", fontFamily: S.mono, fontSize: 10, color: l.txHash ? S.accent2 : S.muted }}>{l.txHash || "-"}</td>
                                        <td style={{ padding: "10px 12px", textAlign: "center" }}>{l.verified ? "OK" : "BLOCKED"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── TAB: FHIR Sync ──────────────────────────────────────── */}
                {tab === "fhir" && (
                    <div>
                        <div style={{ marginBottom: 24, padding: 20, background: "rgba(0,212,255,0.04)", border: `1px solid rgba(0,212,255,0.15)`, borderRadius: 4 }}>
                            <h2 style={{ margin: "0 0 8px", fontSize: 16, color: S.accent2 }}>HL7 FHIR R4 Integration</h2>
                            <p style={{ margin: 0, fontSize: 12, color: S.muted }}>Bidirectional sync with hospital EHR systems via FHIR R4 API. Each resource update hashes to the patient SBT on-chain.</p>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
                            {FHIR_RESOURCES.map((r, i) => (
                                <div key={i} style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: S.accent2 }}>{r.type}</span>
                                        <span style={{ fontSize: 11, color: S.accent, fontWeight: 700 }}>{r.count}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: 10, color: S.muted, lineHeight: 1.5 }}>{r.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                            <div style={{ fontSize: 10, letterSpacing: 2, color: S.muted, marginBottom: 12 }}>SYNC FLOW</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
                                {["Hospital EHR", "FHIR R4 API", "BeZhas API", "SHA-256 Hash", "MedRecordSBT.sol", "Patient Wallet"].map((step, i) => (
                                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ padding: "6px 14px", background: i === 4 ? "rgba(0,255,136,0.1)" : S.card, border: `1px solid ${i === 4 ? "rgba(0,255,136,0.3)" : S.border}`, borderRadius: 3, color: i === 4 ? S.accent : S.text, fontWeight: 700 }}>{step}</span>
                                        {i < 5 && <span style={{ color: S.muted }}>-&gt;</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB: Contracts ───────────────────────────────────────── */}
                {tab === "contracts" && (
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <h2 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>MedRecordSBT.sol - Soulbound Token</h2>
                            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                                {[
                                    { label: "Standard", value: "ERC-5192" },
                                    { label: "Network", value: "BeZhas L2" },
                                    { label: "Solidity", value: "^0.8.20" },
                                    { label: "Access Control", value: "HOSPITAL_ROLE + PATIENT_SIG" },
                                ].map((d, i) => (
                                    <div key={i} style={{ padding: "8px 14px", background: S.card, border: `1px solid ${S.border}`, borderRadius: 3 }}>
                                        <div style={{ fontSize: 9, color: S.muted, letterSpacing: 2 }}>{d.label.toUpperCase()}</div>
                                        <div style={{ fontSize: 12, color: S.accent2, fontWeight: 700, marginTop: 2 }}>{d.value}</div>
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
                                { label: "Avg Query Time", value: `${stats.avgResponseMs}ms`, desc: "FHIR-to-SBT verification", color: S.accent },
                                { label: "HIPAA Compliance", value: "100%", desc: "ZK-proof + consent-based access", color: "#7C3AED" },
                                { label: "Breach Attempts", value: stats.breachAttempts.toString(), desc: "All blocked by smart contract", color: "#EF4444" },
                                { label: "Hospital Network", value: "23", desc: "Connected EHR systems", color: S.accent2 },
                                { label: "Revenue (MTD)", value: "$47,200", desc: "SaaS + per-query fees", color: "#FFD700" },
                                { label: "Data Marketplace", value: "$12,800", desc: "Anonymized dataset sales", color: "#FF6B35" },
                            ].map((s, i) => (
                                <div key={i} style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2, marginBottom: 4 }}>{s.label.toUpperCase()}</div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: s.color, margin: "4px 0" }}>{s.value}</div>
                                    <p style={{ margin: 0, fontSize: 10, color: S.muted }}>{s.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: 20, background: "rgba(0,255,136,0.04)", border: `1px solid rgba(0,255,136,0.15)`, borderRadius: 4 }}>
                            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: S.accent, letterSpacing: 2 }}>REVENUE MODEL</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 12 }}>
                                {[
                                    { stream: "Hospital SaaS", fee: "500-10K/month", model: "Per-bed licensing" },
                                    { stream: "Per-Query Fee", fee: "0.1 BEZ/read", model: "Pay-per-access" },
                                    { stream: "ZK Verification", fee: "0.5 BEZ/proof", model: "Insurance claims" },
                                    { stream: "Data Marketplace", fee: "2% commission", model: "Anonymized datasets" },
                                    { stream: "SBT Minting", fee: "0.2 BEZ/mint", model: "On-chain identity" },
                                    { stream: "Emergency Override", fee: "1.0 BEZ/access", model: "ER multi-sig" },
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
                    <AgentDetailPanel agentId="medrecord" accentColor="#00FF88" />
                )}
            </div>
        </div>
    );
}
