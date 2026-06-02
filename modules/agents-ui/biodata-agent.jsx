import { useState, useEffect, useCallback } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── CLINICAL TRIALS MOCK DATA ──────────────────────────────────────────────
const MOCK_TRIALS = [
    { trialId: "CT-BEZ-2026-001", title: "Phase III - mRNA Alzheimer Vaccine", sponsor: "Roche / BioNTech", pi: "Dr. Elena Vives", site: "Hospital Clinic Barcelona", phase: "III", status: "ENROLLING", enrolled: 847, target: 1200, dataTokens: 2541, consentStatus: "ACTIVE", startDate: "2025-09-01", endDate: "2027-06-30", rewardPerDataPoint: 0.5, totalRewardsBEZ: 1270.5 },
    { trialId: "CT-BEZ-2026-002", title: "Phase II - CAR-T Pancreatic Cancer", sponsor: "Novartis Oncology", pi: "Dr. Carlos Mendez", site: "Hospital La Paz Madrid", phase: "II", status: "ACTIVE", enrolled: 95, target: 150, dataTokens: 1847, consentStatus: "ACTIVE", startDate: "2025-11-15", endDate: "2027-11-15", rewardPerDataPoint: 2.0, totalRewardsBEZ: 3694.0 },
    { trialId: "CT-BEZ-2026-003", title: "Phase I - CRISPR Sickle Cell Gene Therapy", sponsor: "Vertex Pharmaceuticals", pi: "Dr. Ana Torres", site: "Hospital Vall Hebron Barcelona", phase: "I", status: "SCREENING", enrolled: 12, target: 30, dataTokens: 156, consentStatus: "PENDING_UPDATES", startDate: "2026-01-10", endDate: "2028-01-10", rewardPerDataPoint: 5.0, totalRewardsBEZ: 780.0 },
    { trialId: "CT-BEZ-2026-004", title: "Phase IV - Long COVID Pulmonary Rehab", sponsor: "AstraZeneca", pi: "Dr. Pedro Ruiz", site: "Hospital Gregorio Maranon Madrid", phase: "IV", status: "DATA_LOCK", enrolled: 2400, target: 2400, dataTokens: 48000, consentStatus: "ACTIVE", startDate: "2024-06-01", endDate: "2026-06-01", rewardPerDataPoint: 0.1, totalRewardsBEZ: 4800.0 },
    { trialId: "CT-BEZ-2026-005", title: "Phase II - GLP-1 + SGLT2 Combo for Obesity", sponsor: "Eli Lilly / Novo Nordisk", pi: "Dr. Laura Sanchez", site: "Hospital del Mar Barcelona", phase: "II", status: "ACTIVE", enrolled: 380, target: 500, dataTokens: 5700, consentStatus: "ACTIVE", startDate: "2025-08-20", endDate: "2027-08-20", rewardPerDataPoint: 0.3, totalRewardsBEZ: 1710.0 },
];

const MOCK_DATASETS = [
    { datasetId: "DS-2026-0042", trial: "CT-BEZ-2026-004", type: "Pulmonary Function", records: 12000, anonymized: true, zkVerified: true, price: 2.5, buyers: 14, totalRevenue: 420000 },
    { datasetId: "DS-2026-0038", trial: "CT-BEZ-2026-001", type: "Cognitive Assessment (ADAS-Cog)", records: 2541, anonymized: true, zkVerified: true, price: 8.0, buyers: 7, totalRevenue: 142296 },
    { datasetId: "DS-2026-0035", trial: "CT-BEZ-2026-002", type: "Tumor Marker Panel (CA 19-9)", records: 1847, anonymized: true, zkVerified: true, price: 15.0, buyers: 3, totalRevenue: 83115 },
    { datasetId: "DS-2026-0031", trial: "CT-BEZ-2026-005", type: "Metabolic Biomarkers (HbA1c, Leptin)", records: 5700, anonymized: true, zkVerified: false, price: 1.0, buyers: 0, totalRevenue: 0 },
    { datasetId: "DS-2026-0029", trial: "CT-BEZ-2026-003", type: "Hemoglobin Electrophoresis", records: 156, anonymized: true, zkVerified: true, price: 25.0, buyers: 2, totalRevenue: 7800 },
];

const STATUS_COLORS = {
    ENROLLING: { bg: "rgba(0,212,255,0.12)", text: "#00D4FF", border: "rgba(0,212,255,0.3)" },
    ACTIVE: { bg: "rgba(0,255,136,0.12)", text: "#00FF88", border: "rgba(0,255,136,0.3)" },
    SCREENING: { bg: "rgba(255,215,0,0.12)", text: "#FFD700", border: "rgba(255,215,0,0.3)" },
    DATA_LOCK: { bg: "rgba(124,58,237,0.12)", text: "#7C3AED", border: "rgba(124,58,237,0.3)" },
    COMPLETED: { bg: "rgba(100,116,139,0.12)", text: "#94A3B8", border: "rgba(100,116,139,0.3)" },
    SUSPENDED: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", border: "rgba(239,68,68,0.3)" },
    PENDING_UPDATES: { bg: "rgba(255,107,53,0.12)", text: "#FF6B35", border: "rgba(255,107,53,0.3)" },
};

const CONTRACT_ABI = `// ClinicalDataMarketplace.sol - BeZhas Research Data Exchange
// Privacy: ZK-SNARK anonymization + On-chain consent

struct ClinicalTrial {
  string  trialId;
  address sponsor;          // Pharma company
  address principalInvestigator;
  string  title;
  uint8   phase;            // 1-4
  uint256 targetEnrollment;
  uint256 startDate;
  uint256 endDate;
  TrialStatus status;
}

struct DataToken {
  uint256 tokenId;          // ERC-1155 token
  uint256 trialId;
  string  dataType;         // e.g., "Cognitive Assessment"
  uint256 recordCount;
  bytes32 anonymizationProof;  // ZK-SNARK proof of proper anonymization
  bytes32 dataHash;         // SHA-256 of encrypted dataset
  uint256 pricePerRecord;   // In BEZ tokens
  bool    zkVerified;
}

struct PatientConsent {
  address patient;
  uint256 trialId;
  bytes32 consentHash;      // SHA-256 of signed consent form
  string[] dataScopes;      // What data can be collected
  bool    allowMarketplace; // Can anonymized data be sold
  uint256 rewardsEarned;    // BEZ tokens earned from data sharing
  uint256 timestamp;
}

// Sponsor registers new clinical trial
function registerTrial(
  string  calldata trialId,
  string  calldata title,
  uint8   phase,
  uint256 targetEnrollment,
  uint256 startDate,
  uint256 endDate
) external onlyRole(SPONSOR_ROLE) returns (uint256 id);

// Patient signs on-chain consent
function signConsent(
  uint256 trialId,
  bytes32 consentHash,
  string[] calldata dataScopes,
  bool    allowMarketplace
) external returns (uint256 consentId);

// Patient revokes consent (data removed from marketplace)
function revokeConsent(
  uint256 consentId
) external;

// Tokenize anonymized dataset for marketplace
function tokenizeDataset(
  uint256 trialId,
  string  calldata dataType,
  uint256 recordCount,
  bytes   calldata zkAnonymizationProof,
  bytes32 dataHash,
  uint256 pricePerRecord
) external onlyRole(RESEARCHER_ROLE) returns (uint256 tokenId);

// Buy access to dataset (BEZ payment)
function purchaseDataAccess(
  uint256 tokenId
) external returns (bytes32 decryptionKey);

// Distribute rewards to patients who contributed data
function distributeRewards(
  uint256 trialId,
  address[] calldata patients,
  uint256[] calldata amounts
) external onlyRole(SPONSOR_ROLE);

// Verify ZK anonymization proof
function verifyAnonymization(
  uint256 tokenId,
  bytes   calldata zkProof
) external view returns (bool valid);`;

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function BioDataAgent() {
    const bridge = useAgentBridge('biodata');
    const [tab, setTab] = useState("trials");
    const [selectedTrial, setSelectedTrial] = useState(null);
    const [stats, setStats] = useState({
        activeTrials: 23, totalPatients: 8420, dataTokens: 91247, datasetsListed: 142,
        totalRewardsBEZ: 48200, marketplaceRevenue: 653211, avgRewardPerPatient: 5.7,
    });
    const [bezFees, setBezFees] = useState(0);

    useEffect(() => {
        const iv = setInterval(() => {
            setBezFees(f => +(f + 0.025).toFixed(4));
            setStats(s => ({
                ...s,
                totalPatients: s.totalPatients + (Math.random() > 0.7 ? 1 : 0),
                dataTokens: s.dataTokens + Math.floor(Math.random() * 5),
                totalRewardsBEZ: +(s.totalRewardsBEZ + Math.random() * 2).toFixed(1),
            }));
        }, 7000);
        return () => clearInterval(iv);
    }, []);

    const tabs = [
        { id: "trials", label: "Trials", icon: "🧬" },
        { id: "consent", label: "Consent", icon: "✅" },
        { id: "marketplace", label: "Data Market", icon: "🏪" },
        { id: "contracts", label: "Contracts", icon: "📜" },
        { id: "stats", label: "Analytics", icon: "📊" },
        { id: "metrics", label: "Metrics", icon: "📊" },
    ];

    const S = {
        bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
        accent: "#7C3AED", accent2: "#00FF88", info: "#00D4FF", warn: "#FFD700", danger: "#EF4444",
        text: "#e2e8f0", muted: "#64748b",
        mono: "'JetBrains Mono','Courier New',monospace",
    };

    return (
        <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.mono, color: S.text, padding: 0 }}>
            <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: `linear-gradient(rgba(124,58,237,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.02) 1px, transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: `1px solid ${S.border}`, paddingBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 10, letterSpacing: 4, color: S.accent, textTransform: "uppercase", marginBottom: 4 }}>Phase 3 - Healthcare</div>
                        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, background: `linear-gradient(135deg, #fff 0%, ${S.accent} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            BioData Agent
                        </h1>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: S.muted }}>Clinical Trial Data Marketplace - ZK-SNARK Anonymization + Patient Rewards</p>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ padding: "8px 16px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 3, fontSize: 12 }}>
                            <span style={{ color: S.muted }}>Fees: </span><span style={{ color: S.accent, fontWeight: 700 }}>{bezFees.toFixed(4)} BEZ</span>
                        </div>
                        <div style={{ padding: "8px 16px", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 3, fontSize: 12 }}>
                            <span style={{ color: S.muted }}>Rewards: </span><span style={{ color: S.accent2, fontWeight: 700 }}>{stats.totalRewardsBEZ.toLocaleString()} BEZ</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            padding: "10px 20px", background: tab === t.id ? S.accent : "transparent",
                            color: tab === t.id ? "#fff" : S.muted, border: `1px solid ${tab === t.id ? S.accent : S.border}`,
                            borderRadius: 3, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: S.mono,
                            letterSpacing: 1, transition: "all 0.2s",
                        }}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* ── TAB: Trials ──────────────────────────────────────────── */}
                {tab === "trials" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                            {[
                                { label: "Active Trials", value: stats.activeTrials.toString(), color: S.accent },
                                { label: "Total Patients", value: stats.totalPatients.toLocaleString(), color: S.accent2 },
                                { label: "Data Tokens", value: stats.dataTokens.toLocaleString(), color: S.info },
                                { label: "Datasets Listed", value: stats.datasetsListed.toString(), color: S.warn },
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
                                        {["Trial ID", "Title", "Phase", "Status", "Enrolled", "Data Tokens", "Rewards (BEZ)", "Actions"].map(h => (
                                            <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: S.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {MOCK_TRIALS.map(tr => {
                                        const sc = STATUS_COLORS[tr.status] || STATUS_COLORS.ACTIVE;
                                        const pct = Math.round((tr.enrolled / tr.target) * 100);
                                        return (
                                            <tr key={tr.trialId} onClick={() => setSelectedTrial(tr)} style={{ borderBottom: `1px solid ${S.border}`, cursor: "pointer" }}
                                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                                <td style={{ padding: "10px 12px", fontWeight: 700, color: S.accent }}>{tr.trialId}</td>
                                                <td style={{ padding: "10px 12px", maxWidth: 220, fontSize: 11 }}>{tr.title}</td>
                                                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                    <span style={{ padding: "3px 10px", borderRadius: 2, fontSize: 10, fontWeight: 900, background: "rgba(124,58,237,0.15)", color: S.accent, border: "1px solid rgba(124,58,237,0.3)" }}>Ph {tr.phase}</span>
                                                </td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <span style={{ padding: "2px 8px", background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, borderRadius: 2, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{tr.status}</span>
                                                </td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                        <div style={{ width: 50, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                                                            <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? S.accent2 : S.info, borderRadius: 2 }} />
                                                        </div>
                                                        <span style={{ fontSize: 10, color: S.muted }}>{tr.enrolled}/{tr.target}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: "10px 12px", color: S.info, fontWeight: 700 }}>{tr.dataTokens.toLocaleString()}</td>
                                                <td style={{ padding: "10px 12px", color: S.accent2, fontWeight: 700 }}>{tr.totalRewardsBEZ.toFixed(1)}</td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <button onClick={e => e.stopPropagation()} style={{ padding: "4px 10px", background: "rgba(124,58,237,0.1)", color: S.accent, border: `1px solid rgba(124,58,237,0.3)`, borderRadius: 2, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: S.mono }}>
                                                        TOKENIZE
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {selectedTrial && (
                            <div style={{ marginTop: 24, padding: 20, background: S.card, border: `1px solid ${S.accent}`, borderRadius: 4 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                        <h3 style={{ margin: "0 0 8px", color: S.accent }}>{selectedTrial.title}</h3>
                                        <div style={{ display: "flex", gap: 16, fontSize: 11, color: S.muted }}>
                                            <span>Sponsor: {selectedTrial.sponsor}</span><span>PI: {selectedTrial.pi}</span>
                                            <span>Site: {selectedTrial.site}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedTrial(null)} style={{ background: "none", border: "none", color: S.muted, cursor: "pointer", fontSize: 18 }}>X</button>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 16 }}>
                                    {[
                                        { label: "Phase", value: selectedTrial.phase, color: S.accent },
                                        { label: "Enrolled", value: `${selectedTrial.enrolled}/${selectedTrial.target}`, color: S.info },
                                        { label: "Data Tokens", value: selectedTrial.dataTokens.toLocaleString(), color: S.warn },
                                        { label: "Reward/Point", value: `${selectedTrial.rewardPerDataPoint} BEZ`, color: S.accent2 },
                                        { label: "Period", value: `${selectedTrial.startDate} - ${selectedTrial.endDate}`, color: S.muted },
                                    ].map((d, i) => (
                                        <div key={i} style={{ padding: 10, background: "rgba(0,0,0,0.3)", borderRadius: 3 }}>
                                            <div style={{ fontSize: 9, color: S.muted, letterSpacing: 2 }}>{d.label}</div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: d.color, marginTop: 4 }}>{d.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: Consent ─────────────────────────────────────────── */}
                {tab === "consent" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                            <div style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                <h3 style={{ margin: "0 0 16px", color: S.accent, fontSize: 16 }}>On-Chain Informed Consent</h3>
                                <p style={{ fontSize: 11, color: S.muted, lineHeight: 1.6, margin: "0 0 16px" }}>
                                    Every clinical trial participant signs consent on-chain via their BeZhas wallet. The consent defines exactly
                                    which data can be collected, how long it can be retained, and whether anonymized data can be sold on the marketplace.
                                    Patients can revoke consent at any time.
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {[
                                        { step: "1", label: "Patient connects wallet", desc: "Links BeZhas identity SBT" },
                                        { step: "2", label: "Review data scopes", desc: "Exactly which metrics will be collected" },
                                        { step: "3", label: "Sign consent on-chain", desc: "EIP-712 typed data signature" },
                                        { step: "4", label: "Marketplace opt-in/out", desc: "Choose if anonymized data can be sold" },
                                        { step: "5", label: "Earn BEZ rewards", desc: "Per-data-point compensation" },
                                    ].map((s, i) => (
                                        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                            <div style={{ minWidth: 28, height: 28, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: S.accent }}>{s.step}</div>
                                            <div>
                                                <div style={{ fontWeight: 700, color: S.text, fontSize: 12 }}>{s.label}</div>
                                                <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{s.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                <h3 style={{ margin: "0 0 16px", color: S.accent2, fontSize: 16 }}>Consent Statistics</h3>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    {[
                                        { label: "Total Consents", value: "8,420", color: S.accent },
                                        { label: "Active", value: "7,891", color: S.accent2 },
                                        { label: "Revoked", value: "312", color: S.danger },
                                        { label: "Pending Updates", value: "217", color: S.warn },
                                        { label: "Marketplace Opt-In", value: "76%", color: S.info },
                                        { label: "Avg Reward", value: "5.7 BEZ", color: S.warn },
                                    ].map((s, i) => (
                                        <div key={i} style={{ padding: 14, background: "rgba(0,0,0,0.3)", borderRadius: 3, borderLeft: `2px solid ${s.color}` }}>
                                            <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2 }}>{s.label.toUpperCase()}</div>
                                            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB: Data Marketplace ────────────────────────────────── */}
                {tab === "marketplace" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h2 style={{ margin: 0, fontSize: 18, color: S.accent }}>Anonymized Clinical Data Marketplace</h2>
                            <div style={{ padding: "6px 14px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 3, fontSize: 12, color: S.accent, fontWeight: 700 }}>
                                Total Revenue: ${stats.marketplaceRevenue.toLocaleString()}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
                            {MOCK_DATASETS.map(ds => (
                                <div key={ds.datasetId} style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{ds.type}</div>
                                            <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{ds.trial} - {ds.datasetId}</div>
                                        </div>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            {ds.anonymized && <span style={{ padding: "2px 8px", borderRadius: 2, fontSize: 9, fontWeight: 700, background: "rgba(0,255,136,0.12)", color: S.accent2, border: "1px solid rgba(0,255,136,0.3)" }}>ANON</span>}
                                            {ds.zkVerified && <span style={{ padding: "2px 8px", borderRadius: 2, fontSize: 9, fontWeight: 700, background: "rgba(124,58,237,0.12)", color: S.accent, border: "1px solid rgba(124,58,237,0.3)" }}>ZK</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 9, color: S.muted, letterSpacing: 1 }}>RECORDS</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: S.info }}>{ds.records.toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 9, color: S.muted, letterSpacing: 1 }}>PRICE/REC</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: S.warn }}>{ds.price} BEZ</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 9, color: S.muted, letterSpacing: 1 }}>BUYERS</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{ds.buyers}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 9, color: S.muted, letterSpacing: 1 }}>REVENUE</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: S.accent2 }}>${ds.totalRevenue.toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <button style={{ width: "100%", padding: "8px 16px", background: ds.zkVerified ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)", color: ds.zkVerified ? S.accent : S.muted, border: `1px solid ${ds.zkVerified ? "rgba(124,58,237,0.3)" : S.border}`, borderRadius: 3, cursor: ds.zkVerified ? "pointer" : "default", fontSize: 11, fontWeight: 700, fontFamily: S.mono, letterSpacing: 1 }}>
                                        {ds.zkVerified ? "PURCHASE ACCESS" : "PENDING ZK VERIFICATION"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── TAB: Contracts ───────────────────────────────────────── */}
                {tab === "contracts" && (
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <h2 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>ClinicalDataMarketplace.sol</h2>
                            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                                {[
                                    { label: "Tokens", value: "ERC-1155 (Data)" },
                                    { label: "Privacy", value: "ZK-SNARK" },
                                    { label: "Consent", value: "On-chain EIP-712" },
                                    { label: "Rewards", value: "BEZ per data point" },
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
                                { label: "Marketplace Revenue", value: `$${(stats.marketplaceRevenue / 1000).toFixed(0)}K`, desc: "Anonymized data sales", color: S.accent },
                                { label: "Patient Rewards", value: `${stats.totalRewardsBEZ.toLocaleString()} BEZ`, desc: "Distributed to participants", color: S.accent2 },
                                { label: "Avg Reward/Patient", value: `${stats.avgRewardPerPatient} BEZ`, desc: "Per enrollment", color: S.warn },
                                { label: "Data Integrity", value: "100%", desc: "ZK-verified datasets", color: S.info },
                                { label: "Active Sponsors", value: "18", desc: "Pharma companies", color: "#FF6B35" },
                                { label: "Research Buyers", value: "67", desc: "Institutions + pharma", color: S.accent },
                            ].map((s, i) => (
                                <div key={i} style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 2, marginBottom: 4 }}>{s.label.toUpperCase()}</div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: s.color, margin: "4px 0" }}>{s.value}</div>
                                    <p style={{ margin: 0, fontSize: 10, color: S.muted }}>{s.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: 20, background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 4 }}>
                            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: S.accent, letterSpacing: 2 }}>REVENUE MODEL</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 12 }}>
                                {[
                                    { stream: "Data Marketplace", fee: "5% commission", model: "Per-transaction cut" },
                                    { stream: "Trial Registration", fee: "100 BEZ/trial", model: "Sponsor pays" },
                                    { stream: "Consent Management", fee: "0.1 BEZ/consent", model: "Per-patient" },
                                    { stream: "ZK Anonymization", fee: "1.0 BEZ/dataset", model: "Per-tokenization" },
                                    { stream: "API Access", fee: "1K BEZ/month", model: "Research subscription" },
                                    { stream: "Compliance Audit", fee: "200 BEZ/audit", model: "IRB/Ethics export" },
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
                            <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — BIODATA</div>
                            <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                        </div>
                        <AgentDetailPanel agentId="biodata" accentColor="#7C3AED" />
                    </div>
                )}
            </div>
        </div>
    );
}
