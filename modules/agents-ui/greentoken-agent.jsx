import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_CREDITS = [
    { id: "VCS-2024-0142", project: "Amazon Reforestation Phase III", type: "VCS", vintage: "2024", tonnes: 125000, price: 18.50, verified: true, registry: "Verra", country: "BR", status: "ACTIVE", tokenId: "BEZ-CC-00091", holder: "0x8a1e...f3b2", retiredPct: 12 },
    { id: "GS-2024-0088", project: "Kenya Clean Cookstoves", type: "Gold Standard", vintage: "2024", tonnes: 45000, price: 24.80, verified: true, registry: "Gold Standard", country: "KE", status: "ACTIVE", tokenId: "BEZ-CC-00092", holder: "0x3EfC...8a3E", retiredPct: 34 },
    { id: "REC-EU-2024-7711", project: "North Sea Offshore Wind Farm", type: "REC", vintage: "2024", tonnes: 0, mwh: 320000, price: 3.20, verified: true, registry: "AIB", country: "NL", status: "ACTIVE", tokenId: "BEZ-REC-00044", holder: "0x52Df...044E", retiredPct: 58 },
    { id: "ACR-2023-0219", project: "Montana Grassland Conservation", type: "ACR", vintage: "2023", tonnes: 67000, price: 14.90, verified: false, registry: "ACR", country: "US", status: "PENDING_VERIFY", tokenId: null, holder: null, retiredPct: 0 },
    { id: "CDM-2024-3301", project: "India Solar Thermal Plant", type: "CDM", vintage: "2024", tonnes: 89000, price: 11.20, verified: true, registry: "UNFCCC", country: "IN", status: "ACTIVE", tokenId: "BEZ-CC-00093", holder: "0x89c2...d12A", retiredPct: 7 },
    { id: "REC-US-2024-4420", project: "Texas Wind Corridor Phase II", type: "REC", vintage: "2024", tonnes: 0, mwh: 540000, price: 2.10, verified: true, registry: "M-RETS", country: "US", status: "RETIRED", tokenId: "BEZ-REC-00045", holder: "0x219F...cc01", retiredPct: 100 },
];

const MOCK_TRADES = [
    { time: "14:32:01", buyer: "0xA1..f3", seller: "0x8a..b2", type: "VCS", qty: 500, price: 18.50, total: 9250, tx: "0x7f3a...c4e2" },
    { time: "14:28:44", buyer: "0x3E..3E", seller: "0x52..4E", type: "REC", qty: 10000, price: 3.20, total: 32000, tx: "0x2b8d...f901" },
    { time: "14:15:22", buyer: "0x89..2A", seller: "0xA1..f3", type: "GS", qty: 200, price: 24.80, total: 4960, tx: "0xa12c...8834" },
    { time: "13:59:10", buyer: "0x52..4E", seller: "0x89..2A", type: "CDM", qty: 1000, price: 11.20, total: 11200, tx: "0x5e9f...2217" },
];

const STATUS_COLORS = { ACTIVE: "#00FF88", PENDING_VERIFY: "#FFD700", RETIRED: "#64748b", SUSPENDED: "#EF4444" };

const CONTRACT_ABI = `// CarbonCreditToken.sol  -  BeZhas Chain
// ERC-1155 multi-token: each token ID = unique credit vintage

struct CreditBatch {
  string   registryId;    // e.g. "VCS-2024-0142"
  string   registry;      // Verra, Gold Standard, ACR, CDM
  string   projectName;
  uint256  totalTonnes;   // tCO2e minted
  uint256  retiredTonnes; // permanently retired
  uint256  pricePerTonne; // in BEZ wei
  string   vintage;       // year
  bool     verified;      // oracle-verified
}

function mintCreditBatch(
  string registryId, string registry, string project,
  uint256 tonnes, uint256 price, string vintage
) external onlyRole(VERIFIER_ROLE) returns (uint256 tokenId);

function retireCredits(uint256 tokenId, uint256 tonnes) external;
function verifiBatch(uint256 tokenId) external onlyRole(ORACLE_ROLE);
function tradeCredits(uint256 tokenId, address to, uint256 qty) external;
function getRetirementCertificate(uint256 tokenId, address holder) view;`;

const S = {
    bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
    accent: "#FFD700", accent2: "#00FF88", text: "#e2e8f0", muted: "#64748b", mono: "'Courier New',monospace",
};

export default function GreenTokenAgent() {
  const bridge = useAgentBridge("greentoken");
    const [tab, setTab] = useState("registry");
    const [sel, setSel] = useState(null);
    const [trades, setTrades] = useState(MOCK_TRADES);

    useEffect(() => {
        const iv = setInterval(() => {
            const types = ["VCS", "GS", "REC", "CDM", "ACR"];
            const t = types[Math.floor(Math.random() * types.length)];
            const qty = Math.floor(Math.random() * 2000) + 100;
            const price = +(Math.random() * 22 + 2).toFixed(2);
            setTrades(p => [{
                time: new Date().toLocaleTimeString(), buyer: `0x${Math.random().toString(16).slice(2, 4)}..${Math.random().toString(16).slice(2, 4)}`,
                seller: `0x${Math.random().toString(16).slice(2, 4)}..${Math.random().toString(16).slice(2, 4)}`, type: t, qty, price, total: +(qty * price).toFixed(2),
                tx: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`
            }, ...p].slice(0, 20));
        }, 7000);
        return () => clearInterval(iv);
    }, []);

    const tabs = ["registry", "trading", "retirement", "contracts", "analytics", "metrics"];

    const totalTonnes = MOCK_CREDITS.reduce((s, c) => s + c.tonnes, 0);
    const totalMWh = MOCK_CREDITS.reduce((s, c) => s + (c.mwh || 0), 0);
    const activeCredits = MOCK_CREDITS.filter(c => c.status === "ACTIVE").length;

    return (
        <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.mono, color: S.text, padding: 24 }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                    <span style={{ fontSize: 28 }}>🌿</span>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, color: S.accent }}>GreenToken Agent</h1>
                        <p style={{ margin: 0, fontSize: 11, color: S.muted, letterSpacing: 2 }}>CARBON CREDITS & REC TOKENIZATION</p>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 11 }}>
                        <span style={{ color: S.accent2 }}>{totalTonnes.toLocaleString()} tCO2e TOKENIZED</span>
                        <span style={{ color: S.accent }}>{totalMWh.toLocaleString()} MWh RECs</span>
                        <span style={{ color: "#00D4FF" }}>{activeCredits} ACTIVE BATCHES</span>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
                    {tabs.map(t => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: "8px 16px", background: tab === t ? S.accent : "transparent", color: tab === t ? "#000" : S.muted,
                            border: `1px solid ${tab === t ? S.accent : S.border}`, borderRadius: 2, cursor: "pointer", fontSize: 11,
                            fontFamily: S.mono, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                        }}>{t}</button>
                    ))}
                </div>

                {tab === "registry" && (
                    <div style={{ display: "grid", gridTemplateColumns: sel !== null ? "1fr 1fr" : "1fr", gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, letterSpacing: 2 }}>CREDIT & REC REGISTRY</div>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                <thead><tr style={{ borderBottom: `1px solid ${S.border}`, color: S.muted }}>
                                    <th style={{ textAlign: "left", padding: 8 }}>ID</th><th>TYPE</th><th>PROJECT</th>
                                    <th>QTY</th><th>PRICE</th><th>STATUS</th>
                                </tr></thead>
                                <tbody>{MOCK_CREDITS.map((c, i) => (
                                    <tr key={i} onClick={() => setSel(i)} style={{
                                        borderBottom: `1px solid ${S.border}`, cursor: "pointer",
                                        background: sel === i ? "rgba(255,215,0,0.08)" : "transparent"
                                    }}>
                                        <td style={{ padding: 8, color: S.accent }}>{c.id}</td>
                                        <td style={{ textAlign: "center" }}><span style={{
                                            padding: "2px 6px", background: c.type === "REC" ? "rgba(0,212,255,0.15)" : "rgba(0,255,136,0.15)",
                                            color: c.type === "REC" ? "#00D4FF" : S.accent2, borderRadius: 2, fontSize: 10
                                        }}>{c.type}</span></td>
                                        <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.project}</td>
                                        <td style={{ textAlign: "right" }}>{c.type === "REC" ? `${(c.mwh || 0).toLocaleString()} MWh` : `${c.tonnes.toLocaleString()} t`}</td>
                                        <td style={{ textAlign: "right", color: S.accent }}>${c.price}</td>
                                        <td style={{ textAlign: "center" }}><span style={{ color: STATUS_COLORS[c.status] || S.muted, fontSize: 10 }}>{c.status}</span></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                        {sel !== null && (() => {
                            const c = MOCK_CREDITS[sel]; return (
                                <div style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 11, color: S.muted, letterSpacing: 2, marginBottom: 12 }}>CREDIT DETAIL</div>
                                    <h3 style={{ margin: "0 0 8px", fontSize: 16, color: S.accent }}>{c.id}</h3>
                                    <p style={{ margin: "0 0 16px", fontSize: 12, color: S.text }}>{c.project}</p>
                                    {[
                                        ["Registry", c.registry], ["Country", c.country], ["Vintage", c.vintage],
                                        ["Verified", c.verified ? "YES (Oracle)" : "PENDING"],
                                        ["Token ID", c.tokenId || "Not minted"], ["Holder", c.holder || "N/A"],
                                        ["Retired", `${c.retiredPct}%`],
                                    ].map(([k, v], j) => (
                                        <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}`, fontSize: 11 }}>
                                            <span style={{ color: S.muted }}>{k}</span><span style={{ color: k === "Verified" && c.verified ? S.accent2 : S.text }}>{v}</span>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: 12, height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                                        <div style={{ width: `${c.retiredPct}%`, height: "100%", background: c.retiredPct === 100 ? S.muted : S.accent2, transition: "width 0.5s" }} />
                                    </div>
                                    <div style={{ marginTop: 4, fontSize: 10, color: S.muted, textAlign: "right" }}>{c.retiredPct}% RETIRED</div>
                                </div>);
                        })()}
                    </div>
                )}

                {tab === "trading" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                            {[
                                { label: "24h Volume", val: `$${(trades.reduce((s, t) => s + t.total, 0)).toLocaleString()}`, color: S.accent },
                                { label: "Trades Today", val: trades.length, color: S.accent2 },
                                { label: "Avg Price/tCO2e", val: "$16.42", color: "#00D4FF" },
                                { label: "REC Avg/MWh", val: "$2.85", color: "#F97316" },
                            ].map((m, i) => (
                                <div key={i} style={{ padding: 14, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, textAlign: "center" }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 1, marginBottom: 4 }}>{m.label}</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.val}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, letterSpacing: 2 }}>LIVE ORDER BOOK</div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead><tr style={{ borderBottom: `1px solid ${S.border}`, color: S.muted }}>
                                <th style={{ textAlign: "left", padding: 8 }}>TIME</th><th>TYPE</th><th>QTY</th>
                                <th>PRICE</th><th>TOTAL</th><th>BUYER</th><th>TX</th>
                            </tr></thead>
                            <tbody>{trades.map((t, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, opacity: i === 0 ? 1 : 0.7 + i * 0.02 }}>
                                    <td style={{ padding: 8 }}>{t.time}</td>
                                    <td style={{ textAlign: "center" }}><span style={{ padding: "2px 6px", background: "rgba(0,255,136,0.12)", color: S.accent2, borderRadius: 2, fontSize: 10 }}>{t.type}</span></td>
                                    <td style={{ textAlign: "right" }}>{t.qty.toLocaleString()}</td>
                                    <td style={{ textAlign: "right", color: S.accent }}>${t.price}</td>
                                    <td style={{ textAlign: "right", fontWeight: 700 }}>${t.total.toLocaleString()}</td>
                                    <td style={{ color: S.muted }}>{t.buyer}</td>
                                    <td style={{ color: "#00D4FF" }}>{t.tx}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}

                {tab === "retirement" && (
                    <div>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 12, letterSpacing: 2 }}>CREDIT RETIREMENT (PERMANENT BURN)</div>
                        <div style={{ padding: 20, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, marginBottom: 20 }}>
                            <h3 style={{ margin: "0 0 16px", fontSize: 14, color: S.accent }}>Retirement Flow</h3>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {["1. Select Credits", "2. Specify Tonnes", "3. Burn On-Chain", "4. Registry Sync", "5. Certificate NFT"].map((s, i) => (
                                    <div key={i} style={{ flex: 1, minWidth: 120, padding: 12, background: "rgba(0,0,0,0.3)", border: `1px solid ${S.border}`, borderRadius: 4, textAlign: "center" }}>
                                        <div style={{ fontSize: 10, color: S.accent, marginBottom: 4 }}>STEP {i + 1}</div>
                                        <div style={{ fontSize: 11, color: S.text }}>{s.split(". ")[1]}</div>
                                        {i < 4 && <div style={{ color: S.muted, marginTop: 4 }}>&#8594;</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                            {[
                                { label: "Total Retired", val: "142,500 tCO2e", color: S.accent2, sub: "Permanently offset" },
                                { label: "Retirement Certs", val: "48 NFTs", color: S.accent, sub: "On-chain proof" },
                                { label: "Largest Single", val: "25,000 tCO2e", color: "#00D4FF", sub: "VCS-2023-0081" },
                            ].map((m, i) => (
                                <div key={i} style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 1 }}>{m.label}</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: m.color, margin: "8px 0 4px" }}>{m.val}</div>
                                    <div style={{ fontSize: 10, color: S.muted }}>{m.sub}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, letterSpacing: 2 }}>RECENT RETIREMENTS</div>
                        {MOCK_CREDITS.filter(c => c.retiredPct > 0).map((c, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, marginBottom: 8 }}>
                                <span style={{ fontSize: 20 }}>{c.type === "REC" ? "⚡" : "🌳"}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700 }}>{c.id}</div>
                                    <div style={{ fontSize: 10, color: S.muted }}>{c.project}</div>
                                </div>
                                <div style={{ width: 120 }}>
                                    <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                                        <div style={{ width: `${c.retiredPct}%`, height: "100%", background: c.retiredPct === 100 ? S.muted : S.accent2 }} />
                                    </div>
                                    <div style={{ fontSize: 10, color: S.muted, textAlign: "right", marginTop: 2 }}>{c.retiredPct}%</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === "contracts" && (
                    <div>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, letterSpacing: 2 }}>SMART CONTRACT ABI</div>
                        <pre style={{ padding: 16, background: "rgba(0,0,0,0.4)", border: `1px solid ${S.border}`, borderRadius: 4, fontSize: 11, color: S.accent2, overflow: "auto", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{CONTRACT_ABI}</pre>
                    </div>
                )}

                {tab === "analytics" && (
                    <div>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 12, letterSpacing: 2 }}>REVENUE MODEL</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                            {[
                                { label: "Minting Fee", val: "2% per batch", desc: "Fee on each credit/REC tokenization event", color: S.accent },
                                { label: "Trading Spread", val: "0.3% per trade", desc: "DEX spread on carbon credit secondary market", color: S.accent2 },
                                { label: "Retirement Fee", val: "0.5 BEZ/cert", desc: "On-chain retirement certificate NFT minting", color: "#00D4FF" },
                                { label: "Verification Oracle", val: "1.0 BEZ/batch", desc: "Oracle verification call via Verra/GS registry API", color: "#F97316" },
                                { label: "API Access", val: "SaaS B2B", desc: "Enterprise API for carbon portfolio management", color: "#7C3AED" },
                                { label: "Registry Sync", val: "0.2 BEZ/sync", desc: "Automated sync with Verra, GS, ACR, CDM registries", color: "#EC4899" },
                            ].map((r, i) => (
                                <div key={i} style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 1, marginBottom: 4 }}>{r.label}</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: r.color, marginBottom: 6 }}>{r.val}</div>
                                    <div style={{ fontSize: 10, color: S.muted, lineHeight: 1.4 }}>{r.desc}</div>
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
                  📊 REAL-TIME AGENT METRICS — GREENTOKEN
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/greentoken/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="greentoken" accentColor={S.accent} />
            </div>
          )}

            </div>
        </div>
    );
}
