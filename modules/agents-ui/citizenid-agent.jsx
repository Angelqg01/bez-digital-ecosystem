import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_CITIZENS = [
    { id: "CIT-001", wallet: "0xA1…F3", name: "Maria Gonzalez", kyc: "VERIFIED", docs: 3, registered: "2025-11-02" },
    { id: "CIT-002", wallet: "0xB2…E4", name: "Carlos Mendez", kyc: "PENDING", docs: 1, registered: "2026-01-15" },
    { id: "CIT-003", wallet: "0xC3…D5", name: "Ana Torres", kyc: "VERIFIED", docs: 5, registered: "2025-08-20" },
    { id: "CIT-004", wallet: "0xD4…C6", name: "Luis Ramirez", kyc: "NONE", docs: 0, registered: "2026-03-10" },
    { id: "CIT-005", wallet: "0xE5…B7", name: "Sofia Herrera", kyc: "REVOKED", docs: 2, registered: "2025-06-01" },
];
const KYC_COLORS = { NONE: "#6B7280", PENDING: "#F59E0B", VERIFIED: "#10B981", REVOKED: "#EF4444" };
const DOC_TYPES = ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "BIRTH_CERT", "TAX_ID", "OTHER"];
const ABI_TEXT = `// CitizenIdentityNFT.sol — Key functions
registerCitizen(wallet, nameHash, biometricHash)
submitKYC(citizenId, dataHash)
verifyKYC(citizenId)
revokeKYC(citizenId)
issueDocument(citizenId, docType, docHash, expiry)
revokeDocument(citizenId, docIdx)
deactivateCitizen(citizenId)
getCitizenDocs(citizenId)
isDocValid(citizenId, docIdx)
isKYCVerified(citizenId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#10B981", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function CitizenIdentityAgent() {
    const bridge = useAgentBridge('citizenid');
    const [tab, setTab] = useState("citizens");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "KYC verified for CIT-003 — Ana Torres" },
        { ts: Date.now() - 60000, msg: "New citizen CIT-004 registered — Luis Ramirez" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New citizen CIT-006 registered — wallet 0xF6…A8",
                "KYC submission received for CIT-002 — pending review",
                "NATIONAL_ID document issued to CIT-001",
                "KYC revoked for CIT-005 — compliance issue",
                "PASSPORT document verified for CIT-003",
                "Citizen CIT-004 submitted KYC biometric data",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "citizens", label: "🪪 Citizens" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "kyc", label: "🔒 KYC Pipeline" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🪪</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Citizen<span style={{ color: S.accent }}>Identity</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Digital citizen ID · KYC verification · Document registry</p>
                </div>
                <span style={{ marginLeft: "auto", background: "#10B981", color: "#000", borderRadius: 8, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>● LIVE</span>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${S.border}`, paddingBottom: 8 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        style={{ background: tab === t.id ? S.accent : "transparent", color: tab === t.id ? "#000" : S.muted, border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Citizens Tab ── */}
            {tab === "citizens" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_CITIZENS.map(c => (
                        <div key={c.id} onClick={() => setSel(c)} style={{ background: S.card, border: `1px solid ${sel?.id === c.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{c.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>{c.wallet} · {c.docs} docs</div>
                            <div style={{ fontSize: 11, color: S.muted }}>Registered {c.registered}</div>
                            <span style={{ background: KYC_COLORS[c.kyc] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{c.kyc}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Live Feed ── */}
            {tab === "live" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, maxHeight: 500, overflowY: "auto" }}>
                    {events.map((e, i) => (
                        <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
                            <span style={{ color: S.accent, fontFamily: S.mono, marginRight: 10 }}>{new Date(e.ts).toLocaleTimeString()}</span>{e.msg}
                        </div>
                    ))}
                </div>
            )}

            {/* ── KYC Pipeline ── */}
            {tab === "kyc" && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", padding: 32 }}>
                    {["NONE", "PENDING", "VERIFIED", "REVOKED"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: KYC_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_CITIZENS.filter(c => c.kyc === st).length}</span>
                            </div>
                            {i < a.length - 1 && <span style={{ color: S.muted, fontSize: 20 }}>→</span>}
                        </div>
                    ))}
                </div>
            )}

            {/* ── ABI ── */}
            {tab === "abi" && (
                <pre style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, fontFamily: S.mono, fontSize: 13, color: S.accent, whiteSpace: "pre-wrap", overflowX: "auto" }}>{ABI_TEXT}</pre>
            )}

            {/* ── Analytics ── */}
            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                    {[
                        { label: "Total Citizens", val: "5" },
                        { label: "KYC Verified", val: "2" },
                        { label: "Pending KYC", val: "1" },
                        { label: "Documents Issued", val: "11" },
                    ].map(m => (
                        <div key={m.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: S.accent }}>{m.val}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.label}</div>
                        </div>
                    ))}
                </div>
            )}
            {tab === "metrics" && (
                <div>
                    <div style={{ background: S.card, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — CITIZENID</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="citizenid" accentColor="#10B981" />
                </div>
            )}
        </div>
    );
}
