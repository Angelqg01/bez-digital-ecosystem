import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_MATERIALS = [
    { id: "MAT-001", name: "6061-T6 Aluminum Sheet", sku: "AL6061-3mm", supplier: "Alcoa Inc.", qty: 12500, unit: "kg", price: 4.80, reorderPoint: 3000, location: "Warehouse A", status: "IN_STOCK" },
    { id: "MAT-002", name: "CATL LFP Cell 3.2V 100Ah", sku: "CATL-LFP100", supplier: "CATL Global", qty: 840, unit: "cells", price: 32.50, reorderPoint: 500, location: "Warehouse B", status: "IN_STOCK" },
    { id: "MAT-003", name: "Carbon Fiber Prepreg T700", sku: "CF-T700-UD", supplier: "Toray Industries", qty: 120, unit: "rolls", price: 890.00, reorderPoint: 200, location: "Warehouse A", status: "LOW_STOCK" },
    { id: "MAT-004", name: "M8x30 SS Hex Bolts (1000pc)", sku: "SS-M8X30-1K", supplier: "Würth Group", qty: 45000, unit: "pcs", price: 0.12, reorderPoint: 10000, location: "Warehouse C", status: "IN_STOCK" },
    { id: "MAT-005", name: "Nylon PA6 Pellets", sku: "PA6-NATURAL", supplier: "BASF SE", qty: 0, unit: "kg", price: 3.20, reorderPoint: 5000, location: "Warehouse A", status: "OUT_OF_STOCK" },
    { id: "MAT-006", name: "SMT Solder Paste SAC305", sku: "SP-SAC305-500", supplier: "Henkel AG", qty: 280, unit: "jars", price: 145.00, reorderPoint: 100, location: "Warehouse B", status: "IN_STOCK" },
];

const MOCK_ORDERS = [
    { time: "14:58:03", material: "MAT-003", action: "PO_CREATED", supplier: "Toray Industries", qty: "300 rolls", value: "$267,000", tx: "0x8a1f...b4c2" },
    { time: "14:42:30", material: "MAT-005", action: "REORDER_TRIGGERED", supplier: "BASF SE", qty: "8,000 kg", value: "$25,600", tx: "0x3d7e...a891" },
    { time: "14:20:15", material: "MAT-002", action: "RECEIVED", supplier: "CATL Global", qty: "500 cells", value: "$16,250", tx: "0xc5b2...f103" },
    { time: "13:55:44", material: "MAT-001", action: "CONSUMED", supplier: "—", qty: "2,400 kg", value: "$11,520", tx: "0x91a4...d7e8" },
];

const STATUS_COLORS = { IN_STOCK: "#00FF88", LOW_STOCK: "#FFD700", OUT_OF_STOCK: "#EF4444", ON_ORDER: "#3B82F6" };
const ACTION_COLORS = { PO_CREATED: "#3B82F6", REORDER_TRIGGERED: "#F97316", RECEIVED: "#00FF88", CONSUMED: "#7C3AED", RETURNED: "#EF4444" };

const CONTRACT_ABI = `// MaterialTokenMRP.sol  —  BeZhas Chain
// Tokenized raw materials with Bill-of-Materials tracking

struct Material {
  string   sku;
  string   name;
  address  supplier;
  uint256  pricePerUnit;     // in BEZ wei
  uint256  totalSupply;
  uint256  reorderPoint;
  bool     active;
}

struct PurchaseOrder {
  uint256  materialId;
  address  buyer;
  uint256  quantity;
  uint256  totalCost;
  uint256  createdAt;
  OrderStatus status;        // PENDING → CONFIRMED → SHIPPED → RECEIVED
}

struct BOMEntry {
  uint256  productId;
  uint256  materialId;
  uint256  quantityNeeded;   // per unit of product
}

function registerMaterial(
  string sku, string name, uint256 pricePerUnit, uint256 reorderPoint
) external returns (uint256 materialId);

function createPurchaseOrder(uint256 materialId, uint256 qty) external payable returns (uint256 poId);
function confirmOrder(uint256 poId) external;
function receiveOrder(uint256 poId, uint256 actualQty, bytes32 qualityProof) external;
function addBOMEntry(uint256 productId, uint256 materialId, uint256 qtyNeeded) external;
function consumeMaterial(uint256 materialId, uint256 qty) external;`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#F97316", accent2: "#00D4FF", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function SupplyMRPAgent() {
  const bridge = useAgentBridge("supplymrp");
    const [tab, setTab] = useState("inventory");
    const [sel, setSel] = useState(null);
    const [orders, setOrders] = useState(MOCK_ORDERS);

    useEffect(() => {
        const iv = setInterval(() => {
            const mat = MOCK_MATERIALS[Math.floor(Math.random() * MOCK_MATERIALS.length)];
            const actions = ["PO_CREATED", "CONSUMED", "RECEIVED", "REORDER_TRIGGERED"];
            const action = actions[Math.floor(Math.random() * actions.length)];
            const qty = Math.floor(Math.random() * 500) + 50;
            setOrders(p => [{
                time: new Date().toLocaleTimeString(), material: mat.id, action,
                supplier: mat.supplier, qty: `${qty} ${mat.unit}`, value: `$${(qty * mat.price).toLocaleString()}`, tx: "0x" + Math.random().toString(16).slice(2, 6) + "..." + Math.random().toString(16).slice(2, 6)
            }, ...p].slice(0, 30));
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "inventory", label: "📦 Inventory" },
        { id: "orders", label: "📋 Purchase Orders" },
        { id: "bom", label: "🔩 Bill of Materials" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const inStock = MOCK_MATERIALS.filter(m => m.status === "IN_STOCK").length;
    const totalValue = MOCK_MATERIALS.reduce((s, m) => s + m.qty * m.price, 0);
    const alerts = MOCK_MATERIALS.filter(m => m.status === "LOW_STOCK" || m.status === "OUT_OF_STOCK").length;

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>📦</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>SupplyMRP Agent — On-chain Material Planning</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>Tokenized inventory · Automated POs · BOM tracking</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#F9731622", color: "#F97316", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● ACTIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "inventory" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["In Stock", inStock, "#00FF88"], ["Inventory Value", "$" + Math.round(totalValue).toLocaleString(), S.accent], ["Alerts", alerts, "#EF4444"]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>SKU</th><th>Material</th><th>Qty</th><th>Value</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_MATERIALS.map(m => (
                                <tr key={m.id} onClick={() => setSel(m)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === m.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent2, fontSize: 11 }}>{m.sku}</td>
                                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</td>
                                    <td style={{ fontFamily: S.mono }}>{m.qty.toLocaleString()} {m.unit}</td>
                                    <td style={{ fontFamily: S.mono, color: S.accent }}>${(m.qty * m.price).toLocaleString()}</td>
                                    <td><span style={{ color: STATUS_COLORS[m.status], fontSize: 11 }}>● {m.status.replace("_", " ")}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.name}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>Supplier: {sel.supplier} · Location: {sel.location}</div>
                            {[["SKU", sel.sku], ["Qty", sel.qty.toLocaleString() + " " + sel.unit], ["Price/unit", "$" + sel.price], ["Total Value", "$" + (sel.qty * sel.price).toLocaleString()], ["Reorder Point", sel.reorderPoint.toLocaleString() + " " + sel.unit]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: S.bg, borderRadius: 8, padding: 10 }}>
                                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>Stock Level vs Reorder Point</div>
                                <div style={{ background: "#0D2040", borderRadius: 6, height: 16, overflow: "hidden" }}>
                                    <div style={{ width: Math.min(100, (sel.qty / (sel.reorderPoint * 2)) * 100) + "%", height: "100%", borderRadius: 6, background: sel.qty >= sel.reorderPoint ? "#00FF88" : sel.qty > 0 ? "#FFD700" : "#EF4444" }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "orders" && (
                <div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        {[["POs Today", orders.filter(o => o.action === "PO_CREATED").length, "#3B82F6"], ["Received", orders.filter(o => o.action === "RECEIVED").length, "#00FF88"], ["Auto-Reorders", orders.filter(o => o.action === "REORDER_TRIGGERED").length, S.accent]].map(([l, v, c]) => (
                            <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                            </div>
                        ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Material</th><th>Action</th><th>Supplier</th><th>Qty</th><th>Value</th><th>Tx</th>
                        </tr></thead>
                        <tbody>{orders.map((o, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{o.time}</td>
                                <td style={{ color: S.accent2 }}>{o.material}</td>
                                <td><span style={{ color: ACTION_COLORS[o.action] || S.text, fontSize: 11 }}>{o.action}</span></td>
                                <td>{o.supplier}</td>
                                <td>{o.qty}</td>
                                <td style={{ color: S.accent }}>{o.value}</td>
                                <td style={{ color: S.muted }}>{o.tx}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "bom" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Bill of Materials — Production Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. BOM Define", "2. MRP Calc", "3. Auto-PO", "4. Receive & QC", "5. Release to Prod"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📐", "🧮", "🛒", "✅", "🏭"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    <h4 style={{ fontSize: 13, color: S.muted, marginBottom: 8 }}>Sample BOM: EV Battery Pack 48V</h4>
                    {[
                        { material: "CATL LFP Cell 3.2V 100Ah", qty: "16 cells", available: 840, needed: 16, status: "OK" },
                        { material: "6061-T6 Aluminum Sheet", qty: "12 kg", available: 12500, needed: 12, status: "OK" },
                        { material: "M8x30 SS Hex Bolts", qty: "64 pcs", available: 45000, needed: 64, status: "OK" },
                        { material: "Nylon PA6 Pellets", qty: "2.5 kg", available: 0, needed: 2.5, status: "BLOCKED" },
                    ].map((b, i) => (
                        <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{b.material}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>Need: {b.qty} · Available: {b.available.toLocaleString()}</div>
                            </div>
                            <span style={{ color: b.status === "OK" ? "#00FF88" : "#EF4444", fontFamily: S.mono, fontSize: 12 }}>● {b.status}</span>
                        </div>
                    ))}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>MaterialTokenMRP.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Material Registration", "0.3 BEZ / material", "+60 materials/mo", "📦"],
                        ["Purchase Orders", "0.5 BEZ / PO", "+420 POs/mo", "📋"],
                        ["BOM Management", "1.0 BEZ / product", "+35 products/mo", "🔩"],
                        ["Auto-Reorder Engine", "$799/mo SaaS", "18 factories connected", "🤖"],
                        ["Quality Proof-on-Receive", "0.2 BEZ / proof", "+400 proofs/mo", "✅"],
                        ["Supply Chain Analytics", "$399/mo premium", "32 subscribers", "📊"],
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
          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: S.card || S.panel, border: "1px solid " + (S.border), borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — SUPPLYMRP
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/supplymrp/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="supplymrp" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
