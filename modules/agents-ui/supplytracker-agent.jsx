import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_SHIPMENTS = [
    { id: "SHP-001", sender: "Acme Corp", receiver: "Beta LLC", status: "IN_TRANSIT", weight: 2500, checkpoints: 3, created: "2026-03-10" },
    { id: "SHP-002", sender: "Gamma Ind.", receiver: "Delta SA", status: "DELIVERED", weight: 800, checkpoints: 5, created: "2026-02-20" },
    { id: "SHP-003", sender: "Epsilon Tech", receiver: "Zeta Dist", status: "CREATED", weight: 12000, checkpoints: 0, created: "2026-03-16" },
    { id: "SHP-004", sender: "Eta Logistics", receiver: "Theta Mfg", status: "AT_CHECKPOINT", weight: 4500, checkpoints: 2, created: "2026-03-12" },
    { id: "SHP-005", sender: "Iota Trading", receiver: "Kappa Retail", status: "CANCELLED", weight: 600, checkpoints: 1, created: "2026-03-08" },
];
const STATUS_COLORS = { CREATED: "#6B7280", IN_TRANSIT: "#3B82F6", AT_CHECKPOINT: "#F59E0B", DELIVERED: "#10B981", CANCELLED: "#EF4444" };
const ABI_TEXT = `// SupplyTracker.sol — Key functions
createShipment(receiver, contentsHash, weight)
recordCheckpoint(shipmentId, cpType, locationHash, temperature)
markInTransit(shipmentId)
confirmDelivery(shipmentId)
cancelShipment(shipmentId)
getShipmentCheckpoints(shipmentId)
getSenderShipments(sender)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#06B6D4", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function SupplyTrackerAgent() {
  const bridge = useAgentBridge("supplytracker");
    const [tab, setTab] = useState("shipments");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "Shipment SHP-004 arrived at CUSTOMS checkpoint" },
        { ts: Date.now() - 60000, msg: "SHP-002 delivery confirmed by receiver Delta SA" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New shipment SHP-006 created by Acme Corp — 3,200 kg",
                "Checkpoint ORIGIN recorded for SHP-003 (temp: 4°C)",
                "SHP-001 marked IN_TRANSIT by operator 0xA1…",
                "Delivery confirmed for SHP-004 by Theta Mfg",
                "Temperature alert on SHP-006: -2°C at PORT checkpoint",
                "SHP-005 cancellation processed by sender",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "shipments", label: "📦 Shipments" },
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
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📦</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Supply<span style={{ color: S.accent }}>Tracker</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Shipment tracking · IoT checkpoints · Proof of delivery</p>
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

            {/* ── Shipments Tab ── */}
            {tab === "shipments" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_SHIPMENTS.map(s => (
                        <div key={s.id} onClick={() => setSel(s)} style={{ background: S.card, border: `1px solid ${sel?.id === s.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{s.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.sender} → {s.receiver}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>{s.weight.toLocaleString()} kg · {s.checkpoints} checkpoints</div>
                            <div style={{ fontSize: 11, color: S.muted }}>Created {s.created}</div>
                            <span style={{ background: STATUS_COLORS[s.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{s.status}</span>
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
                <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", padding: 32 }}>
                    {["CREATED", "IN_TRANSIT", "AT_CHECKPOINT", "DELIVERED"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: STATUS_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_SHIPMENTS.filter(s => s.status === st).length}</span>
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
                        { label: "Total Shipments", val: "5" },
                        { label: "In Transit", val: "1" },
                        { label: "Delivered", val: "1" },
                        { label: "Avg Checkpoints", val: "2.2" },
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
                  📊 REAL-TIME AGENT METRICS — SUPPLYTRACKER
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/supplytracker/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="supplytracker" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
