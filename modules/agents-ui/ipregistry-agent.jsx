import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_IP = [
    { id: "IP-001", type: "PATENT", title: "Quantum Encryption Algorithm", owner: "0xB1…", status: "REGISTERED", licenses: 3, revenue: "5.2 ETH" },
    { id: "IP-002", type: "TRADEMARK", title: "BeZhas® Brand Identity", owner: "0xB2…", status: "LICENSED", licenses: 7, revenue: "12.0 ETH" },
    { id: "IP-003", type: "COPYRIGHT", title: "AI Training Dataset v3", owner: "0xB1…", status: "PENDING", licenses: 0, revenue: "0 ETH" },
    { id: "IP-004", type: "DESIGN", title: "Modular Solar Panel Design", owner: "0xB3…", status: "DISPUTED", licenses: 1, revenue: "2.5 ETH" },
    { id: "IP-005", type: "TRADE_SECRET", title: "Proprietary Catalyst Formula", owner: "0xB4…", status: "REGISTERED", licenses: 0, revenue: "0 ETH" },
];
const STATUS_COLORS = { PENDING: "#F59E0B", REGISTERED: "#10B981", LICENSED: "#3B82F6", DISPUTED: "#EF4444", REVOKED: "#6B7280" };
const TYPE_COLORS = { PATENT: "#8B5CF6", TRADEMARK: "#EC4899", COPYRIGHT: "#3B82F6", TRADE_SECRET: "#F59E0B", DESIGN: "#10B981" };
const CONTRACT_ABI = `// IPRegistryNFT.sol — Key functions
registerIP(ipType, title, proofHash, duration) payable
approveRegistration(ipId)
grantLicense(ipId, licensee, duration, exclusive) payable
revokeLicense(ipId, licenseId)
disputeIP(ipId)
revokeIP(ipId)
withdrawRevenue()
verifyProof(ipId, hash)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#EC4899", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function IPRegistryAgent() {
    const bridge = useAgentBridge('ipregistry');
    const [tab, setTab] = useState("registry");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "IP-002 licensed to 0xD1… (exclusive, 2 ETH fee)" },
        { ts: Date.now() - 50000, msg: "New IP registered: Patent 'Quantum Encryption Algorithm'" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "IP-003 approved by registrar 0xA1… — status: REGISTERED",
                "License #7 granted on IP-002 to 0xD3… (non-exclusive)",
                "Dispute filed on IP-004 — status changed to DISPUTED",
                "Revenue withdrawal: 5.2 ETH by 0xB1…",
                "Proof verification passed for IP-001 ✓",
                "IP-006 registered: Copyright 'Decentralized Music Score'",
                "License revoked on IP-004 (#1) by owner 0xB3…",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "registry", label: "🏛️ IP Registry" },
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
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "grid", placeItems: "center", fontSize: 20 }}>🏛️</div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>IP Registry Agent</div>
                    <div style={{ fontSize: 12, color: S.muted }}>Intellectual property registration • Licensing marketplace • Proof verification</div>
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
            {tab === "registry" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_IP.map(ip => (
                        <div key={ip.id} onClick={() => setSel(sel === ip.id ? null : ip.id)} style={{ background: S.card, border: `1px solid ${sel === ip.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <span style={{ fontWeight: 700 }}>{ip.id}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: TYPE_COLORS[ip.type] + "22", color: TYPE_COLORS[ip.type] }}>{ip.type}</span>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: STATUS_COLORS[ip.status] + "22", color: STATUS_COLORS[ip.status] }}>{ip.status}</span>
                            </div>
                            <div style={{ fontSize: 14, marginBottom: 6 }}>{ip.title}</div>
                            <div style={{ display: "flex", gap: 16, fontSize: 12, color: S.muted }}>
                                <span>Owner: {ip.owner}</span>
                                <span>Licenses: {ip.licenses}</span>
                                <span>Revenue: {ip.revenue}</span>
                            </div>
                            {sel === ip.id && (
                                <div style={{ marginTop: 12, padding: 12, background: S.bg, borderRadius: 8, fontSize: 12, fontFamily: S.mono }}>
                                    <div>ipType: IPType.{ip.type}</div>
                                    <div>proofHash: keccak256("{ip.title}")</div>
                                    <div>status: IPStatus.{ip.status}</div>
                                    <div>licenseCount: {ip.licenses} | totalRevenue: {ip.revenue}</div>
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
                    {[{ s: "PENDING", n: 5, c: STATUS_COLORS.PENDING }, { s: "REGISTERED", n: 14, c: STATUS_COLORS.REGISTERED }, { s: "LICENSED", n: 8, c: STATUS_COLORS.LICENSED }, { s: "DISPUTED", n: 2, c: STATUS_COLORS.DISPUTED }, { s: "REVOKED", n: 1, c: STATUS_COLORS.REVOKED }].map(p => (
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
                    {[{ l: "Total IP Assets", v: "30" }, { l: "Active Licenses", v: "24" }, { l: "Revenue Generated", v: "45.7 ETH" }, { l: "Patents", v: "12" }, { l: "Trademarks", v: "8" }, { l: "Copyrights", v: "10" }].map(m => (
                        <div key={m.l} style={{ background: S.card, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: S.accent }}>{m.v}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.l}</div>
                        </div>
                    ))}
                </div>
            )}
            {tab === "metrics" && (
                <div>
                    <div style={{ background: S.card, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — IPREGISTRY</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="ipregistry" accentColor="#EC4899" />
                </div>
            )}
        </div>
    );
}
