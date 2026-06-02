import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_CLAIMS = [
    { id: "CLM-001", policyId: "POL-002", claimant: "Finca Los Pinos", type: "Crop Damage", amount: 320000, currency: "MXN", filedDate: "2026-03-10", evidence: "3 photos + IoT temp log", aiScore: 87, status: "APPROVED", adjuster: "AI + Manual Review", fraudRisk: 5 },
    { id: "CLM-002", policyId: "POL-003", claimant: "AutoFleet Corp", type: "Vehicle Collision", amount: 45000, currency: "USD", filedDate: "2026-03-08", evidence: "Police report + dashcam", aiScore: 92, status: "APPROVED", adjuster: "AI Auto-Approved", fraudRisk: 3 },
    { id: "CLM-003", policyId: "POL-005", claimant: "Bodegas Valle DO", type: "Drought Parametric", amount: 500000, currency: "MXN", filedDate: "2026-03-14", evidence: "Oracle drought index >85", aiScore: 95, status: "PENDING", adjuster: "Oracle Triggered", fraudRisk: 1 },
    { id: "CLM-004", policyId: "POL-003", claimant: "AutoFleet Corp", type: "Theft", amount: 120000, currency: "USD", filedDate: "2026-02-20", evidence: "Police report only", aiScore: 42, status: "FLAGGED", adjuster: "AI Flagged Fraud", fraudRisk: 78 },
    { id: "CLM-005", policyId: "POL-001", claimant: "TransLogistica SA", type: "Cargo Water Damage", amount: 85000, currency: "USD", filedDate: "2026-03-12", evidence: "Inspection report + photos", aiScore: 76, status: "REVIEW", adjuster: "Manual Review Required", fraudRisk: 22 },
    { id: "CLM-006", policyId: "POL-004", claimant: "Solar Farms Inc", type: "Equipment Failure", amount: 65000, currency: "USD", filedDate: "2026-01-15", evidence: "IoT sensor log + tech report", aiScore: 91, status: "PAID", adjuster: "AI Auto-Approved", fraudRisk: 2 },
];

const MOCK_EVENTS = [
    { time: "15:30:02", claim: "CLM-003", event: "ORACLE_VERIFIED", detail: "Drought index confirmed 87.3 — auto-payout triggered" },
    { time: "15:18:45", claim: "CLM-004", event: "FRAUD_FLAG", detail: "AI confidence 42% — inconsistent timeline — manual review" },
    { time: "15:05:10", claim: "CLM-005", event: "EVIDENCE_ADDED", detail: "3 additional photos uploaded — re-scoring..." },
    { time: "14:50:33", claim: "CLM-006", event: "PAYOUT_SENT", detail: "65,000 USD equivalent in BEZ — tx 0x8a3f...d21c" },
];

const STATUS_COLORS = { APPROVED: "#00FF88", PENDING: "#FFD700", FLAGGED: "#EF4444", REVIEW: "#F97316", PAID: "#3B82F6", DENIED: "#7C3AED" };
const EVENT_COLORS = { ORACLE_VERIFIED: "#00FF88", FRAUD_FLAG: "#EF4444", EVIDENCE_ADDED: "#3B82F6", PAYOUT_SENT: "#00FF88", AI_SCORED: "#FFD700", ESCALATED: "#F97316" };

const CONTRACT_ABI = `// ClaimAdjuster.sol  —  BeZhas Chain
// AI-powered claim processing with fraud detection

struct Claim {
  uint256  policyId;
  address  claimant;
  string   claimType;
  uint256  amount;
  uint256  filedAt;
  uint256  aiScore;          // 0-100 AI confidence
  uint256  fraudRisk;        // 0-100 fraud probability
  bool     approved;
  bool     paid;
  bool     flagged;
}

struct EvidenceLog {
  uint256  claimId;
  string   evidenceHash;     // IPFS CID
  string   evidenceType;     // "photo","document","iot_log","oracle"
  uint256  timestamp;
}

function fileClaim(uint256 policyId, string claimType, uint256 amount) external returns (uint256);
function submitEvidence(uint256 claimId, string hash, string evidenceType) external;
function aiScoreClaim(uint256 claimId, uint256 score, uint256 fraudRisk) external;
function approveClaim(uint256 claimId) external;
function flagClaim(uint256 claimId, string reason) external;
function payoutClaim(uint256 claimId) external;`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#F97316", accent2: "#FFD700", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function ClaimAdjusterAgent() {
    const bridge = useAgentBridge('claimadjuster');
    const [tab, setTab] = useState("claims");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState(MOCK_EVENTS);

    useEffect(() => {
        const iv = setInterval(() => {
            const claim = MOCK_CLAIMS[Math.floor(Math.random() * MOCK_CLAIMS.length)];
            const evts = ["AI_SCORED", "EVIDENCE_ADDED", "ESCALATED", "ORACLE_VERIFIED"];
            const evt = evts[Math.floor(Math.random() * evts.length)];
            setEvents(p => [{
                time: new Date().toLocaleTimeString(), claim: claim.id, event: evt,
                detail: evt === "AI_SCORED" ? `Score: ${claim.aiScore} — Fraud risk: ${claim.fraudRisk}%` : evt === "EVIDENCE_ADDED" ? `New evidence for ${claim.type} claim` : `${claim.type} — ${claim.claimant}`
            }, ...p].slice(0, 30));
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "claims", label: "📋 Claims" },
        { id: "activity", label: "📡 Activity" },
        { id: "pipeline", label: "🔄 Adjuster Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const approved = MOCK_CLAIMS.filter(c => c.status === "APPROVED" || c.status === "PAID").length;
    const flagged = MOCK_CLAIMS.filter(c => c.status === "FLAGGED").length;
    const totalAmount = MOCK_CLAIMS.reduce((s, c) => s + c.amount, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>📋</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>ClaimAdjuster Agent — AI-Powered Claim Processing</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>AI scoring · Fraud detection · Evidence hashing · Auto-payout</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#F9731622", color: "#F97316", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● ACTIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "claims" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Approved/Paid", approved, "#00FF88"], ["Flagged", flagged, "#EF4444"], ["Total Claims", totalAmount.toLocaleString(), S.accent]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Claimant</th><th>Type</th><th>AI</th><th>Fraud</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_CLAIMS.map(c => (
                                <tr key={c.id} onClick={() => setSel(c)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === c.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent2, fontSize: 11 }}>{c.id}</td>
                                    <td>{c.claimant}</td>
                                    <td style={{ fontSize: 12 }}>{c.type}</td>
                                    <td style={{ fontFamily: S.mono, fontSize: 11, color: c.aiScore >= 80 ? "#00FF88" : c.aiScore >= 60 ? "#FFD700" : "#EF4444" }}>{c.aiScore}%</td>
                                    <td style={{ fontFamily: S.mono, fontSize: 11, color: c.fraudRisk > 50 ? "#EF4444" : c.fraudRisk > 20 ? "#FFD700" : "#00FF88" }}>{c.fraudRisk}%</td>
                                    <td><span style={{ color: STATUS_COLORS[c.status], fontSize: 11 }}>● {c.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.type} Claim</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>{sel.claimant} · Policy {sel.policyId}</div>
                            {[["Amount", sel.amount.toLocaleString() + " " + sel.currency], ["Filed", sel.filedDate], ["Evidence", sel.evidence], ["AI Score", sel.aiScore + "%"], ["Fraud Risk", sel.fraudRisk + "%"], ["Adjuster", sel.adjuster]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12, maxWidth: 200, textAlign: "right" }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                                <div style={{ flex: 1, background: "#00FF8822", borderRadius: 8, padding: 6, textAlign: "center", fontSize: 11 }}>
                                    <div style={{ color: "#00FF88", fontWeight: 700 }}>AI: {sel.aiScore}%</div>
                                </div>
                                <div style={{ flex: 1, background: sel.fraudRisk > 50 ? "#EF444422" : "#FFD70022", borderRadius: 8, padding: 6, textAlign: "center", fontSize: 11 }}>
                                    <div style={{ color: sel.fraudRisk > 50 ? "#EF4444" : "#FFD700", fontWeight: 700 }}>Fraud: {sel.fraudRisk}%</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "activity" && (
                <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Claim</th><th>Event</th><th>Detail</th>
                        </tr></thead>
                        <tbody>{events.map((e, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11`, background: e.event === "FRAUD_FLAG" ? "#EF444411" : "transparent" }}>
                                <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                                <td style={{ color: S.accent2 }}>{e.claim}</td>
                                <td><span style={{ color: EVENT_COLORS[e.event] || S.text, fontSize: 11 }}>{e.event}</span></td>
                                <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.detail}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Claim Adjuster Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. File Claim", "2. Evidence", "3. AI Score", "4. Review/Flag", "5. Payout"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📋", "📎", "🤖", "🔍", "💰"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    {["PENDING", "REVIEW", "APPROVED", "FLAGGED", "PAID"].map(status => {
                        const items = MOCK_CLAIMS.filter(c => c.status === status);
                        if (!items.length) return null;
                        return (
                            <div key={status} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: STATUS_COLORS[status] }}>● {status} ({items.length})</div>
                                {items.map(c => (
                                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span>{c.claimant} — {c.type}</span>
                                        <span style={{ fontFamily: S.mono, color: S.muted }}>AI:{c.aiScore}% Fraud:{c.fraudRisk}% · {c.amount.toLocaleString()} {c.currency}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>ClaimAdjuster.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Claim Filing", "0.5 BEZ / claim", "+120 claims/mo", "📋"],
                        ["AI Scoring", "0.2 BEZ / score", "+120 scores/mo", "🤖"],
                        ["Fraud Detection", "1.0 BEZ / flag", "+15 flags/mo", "🚨"],
                        ["Evidence Hashing", "0.1 BEZ / hash", "+400 hashes/mo", "📎"],
                        ["Auto-Payout", "0.3% of payout", "+2.1M USD/mo settled", "💰"],
                        ["Adjuster SaaS", "$1,499/mo per insurer", "8 insurers", "🏢"],
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — CLAIMADJUSTER</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="claimadjuster" accentColor="#F97316" />
                </div>
            )}
        </div>
    );
}
