import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_CLUBS = [
    { id: "FAN-001", name: "Club America FC", category: "Sports", members: 24500, polls: 18, rewardPool: 12000, currency: "BEZ", status: "ACTIVE", engagement: 87 },
    { id: "FAN-002", name: "DJ Azteca Fans", category: "Music", members: 8900, polls: 12, rewardPool: 4500, currency: "BEZ", status: "ACTIVE", engagement: 92 },
    { id: "FAN-003", name: "Chivas Nation", category: "Sports", members: 31200, polls: 25, rewardPool: 18000, currency: "BEZ", status: "ACTIVE", engagement: 78 },
    { id: "FAN-004", name: "ESL LATAM eSports", category: "eSports", members: 5600, polls: 8, rewardPool: 2800, currency: "BEZ", status: "ACTIVE", engagement: 95 },
    { id: "FAN-005", name: "Cine Soberano Club", category: "Film", members: 3200, polls: 6, rewardPool: 1500, currency: "BEZ", status: "ACTIVE", engagement: 71 },
    { id: "FAN-006", name: "Pumas UNAM Crew", category: "Sports", members: 15800, polls: 0, rewardPool: 0, currency: "BEZ", status: "NEW", engagement: 0 },
];

const CAT_COLORS = { Sports: "#3B82F6", Music: "#E040FB", eSports: "#EF4444", Film: "#FFD700", Art: "#00FF88" };
const STATUS_COLORS = { ACTIVE: "#00FF88", NEW: "#FFD700", PAUSED: "#7C3AED" };

const CONTRACT_ABI = `// FanTokenDAO.sol  --  BeZhas Chain
// Fan engagement governance for teams and artists

struct FanClub {
  string  name;
  string  category;        // "Sports", "Music", "eSports", "Film"
  address manager;
  uint256 totalMembers;
  uint256 totalPolls;
  uint256 rewardPool;
  bool    active;
}

struct Poll {
  uint256   clubId;
  string    question;
  string[]  options;
  uint256   startTime;
  uint256   endTime;
  bool      finalized;
  uint256   winningOption;
}

function createClub(string name, string category) external returns (uint256);
function joinClub(uint256 clubId) external;
function createPoll(uint256 clubId, string question, string[] options, uint256 duration) external returns (uint256);
function vote(uint256 pollId, uint256 optionIndex) external;
function finalizePoll(uint256 pollId) external;
function depositRewards(uint256 clubId) external payable;
function claimReward(uint256 clubId, uint256 amount) external;`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#E040FB", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function FanTokenAgent() {
    const bridge = useAgentBridge('fantoken');
    const [tab, setTab] = useState("clubs");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { time: "15:20:00", type: "VOTE_CAST", club: "FAN-001", detail: "0xC2..F9 voted on 'Jersey color 2027'" },
        { time: "15:15:00", type: "MEMBER_JOINED", club: "FAN-003", detail: "0xA1..D3 joined Chivas Nation" },
        { time: "15:10:00", type: "REWARD_CLAIMED", club: "FAN-002", detail: "DJ Azteca fan claimed 25 BEZ reward" },
    ]);

    useEffect(() => {
        const EVTS = ["VOTE_CAST", "MEMBER_JOINED", "POLL_CREATED", "POLL_FINALIZED", "REWARD_CLAIMED", "REWARD_DEPOSITED"];
        const iv = setInterval(() => {
            const c = MOCK_CLUBS[Math.floor(Math.random() * MOCK_CLUBS.length)];
            const ev = EVTS[Math.floor(Math.random() * EVTS.length)];
            setEvents(p => [{ time: new Date().toLocaleTimeString(), type: ev, club: c.id, detail: `${ev} -- ${c.name} (${c.category})` }, ...p].slice(0, 30));
        }, 6000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "clubs", label: "🏟️ Clubs" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const totalMembers = MOCK_CLUBS.reduce((s, c) => s + c.members, 0);
    const totalRewards = MOCK_CLUBS.reduce((s, c) => s + c.rewardPool, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🏟️</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>FanToken Agent -- Fan Governance DAO</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>Fan clubs - Polls & voting - Engagement rewards</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#E040FB22", color: "#E040FB", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "clubs" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Total Fans", totalMembers.toLocaleString(), S.accent], ["Reward Pools", totalRewards.toLocaleString() + " BEZ", S.accent2], ["Clubs", MOCK_CLUBS.length, "#FFD700"]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Club</th><th>Category</th><th>Members</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_CLUBS.map(c => (
                                <tr key={c.id} onClick={() => setSel(c)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === c.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent, fontSize: 11 }}>{c.id}</td>
                                    <td style={{ fontSize: 12 }}>{c.name}</td>
                                    <td><span style={{ color: CAT_COLORS[c.category], fontSize: 11 }}>{c.category}</span></td>
                                    <td style={{ fontFamily: S.mono, fontSize: 11 }}>{c.members.toLocaleString()}</td>
                                    <td><span style={{ color: STATUS_COLORS[c.status], fontSize: 11 }}>● {c.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.name}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>{sel.category}</div>
                            {[["Members", sel.members.toLocaleString()], ["Polls", sel.polls], ["Reward Pool", sel.rewardPool.toLocaleString() + " " + sel.currency], ["Engagement", sel.engagement + "%"]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: S.accent + "11", borderRadius: 8, overflow: "hidden" }}>
                                <div style={{ height: 6, background: sel.engagement > 80 ? S.accent2 : S.accent, width: sel.engagement + "%", borderRadius: 8 }} />
                            </div>
                            <div style={{ textAlign: "center", color: S.muted, fontSize: 11, marginTop: 4 }}>Engagement Score: {sel.engagement}%</div>
                        </div>
                    )}
                </div>
            )}

            {tab === "live" && (
                <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Event</th><th>Club</th><th>Detail</th>
                        </tr></thead>
                        <tbody>{events.map((e, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                                <td style={{ color: e.type === "REWARD_CLAIMED" ? S.accent2 : S.accent }}>{e.type}</td>
                                <td style={{ color: "#FFD700" }}>{e.club}</td>
                                <td style={{ fontSize: 11 }}>{e.detail}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Fan Engagement Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Create Club", "2. Onboard Fans", "3. Run Polls", "4. Vote & Engage", "5. Claim Rewards"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["🏟️", "👥", "📊", "🗳️", "🏆"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    {["ACTIVE", "NEW"].map(status => {
                        const items = MOCK_CLUBS.filter(c => c.status === status);
                        if (!items.length) return null;
                        return (
                            <div key={status} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: STATUS_COLORS[status] }}>● {status} ({items.length})</div>
                                {items.map(c => (
                                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span>{c.name} -- {c.category}</span>
                                        <span style={{ fontFamily: S.mono, color: S.muted }}>{c.members.toLocaleString()} fans - {c.polls} polls</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>FanTokenDAO.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Fan Membership", "0.5 BEZ / join", "+3.2K new fans/mo", "👥"],
                        ["Poll Creation", "2.0 BEZ / poll", "+45 polls/mo", "📊"],
                        ["Engagement Rewards", "Variable per club", "+38K BEZ rewarded/mo", "🏆"],
                        ["Club SaaS Platform", "$599/mo per team/artist", "22 clubs", "🏟️"],
                        ["Merchandise Voting", "1.0 BEZ / merch vote", "+5K votes/mo", "🗳️"],
                        ["Fan Analytics", "$199/mo per dashboard", "15 dashboards", "📈"],
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — FANTOKEN</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="fantoken" accentColor="#E040FB" />
                </div>
            )}
        </div>
    );
}
