import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_PARCELS = [
    { id: "PARCEL-001", owner: "Maria Gonzalez", zone: "RESIDENTIAL", area: 5000, value: "120,000 BEZ", status: "REGISTERED", transfers: 2 },
    { id: "PARCEL-002", owner: "Acme Corp", zone: "COMMERCIAL", area: 12000, value: "450,000 BEZ", status: "REGISTERED", transfers: 5 },
    { id: "PARCEL-003", owner: "Carlos Mendez", zone: "AGRICULTURAL", area: 80000, value: "320,000 BEZ", status: "DISPUTED", transfers: 1 },
    { id: "PARCEL-004", owner: "Municipality", zone: "PROTECTED", area: 200000, value: "0 BEZ", status: "FROZEN", transfers: 0 },
    { id: "PARCEL-005", owner: "Luis Ramirez", zone: "INDUSTRIAL", area: 25000, value: "680,000 BEZ", status: "REGISTERED", transfers: 3 },
];
const STATUS_COLORS = { REGISTERED: "#10B981", DISPUTED: "#F59E0B", FROZEN: "#3B82F6", DEREGISTERED: "#6B7280" };
const ABI_TEXT = `// LandCadastralRegistry.sol — Key functions
registerParcel(owner, locationHash, areaSqM, zoneType, appraisedValue)
transferParcel(parcelId, newOwner, salePrice)
appraiseParcel(parcelId, newValue)
rezoneParcel(parcelId, newZone)
disputeParcel(parcelId)
freezeParcel(parcelId)
unfreezeParcel(parcelId)
deregisterParcel(parcelId)
getParcelTransfers(parcelId)
getOwnerParcels(owner)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#A78BFA", accent2: "#C084FC", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function LandCadastralAgent() {
    const bridge = useAgentBridge('landcadastral');
    const [tab, setTab] = useState("parcels");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "Parcel PARCEL-002 transfer recorded — Acme Corp → Beta LLC" },
        { ts: Date.now() - 60000, msg: "PARCEL-003 flagged as DISPUTED by surveyor" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New parcel PARCEL-006 registered — 15,000 sqm RESIDENTIAL",
                "Appraisal update: PARCEL-005 revalued to 720,000 BEZ",
                "PARCEL-001 rezoned from RESIDENTIAL to MIXED_USE",
                "Transfer completed: PARCEL-002 sold for 500,000 BEZ",
                "PARCEL-004 unfrozen by court order — status REGISTERED",
                "Surveyor submitted boundary update for PARCEL-003",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "parcels", label: "🗺️ Parcels" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Status Map" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🗺️</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Land<span style={{ color: S.accent }}>Cadastral</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Land parcels · Ownership transfers · Zoning · Appraisals</p>
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

            {/* ── Parcels Tab ── */}
            {tab === "parcels" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_PARCELS.map(p => (
                        <div key={p.id} onClick={() => setSel(p)} style={{ background: S.card, border: `1px solid ${sel?.id === p.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{p.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.owner}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>{p.zone} · {p.area.toLocaleString()} sqm</div>
                            <div style={{ fontSize: 12, color: S.muted }}>{p.value} · {p.transfers} transfers</div>
                            <span style={{ background: STATUS_COLORS[p.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{p.status}</span>
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

            {/* ── Status Map ── */}
            {tab === "pipeline" && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", padding: 32 }}>
                    {["REGISTERED", "DISPUTED", "FROZEN", "DEREGISTERED"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: STATUS_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_PARCELS.filter(p => p.status === st).length}</span>
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
                        { label: "Total Parcels", val: "5" },
                        { label: "Total Area (sqm)", val: "322K" },
                        { label: "Disputed", val: "1" },
                        { label: "Total Transfers", val: "11" },
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — LANDCADASTRAL</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="landcadastral" accentColor="#A78BFA" />
                </div>
            )}
        </div>
    );
}
