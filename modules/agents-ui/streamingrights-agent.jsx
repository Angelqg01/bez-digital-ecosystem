import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_IPS = [
    { id: "IP-001", title: "Neon Nights", type: "FILM", holder: "Cine Soberano", licenses: 8, revenue: 245000, streams: "12.5M", territory: "GLOBAL", status: "ACTIVE", drmHash: "QmNeon...a3f" },
    { id: "IP-002", title: "Cumbia Electronica S1", type: "SERIES", holder: "Streaming MX", licenses: 12, revenue: 189000, streams: "8.2M", territory: "LATAM", status: "ACTIVE", drmHash: "QmCumb...b7e" },
    { id: "IP-003", title: "Aztec Beats Vol. 2", type: "MUSIC_ALBUM", holder: "DJ Azteca", licenses: 5, revenue: 67000, streams: "4.1M", territory: "GLOBAL", status: "ACTIVE", drmHash: "QmAztc...c9d" },
    { id: "IP-004", title: "Web3 Unplugged", type: "PODCAST", holder: "BeZhas Media", licenses: 3, revenue: 12500, streams: "1.8M", territory: "GLOBAL", status: "ACTIVE", drmHash: "QmW3Up...d2a" },
    { id: "IP-005", title: "Liga MX Final 2026", type: "LIVE_EVENT", holder: "FMF Digital", licenses: 15, revenue: 520000, streams: "45M", territory: "LATAM", status: "ACTIVE", drmHash: "QmLiga...e5f" },
    { id: "IP-006", title: "Indie Film: Raices", type: "FILM", holder: "Cine Indie MX", licenses: 0, revenue: 0, streams: "0", territory: "PENDING", status: "REGISTERED", drmHash: "QmRaic...f1b" },
];

const TYPE_COLORS = { FILM: "#3B82F6", SERIES: "#E040FB", MUSIC_ALBUM: "#FFD700", PODCAST: "#00FF88", LIVE_EVENT: "#EF4444" };
const STATUS_COLORS = { ACTIVE: "#00FF88", REGISTERED: "#FFD700", EXPIRED: "#7C3AED", REVOKED: "#EF4444" };

const CONTRACT_ABI = `// StreamingRightsMarket.sol  --  BeZhas Chain
// Marketplace for streaming and licensing rights

struct IntellectualProperty {
  string    title;
  MediaType mediaType;      // FILM, SERIES, MUSIC_ALBUM, PODCAST, LIVE_EVENT
  address   rightHolder;
  uint256   registeredAt;
  string    metadataURI;    // IPFS DRM proof
  uint256   totalLicenses;
  uint256   totalRevenue;
  bool      active;
}

struct License {
  uint256       ipId;
  address       licensee;
  uint256       pricePaid;
  uint256       startDate;
  uint256       endDate;
  string        territory;    // "LATAM", "GLOBAL", "EU"
  uint256       streamCap;    // 0 = unlimited
  uint256       streamsUsed;
  LicenseStatus status;
}

function registerIP(string title, MediaType mediaType, string metadataURI) external returns (uint256);
function createLicense(uint256 ipId, address licensee, uint256 startDate, uint256 endDate, string territory, uint256 streamCap) external payable returns (uint256);
function reportStreams(uint256 licenseId, uint256 streams) external;
function revokeLicense(uint256 licenseId) external;
function withdrawRevenue(uint256 ipId, uint256 amount) external;`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#E040FB", accent2: "#00FF88", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function StreamingRightsAgent() {
  const bridge = useAgentBridge("streamingrights");
    const [tab, setTab] = useState("catalog");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { time: "13:50:00", type: "LICENSE_CREATED", ip: "IP-005", detail: "New license for Liga MX Final 2026 -- LATAM territory" },
        { time: "13:45:00", type: "STREAMS_REPORTED", ip: "IP-001", detail: "2.1M streams reported for Neon Nights" },
        { time: "13:40:00", type: "REVENUE_WITHDRAWN", ip: "IP-003", detail: "DJ Azteca withdrew 15,000 BEZ" },
    ]);

    useEffect(() => {
        const EVTS = ["LICENSE_CREATED", "STREAMS_REPORTED", "REVENUE_WITHDRAWN", "IP_REGISTERED", "LICENSE_REVOKED"];
        const iv = setInterval(() => {
            const ip = MOCK_IPS[Math.floor(Math.random() * MOCK_IPS.length)];
            const ev = EVTS[Math.floor(Math.random() * EVTS.length)];
            setEvents(p => [{ time: new Date().toLocaleTimeString(), type: ev, ip: ip.id, detail: `${ev} -- ${ip.title} (${ip.holder})` }, ...p].slice(0, 30));
        }, 8000);
        return () => clearInterval(iv);
    }, []);

    const TABS = [
        { id: "catalog", label: "🎬 Catalog" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "contracts", label: "📄 Contracts" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    const totalRevenue = MOCK_IPS.reduce((s, ip) => s + ip.revenue, 0);
    const totalLicenses = MOCK_IPS.reduce((s, ip) => s + ip.licenses, 0);

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter',sans-serif", padding: 24 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>🎬</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>StreamingRights Agent -- IP Licensing Marketplace</h2>
                    <span style={{ color: S.muted, fontSize: 13 }}>IP registry - License management - Stream tracking - DRM proofs</span>
                </div>
                <span style={{ marginLeft: "auto", background: "#E040FB22", color: "#E040FB", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontFamily: S.mono }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? S.accent + "22" : S.card, color: tab === t.id ? S.accent : S.text, border: `1px solid ${tab === t.id ? S.accent : S.border}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>{t.label}</button>
                ))}
            </div>

            {tab === "catalog" && (
                <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 1fr" : "1fr", gap: 16 }}>
                    <div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {[["Total Revenue", totalRevenue.toLocaleString() + " BEZ", S.accent], ["Licenses", totalLicenses, S.accent2], ["IPs", MOCK_IPS.length, "#FFD700"]].map(([l, v, c]) => (
                                <div key={l} style={{ flex: 1, background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: S.mono }}>{v}</div>
                                    <div style={{ fontSize: 11, color: S.muted }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                                <th style={{ padding: 6 }}>ID</th><th>Title</th><th>Type</th><th>Licenses</th><th>Status</th>
                            </tr></thead>
                            <tbody>{MOCK_IPS.map(ip => (
                                <tr key={ip.id} onClick={() => setSel(ip)} style={{ borderBottom: `1px solid ${S.border}11`, cursor: "pointer", background: sel?.id === ip.id ? S.accent + "11" : "transparent" }}>
                                    <td style={{ padding: 6, fontFamily: S.mono, color: S.accent, fontSize: 11 }}>{ip.id}</td>
                                    <td style={{ fontSize: 12 }}>{ip.title}</td>
                                    <td><span style={{ color: TYPE_COLORS[ip.type], fontSize: 11 }}>{ip.type}</span></td>
                                    <td style={{ fontFamily: S.mono, fontSize: 11 }}>{ip.licenses}</td>
                                    <td><span style={{ color: STATUS_COLORS[ip.status], fontSize: 11 }}>● {ip.status}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {sel && (
                        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{sel.title}</h3>
                            <div style={{ color: S.muted, fontSize: 12, marginBottom: 12 }}>{sel.holder} - {sel.type}</div>
                            {[["Revenue", sel.revenue.toLocaleString() + " BEZ"], ["Licenses", sel.licenses], ["Streams", sel.streams], ["Territory", sel.territory], ["DRM Hash", sel.drmHash]].map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${S.border}11`, fontSize: 13 }}>
                                    <span style={{ color: S.muted }}>{k}</span><span style={{ fontFamily: S.mono, fontSize: 12 }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === "live" && (
                <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: S.mono }}>
                        <thead><tr style={{ color: S.muted, textAlign: "left", borderBottom: `1px solid ${S.border}` }}>
                            <th style={{ padding: 6 }}>Time</th><th>Event</th><th>IP</th><th>Detail</th>
                        </tr></thead>
                        <tbody>{events.map((e, x) => (
                            <tr key={x} style={{ borderBottom: `1px solid ${S.border}11` }}>
                                <td style={{ padding: 6, color: S.muted }}>{e.time}</td>
                                <td style={{ color: e.type === "LICENSE_CREATED" ? S.accent2 : S.accent }}>{e.type}</td>
                                <td style={{ color: "#FFD700" }}>{e.ip}</td>
                                <td style={{ fontSize: 11 }}>{e.detail}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}

            {tab === "pipeline" && (
                <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12, color: S.accent }}>Streaming Rights Pipeline</h3>
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {["1. Register IP", "2. DRM Proof", "3. Create License", "4. Stream & Report", "5. Revenue Settle"].map((s, i) => (
                            <div key={s} style={{ flex: 1, background: i < 3 ? S.accent + "22" : S.card, border: `1px solid ${i < 3 ? S.accent : S.border}`, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12 }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{["📝", "🔐", "📜", "📡", "💰"][i]}</div>
                                {s}
                            </div>
                        ))}
                    </div>
                    {["ACTIVE", "REGISTERED"].map(status => {
                        const items = MOCK_IPS.filter(ip => ip.status === status);
                        if (!items.length) return null;
                        return (
                            <div key={status} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: STATUS_COLORS[status] }}>● {status} ({items.length})</div>
                                {items.map(ip => (
                                    <div key={ip.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span>{ip.title} -- {ip.holder}</span>
                                        <span style={{ fontFamily: S.mono, color: S.muted }}>{ip.licenses} licenses - {ip.streams} streams</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "contracts" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, color: S.accent }}>StreamingRightsMarket.sol</h3>
                    <pre style={{ color: S.accent, fontSize: 12, fontFamily: S.mono, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{CONTRACT_ABI}</pre>
                </div>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                        ["IP Registration", "2.0 BEZ / registration", "+35 IPs/mo", "📝"],
                        ["License Sales", "3-5% commission", "+$1.03M GMV/mo", "📜"],
                        ["Stream Reporting API", "0.01 BEZ / 1K streams", "+72M streams/mo", "📡"],
                        ["Studio SaaS Platform", "$1,499/mo per studio", "8 studios", "🎬"],
                        ["DRM Verification", "0.2 BEZ / verify", "+12K verifications/mo", "🔐"],
                        ["Rights Analytics", "$399/mo per dashboard", "24 dashboards", "📊"],
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
                  📊 REAL-TIME AGENT METRICS — STREAMINGRIGHTS
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/streamingrights/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="streamingrights" accentColor={S.accent} />
            </div>
          )}

        </div>
    );
}
