import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_INVOICES = [
    { id: "INV-001", seller: "0xB1…3F", debtor: "0xC1…2A", faceValue: "10.00 ETH", discount: "5%", funded: "9.50 ETH", status: "REPAID", due: "2026-04-15" },
    { id: "INV-002", seller: "0xB2…7A", debtor: "0xC2…5D", faceValue: "25.00 ETH", discount: "3%", funded: "24.25 ETH", status: "FUNDED", due: "2026-05-01" },
    { id: "INV-003", seller: "0xB3…4D", debtor: "0xC3…8B", faceValue: "8.00 ETH", discount: "7%", funded: "-", status: "APPROVED", due: "2026-04-30" },
    { id: "INV-004", seller: "0xB4…9C", debtor: "0xC4…1E", faceValue: "15.00 ETH", discount: "4%", funded: "14.40 ETH", status: "DEFAULTED", due: "2026-03-01" },
    { id: "INV-005", seller: "0xB5…2E", debtor: "0xC5…6F", faceValue: "5.00 ETH", discount: "6%", funded: "-", status: "SUBMITTED", due: "2026-06-15" },
];
const STATUS_COLORS = { SUBMITTED: "#6B7280", APPROVED: "#F59E0B", FUNDED: "#3B82F6", REPAID: "#10B981", DEFAULTED: "#EF4444", CANCELLED: "#9CA3AF" };
const ABI_TEXT = `// InvoiceFactoring.sol — Key functions
submitInvoice(debtor, faceValue, discountBps, dueDate)
approveInvoice(invoiceId)
fundInvoice(invoiceId) payable
repayInvoice(invoiceId) payable
markDefaulted(invoiceId)
cancelInvoice(invoiceId)
withdrawRepaid(invoiceId)
getSellerInvoices(seller)
getDiscountedAmount(invoiceId)
isOverdue(invoiceId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#8B5CF6", accent2: "#A78BFA", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function InvoiceFactoringAgent() {
    const bridge = useAgentBridge('invoicefactoring');
    const [tab, setTab] = useState("invoices");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "INV-001 repaid by debtor 0xC1…2A — face value 10.00 ETH" },
        { ts: Date.now() - 60000, msg: "INV-004 marked defaulted — past due date 2026-03-01" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New invoice INV-006 submitted: 12.00 ETH face value, 5% discount",
                "INV-003 approved by factor — ready for funding",
                "INV-002 repayment received: 25.00 ETH from debtor 0xC2…5D",
                "Factor withdrew repaid funds from INV-001: 10.00 ETH",
                "INV-005 discount check: 6% within 3000 bps limit ✓",
                "Overdue alert: INV-004 past due by 45 days",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "invoices", label: "📄 Invoices" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Lifecycle" },
        { id: "abi", label: "📜 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📄</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Invoice<span style={{ color: S.accent }}>Factoring</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Invoice submission · Factoring · Repayment · Settlement</p>
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

            {tab === "invoices" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_INVOICES.map(inv => (
                        <div key={inv.id} onClick={() => setSel(inv)} style={{ background: S.card, border: `1px solid ${sel?.id === inv.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{inv.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>Seller: {inv.seller}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>Face: {inv.faceValue} · Discount: {inv.discount}</div>
                            <div style={{ fontSize: 12, color: S.muted }}>Funded: {inv.funded} · Due: {inv.due}</div>
                            <span style={{ background: STATUS_COLORS[inv.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{inv.status}</span>
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
                    {["SUBMITTED", "APPROVED", "FUNDED", "REPAID"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: STATUS_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_INVOICES.filter(inv => inv.status === st).length}</span>
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
                        { label: "Total Invoices", val: "5" },
                        { label: "Active Funded", val: "1" },
                        { label: "Total Face Value", val: "63 ETH" },
                        { label: "Default Rate", val: "20%" },
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — INVOICEFACTORING</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="invoicefactoring" accentColor="#8B5CF6" />
                </div>
            )}
        </div>
    );
}
