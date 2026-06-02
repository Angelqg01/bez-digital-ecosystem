import { useState, useEffect } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── MOCK DATA ──────────────────────────────────────
const MOCK_LISTINGS = [
    { id: "LST-001", seller: "0xE1…3F", price: "2.5 ETH", item: "Vintage Watch", status: "ACTIVE", buyer: "—" },
    { id: "LST-002", seller: "0xE2…7A", price: "0.8 ETH", item: "GPU RX 7900", status: "SOLD", buyer: "0xF1…2B" },
    { id: "LST-003", seller: "0xE3…4D", price: "5.0 ETH", item: "Domain Name", status: "DISPUTED", buyer: "0xF2…9E" },
    { id: "LST-004", seller: "0xE4…9C", price: "1.2 ETH", item: "Art Print #42", status: "RESOLVED", buyer: "0xF3…1A" },
    { id: "LST-005", seller: "0xE5…2E", price: "0.3 ETH", item: "Gaming Chair", status: "CANCELLED", buyer: "—" },
];
const STATUS_COLORS = { ACTIVE: "#10B981", SOLD: "#3B82F6", DISPUTED: "#EF4444", RESOLVED: "#8B5CF6", CANCELLED: "#6B7280" };
const ABI_TEXT = `// P2PMarketplace.sol — Key functions
createListing(price, itemHash)
purchase(listingId) payable
confirmDelivery(listingId)
raiseDispute(listingId)
resolveDispute(listingId, winner)
cancelListing(listingId)
setPlatformFee(feeBps)
getSellerListings(seller)
getBuyerPurchases(buyer)
isListingActive(listingId)`;

const S = {
    bg: "#03060E", card: "#0C1628", border: "#0D2040",
    accent: "#6366F1", accent2: "#818CF8", text: "#E8F4FF",
    muted: "#3D5E80", mono: "'JetBrains Mono',monospace",
};

export default function P2PMarketplaceAgent() {
    const bridge = useAgentBridge('p2pmarketplace');
    const [tab, setTab] = useState("listings");
    const [sel, setSel] = useState(null);
    const [events, setEvents] = useState([
        { ts: Date.now(), msg: "LST-002 delivery confirmed — 0.78 ETH paid to seller (2.5% fee)" },
        { ts: Date.now() - 60000, msg: "LST-003 dispute raised by buyer 0xF2…9E" },
    ]);

    useEffect(() => {
        const id = setInterval(() => {
            const msgs = [
                "New listing LST-006: 'Mechanical Keyboard' — 0.15 ETH",
                "LST-001 purchased by 0xAA…55 — escrow locked 2.5 ETH",
                "LST-003 dispute resolved — buyer wins, 5.0 ETH refunded",
                "LST-005 cancelled by seller 0xE5…2E",
                "Platform fee updated: 2.5% → 3.0% by admin",
                "LST-004 resolved — seller received 1.17 ETH after fee",
                "New listing LST-007: 'Mining Rig 6x GPU' — 12.0 ETH",
            ];
            setEvents(ev => [{ ts: Date.now(), msg: msgs[Math.floor(Math.random() * msgs.length)] }, ...ev].slice(0, 50));
        }, 7000);
        return () => clearInterval(id);
    }, []);

    const TABS = [
        { id: "listings", label: "🛒 Listings" },
        { id: "live", label: "🔴 Live Feed" },
        { id: "pipeline", label: "🔄 Pipeline" },
        { id: "abi", label: "📄 ABI" },
        { id: "analytics", label: "📊 Analytics" },
        { id: "metrics", label: "📊 Metrics" },
    ];

    return (
        <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${S.accent},${S.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🛒</div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>P2P<span style={{ color: S.accent }}>Marketplace</span> Agent</h1>
                    <p style={{ margin: 0, color: S.muted, fontSize: 13 }}>Listings · Escrow · Disputes · Fee tracking</p>
                </div>
                <span style={{ marginLeft: "auto", background: "#10B981", color: "#000", borderRadius: 8, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>● LIVE</span>
            </div>

            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${S.border}`, paddingBottom: 8 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        style={{ background: tab === t.id ? S.accent : "transparent", color: tab === t.id ? "#000" : S.muted, border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "listings" && (
                <div style={{ display: "grid", gap: 10 }}>
                    {MOCK_LISTINGS.map(l => (
                        <div key={l.id} onClick={() => setSel(l)} style={{ background: S.card, border: `1px solid ${sel?.id === l.id ? S.accent : S.border}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: 12 }}>
                            <div>
                                <div style={{ fontFamily: S.mono, fontSize: 13, color: S.accent }}>{l.id}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{l.item}</div>
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>Price: {l.price} · Seller: {l.seller}</div>
                            <div style={{ fontSize: 12, color: S.muted }}>Buyer: {l.buyer}</div>
                            <span style={{ background: STATUS_COLORS[l.status] || S.muted, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{l.status}</span>
                        </div>
                    ))}
                </div>
            )}

            {tab === "live" && (
                <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, maxHeight: 500, overflowY: "auto" }}>
                    {events.map((e, i) => (
                        <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
                            <span style={{ color: S.accent, fontFamily: S.mono, marginRight: 10 }}>{new Date(e.ts).toLocaleTimeString()}</span>{e.msg}
                        </div>
                    ))}
                </div>
            )}

            {tab === "pipeline" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
                    {["ACTIVE", "SOLD", "DISPUTED", "RESOLVED", "CANCELLED"].map(st => (
                        <div key={st} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_COLORS[st] }} />
                                <span style={{ fontWeight: 700, fontSize: 13 }}>{st}</span>
                                <span style={{ marginLeft: "auto", fontFamily: S.mono, fontSize: 12, color: S.muted }}>{MOCK_LISTINGS.filter(l => l.status === st).length}</span>
                            </div>
                            {MOCK_LISTINGS.filter(l => l.status === st).map(l => (
                                <div key={l.id} style={{ background: S.bg, borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 12 }}>
                                    <span style={{ color: S.accent, fontFamily: S.mono }}>{l.id}</span> — {l.item}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {tab === "abi" && (
                <pre style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, fontFamily: S.mono, fontSize: 13, color: S.accent, whiteSpace: "pre-wrap", overflowX: "auto" }}>{ABI_TEXT}</pre>
            )}

            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                    {[
                        { label: "Listings", val: "5" },
                        { label: "Total Volume", val: "9.8 ETH" },
                        { label: "Disputes", val: "1" },
                        { label: "Platform Fee", val: "2.5%" },
                    ].map(m => (
                        <div key={m.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: S.accent }}>{m.val}</div>
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{m.label}</div>
                        </div>
                    ))}
                </div>
            )}
            {tab === "metrics" && (
                <div>
                    <div style={{ background: S.card, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 10, color: S.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>📊 REAL-TIME AGENT METRICS — P2PMARKETPLACE</div>
                        <div style={{ fontSize: 9, color: S.muted }}>{bridge.loading ? "⏳ Connecting..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected"}</div>
                    </div>
                    <AgentDetailPanel agentId="p2pmarketplace" accentColor="#6366F1" />
                </div>
            )}
        </div>
    );
}
