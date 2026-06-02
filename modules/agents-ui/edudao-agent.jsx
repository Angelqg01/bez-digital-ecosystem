import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_PROPOSALS = [
    { id: "PROP-001", title: "Add Solidity Track to CS Dept", institution: "UNAM", proposer: "Dr. García", votes: 234, quorum: 300, forPct: 82, status: "ACTIVE", category: "Curriculum", deadline: "2026-04-15" },
    { id: "PROP-002", title: "Allocate 50K BEZ to Lab Equipment", institution: "TecMilenio", proposer: "Ing. Reyes", votes: 189, quorum: 150, forPct: 91, status: "PASSED", category: "Budget", deadline: "2026-03-10" },
    { id: "PROP-003", title: "Partnership with Chainlink Labs", institution: "BeZhas Academy", proposer: "Prof. Ruiz", votes: 412, quorum: 400, forPct: 76, status: "PASSED", category: "Partnership", deadline: "2026-03-05" },
    { id: "PROP-004", title: "Increase Scholarship Fund 30%", institution: "IPN", proposer: "Dra. Morales", votes: 67, quorum: 200, forPct: 95, status: "ACTIVE", category: "Budget", deadline: "2026-05-01" },
    { id: "PROP-005", title: "Mandatory DeFi Ethics Module", institution: "Platzi Web3", proposer: "L. Fernández", votes: 145, quorum: 100, forPct: 58, status: "REJECTED", category: "Curriculum", deadline: "2026-02-28" },
    { id: "PROP-006", title: "Open Source Research Repository", institution: "UNAM", proposer: "Dr. Hernández", votes: 88, quorum: 250, forPct: 72, status: "ACTIVE", category: "Infrastructure", deadline: "2026-06-01" },
];

const STATUS_COLORS = { ACTIVE: "#FFD700", PASSED: "#00FF88", REJECTED: "#EF4444", EXECUTED: "#3B82F6" };
const CAT_COLORS = { Curriculum: "#3B82F6", Budget: "#FFD700", Partnership: "#7C3AED", Infrastructure: "#F97316" };

const CONTRACT_ABI = `// EduDAO.sol  —  BeZhas Chain
// DAO governance for educational institutions

struct Proposal {
  string   title;
  string   category;
  address  proposer;
  uint256  institution;
  uint256  forVotes;
  uint256  againstVotes;
  uint256  quorum;
  uint256  deadline;
  bool     executed;
}

struct Institution {
  string   name;
  address  admin;
  uint256  memberCount;
  uint256  treasuryBez;
  bool     active;
}

function registerInstitution(string name) external returns (uint256);
function createProposal(uint256 instId, string title, string category, uint256 quorum, uint256 deadline) external returns (uint256);
function castVote(uint256 proposalId, bool support) external;
function executeProposal(uint256 proposalId) external;
function fundTreasury(uint256 instId) external payable;`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#EAB308", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function EduDAOAgent() {
    const bridge = useAgentBridge('edudao');
    const [tab, setTab] = useState("proposals");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { time: "15:30:00", type: "VOTE_CAST", prop: "PROP-001", detail: "0xC2..A1 voted FOR — Add Solidity Track" },
        { time: "15:25:00", type: "EXECUTED", prop: "PROP-002", detail: "50K BEZ released to Lab Equipment" },
    ]);

    useEffect(() => {
        const EVTS = ["VOTE_CAST", "PROPOSAL_CREATED", "EXECUTED", "TREASURY_FUNDED", "QUORUM_REACHED"];
        const iv = setInterval(() => {
            const p = MOCK_PROPOSALS[Math.floor(Math.random() * MOCK_PROPOSALS.length)];
            const ev = EVTS[Math.floor(Math.random() * EVTS.length)];
            setEvents(prev => [{ time: new Date().toLocaleTimeString(), type: ev, prop: p.id, detail: `${ev} — ${p.title}` }, ...prev].slice(0, 30));
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "proposals", label: "🗳️ Proposals" },
        { id: "live", label: "🔴 Votes" },
        { id: "pipeline", label: "🔄 Governance" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🏛️</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>EduDAO Agent — Academic Governance</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>Institutional DAO · On-chain voting · Treasury management</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#EAB30822", color: "#EAB308", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "proposals" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Active", MOCK_PROPOSALS.filter(p => p.status === "ACTIVE").length, "#FFD700"], ["Passed", MOCK_PROPOSALS.filter(p => p.status === "PASSED").length, "#00FF88"], ["Total Votes", MOCK_PROPOSALS.reduce((s, p) => s + p.votes, 0), "#3B82F6"]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Proposal</th><th>Category</th><th>Votes</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_PROPOSALS.map(p => (
                                <tr key={p.id} onClick={() => setSel(p)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === p.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent, fontSize: 11 }}>{p.id}</td>
                                    <td style={{ fontSize: 12 }}>{p.title}</td>
                                    <td><span style={{ color: CAT_COLORS[p.category], fontSize: 11 }}>{p.category}</span></td>
                                    <td style={{ fontFamily: S.mono, fontSize: 12 }}>{p.votes}/{p.quorum}</td>
                                    <td><span style={{ color: STATUS_COLORS[p.status], fontSize: 11 }}>● {p.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.title}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>{sel.institution} · {sel.proposer}</div>
                            {[["Category", sel.category], ["Votes", sel.votes + " / " + sel.quorum], ["For %", sel.forPct + "%"], ["Deadline", sel.deadline], ["Status", sel.status]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                                <div style={{ flex: sel.forPct, background: "#00FF8844", borderRadius: 6, padding: "4px 8px", textAlign: "center", fontSize: 11, color: "#00FF88" }}>FOR {sel.forPct}%</div>
                                <div style={{ flex: 100 - sel.forPct, background: "#EF444444", borderRadius: 6, padding: "4px 8px", textAlign: "center", fontSize: 11, color: "#EF4444" }}>AGAINST {100 - sel.forPct}%</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "live" && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                    <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                        <th style={{ padding: 6 }}>Time</th><th>Event</th><th>Proposal</th><th>Detail</th>
                    </tr></thead>
                    <tbody>{events.map((e, x) => (
                        <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                            <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                            <td style={{ color: e.type === "EXECUTED" ? S.accent2 : S.accent }}>{e.type}</td>
                            <td style={{ color: "#3B82F6" }}>{e.prop}</td>
                            <td style={{ fontSize: 11 }}>{e.detail}</td>
                        </tr>
                    ))}</tbody>
                </table>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Governance Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Draft Proposal", "2. Submit On-Chain", "3. Voting Period", "4. Quorum Check", "5. Execute"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📝", "⛓️", "🗳️", "📊", "⚡"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>EduDAO.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Proposal Submission", "1.0 BEZ / proposal", "+25 proposals/mo", "📝"],
                        ["Vote Casting", "0.01 BEZ / vote", "+3.2K votes/mo", "🗳️"],
                        ["Treasury Management", "0.5% AUM/yr", "850K BEZ TVL", "💰"],
                        ["Institution Onboarding", "10 BEZ / register", "12 institutions", "🏛️"],
                        ["Governance SaaS", "$399/mo per institution", "8 subscribers", "📊"],
                        ["Execution Service", "0.5 BEZ / execution", "+18 executions/mo", "⚡"],
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
            {tab === "metrics" && (
                <div>
                    <div style={{ background: S.card, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — EDUDAO</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="edudao" accentColor="#EAB308" />
                </div>
            )}
        </div>
    );
}
