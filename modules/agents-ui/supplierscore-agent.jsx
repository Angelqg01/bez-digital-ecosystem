import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_SUPPLIERS = [
    { addr: "0xB1…", name: "Beta Parts Inc.", orders: 142, onTime: 134, quality: 92, active: true },
    { addr: "0xB2…", name: "Delta Steel SA", orders: 87, onTime: 79, quality: 85, active: true },
    { addr: "0xB3…", name: "Zeta Chips Ltd", orders: 210, onTime: 205, quality: 97, active: true },
    { addr: "0xB4…", name: "Theta Rubber Co", orders: 63, onTime: 48, quality: 71, active: false },
    { addr: "0xB5…", name: "Kappa Chemicals", orders: 95, onTime: 90, quality: 88, active: true },
];
const MOCK_CERTS = [
    { id: "CERT-001", supplier: "Beta Parts Inc.", cert: "ISO 9001", status: "APPROVED", expires: "2027-06-15" },
    { id: "CERT-002", supplier: "Zeta Chips Ltd", cert: "ISO 14001", status: "APPROVED", expires: "2027-01-30" },
    { id: "CERT-003", supplier: "Theta Rubber Co", cert: "ISO 9001", status: "REVOKED", expires: "2026-12-01" },
    { id: "CERT-004", supplier: "Delta Steel SA", cert: "ISO 45001", status: "EXPIRED", expires: "2026-02-28" },
];
const CERT_COLORS = { PENDING: "#6B7280", APPROVED: "#10B981", REVOKED: "#EF4444", EXPIRED: "#F59E0B" };
const ABI_TEXT = `// SupplierScoreOracle.sol — Key functions
registerSupplier(supplier, nameHash)
recordOrder(supplier, onTime)
performAudit(supplier, score, reportHash)
issueCertification(supplier, certHash, expiresAt)
revokeCertification(certId)
markCertExpired(certId)
deactivateSupplier(supplier)
getDeliveryRate(supplier)
getSupplierAudits(supplier)
getSupplierCerts(supplier)
isCertValid(certId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#A855F7", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function SupplierScoreAgent() {
  const bridge = useAgentBridge("supplierscore");
    const [tab, setTab] = useState("suppliers");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "Audit completed for Zeta Chips — score 97/100" },
        { ts: Date.now() - 60000, msg: "CERT-003 revoked for Theta Rubber Co" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New supplier Sigma Metals registered by auditor 0xA1…",
                "Order recorded for Beta Parts — on-time delivery ✓",
                "Audit initiated for Delta Steel SA — auditor 0xA2…",
                "CERT-004 marked expired for Delta Steel SA",
                "Late delivery recorded for Theta Rubber Co",
                "New ISO 27001 certification issued to Kappa Chemicals",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "suppliers", label: "🏢 Suppliers" },
        { id: "certs", label: "📜 Certifications" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏢</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Supplier<span style={{ color: S.accent }}>Score</span> Oracle Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Reputation scoring · On-chain audits · Certification management</p>
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

            {/* ── Suppliers Tab ── */}
            {tab === "suppliers" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_SUPPLIERS.map(s => {
                        const rate = s.orders > 0 ? Math.round((s.onTime / s.orders) * 100) : 0;
                        return (
                            <div key={s.addr} onClick={() => setSel(s)} style={{ background: S.card, border: `1px solid ${sel?.addr === s.addr ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                    <div>
                                        <span style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</span>
                                        <span style={{ fontFamily: S.mono, fontSize: 11, color: S.muted, marginLeft: 8 }}>{s.addr}</span>
                                    </div>
                                    <span style={{ background: s.active ? "#10B981" : "#EF4444", color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{s.active ? "ACTIVE" : "INACTIVE"}</span>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: S.accent }}>{s.quality}</div>
                                        <div style={{ fontSize: 11, color: S.muted }}>Quality Score</div>
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: rate >= 90 ? "#10B981" : rate >= 75 ? "#F59E0B" : "#EF4444" }}>{rate}%</div>
                                        <div style={{ fontSize: 11, color: S.muted }}>On-Time Rate</div>
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: S.text }}>{s.orders}</div>
                                        <div style={{ fontSize: 11, color: S.muted }}>Total Orders</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Certifications Tab ── */}
            {tab === "certs" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_CERTS.map(c => (
                        <div key={c.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 10 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{c.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.cert}</div>
                            </div>
                            <div style={{ fontSize: 13, color: S.muted }}>{c.supplier}</div>
                            <div style={{ fontSize: 11, color: S.muted }}>Expires {c.expires}</div>
                            <span style={{ background: CERT_COLORS[c.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{c.status}</span>
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

            {/* ── ABI ── */}
            {tab === "abi" && (
                <pre style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, fontFamily: S.mono, fontSize: 13, color: S.accent, whiteSpace: "pre-wrap", overflowX: "auto" }}>{ABI_TEXT}</pre>
            )}

            {/* ── Analytics ── */}
            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                    {[
                        { label: "Total Suppliers", val: "5" },
                        { label: "Active Certs", val: "2" },
                        { label: "Avg Quality", val: "87" },
                        { label: "Avg On-Time", val: "93%" },
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
                  📊 REAL-TIME AGENT METRICS — SUPPLIERSCORE
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/supplierscore/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="supplierscore" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
