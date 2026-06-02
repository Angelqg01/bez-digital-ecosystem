import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_EVIDENCE = [
    { id: "EV-001", type: "DOCUMENT", caseId: 100, hash: "0xabc1…", sealed: true, challenged: false, custody: 4, submitter: "0xB1…" },
    { id: "EV-002", type: "PHOTO", caseId: 100, hash: "0xdef2…", sealed: false, challenged: false, custody: 2, submitter: "0xB2…" },
    { id: "EV-003", type: "VIDEO", caseId: 201, hash: "0x1234…", sealed: true, challenged: true, custody: 5, submitter: "0xB1…" },
    { id: "EV-004", type: "DIGITAL_FORENSIC", caseId: 305, hash: "0x5678…", sealed: false, challenged: false, custody: 1, submitter: "0xB3…" },
    { id: "EV-005", type: "TESTIMONY", caseId: 100, hash: "0x9abc…", sealed: true, challenged: false, custody: 3, submitter: "0xB4…" },
];
const TYPE_COLORS = { DOCUMENT: "#3B82F6", PHOTO: "#10B981", VIDEO: "#EF4444", AUDIO: "#F59E0B", DIGITAL_FORENSIC: "#8B5CF6", TESTIMONY: "#EC4899" };
const CONTRACT_ABI = `// EvidenceVault.sol — Key functions
submitEvidence(contentHash, evidenceType, caseId)
transferCustody(evidenceId, to, notesHash)
sealEvidence(evidenceId)
challengeEvidence(evidenceId)
releaseEvidence(evidenceId, to)
verifyHash(evidenceId, hash)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#3B82F6", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function EvidenceVaultAgent() {
    const bridge = useAgentBridge('evidencevault');
    const [tab, setTab] = useState("evidence");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "Evidence EV-005 sealed by custodian 0xA1…" },
        { ts: Date.now() - 45000, msg: "New evidence submitted for Case #305 — digital forensics" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "Custody transferred: EV-002 → 0xA2… (chain of custody: 3)",
                "Evidence EV-006 submitted for Case #410 — AUDIO type",
                "EV-003 challenged by party 0xC1… — under review",
                "Hash verification passed for EV-001 ✓",
                "Evidence EV-004 sealed — no further transfers allowed",
                "Released: EV-005 to court address 0xD1…",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "evidence", label: "🔒 Evidence" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔗 Custody Chain" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "grid", placeItems: "center", fontSize: 20 }}>🔒</div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>EvidenceVault Agent</div>
                    <div style={{ fontSize: 12, color: S.muted }}>Tamper-proof evidence storage • Chain of custody • Hash verification</div>
                </div>
                <span style={{ marginLeft: "auto", background: "#10B981", color: "#000", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 999 }}>ACTIVE</span>
            </div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${S.border}`, paddingBottom: 8 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent : "transparent", color: tab === t.id ? "#fff" : S.muted, border: "none", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{t.label}</button>
                ))}
            </div>
            {/* Content */}
            {tab === "evidence" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_EVIDENCE.map(e => (
                        <div key={e.id} onClick={() => setSel(sel === e.id ? null : e.id)} style={{ background: S.card, border: `1px solid ${sel === e.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontWeight: 700 }}>{e.id}</span>
                                <div style={{ display: "flex", gap: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: TYPE_COLORS[e.type] + "22", color: TYPE_COLORS[e.type] }}>{e.type}</span>
                                    {e.sealed && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#10B98122", color: "#10B981" }}>SEALED</span>}
                                    {e.challenged && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#EF444422", color: "#EF4444" }}>CHALLENGED</span>}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 16, fontSize: 12, color: S.muted }}>
                                <span>Case #{e.caseId}</span>
                                <span>Hash: {e.hash}</span>
                                <span>Custody records: {e.custody}</span>
                                <span>Submitter: {e.submitter}</span>
                            </div>
                            {sel === e.id && (
                                <div style={{ marginTop: 12, padding: 12, background: S.bg, borderRadius: 8, fontSize: 12, fontFamily: S.mono }}>
                                    <div>contentHash: {e.hash}</div>
                                    <div>custodyChain: [{Array(e.custody).fill(0).map((_, i) => `Record#${i}`).join(" → ")}]</div>
                                    <div>sealed: {e.sealed.toString()} | challenged: {e.challenged.toString()}</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {tab === "live" && (
                <div style={{ display: "grid", gap: 6 }}>
                    {events.map((e, i) => (
                        <div key={i} style={{ background: S.card, padding: "10px 14px", borderRadius: 8, fontSize: 13, borderLeft: `3px solid ${S.accent}` }}>
                            <span style={{ color: S.muted, fontFamily: S.mono, fontSize: 11, marginRight: 10 }}>{new Date(e.ts).toLocaleTimeString()}</span>{e.msg}
                        </div>
                    ))}
                </div>
            )}
            {tab === "pipeline" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
                    {[{ s: "SUBMITTED", n: 12, c: "#F59E0B" }, { s: "TRANSFERRED", n: 8, c: "#3B82F6" }, { s: "SEALED", n: 15, c: "#10B981" }, { s: "RELEASED", n: 6, c: "#8B5CF6" }, { s: "CHALLENGED", n: 2, c: "#EF4444" }].map(p => (
                        <div key={p.s} style={{ background: S.card, borderRadius: 10, padding: 20, textAlign: "center", borderTop: `3px solid ${p.c}` }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: p.c }}>{p.n}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{p.s}</div>
                        </div>
                    ))}
                </div>
            )}
            {tab === "abi" && (
                <pre style={{ background: S.card, borderRadius: 10, padding: 20, fontSize: 13, fontFamily: S.mono, color: S.accent, whiteSpace: "pre-wrap", border: `1px solid ${S.border}` }}>{CONTRACT_ABI}</pre>
            )}
            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                    {[{ l: "Total Evidence", v: "43" }, { l: "Sealed", v: "28" }, { l: "Challenged", v: "4" }, { l: "Cases Covered", v: "18" }, { l: "Custody Transfers", v: "97" }, { l: "Hash Verifications", v: "156" }].map(m => (
                        <div key={m.l} style={{ background: S.card, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: S.accent }}>{m.v}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.l}</div>
                        </div>
                    ))}
                </div>
            )}
            {tab === "metrics" && (
                <div>
                    <div style={{ background: S.card, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — EVIDENCEVAULT</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="evidencevault" accentColor="#3B82F6" />
                </div>
            )}
        </div>
    );
}
