import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_ELECTIONS = [
    { id: "ELEC-001", name: "Mayor 2026", status: "TALLIED", candidates: 4, voters: 1250, turnout: "68%", winner: "Alice Mendez" },
    { id: "ELEC-002", name: "City Council 2026", status: "VOTING", candidates: 8, voters: 3400, turnout: "42%", winner: "-" },
    { id: "ELEC-003", name: "School Board 2026", status: "REGISTRATION", candidates: 3, voters: 200, turnout: "-", winner: "-" },
    { id: "ELEC-004", name: "Water District Ref.", status: "CREATED", candidates: 0, voters: 0, turnout: "-", winner: "-" },
    { id: "ELEC-005", name: "Budget Referendum Q1", status: "CANCELLED", candidates: 2, voters: 0, turnout: "0%", winner: "-" },
];
const STATUS_COLORS = { CREATED: "#6B7280", REGISTRATION: "#F59E0B", VOTING: "#3B82F6", TALLIED: "#10B981", CANCELLED: "#EF4444" };
const ABI_TEXT = `// VotingSystem.sol — Key functions
createElection(nameHash, descriptionHash)
openRegistration(electionId, registrationDuration)
registerCandidate(electionId, candidateWallet, nameHash)
registerVoter(electionId, voterWallet)
startVoting(electionId, votingDuration)
castBallot(electionId, candidateIndex)
tallyResults(electionId)
cancelElection(electionId)
getElectionCandidates(electionId)
getCandidateVotes(electionId, candidateIndex)
isRegisteredVoter(electionId, voter)
hasVoted(electionId, voter)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#3B82F6", accent2: "#60A5FA", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function VotingSystemAgent() {
  const bridge = useAgentBridge("voting");
    const [tab, setTab] = useState("elections");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "ELEC-002 ballot cast by voter 0xD1…7A — candidateIdx 2" },
        { ts: Date.now() - 60000, msg: "ELEC-001 tally complete — winner: Alice Mendez (520 votes)" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New election ELEC-006 created: 'Parks & Recreation Board'",
                "ELEC-003 registration: candidate 0xC4… registered as 'David Ruiz'",
                "ELEC-002 ballot cast — voter 0xD5…3B, candidateIdx 0",
                "Voter registration: 15 new voters added to ELEC-003",
                "ELEC-002 turnout update: 45% (1,530 of 3,400 registered)",
                "ELEC-004 registration phase opened — 5-day window",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "elections", label: "🗳️ Elections" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Lifecycle" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🗳️</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>Voting<span style={{ color: S.accent }}>System</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Elections · Voter registration · Ballot casting · Tallying</p>
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

            {/* ── Elections Tab ── */}
            {tab === "elections" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_ELECTIONS.map(el => (
                        <div key={el.id} onClick={() => setSel(el)} style={{ background: S.card, border: `1px solid ${sel?.id === el.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{el.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{el.name}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>{el.candidates} candidates · {el.voters.toLocaleString()} voters</div>
                            <div style={{ fontSize: 12, color: S.muted }}>Turnout: {el.turnout} {el.winner !== "-" ? `· Winner: ${el.winner}` : ""}</div>
                            <span style={{ background: STATUS_COLORS[el.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{el.status}</span>
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

            {/* ── Lifecycle ── */}
            {tab === "pipeline" && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", padding: 32 }}>
                    {["CREATED", "REGISTRATION", "VOTING", "TALLIED"].map((st, i, a) => (
                        <div key={st} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ background: STATUS_COLORS[st], color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                                {st}<br /><span style={{ fontSize: 18 }}>{MOCK_ELECTIONS.filter(el => el.status === st).length}</span>
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
                        { label: "Total Elections", val: "5" },
                        { label: "Active Voting", val: "1" },
                        { label: "Total Voters", val: "4,850" },
                        { label: "Avg Turnout", val: "55%" },
                    ].map(m => (
                        <div key={m.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: S.accent }}>{m.val}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.label}</div>
                        </div>
                    ))}
                </div>
            )}
          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: S.card || S.panel, border: "1px solid " + (S.border), borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — VOTING
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/voting/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="voting" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
