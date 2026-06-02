import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_AGREEMENTS = [
    { id: "SLA-001", provider: "0xA1…3F", consumer: "0xB1…9D", uptime: "99.50%", penalty: "0.5 ETH", deposit: "5.00 ETH", breaches: 0, status: "ACTIVE", expires: "2026-06-15" },
    { id: "SLA-002", provider: "0xA2…7B", consumer: "0xB2…4A", uptime: "99.90%", penalty: "1.0 ETH", deposit: "8.00 ETH", breaches: 2, status: "ACTIVE", expires: "2026-09-01" },
    { id: "SLA-003", provider: "0xA3…5C", consumer: "0xB3…1E", uptime: "99.00%", penalty: "0.2 ETH", deposit: "0.00 ETH", breaches: 10, status: "BREACHED", expires: "2026-04-20" },
    { id: "SLA-004", provider: "0xA4…8D", consumer: "0xB4…6F", uptime: "99.95%", penalty: "2.0 ETH", deposit: "10.00 ETH", breaches: 0, status: "ACTIVE", expires: "2026-12-31" },
    { id: "SLA-005", provider: "0xA5…2A", consumer: "0xB5…3C", uptime: "99.50%", penalty: "0.3 ETH", deposit: "1.50 ETH", breaches: 1, status: "TERMINATED", expires: "2026-03-01" },
];
const STATUS_COLORS = { ACTIVE: "#10B981", BREACHED: "#EF4444", TERMINATED: "#6B7280", EXPIRED: "#F59E0B" };
const ABI_TEXT = `// SLAMonitor.sol — Key functions
createAgreement(consumer, uptimeTargetBps, penaltyPerBreach, duration) payable
reportIncident(agreementId, severity, descHash, downtimeSeconds)
resolveIncident(incidentId)
recordBreach(agreementId)
terminateAgreement(agreementId)
markExpired(agreementId)
getAgreementIncidents(agreementId)
getProviderAgreements(provider)
isAgreementActive(agreementId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#F43F5E", accent2: "#FB7185", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function SLAMonitorAgent() {
  const bridge = useAgentBridge("slamonitor");
    const [tab, setTab] = useState("agreements");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "SLA-002 breach recorded — 1.0 ETH penalty paid to 0xB2…4A" },
        { ts: Date.now() - 60000, msg: "SLA-001 incident reported: HIGH severity, 45min downtime" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "SLA-004 uptime check: 99.97% — within target ✓",
                "SLA-002 incident #7 resolved — downtime 12 minutes",
                "SLA-003 deposit depleted — agreement auto-breached",
                "New agreement SLA-006 created: 99.9% target, 5 ETH deposit",
                "SLA-001 provider 0xA1…3F passed monthly audit",
                "SLA-005 terminated by provider — 1.50 ETH deposit refunded",
                "CRITICAL incident on SLA-002: 2-hour outage reported",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "agreements", label: "📑 Agreements" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Lifecycle" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📑</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>SLA<span style={{ color: S.accent }}>Monitor</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Uptime SLAs · Deposits · Breach penalties · Incident tracking</p>
                </div>
                <span style={{ marginLeft: "auto", background: "#10B981", color: "#000", borderRadius: 8, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${S.border}`, paddingBottom: 8 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        style={{ background: tab === t.id ? S.accent : "transparent", color: tab === t.id ? "#000" : S.muted, border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "agreements" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_AGREEMENTS.map(a => (
                        <div key={a.id} onClick={() => setSel(a)} style={{ background: S.card, border: `1px solid ${sel?.id === a.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{a.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>Target: {a.uptime}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>Provider: {a.provider} · Consumer: {a.consumer}</div>
                            <div style={{ fontSize: 12, color: S.muted }}>Deposit: {a.deposit} · Penalty: {a.penalty} · Breaches: {a.breaches}</div>
                            <span style={{ background: STATUS_COLORS[a.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{a.status}</span>
                        </div>
                    ))}
                </div>
            )}

            {tab === "live" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, maxHeight: 500, overflowY: "auto" }}>
                    {events.map((e, i) => (
                        <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
                            <span style={{ color: S.accent, fontFamily: S.mono, marginRight: 10 }}>{new Date(e.ts).toLocaleTimeString()}</span>{e.msg}
                        </div>
                    ))}
                </div>
            )}

            {tab === "pipeline" && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", padding: 32 }}>
                    {["ACTIVE", "BREACHED", "TERMINATED", "EXPIRED"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: STATUS_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_AGREEMENTS.filter(ag => ag.status === st).length}</span>
                            </div>
                            {i < a.length - 1 && <span style={{ color: S.muted, fontSize: 20 }}>→</span>}
                        </div>
                    ))}
                </div>
            )}

            {tab === "abi" && (
                <pre style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, fontFamily: S.mono, fontSize: 13, color: S.accent, whiteSpace: "pre-wrap", overflowX: "auto" }}>{ABI_TEXT}</pre>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                    {[
                        { label: "Total SLAs", val: "5" },
                        { label: "Active", val: "3" },
                        { label: "Total Deposits", val: "24.5 ETH" },
                        { label: "Breach Rate", val: "20%" },
                    ].map(m => (
                        <div key={m.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: S.accent }}>{m.val}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.label}</div>
                        </div>
                    ))}
                </div>
            )}
          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: S.card || S.panel, border: "1px solid " + (S.border), borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — SLAMONITOR
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/slamonitor/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="slamonitor" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
