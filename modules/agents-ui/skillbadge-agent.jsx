import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_BADGES = [
    { id: "BDG-001", title: "Solidity Developer L2", issuer: "BeZhas Academy", holder: "0xA1..F3", skill: "Smart Contracts", level: 2, score: 92, issuedAt: "2026-02-14", verified: true, sbt: true },
    { id: "BDG-002", title: "DeFi Analyst Certified", issuer: "Platzi Web3", holder: "0xB2..E4", skill: "DeFi", level: 3, score: 88, issuedAt: "2026-03-01", verified: true, sbt: true },
    { id: "BDG-003", title: "Rust Systems L1", issuer: "UNAM Online", holder: "0xC3..D5", skill: "Rust", level: 1, score: 75, issuedAt: "2026-01-20", verified: true, sbt: true },
    { id: "BDG-004", title: "AI/ML Engineer L3", issuer: "Google LATAM", holder: "0xD4..C6", skill: "AI/ML", level: 3, score: 96, issuedAt: "2026-03-10", verified: true, sbt: true },
    { id: "BDG-005", title: "ZK-Proofs Specialist", issuer: "Ethereum Foundation", holder: "0xE5..B7", skill: "Zero Knowledge", level: 3, score: 91, issuedAt: "2026-02-28", verified: false, sbt: true },
    { id: "BDG-006", title: "Supply Chain Logistics", issuer: "TecMilenio", holder: "0xF6..A8", skill: "Supply Chain", level: 2, score: 84, issuedAt: "2026-03-05", verified: true, sbt: true },
];

const LEVEL_COLORS = { 1: "#00FF88", 2: "#FFD700", 3: "#EF4444" };
const LEVEL_LABELS = { 1: "Foundational", 2: "Professional", 3: "Expert" };

const CONTRACT_ABI = `// SkillBadgeSBT.sol  —  BeZhas Chain
// Soulbound skill badges / micro-credentials

struct Badge {
  string   title;
  string   skill;
  uint256  level;        // 1-3
  uint256  score;        // 0-100
  address  holder;
  address  issuer;
  uint256  issuedAt;
  bool     verified;
  bool     revoked;
}

struct Issuer {
  string   name;
  address  addr;
  uint256  badgesIssued;
  bool     accredited;
}

function registerIssuer(string name) external returns (uint256);
function mintBadge(address holder, string title, string skill, uint256 level, uint256 score, string metadataURI) external returns (uint256);
function verifyBadge(uint256 badgeId) external;
function revokeBadge(uint256 badgeId) external;
function getBadge(uint256 badgeId) external view returns (Badge memory);`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#7C3AED", accent2: "#FFD700", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function SkillBadgeAgent() {
  const bridge = useAgentBridge("skillbadge");
    const [tab, setTab] = useState("badges");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { time: "15:35:00", type: "BADGE_MINTED", badge: "BDG-004", detail: "AI/ML Engineer L3 minted for 0xD4..C6" },
        { time: "15:30:00", type: "VERIFIED", badge: "BDG-001", detail: "Solidity Developer L2 verified by BeZhas Academy" },
        { time: "15:25:00", type: "SKILL_ASSESSED", badge: "BDG-003", detail: "Rust L1 assessment scored 75/100" },
    ]);

    useEffect(() => {
        const EVTS = ["BADGE_MINTED", "VERIFIED", "SKILL_ASSESSED", "ISSUER_REGISTERED", "BADGE_REVOKED", "LEVEL_UP"];
        const iv = setInterval(() => {
            const b = MOCK_BADGES[Math.floor(Math.random() * MOCK_BADGES.length)];
            const ev = EVTS[Math.floor(Math.random() * EVTS.length)];
            setEvents(p => [{ time: new Date().toLocaleTimeString(), type: ev, badge: b.id, detail: `${ev} — ${b.title} (${b.issuer})` }, ...p].slice(0, 30));
        }, 7000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "badges", label: "🏅 Badges" },
        { id: "live", label: "🔴 Activity" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const totalBadges = MOCK_BADGES.length;
    const verifiedBadges = MOCK_BADGES.filter(b => b.verified).length;
    const avgScore = Math.round(MOCK_BADGES.reduce((s, b) => s + b.score, 0) / totalBadges);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🏅</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>SkillBadge Agent — Soulbound Micro-Credentials</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>SBT badges · Skill verification · On-chain credentials</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#7C3AED22", color: "#7C3AED", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "badges" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Badges", totalBadges, S.accent], ["Verified", verifiedBadges, "#00FF88"], ["Avg Score", avgScore, S.accent2]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Badge</th><th>Skill</th><th>Level</th><th>Score</th>
                            </tr></thead>
                            <tbody>{MOCK_BADGES.map(b => (
                                <tr key={b.id} onClick={() => setSel(b)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === b.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent, fontSize: 11 }}>{b.id}</td>
                                    <td style={{ fontSize: 12 }}>{b.title}</td>
                                    <td style={{ fontSize: 12, color: S.muted }}>{b.skill}</td>
                                    <td><span style={{ color: LEVEL_COLORS[b.level], fontSize: 11 }}>L{b.level} {LEVEL_LABELS[b.level]}</span></td>
                                    <td style={{ fontFamily: S.mono, fontSize: 12, color: b.score >= 90 ? "#00FF88" : b.score >= 70 ? "#FFD700" : "#EF4444" }}>{b.score}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.title}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>{sel.issuer} · {sel.holder}</div>
                            {[["Skill", sel.skill], ["Level", `L${sel.level} — ${LEVEL_LABELS[sel.level]}`], ["Score", sel.score + "/100"], ["Issued", sel.issuedAt], ["Verified", sel.verified ? "✅ Yes" : "⏳ Pending"], ["SBT", sel.sbt ? "🔒 Soulbound" : "Transferable"]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: S.accent + "11", borderRadius: 8, overflow: "hidden" }}>
                                <div style={{ height: 8, background: sel.score >= 90 ? "#00FF88" : sel.score >= 70 ? "#FFD700" : "#EF4444", width: sel.score + "%", borderRadius: 8 }} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "live" && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                    <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                        <th style={{ padding: 6 }}>Time</th><th>Event</th><th>Badge</th><th>Detail</th>
                    </tr></thead>
                    <tbody>{events.map((e, x) => (
                        <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                            <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                            <td style={{ color: e.type === "BADGE_MINTED" ? S.accent2 : e.type === "VERIFIED" ? "#00FF88" : S.accent }}>{e.type}</td>
                            <td style={{ color: "#3B82F6" }}>{e.badge}</td>
                            <td style={{ fontSize: 11 }}>{e.detail}</td>
                        </tr>
                    ))}</tbody>
                </table>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Credential Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Skill Assessment", "2. Score Evaluation", "3. Mint SBT Badge", "4. Third-Party Verify", "5. On-Chain Proof"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📝", "📊", "🏅", "✅", "⛓️"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>SkillBadgeSBT.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Badge Minting", "0.5 BEZ / badge", "+320 badges/mo", "🏅"],
                        ["Skill Assessment", "1.0 BEZ / test", "+480 assessments/mo", "📝"],
                        ["Verification", "0.1 BEZ / verify", "+2.1K verifications/mo", "✅"],
                        ["Issuer Registration", "5.0 BEZ / issuer", "+6 issuers/mo", "🏛️"],
                        ["Talent Marketplace", "3% placement fee", "+45 placements/mo", "💼"],
                        ["API Access", "$149/mo per API key", "22 API keys", "🔑"],
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
                  📊 REAL-TIME AGENT METRICS — SKILLBADGE
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/skillbadge/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="skillbadge" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
