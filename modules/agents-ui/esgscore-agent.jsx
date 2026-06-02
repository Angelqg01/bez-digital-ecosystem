import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_COMPANIES = [
    { id: "ESG-001", name: "Iberdrola Renovables", sector: "ENERGY", country: "ES", ticker: "IBE", esgScore: 87, envScore: 92, socScore: 81, govScore: 88, trend: "+3", tokenId: "BEZ-ESG-0041", certified: true, lastAudit: "2026-03-10", status: "A+" },
    { id: "ESG-002", name: "Maersk Logistics", sector: "SHIPPING", country: "DK", ticker: "MAERSK", esgScore: 72, envScore: 65, socScore: 78, govScore: 73, trend: "+1", tokenId: "BEZ-ESG-0042", certified: true, lastAudit: "2026-03-08", status: "B+" },
    { id: "ESG-003", name: "Tesla Energy", sector: "AUTO/ENERGY", country: "US", ticker: "TSLA", esgScore: 79, envScore: 85, socScore: 62, govScore: 90, trend: "-2", tokenId: "BEZ-ESG-0043", certified: true, lastAudit: "2026-03-12", status: "A-" },
    { id: "ESG-004", name: "Shell Transition Fund", sector: "OIL&GAS", country: "NL", ticker: "SHEL", esgScore: 41, envScore: 28, socScore: 55, govScore: 40, trend: "+5", tokenId: null, certified: false, lastAudit: "2026-02-28", status: "D" },
    { id: "ESG-005", name: "Acciona Infraestructuras", sector: "CONSTRUCTION", country: "ES", ticker: "ANA", esgScore: 83, envScore: 88, socScore: 79, govScore: 82, trend: "+2", tokenId: "BEZ-ESG-0044", certified: true, lastAudit: "2026-03-14", status: "A" },
    { id: "ESG-006", name: "Amazon Web Services", sector: "TECH", country: "US", ticker: "AMZN", esgScore: 58, envScore: 52, socScore: 63, govScore: 59, trend: "0", tokenId: "BEZ-ESG-0045", certified: false, lastAudit: "2026-03-01", status: "C+" },
];

const MOCK_AUDITS = [
    { date: "2026-03-14", company: "Acciona", category: "ENV", metric: "Scope 1 Emissions", before: 45200, after: 38100, change: -15.7, verifier: "Claude AI + DNV" },
    { date: "2026-03-12", company: "Tesla", category: "GOV", metric: "Board Diversity", before: 62, after: 90, change: +45.2, verifier: "Claude AI + SGS" },
    { date: "2026-03-10", company: "Iberdrola", category: "ENV", metric: "Renewable %", before: 88, after: 92, change: +4.5, verifier: "Claude AI + Bureau Veritas" },
    { date: "2026-03-08", company: "Maersk", category: "SOC", metric: "Safety Incidents", before: 12, after: 8, change: -33.3, verifier: "Claude AI + DNV" },
];

const STATUS_COLORS = { "A+": "#00FF88", "A": "#00FF88", "A-": "#00D4FF", "B+": "#00D4FF", "B": "#FFD700", "C+": "#FFD700", "C": "#F97316", "D": "#EF4444", "F": "#EF4444" };

const getScoreColor = (s) => s >= 80 ? "#00FF88" : s >= 60 ? "#FFD700" : s >= 40 ? "#F97316" : "#EF4444";

const CONTRACT_ABI = `// ESGScoreOracle.sol  -  BeZhas Chain
// On-chain ESG scoring with AI verification and tradeable reputation tokens

struct CompanyESG {
  string  companyId;
  string  name;
  string  sector;
  uint256 envScore;       // 0-100 Environmental
  uint256 socScore;       // 0-100 Social
  uint256 govScore;       // 0-100 Governance
  uint256 totalScore;     // Weighted average
  string  grade;          // A+, A, B+, B, C+, C, D, F
  bool    certified;      // Oracle-verified
  uint256 lastAudit;      // Timestamp
}

struct AuditRecord {
  uint256 companyTokenId;
  string  category;       // ENV, SOC, GOV
  string  metric;
  int256  changePercent;  // Positive = improvement
  string  verifier;       // "Claude AI + DNV"
  uint256 timestamp;
}

function registerCompany(
  string companyId, string name, string sector
) external onlyRole(REGISTRAR_ROLE) returns (uint256 tokenId);

function submitAudit(
  uint256 tokenId, uint256 env, uint256 soc, uint256 gov,
  string category, string metric, int256 change
) external onlyRole(AUDITOR_ROLE);

function certifyScore(uint256 tokenId) external onlyRole(ORACLE_ROLE);
function getCompanyScore(uint256 tokenId) view returns (CompanyESG);
function tradeESGToken(uint256 tokenId, address to) external;`;

const S = {
    bg: "#030712", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
    accent: "#7C3AED", accent2: "#00FF88", text: "#e2e8f0", muted: "#64748b", mono: "'Courier New',monospace",
};

export default function ESGScoreAgent() {
  const bridge = useAgentBridge("esgscore");
    const [tab, setTab] = useState("scores");
    const [sel, setSel] = useState(null);
    const [audits, setAudits] = useState(MOCK_AUDITS);

    useEffect(() => {
        const iv = setInterval(() => {
            const cats = ["ENV", "SOC", "GOV"];
            const metrics = { ENV: ["Scope 1 Emissions", "Renewable %", "Water Usage", "Waste Reduction"], SOC: ["Safety Incidents", "Diversity Index", "Community Invest", "Labor Standards"], GOV: ["Board Independence", "Anti-Corruption", "Tax Transparency", "Data Privacy"] };
            const cat = cats[Math.floor(Math.random() * cats.length)];
            const ms = metrics[cat];
            const m = ms[Math.floor(Math.random() * ms.length)];
            const co = MOCK_COMPANIES[Math.floor(Math.random() * MOCK_COMPANIES.length)];
            setAudits(p => [{
                date: new Date().toISOString().split("T")[0], company: co.name.split(" ")[0], category: cat,
                metric: m, before: Math.floor(Math.random() * 80 + 10), after: Math.floor(Math.random() * 95 + 5),
                change: +(Math.random() * 40 - 10).toFixed(1), verifier: `Claude AI + ${["DNV", "SGS", "Bureau Veritas", "TUV"][Math.floor(Math.random() * 4)]}`
            }, ...p].slice(0, 20));
        }, 9000);
        return () => clearInterval(iv);
    }, []);

    const tabs = ["scores", "audits", "methodology", "contracts", "analytics", "metrics"];
    const avgScore = (MOCK_COMPANIES.reduce((s, c) => s + c.esgScore, 0) / MOCK_COMPANIES.length).toFixed(0);
    const certified = MOCK_COMPANIES.filter(c => c.certified).length;

    return (
        <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.mono, color: S.text, padding: 24 }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                    <span style={{ fontSize: 28 }}>📊</span>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, color: S.accent }}>ESG Score Agent</h1>
                        <p style={{ margin: 0, fontSize: 11, color: S.muted, letterSpacing: 2 }}>ON-CHAIN ESG REPUTATION SCORING</p>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 11 }}>
                        <span style={{ color: S.accent2 }}>AVG SCORE: {avgScore}</span>
                        <span style={{ color: S.accent }}>{certified}/{MOCK_COMPANIES.length} CERTIFIED</span>
                        <span style={{ color: "#00D4FF" }}>{audits.length} AUDITS</span>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
                    {tabs.map(t => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: "8px 16px", background: tab === t ? S.accent : "transparent", color: tab === t ? "#fff" : S.muted,
                            border: `1px solid ${tab === t ? S.accent : S.border}`, borderRadius: 2, cursor: "pointer", fontSize: 11,
                            fontFamily: S.mono, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                        }}>{t}</button>
                    ))}
                </div>

                {tab === "scores" && (
                    <div style={{ display: "grid", gridTemplateColumns: sel !== null ? "1fr 1fr" : "1fr", gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, letterSpacing: 2 }}>COMPANY ESG LEADERBOARD</div>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                <thead><tr style={{ borderBottom: `1px solid ${S.border}`, color: S.muted }}>
                                    <th style={{ textAlign: "left", padding: 8 }}>#</th><th>COMPANY</th><th>SECTOR</th>
                                    <th>E</th><th>S</th><th>G</th><th>TOTAL</th><th>GRADE</th>
                                </tr></thead>
                                <tbody>{[...MOCK_COMPANIES].sort((a, b) => b.esgScore - a.esgScore).map((c, i) => (
                                    <tr key={i} onClick={() => setSel(MOCK_COMPANIES.indexOf(c))} style={{
                                        borderBottom: `1px solid ${S.border}`, cursor: "pointer",
                                        background: sel === MOCK_COMPANIES.indexOf(c) ? "rgba(124,58,237,0.08)" : "transparent"
                                    }}>
                                        <td style={{ padding: 8, color: S.muted }}>{i + 1}</td>
                                        <td style={{ fontWeight: 700 }}>{c.name}</td>
                                        <td><span style={{ padding: "2px 6px", background: "rgba(124,58,237,0.12)", color: S.accent, borderRadius: 2, fontSize: 10 }}>{c.sector}</span></td>
                                        <td style={{ textAlign: "center", color: getScoreColor(c.envScore) }}>{c.envScore}</td>
                                        <td style={{ textAlign: "center", color: getScoreColor(c.socScore) }}>{c.socScore}</td>
                                        <td style={{ textAlign: "center", color: getScoreColor(c.govScore) }}>{c.govScore}</td>
                                        <td style={{ textAlign: "center", fontWeight: 700, color: getScoreColor(c.esgScore) }}>{c.esgScore}</td>
                                        <td style={{ textAlign: "center" }}><span style={{ padding: "2px 8px", background: `${STATUS_COLORS[c.status]}22`, color: STATUS_COLORS[c.status], borderRadius: 2, fontWeight: 700 }}>{c.status}</span></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                        {sel !== null && (() => {
                            const c = MOCK_COMPANIES[sel]; return (
                                <div style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ fontSize: 11, color: S.muted, letterSpacing: 2, marginBottom: 12 }}>COMPANY DETAIL</div>
                                    <h3 style={{ margin: "0 0 4px", fontSize: 16, color: S.accent }}>{c.name}</h3>
                                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 16 }}>{c.ticker} | {c.country} | {c.sector}</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
                                        {[
                                            { label: "ENV", val: c.envScore, color: getScoreColor(c.envScore) },
                                            { label: "SOC", val: c.socScore, color: getScoreColor(c.socScore) },
                                            { label: "GOV", val: c.govScore, color: getScoreColor(c.govScore) },
                                        ].map((s, j) => (
                                            <div key={j} style={{ padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 4, textAlign: "center" }}>
                                                <div style={{ fontSize: 10, color: S.muted, marginBottom: 4 }}>{s.label}</div>
                                                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
                                                <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                                                    <div style={{ width: `${s.val}%`, height: "100%", background: s.color }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {[
                                        ["Total Score", `${c.esgScore} (${c.status})`], ["Trend", `${c.trend} pts`],
                                        ["Certified", c.certified ? "YES" : "PENDING"], ["Token ID", c.tokenId || "Not minted"],
                                        ["Last Audit", c.lastAudit],
                                    ].map(([k, v], j) => (
                                        <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}`, fontSize: 11 }}>
                                            <span style={{ color: S.muted }}>{k}</span>
                                            <span style={{ color: k === "Certified" && c.certified ? S.accent2 : S.text }}>{v}</span>
                                        </div>
                                    ))}
                                </div>);
                        })()}
                    </div>
                )}

                {tab === "audits" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                            {[
                                { label: "Total Audits", val: audits.length, color: S.accent },
                                { label: "Avg Improvement", val: `${(audits.filter(a => a.change > 0).reduce((s, a) => s + a.change, 0) / Math.max(1, audits.filter(a => a.change > 0).length)).toFixed(1)}%`, color: S.accent2 },
                                { label: "AI + Third-Party", val: `${new Set(audits.map(a => a.verifier.split(" + ")[1])).size} verifiers`, color: "#00D4FF" },
                            ].map((m, i) => (
                                <div key={i} style={{ padding: 14, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, textAlign: "center" }}>
                                    <div style={{ fontSize: 10, color: S.muted, letterSpacing: 1, marginBottom: 4 }}>{m.label}</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.val}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead><tr style={{ borderBottom: `1px solid ${S.border}`, color: S.muted }}>
                                <th style={{ textAlign: "left", padding: 8 }}>DATE</th><th>COMPANY</th><th>CAT</th>
                                <th>METRIC</th><th>CHANGE</th><th>VERIFIER</th>
                            </tr></thead>
                            <tbody>{audits.map((a, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                                    <td style={{ padding: 8 }}>{a.date}</td>
                                    <td style={{ fontWeight: 700 }}>{a.company}</td>
                                    <td><span style={{
                                        padding: "2px 6px", background: a.category === "ENV" ? "rgba(0,255,136,0.12)" : a.category === "SOC" ? "rgba(0,212,255,0.12)" : "rgba(124,58,237,0.12)",
                                        color: a.category === "ENV" ? S.accent2 : a.category === "SOC" ? "#00D4FF" : S.accent, borderRadius: 2, fontSize: 10
                                    }}>{a.category}</span></td>
                                    <td>{a.metric}</td>
                                    <td style={{ color: a.change >= 0 ? S.accent2 : "#EF4444", fontWeight: 700 }}>{a.change >= 0 ? "+" : ""}{a.change}%</td>
                                    <td style={{ color: S.muted, fontSize: 10 }}>{a.verifier}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}

                {tab === "methodology" && (
                    <div>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 12, letterSpacing: 2 }}>ESG SCORING METHODOLOGY</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                            {[
                                { cat: "ENVIRONMENTAL (40%)", color: S.accent2, icon: "🌍", metrics: ["Scope 1/2/3 Emissions", "Renewable Energy %", "Water Usage Intensity", "Waste Reduction Rate", "Biodiversity Impact"] },
                                { cat: "SOCIAL (30%)", color: "#00D4FF", icon: "👥", metrics: ["Workplace Safety (LTIR)", "Diversity & Inclusion", "Community Investment", "Supply Chain Labor", "Data Privacy Score"] },
                                { cat: "GOVERNANCE (30%)", color: S.accent, icon: "🏛️", metrics: ["Board Independence", "Anti-Corruption Index", "Tax Transparency", "Executive Compensation", "Shareholder Rights"] },
                            ].map((c, i) => (
                                <div key={i} style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                        <span style={{ fontSize: 20 }}>{c.icon}</span>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.cat}</div>
                                    </div>
                                    {c.metrics.map((m, j) => (
                                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} />
                                            <span>{m}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: 16, background: S.card, border: `1px solid ${S.border}`, borderRadius: 4 }}>
                            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: S.accent }}>Verification Pipeline</h3>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {["1. Data Collection", "2. Claude AI Analysis", "3. Third-Party Audit", "4. On-Chain Commit", "5. Token Mint/Update"].map((s, i) => (
                                    <div key={i} style={{ flex: 1, minWidth: 120, padding: 12, background: "rgba(0,0,0,0.3)", border: `1px solid ${S.border}`, borderRadius: 4, textAlign: "center" }}>
                                        <div style={{ fontSize: 10, color: S.accent, marginBottom: 4 }}>STEP {i + 1}</div>
                                        <div style={{ fontSize: 11, color: S.text }}>{s.split(". ")[1]}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
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
                                { label: "Certification SaaS", val: "$2K-50K/yr", desc: "Annual ESG certification subscription per company", color: S.accent },
                                { label: "Advisory Premium", val: "$10K/audit", desc: "Deep-dive AI + human audit with recommendations", color: S.accent2 },
                                { label: "Token Trading", val: "0.5% spread", desc: "ESG reputation token secondary market trading fee", color: "#00D4FF" },
                                { label: "API Data Feed", val: "B2B licensing", desc: "Real-time ESG scores for fund managers and investors", color: "#FFD700" },
                                { label: "Compliance Reports", val: "$500/report", desc: "Regulatory ESG compliance reports (EU CSRD, SEC)", color: "#F97316" },
                                { label: "Green Bond Rating", val: "1% issuance", desc: "ESG score used for green bond rating and pricing", color: "#EC4899" },
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
                  📊 REAL-TIME AGENT METRICS — ESGSCORE
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/esgscore/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="esgscore" accentColor={S.accent} />
            </div>
          )}

            </div>
        </div>
    );
}
