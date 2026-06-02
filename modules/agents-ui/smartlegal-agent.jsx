import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_CONTRACTS = [
    { id: "SLC-001", title: "Service Agreement — Acme Corp", parties: ["Acme Corp", "Beta LLC"], status: "ACTIVE", clauses: 5, signed: "2/2", expires: "2027-03-15" },
    { id: "SLC-002", title: "NDA — Gamma Industries", parties: ["Gamma Ind.", "Delta SA"], status: "PENDING_SIGNATURES", clauses: 3, signed: "1/2", expires: "2026-12-01" },
    { id: "SLC-003", title: "Employment Contract — J. Doe", parties: ["J. Doe", "Epsilon Tech"], status: "DISPUTED", clauses: 8, signed: "2/2", expires: "2028-06-30" },
    { id: "SLC-004", title: "Licensing Agreement — Zeta IP", parties: ["Zeta IP", "Eta Media"], status: "TERMINATED", clauses: 6, signed: "2/2", expires: "2026-09-01" },
    { id: "SLC-005", title: "Joint Venture — Theta & Iota", parties: ["Theta Co", "Iota Ltd"], status: "ACTIVE", clauses: 12, signed: "3/3", expires: "2029-01-01" },
];
const STATUS_COLORS = { DRAFT: "#6B7280", PENDING_SIGNATURES: "#F59E0B", ACTIVE: "#10B981", DISPUTED: "#EF4444", TERMINATED: "#7C3AED", EXPIRED: "#3D5E80" };
const CONTRACT_ABI = `// SmartLegalContract.sol — Key functions
draftContract(title, documentHash, expiresAt, signaturesRequired, signatories[])
signContract(contractId)
addClause(contractId, clauseType, contentHash, penalty)
fulfillClause(contractId, clauseId)
raiseDispute(contractId)
terminateContract(contractId, reason)
checkExpiry(contractId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#8B5CF6", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function SmartLegalContractAgent() {
  const bridge = useAgentBridge("smartlegal");
    const [tab, setTab] = useState("contracts");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "Contract SLC-005 activated — 3/3 signatures collected" },
        { ts: Date.now() - 60000, msg: "Clause #4 fulfilled on SLC-001 by notary 0xA1…" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New contract SLC-006 drafted by 0xB3…",
                "Signature received on SLC-002 (2/2) — activating",
                "Dispute raised on SLC-005 by party Theta Co",
                "Clause #2 marked fulfilled on SLC-003",
                "Contract SLC-004 terminated: breach of terms",
                "Expiry check triggered on SLC-002 — still valid",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "contracts", label: "📜 Contracts" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "grid", placeItems: "center", fontSize: 20 }}>📜</div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>SmartLegal Agent</div>
                    <div style={{ fontSize: 12, color: S.muted }}>On-chain legal agreements • Digital signatures • Dispute resolution</div>
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
            {tab === "contracts" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_CONTRACTS.map(c => (
                        <div key={c.id} onClick={() => setSel(sel === c.id ? null : c.id)} style={{ background: S.card, border: `1px solid ${sel === c.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontWeight: 700 }}>{c.id}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: STATUS_COLORS[c.status] + "22", color: STATUS_COLORS[c.status] }}>{c.status}</span>
                            </div>
                            <div style={{ fontSize: 14, marginBottom: 6 }}>{c.title}</div>
                            <div style={{ display: "flex", gap: 16, fontSize: 12, color: S.muted }}>
                                <span>Parties: {c.parties.join(", ")}</span>
                                <span>Clauses: {c.clauses}</span>
                                <span>Signed: {c.signed}</span>
                                <span>Expires: {c.expires}</span>
                            </div>
                            {sel === c.id && (
                                <div style={{ marginTop: 12, padding: 12, background: S.bg, borderRadius: 8, fontSize: 12, fontFamily: S.mono }}>
                                    <div>documentHash: keccak256("{c.title}")</div>
                                    <div>signaturesRequired: {c.signed.split("/")[1]}</div>
                                    <div>clauseTypes: [OBLIGATION, CONDITION, PENALTY, TERMINATION, CONFIDENTIALITY]</div>
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                    {[{ s: "DRAFT", n: 2, c: STATUS_COLORS.DRAFT }, { s: "PENDING", n: 3, c: STATUS_COLORS.PENDING_SIGNATURES }, { s: "ACTIVE", n: 8, c: STATUS_COLORS.ACTIVE }, { s: "DISPUTED", n: 1, c: STATUS_COLORS.DISPUTED }].map(p => (
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
                    {[{ l: "Total Contracts", v: "47" }, { l: "Active", v: "22" }, { l: "Disputed", v: "3" }, { l: "Clauses Fulfilled", v: "184" }, { l: "Avg Signatures", v: "2.4" }, { l: "Terminated", v: "5" }].map(m => (
                        <div key={m.l} style={{ background: S.card, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: S.accent }}>{m.v}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.l}</div>
                        </div>
                    ))}
                </div>
            )}
          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: S.card || S.panel, border: "1px solid " + (S.border), borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — SMARTLEGAL
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/smartlegal/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="smartlegal" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
