import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_EVENTS = [
    { id: "EVT-001", name: "Rock Fest 2026", venue: "Arena CDMX", organizer: "Live Nation MX", date: "2026-06-15", capacity: 15000, sold: 12340, tier: "MULTI", price: 85, currency: "BEZ", status: "ON_SALE", resaleActive: 890 },
    { id: "EVT-002", name: "EDM Summer Nights", venue: "Playa del Carmen Open", organizer: "Ultra MX", date: "2026-07-20", capacity: 8000, sold: 8000, tier: "VIP", price: 120, currency: "BEZ", status: "SOLD_OUT", resaleActive: 245 },
    { id: "EVT-003", name: "Liga MX Final", venue: "Estadio Azteca", organizer: "FMF", date: "2026-05-28", capacity: 87000, sold: 65200, tier: "GENERAL", price: 45, currency: "BEZ", status: "ON_SALE", resaleActive: 1230 },
    { id: "EVT-004", name: "Comedy Night: JuanPa", venue: "Teatro Metropolitan", organizer: "Ocesa", date: "2026-04-10", capacity: 3200, sold: 2980, tier: "PREMIUM", price: 65, currency: "BEZ", status: "ON_SALE", resaleActive: 78 },
    { id: "EVT-005", name: "Orquesta Sinfonica", venue: "Palacio de Bellas Artes", organizer: "INBA", date: "2026-08-05", capacity: 1800, sold: 420, tier: "BACKSTAGE", price: 150, currency: "BEZ", status: "UPCOMING", resaleActive: 0 },
    { id: "EVT-006", name: "eSports Grand Finals", venue: "Arena Monterrey", organizer: "ESL LATAM", date: "2026-09-12", capacity: 5000, sold: 0, tier: "GENERAL", price: 35, currency: "BEZ", status: "UPCOMING", resaleActive: 0 },
];

const STATUS_COLORS = { ON_SALE: "#00FF88", SOLD_OUT: "#EF4444", UPCOMING: "#FFD700", COMPLETED: "#3B82F6", CANCELLED: "#7C3AED" };

const CONTRACT_ABI = `// EventTicketNFT.sol  --  BeZhas Chain
// Tokenized event tickets with anti-scalping and refund

struct Event {
  string   name;
  string   venue;
  address  organizer;
  uint256  date;
  uint256  maxCapacity;
  uint256  sold;
  uint256  maxResaleMarkup;  // basis points
  bool     active;
  bool     cancelled;
}

struct Ticket {
  uint256    eventId;
  address    owner;
  TicketTier tier;           // GENERAL, VIP, PREMIUM, BACKSTAGE
  uint256    originalPrice;
  bool       used;
  bool       refunded;
  bool       forSale;
  uint256    resalePrice;
}

function createEvent(string name, string venue, uint256 date, uint256 maxCapacity, uint256 maxResaleMarkup) external returns (uint256);
function purchaseTicket(uint256 eventId, TicketTier tier) external payable returns (uint256);
function useTicket(uint256 ticketId) external;
function listForResale(uint256 ticketId, uint256 price) external;
function buyResale(uint256 ticketId) external payable;
function cancelEvent(uint256 eventId) external;
function refundTicket(uint256 ticketId) external;`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#E040FB", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function EventTicketAgent() {
    const bridge = useAgentBridge('eventticket');
    const [tab, setTab] = useState("events");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { time: "16:10:00", type: "TICKET_SOLD", event: "EVT-001", detail: "0xD4..A1 purchased VIP ticket for Rock Fest 2026" },
        { time: "16:05:00", type: "RESALE_LISTED", event: "EVT-003", detail: "Ticket #8821 listed for resale at 52 BEZ" },
        { time: "16:00:00", type: "TICKET_USED", event: "EVT-004", detail: "Ticket #3012 scanned at Teatro Metropolitan" },
    ]);

    useEffect(() => {
        const EVTS = ["TICKET_SOLD", "RESALE_LISTED", "RESALE_COMPLETED", "TICKET_USED", "REFUND_ISSUED", "EVENT_CREATED"];
        const iv = setInterval(() => {
            const e = MOCK_EVENTS[Math.floor(Math.random() * MOCK_EVENTS.length)];
            const ev = EVTS[Math.floor(Math.random() * EVTS.length)];
            setEvents(p => [{ time: new Date().toLocaleTimeString(), type: ev, event: e.id, detail: `${ev} -- ${e.name} (${e.venue})` }, ...p].slice(0, 30));
        }, 7000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "events", label: "🎫 Events" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const totalSold = MOCK_EVENTS.reduce((s, e) => s + e.sold, 0);
    const totalResale = MOCK_EVENTS.reduce((s, e) => s + e.resaleActive, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🎫</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>EventTicket Agent -- Tokenized Events</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>Ticket NFTs - Anti-scalping - Verified resale - Refunds</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#E040FB22", color: "#E040FB", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "events" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Tickets Sold", totalSold.toLocaleString(), S.accent], ["Resale Active", totalResale.toLocaleString(), S.accent2], ["Events", MOCK_EVENTS.length, "#FFD700"]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Event</th><th>Venue</th><th>Sold</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_EVENTS.map(e => (
                                <tr key={e.id} onClick={() => setSel(e)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === e.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent, fontSize: 11 }}>{e.id}</td>
                                    <td style={{ fontSize: 12 }}>{e.name}</td>
                                    <td style={{ fontSize: 12, color: S.muted }}>{e.venue}</td>
                                    <td style={{ fontFamily: S.mono, fontSize: 11 }}>{e.sold.toLocaleString()}/{e.capacity.toLocaleString()}</td>
                                    <td><span style={{ color: STATUS_COLORS[e.status], fontSize: 11 }}>● {e.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.name}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>{sel.venue} - {sel.organizer}</div>
                            {[["Date", sel.date], ["Price", sel.price + " " + sel.currency], ["Capacity", sel.capacity.toLocaleString()], ["Sold", sel.sold.toLocaleString()], ["Tier", sel.tier], ["Resale Active", sel.resaleActive]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12, background: S.accent + "11", borderRadius: 8, overflow: "hidden" }}>
                                <div style={{ height: 6, background: S.accent, width: Math.min(100, (sel.sold / sel.capacity * 100)) + "%", borderRadius: 8 }} />
                            </div>
                            <div style={{ textAlign: "center", color: S.muted, fontSize: 11, marginTop: 4 }}>Occupancy: {(sel.sold / sel.capacity * 100).toFixed(1)}%</div>
                        </div>
                    )}
                </div>
            )}

            {tab === "live" && (
                <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Event Type</th><th>Event</th><th>Detail</th>
                        </tr></thead>
                        <tbody>{events.map((e, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                                <td style={{ color: e.type === "TICKET_SOLD" ? S.accent2 : e.type === "REFUND_ISSUED" ? "#EF4444" : S.accent }}>{e.type}</td>
                                <td style={{ color: "#FFD700" }}>{e.event}</td>
                                <td style={{ fontSize: 11 }}>{e.detail}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Event Ticket Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Create Event", "2. Sell Tickets", "3. Resale Market", "4. Scan & Use", "5. Settlement"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["🎪", "🎫", "🔄", "📱", "💰"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    {["ON_SALE", "SOLD_OUT", "UPCOMING"].map(status => {
                        const items = MOCK_EVENTS.filter(e => e.status === status);
                        if (!items.length) return null;
                        return (
                            <div key={status} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: STATUS_COLORS[status] }}>● {status} ({items.length})</div>
                                {items.map(e => (
                                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span>{e.name} -- {e.venue}</span>
                                        <span style={{ fontFamily: S.mono, color: S.muted }}>{e.sold.toLocaleString()} sold - {e.resaleActive} resale</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>EventTicketNFT.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["Primary Ticket Sales", "0.5-2.0 BEZ / ticket", "+88K tickets/mo", "🎫"],
                        ["Resale Marketplace", "5% commission per resale", "+2.4K resales/mo", "🔄"],
                        ["Anti-Scalping Engine", "0.2 BEZ / verification", "+15K checks/mo", "🛡️"],
                        ["Event SaaS Platform", "$799/mo per organizer", "34 organizers", "🎪"],
                        ["Refund Processing", "0.1 BEZ / refund", "+1.2K refunds/mo", "💸"],
                        ["Analytics Dashboard", "$299/mo per venue", "18 venues", "📊"],
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
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — EVENTTICKET</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="eventticket" accentColor="#E040FB" />
                </div>
            )}
        </div>
    );
}
