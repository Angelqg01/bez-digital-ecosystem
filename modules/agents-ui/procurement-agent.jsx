import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_POS = [
    { id: "PO-001", buyer: "Acme Corp", supplier: "Beta Parts", amount: "5.0 ETH", status: "APPROVED", approvals: "2/2", created: "2026-03-10" },
    { id: "PO-002", buyer: "Gamma Mfg", supplier: "Delta Steel", amount: "12.5 ETH", status: "PENDING_APPROVAL", approvals: "1/3", created: "2026-03-14" },
    { id: "PO-003", buyer: "Epsilon Tech", supplier: "Zeta Chips", amount: "8.0 ETH", status: "SHIPPED", approvals: "2/2", created: "2026-03-08" },
    { id: "PO-004", buyer: "Eta Motors", supplier: "Theta Rubber", amount: "3.2 ETH", status: "SETTLED", approvals: "1/1", created: "2026-02-28" },
    { id: "PO-005", buyer: "Iota Pharma", supplier: "Kappa Chem", amount: "20.0 ETH", status: "CANCELLED", approvals: "0/2", created: "2026-03-16" },
];
const STATUS_COLORS = { DRAFT: "#6B7280", PENDING_APPROVAL: "#F59E0B", APPROVED: "#3B82F6", SHIPPED: "#8B5CF6", RECEIVED: "#06B6D4", SETTLED: "#10B981", CANCELLED: "#EF4444" };
const ABI_TEXT = `// ProcurementNFT.sol — Key functions
createPO(supplier, itemsHash, totalAmount, requiredApprovals)
submitForApproval(poId)
approvePO(poId)
markShipped(poId)
confirmReceipt(poId)
settle(poId)
cancelPO(poId)
getBuyerOrders(buyer)
getSupplierOrders(supplier)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#F97316", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function ProcurementNFTAgent() {
  const bridge = useAgentBridge("procurement");
    const [tab, setTab] = useState("orders");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "PO-001 fully approved — 2/2 approvals collected" },
        { ts: Date.now() - 60000, msg: "PO-004 settled — 3.2 ETH released to Theta Rubber" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New PO-006 created by Acme Corp — 7.5 ETH escrow deposited",
                "Approval received on PO-002 (2/3) by 0xA2…",
                "PO-003 marked SHIPPED by Zeta Chips",
                "Receipt confirmed on PO-003 by Epsilon Tech",
                "PO-005 cancelled — 20.0 ETH refunded to Iota Pharma",
                "PO-002 submitted for approval by Gamma Mfg",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "orders", label: "🛒 Orders" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🛒</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Procurement<span style={{ color: S.accent }}>NFT</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Purchase orders · Multi-approval · Auto-settlement</p>
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

            {/* ── Orders Tab ── */}
            {tab === "orders" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_POS.map(po => (
                        <div key={po.id} onClick={() => setSel(po)} style={{ background: S.card, border: `1px solid ${sel?.id === po.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{po.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{po.buyer} → {po.supplier}</div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: S.accent }}>{po.amount} <span style={{ color: S.muted, fontWeight: 400, fontSize: 11 }}>Approvals: {po.approvals}</span></div>
                            <div style={{ fontSize: 11, color: S.muted }}>Created {po.created}</div>
                            <span style={{ background: STATUS_COLORS[po.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{po.status}</span>
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

            {/* ── Pipeline ── */}
            {tab === "pipeline" && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", padding: 32, flexWrap: "wrap" }}>
                    {["DRAFT", "PENDING_APPROVAL", "APPROVED", "SHIPPED", "RECEIVED", "SETTLED"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: STATUS_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 16px", fontSize: 12, fontWeight: 700, textAlign: "center", minWidth: 70 }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_POS.filter(p => p.status === st).length}</span>
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
                        { label: "Total POs", val: "5" },
                        { label: "Pending Approval", val: "1" },
                        { label: "Settled", val: "1" },
                        { label: "Total Escrow", val: "48.7 ETH" },
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
                  📊 REAL-TIME AGENT METRICS — PROCUREMENT
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/procurement/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="procurement" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
