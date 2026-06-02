import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_VEHICLES = [
    { vin: "1HGCM82633A004352", make: "Toyota", model: "Camry 2024", owner: "0x8a1e...f3b2", mileage: 12480, status: "ACTIVE", tokenId: "BEZ-VH-00001", mintDate: "2024-03-15", country: "MX", type: "SEDAN", color: "#3B82F6", inspections: 3, lastService: "2025-11-02" },
    { vin: "WVWZZZ3CZWE123456", make: "Volkswagen", model: "ID.4 EV 2025", owner: "0x3EfC...8a3E", mileage: 8200, status: "ACTIVE", tokenId: "BEZ-VH-00002", mintDate: "2025-01-10", country: "DE", type: "SUV_EV", color: "#10B981", inspections: 2, lastService: "2025-09-18" },
    { vin: "5YJ3E1EA8LF000111", make: "Tesla", model: "Model 3 2023", owner: "0x52Df...044E", mileage: 34500, status: "ACTIVE", tokenId: "BEZ-VH-00003", mintDate: "2023-06-22", country: "US", type: "SEDAN_EV", color: "#10B981", inspections: 5, lastService: "2026-01-15" },
    { vin: "WBAPH5C55BA271144", make: "BMW", model: "530e Hybrid 2024", owner: "0x89c2...d12A", mileage: 19700, status: "IN_TRANSFER", tokenId: "BEZ-VH-00004", mintDate: "2024-07-08", country: "ES", type: "HYBRID", color: "#F59E0B", inspections: 4, lastService: "2025-12-20" },
    { vin: "JN1TBNT30Z0000789", make: "Nissan", model: "Leaf 2024", owner: "0x219F...cc01", mileage: 5100, status: "ACTIVE", tokenId: "BEZ-VH-00005", mintDate: "2024-11-30", country: "JP", type: "HATCH_EV", color: "#10B981", inspections: 1, lastService: "2025-08-05" },
    { vin: "3FA6P0G71KR200333", make: "Ford", model: "F-150 Lightning 2025", owner: null, mileage: 0, status: "PENDING_MINT", tokenId: null, mintDate: null, country: "US", type: "TRUCK_EV", color: "#10B981", inspections: 0, lastService: null },
];

const MOCK_TRANSFERS = [
    { time: "14:32:01", vin: "1HGCM826...352", from: "0x8a..b2", to: "0x3E..3E", mileage: 12480, tx: "0x7f3a...c4e2", status: "COMPLETED" },
    { time: "14:28:44", vin: "WBAPH5C5...144", from: "0x52..4E", to: "0x89..2A", mileage: 19700, tx: "0x2b8d...f901", status: "PENDING" },
    { time: "13:15:22", vin: "5YJ3E1EA...111", from: "0xA1..f3", to: "0x52..4E", mileage: 28900, tx: "0xa12c...8834", status: "COMPLETED" },
    { time: "12:40:10", vin: "JN1TBNT3...789", from: "FACTORY", to: "0x219F...cc01", mileage: 0, tx: "0x5e9f...2217", status: "COMPLETED" },
];

const STATUS_COLORS = { ACTIVE: "#00FF88", IN_TRANSFER: "#FFD700", PENDING_MINT: "#3B82F6", SALVAGE: "#EF4444", STOLEN: "#EF4444" };
const TYPE_ICONS = { SEDAN: "S", SUV_EV: "EV", SEDAN_EV: "EV", HYBRID: "HY", HATCH_EV: "EV", TRUCK_EV: "EV" };

const CONTRACT_ABI = `// VehicleIdentityNFT.sol  -  BeZhas Chain
// ERC-721 vehicle digital twin with on-chain mileage oracle

struct Vehicle {
  string   vin;
  string   make;
  string   model;
  uint256  mileage;
  address  currentOwner;
  uint256  mintTimestamp;
  bool     active;
}

function mintVehicle(
  address owner, string vin, string make, string model
) external onlyRole(REGISTRAR_ROLE) returns (uint256 tokenId);

function updateMileage(uint256 tokenId, uint256 newMileage) external onlyRole(ORACLE_ROLE);
function transferVehicle(uint256 tokenId, address newOwner) external;
function reportStolen(uint256 tokenId) external onlyRole(REGISTRAR_ROLE);
function getVehicleHistory(uint256 tokenId) view returns (HistoryEntry[]);`;

const S = {
    bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
    accent: "#3B82F6", accent2: "#00FF88", text: "#e2e8f0", muted: "#64748b", mono: "'Courier New',monospace",
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function VehicleNFTAgent() {
  const bridge = useAgentBridge("vehiclenft");
    const [tab, setTab] = useState("registry");
    const [sel, setSel] = useState(null);
    const [transfers, setTransfers] = useState(MOCK_TRANSFERS);

    useEffect(() => {
        const iv = setInterval(() => {
            const makes = ["Toyota", "BMW", "Tesla", "Ford", "Nissan", "VW"];
            const mk = makes[Math.floor(Math.random() * makes.length)];
            setTransfers(p => [{
                time: new Date().toLocaleTimeString(), vin: "VIN..." + Math.random().toString(36).slice(2, 6).toUpperCase(),
                from: "0x" + Math.random().toString(16).slice(2, 6), to: "0x" + Math.random().toString(16).slice(2, 6),
                mileage: Math.floor(Math.random() * 50000), tx: "0x" + Math.random().toString(16).slice(2, 10),
                status: Math.random() > 0.3 ? "COMPLETED" : "PENDING"
            }, ...p.slice(0, 19)]);
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "registry", label: "Registry" },
        { id: "transfers", label: "Transfers" },
        { id: "inspections", label: "Inspections" },
        { id: "contracts", label: "Contracts" },
        { id: "analytics", label: "Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, fontFamily: "'Inter',sans-serif", padding: 24, minHeight: "100vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <span style={{ fontSize: 28 }}>&#128663;</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20, color: S.accent }}>VehicleNFT Agent</h2>
                    <span style={{ color: S.muted, fontSize: 12 }}>ERC-721 vehicle digital twins with on-chain mileage oracle</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#00FF8822", color: "#00FF88", padding: "4px 12px", borderRadius: 8, fontSize: 12 }}>ACTIVE</span>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${S.border}`, paddingBottom: 8 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        background: tab === t.id ? S.accent + "22" : "transparent", color: tab === t.id ? S.accent : S.muted,
                        border: "none", padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                    }}>{t.label}</button>
                ))}
            </div>

            {/* ── Registry Tab ──────────────────────────────────────────── */}
            {tab === "registry" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>Vehicle Registry ({MOCK_VEHICLES.length})</span>
                            <span style={{ color: S.muted, fontSize: 11 }}>Click row for details</span>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                                <tr style={{ color: S.muted, borderBottom: `1px solid ${S.border}` }}>
                                    <th style={{ textAlign: "left", padding: "8px 6px" }}>VIN</th>
                                    <th style={{ textAlign: "left", padding: "8px 6px" }}>Vehicle</th>
                                    <th style={{ textAlign: "right", padding: "8px 6px" }}>Mileage</th>
                                    <th style={{ textAlign: "center", padding: "8px 6px" }}>Type</th>
                                    <th style={{ textAlign: "center", padding: "8px 6px" }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_VEHICLES.map((v, i) => (
                                    <tr key={i} onClick={() => setSel(v)} style={{
                                        cursor: "pointer", borderBottom: `1px solid ${S.border}`,
                                        background: sel?.vin === v.vin ? S.accent + "11" : "transparent",
                                    }}>
                                        <td style={{ padding: "8px 6px", fontFamily: S.mono, fontSize: 11, color: S.accent }}>{v.vin.slice(0, 11)}...</td>
                                        <td style={{ padding: "8px 6px" }}>{v.make} {v.model.split(" ")[0]}</td>
                                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: S.mono }}>{v.mileage.toLocaleString()} km</td>
                                        <td style={{ textAlign: "center", padding: "8px 6px" }}>
                                            <span style={{ background: v.color + "22", color: v.color, padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>{TYPE_ICONS[v.type] || v.type}</span>
                                        </td>
                                        <td style={{ textAlign: "center", padding: "8px 6px" }}>
                                            <span style={{ color: STATUS_COLORS[v.status] || S.text, fontSize: 11 }}>{v.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontSize: 16, color: S.accent }}>{sel.make} {sel.model}</h3>
                                <button onClick={() => setSel(null)} style={{ background: "transparent", border: "none", color: S.muted, cursor: "pointer" }}>X</button>
                            </div>
                            {[
                                ["VIN", sel.vin],
                                ["Token ID", sel.tokenId || "Pending mint"],
                                ["Owner", sel.owner || "Unassigned"],
                                ["Mileage", sel.mileage.toLocaleString() + " km"],
                                ["Country", sel.country],
                                ["Mint Date", sel.mintDate || "N/A"],
                                ["Inspections", sel.inspections],
                                ["Last Service", sel.lastService || "N/A"],
                            ].map(([k, v], i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${S.border}`, fontSize: 12 }}>
                                    <span style={{ color: S.muted }}>{k}</span>
                                    <span style={{ fontFamily: S.mono, fontSize: 11 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 16 }}>
                                <span style={{ color: S.muted, fontSize: 11 }}>Ownership Timeline</span>
                                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                    {["Factory", "Dealer", sel.owner?.slice(0, 6) || "?"].map((step, i) => (
                                        <div key={i} style={{ flex: 1, textAlign: "center" }}>
                                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: i <= 2 ? S.accent : S.border, margin: "0 auto 4px", lineHeight: "24px", fontSize: 10, color: "#000" }}>{i + 1}</div>
                                            <span style={{ fontSize: 10, color: S.muted }}>{step}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Transfers Tab ─────────────────────────────────────────── */}
            {tab === "transfers" && (
                <div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                        {[
                            ["Total Transfers", transfers.length, S.accent],
                            ["Completed", transfers.filter(t => t.status === "COMPLETED").length, "#00FF88"],
                            ["Pending", transfers.filter(t => t.status === "PENDING").length, "#FFD700"],
                        ].map(([label, val, c], i) => (
                            <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{val}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{label}</div>
                            </div>
                        ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr style={{ color: S.muted, borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>Time</th>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>VIN</th>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>From</th>
                                <th style={{ textAlign: "left", padding: "8px 6px" }}>To</th>
                                <th style={{ textAlign: "right", padding: "8px 6px" }}>Mileage</th>
                                <th style={{ textAlign: "center", padding: "8px 6px" }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transfers.map((t, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                                    <td style={{ padding: "8px 6px", fontFamily: S.mono, color: S.muted, fontSize: 11 }}>{t.time}</td>
                                    <td style={{ padding: "8px 6px", fontFamily: S.mono, fontSize: 11, color: S.accent }}>{t.vin}</td>
                                    <td style={{ padding: "8px 6px", fontFamily: S.mono, fontSize: 11 }}>{t.from}</td>
                                    <td style={{ padding: "8px 6px", fontFamily: S.mono, fontSize: 11 }}>{t.to}</td>
                                    <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: S.mono }}>{t.mileage.toLocaleString()}</td>
                                    <td style={{ textAlign: "center", padding: "8px 6px" }}>
                                        <span style={{ color: t.status === "COMPLETED" ? "#00FF88" : "#FFD700", fontSize: 11 }}>{t.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Inspections Tab ───────────────────────────────────────── */}
            {tab === "inspections" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 16, color: S.accent }}>Vehicle Inspection Pipeline</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 20 }}>
                        {["VIN Scan", "OBD-II Read", "Visual AI Check", "Oracle Score", "NFT Update"].map((step, i) => (
                            <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 20, marginBottom: 4 }}>{["1", "2", "3", "4", "5"][i]}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{step}</div>
                                <div style={{ marginTop: 6, width: "100%", height: 3, background: S.border, borderRadius: 2 }}>
                                    <div style={{ height: "100%", width: `${Math.max(20, 100 - i * 15)}%`, background: S.accent, borderRadius: 2 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16 }}>
                            <h4 style={{ margin: "0 0 12px", fontSize: 13, color: S.accent }}>Recent Inspections</h4>
                            {MOCK_VEHICLES.filter(v => v.inspections > 0).map((v, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${S.border}`, fontSize: 12 }}>
                                    <span>{v.make} {v.model.split(" ")[0]}</span>
                                    <span style={{ color: S.muted }}>{v.inspections} inspections</span>
                                    <span style={{ color: "#00FF88", fontFamily: S.mono, fontSize: 11 }}>PASS</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16 }}>
                            <h4 style={{ margin: "0 0 12px", fontSize: 13, color: S.accent }}>OBD-II Diagnostics</h4>
                            {[
                                ["Engine Health", 96, "#00FF88"],
                                ["Battery Status", 88, "#00D4FF"],
                                ["Emission Level", 92, "#00FF88"],
                                ["Brake System", 99, "#00FF88"],
                                ["Tire Pressure", 85, "#FFD700"],
                            ].map(([label, val, c], i) => (
                                <div key={i} style={{ marginBottom: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                                        <span style={{ color: S.muted }}>{label}</span>
                                        <span style={{ color: c }}>{val}%</span>
                                    </div>
                                    <div style={{ height: 4, background: S.border, borderRadius: 2 }}>
                                        <div style={{ height: "100%", width: `${val}%`, background: c, borderRadius: 2 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Contracts Tab ─────────────────────────────────────────── */}
            {tab === "contracts" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 12, color: S.accent }}>VehicleIdentityNFT.sol</h3>
                    <pre style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, fontSize: 11, fontFamily: S.mono, color: "#00FF88", overflow: "auto", maxHeight: 400 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {/* ── Analytics Tab ─────────────────────────────────────────── */}
            {tab === "analytics" && (
                <div>
                    <h3 style={{ fontSize: 14, marginBottom: 16, color: S.accent }}>Revenue Model &mdash; VehicleNFT</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                        {[
                            ["NFT Minting Fee", "0.5 BEZ / vehicle", "One-time mint per VIN registration"],
                            ["Transfer Fee", "0.2% sale price", "Charged on each on-chain ownership transfer"],
                            ["Mileage Oracle Update", "0.1 BEZ / update", "IoT-verified on-chain mileage recording"],
                            ["Inspection Certification", "1.0 BEZ / report", "AI + OBD-II inspection sealed on-chain"],
                            ["History Report API", "0.3 BEZ / query", "Vehicle history for buyers and insurers"],
                            ["Stolen Vehicle Alert", "0 BEZ (free)", "Public good — immutable stolen registry"],
                        ].map(([title, fee, desc], i) => (
                            <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
                                    <span style={{ color: S.accent, fontFamily: S.mono, fontSize: 12 }}>{fee}</span>
                                </div>
                                <div style={{ color: S.muted, fontSize: 11 }}>{desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: S.card || S.panel, border: "1px solid " + (S.border), borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — VEHICLENFT
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/vehiclenft/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="vehiclenft" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
