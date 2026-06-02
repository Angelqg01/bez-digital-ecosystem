import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_POLICIES = [
    { id: "POL-001", holder: "TransLogistica SA", type: "Cargo Marine", premium: 4500, currency: "BEZ", coverage: 2500000, coverCurrency: "USD", tokenId: "#8801", startDate: "2026-01-15", endDate: "2027-01-15", status: "ACTIVE", risk: "Medium", claims: 0 },
    { id: "POL-002", holder: "Finca Los Pinos", type: "Crop Insurance", premium: 1200, currency: "BEZ", coverage: 800000, coverCurrency: "MXN", tokenId: "#8802", startDate: "2026-03-01", endDate: "2026-12-31", status: "ACTIVE", risk: "High", claims: 1 },
    { id: "POL-003", holder: "AutoFleet Corp", type: "Fleet Liability", premium: 8200, currency: "BEZ", coverage: 5000000, coverCurrency: "USD", tokenId: "#8803", startDate: "2025-11-01", endDate: "2026-11-01", status: "ACTIVE", risk: "Low", claims: 2 },
    { id: "POL-004", holder: "Solar Farms Inc", type: "Equipment Breakdown", premium: 3100, currency: "BEZ", coverage: 1200000, coverCurrency: "USD", tokenId: "#8804", startDate: "2026-02-01", endDate: "2027-02-01", status: "ACTIVE", risk: "Low", claims: 0 },
    { id: "POL-005", holder: "Bodegas Valle DO", type: "Parametric Drought", premium: 900, currency: "BEZ", coverage: 500000, coverCurrency: "MXN", tokenId: "#8805", startDate: "2026-01-01", endDate: "2026-12-31", status: "CLAIM_PENDING", risk: "High", claims: 1 },
    { id: "POL-006", holder: "MedTech Labs", type: "Clinical Trial", premium: 15000, currency: "BEZ", coverage: 10000000, coverCurrency: "USD", tokenId: "#8806", startDate: "2025-09-01", endDate: "2026-09-01", status: "EXPIRED", risk: "Medium", claims: 0 },
];

const MOCK_EVENTS = [
    { time: "15:22:10", policy: "POL-002", event: "CLAIM_FILED", detail: "Hail damage — 30% crop loss reported — Michoacán MX" },
    { time: "15:10:44", policy: "POL-003", event: "PREMIUM_PAID", detail: "Monthly premium 683 BEZ — auto-debit from vault" },
    { time: "14:55:30", policy: "POL-005", event: "ORACLE_TRIGGER", detail: "Drought index >85 — parametric threshold exceeded" },
    { time: "14:30:18", policy: "POL-001", event: "POLICY_RENEWED", detail: "Auto-renewal — new term 2027-01-15 to 2028-01-15" },
];

const STATUS_COLORS = { ACTIVE: "#00FF88", CLAIM_PENDING: "#FFD700", EXPIRED: "#EF4444", CANCELLED: "#7C3AED", SUSPENDED: "#F97316" };
const RISK_COLORS = { Low: "#00FF88", Medium: "#FFD700", High: "#EF4444" };
const EVENT_COLORS = { CLAIM_FILED: "#EF4444", PREMIUM_PAID: "#00FF88", ORACLE_TRIGGER: "#FFD700", POLICY_RENEWED: "#3B82F6", FRAUD_FLAG: "#7C3AED" };

const CONTRACT_ABI = `// PolicyNFT.sol  —  BeZhas Chain
// ERC-721 insurance policies with premium tracking

struct Policy {
  string   policyType;
  address  holder;
  uint256  premiumBez;       // monthly premium in BEZ (wei)
  uint256  coverageAmount;   // max payout in wei
  uint256  startDate;
  uint256  endDate;
  uint8    riskTier;         // 1=Low, 2=Medium, 3=High
  bool     active;
  uint256  totalClaims;
}

struct PremiumPayment {
  uint256  policyId;
  uint256  amount;
  uint256  paidAt;
}

function mintPolicy(
  string policyType, uint256 premium, uint256 coverage,
  uint256 startDate, uint256 endDate, uint8 riskTier
) external returns (uint256 tokenId);

function payPremium(uint256 policyId) external payable;
function cancelPolicy(uint256 policyId) external;
function renewPolicy(uint256 policyId, uint256 newEndDate) external;`;

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────
const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#3B82F6", accent2: "#FFD700", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function PolicyNFTAgent() {
  const bridge = useAgentBridge("policynft");
    const [tab, setTab] = useState("policies");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState(MOCK_EVENTS);

    useEffect(() => {
        const iv = setInterval(() => {
            const pol = MOCK_POLICIES[Math.floor(Math.random() * MOCK_POLICIES.length)];
            const evts = ["PREMIUM_PAID", "CLAIM_FILED", "POLICY_RENEWED", "ORACLE_TRIGGER"];
            const evt = evts[Math.floor(Math.random() * evts.length)];
            setEvents(p => [{
                time: new Date().toLocaleTimeString(), policy: pol.id, event: evt,
                detail: evt === "PREMIUM_PAID" ? `${pol.premium} BEZ — auto-debit cycle` : evt === "CLAIM_FILED" ? `New claim on ${pol.type} — ${pol.holder}` : `${pol.type} policy event — ${pol.holder}`
            }, ...p].slice(0, 30));
        }, 9000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "policies", label: "🛡️ Policies" },
        { id: "activity", label: "📡 Activity" },
        { id: "pipeline", label: "🔄 Lifecycle" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const active = MOCK_POLICIES.filter(p => p.status === "ACTIVE").length;
    const totalPremium = MOCK_POLICIES.reduce((s, p) => s + p.premium, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🛡️</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>PolicyNFT Agent — Tokenized Insurance Policies</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>ERC-721 policies · Premium tracking · Risk tiering · Auto-renewal</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#3B82F622", color: "#3B82F6", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● ACTIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "policies" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Active", active, "#00FF88"], ["Premiums/mo", totalPremium.toLocaleString() + " BEZ", S.accent], ["Total Policies", MOCK_POLICIES.length, S.accent2]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>Token</th><th>Holder</th><th>Type</th><th>Risk</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_POLICIES.map(p => (
                                <tr key={p.id} onClick={() => setSel(p)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === p.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent2, fontSize: 11 }}>{p.tokenId}</td>
                                    <td>{p.holder}</td>
                                    <td style={{ fontSize: 12 }}>{p.type}</td>
                                    <td><span style={{ color: RISK_COLORS[p.risk], fontSize: 11 }}>● {p.risk}</span></td>
                                    <td><span style={{ color: STATUS_COLORS[p.status], fontSize: 11 }}>● {p.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.type}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>Holder: {sel.holder} · Token {sel.tokenId}</div>
                            {[["Premium", sel.premium + " " + sel.currency + "/mo"], ["Coverage", sel.coverage.toLocaleString() + " " + sel.coverCurrency], ["Period", sel.startDate + " → " + sel.endDate], ["Risk Tier", sel.risk], ["Claims Filed", sel.claims]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: STATUS_COLORS[sel.status] + "22", padding: 8, borderRadius: 8, textAlign: "center", color: STATUS_COLORS[sel.status], fontSize: 12 }}>
                                {sel.status === "ACTIVE" ? "✅ POLICY ACTIVE — COVERAGE IN FORCE" : sel.status === "CLAIM_PENDING" ? "⏳ CLAIM UNDER REVIEW" : "⚠ POLICY EXPIRED"}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "activity" && (
                <div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        {[["Events", events.length, S.accent], ["Claims", events.filter(e => e.event === "CLAIM_FILED").length, "#EF4444"], ["Payments", events.filter(e => e.event === "PREMIUM_PAID").length, "#00FF88"]].map(([l, v, c]) => (
                            <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                            </div>
                        ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Policy</th><th>Event</th><th>Detail</th>
                        </tr></thead>
                        <tbody>{events.map((e, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                                <td style={{ color: S.accent2 }}>{e.policy}</td>
                                <td><span style={{ color: EVENT_COLORS[e.event] || S.text, fontSize: 11 }}>{e.event}</span></td>
                                <td style={{ color: S.text, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.detail}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Policy Lifecycle Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Underwrite", "2. Mint NFT", "3. Premium Cycle", "4. Claim/Renew", "5. Settle/Expire"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📝", "🪙", "💳", "📋", "✅"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    <h4 style={{ fontSize: 13, color: S.muted, marginBottom: 8 }}>Policies by Status</h4>
                    {["ACTIVE", "CLAIM_PENDING", "EXPIRED", "CANCELLED"].map(status => {
                        const items = MOCK_POLICIES.filter(p => p.status === status);
                        if (!items.length) return null;
                        return (
                            <div key={status} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: STATUS_COLORS[status] }}>● {status} ({items.length})</div>
                                {items.map(p => (
                                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span>{p.holder} — {p.type}</span>
                                        <span style={{ fontFamily: S.mono, color: S.muted }}>{p.premium} BEZ/mo · {p.coverage.toLocaleString()} {p.coverCurrency}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>PolicyNFT.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Policy Minting", "2.0 BEZ / policy", "+45 policies/mo", "🪙"],
                        ["Premium Collection", "1.5% of premium", "+32K BEZ/mo in premiums", "💳"],
                        ["Claim Processing", "0.5 BEZ / claim", "+120 claims/mo", "📋"],
                        ["Underwriting SaaS", "$999/mo per insurer", "12 insurers subscribed", "📝"],
                        ["Risk Score API", "0.1 BEZ / query", "+18K queries/mo", "📊"],
                        ["Renewal Automation", "0.3 BEZ / renewal", "+80 renewals/mo", "🔄"],
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
                  📊 REAL-TIME AGENT METRICS — POLICYNFT
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/policynft/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="policynft" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
