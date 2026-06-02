import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_COURSES = [
    { id: "CRS-001", title: "Blockchain Fundamentals", institution: "TecMilenio", instructor: "Dr. Ricardo Vega", students: 342, price: 25, currency: "BEZ", duration: "8 semanas", level: "Beginner", status: "ACTIVE", completionRate: 78, nftsMinted: 267 },
    { id: "CRS-002", title: "Smart Contract Security", institution: "UNAM Online", instructor: "Ing. María López", students: 189, price: 40, currency: "BEZ", duration: "12 semanas", level: "Advanced", status: "ACTIVE", completionRate: 62, nftsMinted: 117 },
    { id: "CRS-003", title: "DeFi Protocol Design", institution: "BeZhas Academy", instructor: "Prof. Carlos Ruiz", students: 524, price: 35, currency: "BEZ", duration: "10 semanas", level: "Intermediate", status: "ACTIVE", completionRate: 71, nftsMinted: 372 },
    { id: "CRS-004", title: "Tokenomics Masterclass", institution: "Platzi Web3", instructor: "Ana Martínez PhD", students: 156, price: 50, currency: "BEZ", duration: "6 semanas", level: "Advanced", status: "ACTIVE", completionRate: 85, nftsMinted: 133 },
    { id: "CRS-005", title: "Supply Chain on Blockchain", institution: "IPN Virtual", instructor: "Ing. Pedro Sánchez", students: 278, price: 30, currency: "BEZ", duration: "8 semanas", level: "Intermediate", status: "COMPLETED", completionRate: 91, nftsMinted: 253 },
    { id: "CRS-006", title: "Web3 UX Design", institution: "Domestika Web3", instructor: "Lucía Fernández", students: 412, price: 20, currency: "BEZ", duration: "4 semanas", level: "Beginner", status: "UPCOMING", completionRate: 0, nftsMinted: 0 },
];

const LEVEL_COLORS = { Beginner: "#00FF88", Intermediate: "#FFD700", Advanced: "#EF4444" };
const STATUS_COLORS = { ACTIVE: "#00FF88", COMPLETED: "#3B82F6", UPCOMING: "#FFD700", PAUSED: "#7C3AED" };

const CONTRACT_ABI = `// CourseTokenNFT.sol  —  BeZhas Chain
// Tokenized courses with completion certificates as NFTs

struct Course {
  string   title;
  string   institution;
  address  instructor;
  uint256  price;          // in BEZ
  uint256  maxStudents;
  uint256  enrolled;
  uint256  startDate;
  bool     active;
}

struct Certificate {
  uint256  courseId;
  address  student;
  uint256  completedAt;
  uint256  score;          // 0-100
  string   metadataURI;
}

function createCourse(string title, string institution, uint256 price, uint256 maxStudents, uint256 startDate) external returns (uint256);
function enrollStudent(uint256 courseId) external payable;
function issueCertificate(uint256 courseId, address student, uint256 score, string metadataURI) external returns (uint256);
function verifyCertificate(uint256 certId) external view returns (Certificate memory);`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#3B82F6", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function CourseTokenAgent() {
    const bridge = useAgentBridge('coursetoken');
    const [tab, setTab] = useState("courses");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { time: "15:35:00", type: "ENROLLED", course: "CRS-001", detail: "0xA3..F2 enrolled in Blockchain Fundamentals" },
        { time: "15:30:00", type: "CERT_MINTED", course: "CRS-003", detail: "NFT #372 minted — DeFi Protocol Design" },
        { time: "15:25:00", type: "COURSE_CREATED", course: "CRS-006", detail: "Web3 UX Design registered by Domestika Web3" },
    ]);

    useEffect(() => {
        const EVTS = ["ENROLLED", "CERT_MINTED", "SCORE_UPDATED", "COURSE_CREATED", "PAYMENT_RECEIVED"];
        const iv = setInterval(() => {
            const c = MOCK_COURSES[Math.floor(Math.random() * MOCK_COURSES.length)];
            const ev = EVTS[Math.floor(Math.random() * EVTS.length)];
            setEvents(p => [{ time: new Date().toLocaleTimeString(), type: ev, course: c.id, detail: `${ev} — ${c.title} (${c.institution})` }, ...p].slice(0, 30));
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "courses", label: "📚 Courses" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const totalStudents = MOCK_COURSES.reduce((s, c) => s + c.students, 0);
    const totalCerts = MOCK_COURSES.reduce((s, c) => s + c.nftsMinted, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>📚</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>CourseToken Agent — Tokenized Education</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>Course NFTs · Certificate minting · On-chain enrollment</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#3B82F622", color: "#3B82F6", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "courses" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Students", totalStudents.toLocaleString(), S.accent], ["Certificates", totalCerts.toLocaleString(), S.accent2], ["Courses", MOCK_COURSES.length, "#FFD700"]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Title</th><th>Institution</th><th>Level</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_COURSES.map(c => (
                                <tr key={c.id} onClick={() => setSel(c)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === c.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent, fontSize: 11 }}>{c.id}</td>
                                    <td style={{ fontSize: 12 }}>{c.title}</td>
                                    <td style={{ fontSize: 12, color: S.muted }}>{c.institution}</td>
                                    <td><span style={{ color: LEVEL_COLORS[c.level], fontSize: 11 }}>{c.level}</span></td>
                                    <td><span style={{ color: STATUS_COLORS[c.status], fontSize: 11 }}>● {c.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.title}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>{sel.institution} · {sel.instructor}</div>
                            {[["Price", sel.price + " " + sel.currency], ["Duration", sel.duration], ["Students", sel.students], ["Completion Rate", sel.completionRate + "%"], ["NFTs Minted", sel.nftsMinted], ["Level", sel.level]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: S.accent + "11", borderRadius: 8, overflow: "hidden" }}>
                                <div style={{ height: 6, background: S.accent, width: sel.completionRate + "%", borderRadius: 8 }} />
                            </div>
                            <div style={{ textAlign: "center", color: S.muted, fontSize: 11, marginTop: 4 }}>Completion: {sel.completionRate}%</div>
                        </div>
                    )}
                </div>
            )}

            {tab === "live" && (
                <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Event</th><th>Course</th><th>Detail</th>
                        </tr></thead>
                        <tbody>{events.map((e, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                                <td style={{ color: e.type === "CERT_MINTED" ? S.accent2 : S.accent }}>{e.type}</td>
                                <td style={{ color: "#FFD700" }}>{e.course}</td>
                                <td style={{ fontSize: 11 }}>{e.detail}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Education Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Create Course", "2. Enroll Students", "3. Complete Modules", "4. Issue Certificate", "5. Verify On-Chain"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📝", "👩‍🎓", "📖", "🎓", "✅"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    {["ACTIVE", "COMPLETED", "UPCOMING"].map(status => {
                        const items = MOCK_COURSES.filter(c => c.status === status);
                        if (!items.length) return null;
                        return (
                            <div key={status} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: STATUS_COLORS[status] }}>● {status} ({items.length})</div>
                                {items.map(c => (
                                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span>{c.title} — {c.institution}</span>
                                        <span style={{ fontFamily: S.mono, color: S.muted }}>{c.students} students · {c.nftsMinted} certs</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>CourseTokenNFT.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Course Enrollment", "0.5 BEZ / enrollment", "+1.9K enrollments/mo", "👩‍🎓"],
                        ["Certificate NFTs", "1.0 BEZ / cert mint", "+1.1K certs/mo", "🎓"],
                        ["Verification API", "0.1 BEZ / verify", "+5K queries/mo", "✅"],
                        ["Institutional SaaS", "$499/mo per institution", "12 institutions", "🏛️"],
                        ["Credential Marketplace", "2.5% commission", "+$45K GMV/mo", "🛒"],
                        ["Analytics Dashboard", "$199/mo per dashboard", "28 dashboards", "📊"],
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — COURSETOKEN</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="coursetoken" accentColor="#3B82F6" />
                </div>
            )}
        </div>
    );
}
