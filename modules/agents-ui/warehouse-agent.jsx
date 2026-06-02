import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_WAREHOUSES = [
    { id: "WH-001", name: "Central Hub A", operator: "0xA1…", capacity: 10000, used: 7200, active: true },
    { id: "WH-002", name: "Port Facility B", operator: "0xA2…", capacity: 5000, used: 3100, active: true },
    { id: "WH-003", name: "Cold Storage C", operator: "0xA1…", capacity: 2000, used: 1800, active: true },
];
const MOCK_LOTS = [
    { id: "LOT-001", warehouse: "WH-001", product: "Steel Beams", qty: 3000, status: "ACTIVE", expiry: "2027-06-15" },
    { id: "LOT-002", warehouse: "WH-001", product: "Copper Wire", qty: 1200, status: "RESERVED", expiry: "2026-12-01" },
    { id: "LOT-003", warehouse: "WH-002", product: "Rubber Sheets", qty: 800, status: "ACTIVE", expiry: "2026-09-30" },
    { id: "LOT-004", warehouse: "WH-003", product: "Vaccines-B12", qty: 500, status: "ACTIVE", expiry: "2026-04-15" },
    { id: "LOT-005", warehouse: "WH-001", product: "LED Panels", qty: 3000, status: "CONSUMED", expiry: "2028-01-01" },
    { id: "LOT-006", warehouse: "WH-002", product: "Aluminum Rods", qty: 2300, status: "TRANSFERRED", expiry: "2027-03-20" },
];
const STATUS_COLORS = { ACTIVE: "#10B981", RESERVED: "#F59E0B", EXPIRED: "#EF4444", CONSUMED: "#6B7280", TRANSFERRED: "#8B5CF6" };
const ABI_TEXT = `// WarehouseManager.sol — Key functions
registerWarehouse(nameHash, capacity)
receiveLot(warehouseId, productHash, quantity, expiryDate)
reserveLot(lotId)
consumeLot(lotId, quantity)
markExpired(lotId)
transferLot(lotId, toWarehouseId)
deactivateWarehouse(warehouseId)
getWarehouseLots(warehouseId)
isLotExpired(lotId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#22D3EE", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function WarehouseManagerAgent() {
  const bridge = useAgentBridge("warehouse");
    const [tab, setTab] = useState("warehouses");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "LOT-004 expiry alert — expires 2026-04-15 (30 days)" },
        { ts: Date.now() - 60000, msg: "LOT-006 transferred from WH-002 to WH-001" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New LOT-007 received at WH-003 — 400 units Vaccines-C1",
                "LOT-002 reserved for order PO-003",
                "LOT-005 fully consumed — 3,000 LED Panels dispatched",
                "WH-001 capacity warning: 72% utilized",
                "LOT-004 marked expired — 500 units quarantined",
                "Transfer initiated: LOT-003 from WH-002 → WH-001",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "warehouses", label: "🏭 Warehouses" },
        { id: "lots", label: "📦 Lots" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏭</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Warehouse<span style={{ color: S.accent }}>Manager</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Inventory tracking · Lot management · Expiry monitoring</p>
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

            {/* ── Warehouses Tab ── */}
            {tab === "warehouses" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_WAREHOUSES.map(w => {
                        const pct = Math.round((w.used / w.capacity) * 100);
                        return (
                            <div key={w.id} onClick={() => setSel(w)} style={{ background: S.card, border: `1px solid ${sel?.id === w.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <div>
                                        <span style={{ fontFamily: S.mono, fontSize: 13, color: S.accent, marginRight: 10 }}>{w.id}</span>
                                        <span style={{ fontSize: 15, fontWeight: 600 }}>{w.name}</span>
                                    </div>
                                    <span style={{ background: w.active ? "#10B981" : "#EF4444", color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{w.active ? "ACTIVE" : "INACTIVE"}</span>
                                </div>
                                <div style={{ background: S.border, borderRadius: 4, height: 8, overflow: "hidden" }}>
                                    <div style={{ background: pct > 80 ? "#EF4444" : S.accent, height: "100%", width: `${pct}%`, borderRadius: 4, transition: "width 0.3s" }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: S.muted }}>
                                    <span>{w.used.toLocaleString()} / {w.capacity.toLocaleString()} units</span>
                                    <span>{pct}% utilized</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Lots Tab ── */}
            {tab === "lots" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_LOTS.map(l => (
                        <div key={l.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 10 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{l.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{l.product}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>{l.warehouse} · {l.qty.toLocaleString()} units</div>
                            <div style={{ fontSize: 11, color: S.muted }}>Expires {l.expiry}</div>
                            <span style={{ background: STATUS_COLORS[l.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{l.status}</span>
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
                        { label: "Warehouses", val: "3" },
                        { label: "Active Lots", val: "3" },
                        { label: "Total Capacity", val: "17K" },
                        { label: "Avg Utilization", val: "71%" },
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
                  📊 REAL-TIME AGENT METRICS — WAREHOUSE
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/warehouse/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="warehouse" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
