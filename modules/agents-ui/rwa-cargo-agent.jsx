import { useState, useEffect, useRef, useCallback } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

// ─── COMMODITY DATA ───────────────────────────────────────────────────────────
const COMMODITIES = [
  { id: "brent", symbol: "BRENT", name: "Brent Crude Oil", icon: "🛢️", unit: "barrel", unitShort: "bbl", price: 83.42, change: +1.24, category: "Energy", color: "#FF6B35", hs: "2709.00.10", vessel: "NORDIC CROWN", bl: "NC-2025-003291", origin: "SA-RAS", dest: "ES-ALG", cargoTons: 80000, teus: null },
  { id: "wheat", symbol: "WHEAT", name: "Hard Red Winter Wheat", icon: "🌾", unit: "bushel", unitShort: "bu", price: 5.84, change: -0.12, category: "Grains", color: "#FFD700", hs: "1001.99.00", vessel: "CARGILL AMBITION", bl: "CA-2025-007812", origin: "US-NEW", dest: "EG-ALX", cargoTons: 55000, teus: null },
  { id: "copper", symbol: "COPPER", name: "Copper Cathodes Grade A", icon: "🔶", unit: "metric ton", unitShort: "MT", price: 9847.50, change: +124.30, category: "Metals", color: "#F5A623", hs: "7403.11.00", vessel: "BULK HELLAS", bl: "BH-2025-001144", origin: "CL-ANT", dest: "CN-QIN", cargoTons: 25000, teus: null },
  { id: "lng", symbol: "LNG", name: "Liquefied Natural Gas", icon: "💨", unit: "MMBtu", unitShort: "MMBtu", price: 2.31, change: -0.08, category: "Energy", color: "#00E5FF", hs: "2711.11.00", vessel: "PRISM COURAGE", bl: "PC-2025-000881", origin: "QA-RAS", dest: "JP-TOK", cargoTons: 62000, teus: null },
  { id: "gold", symbol: "GOLD", name: "Gold Bullion (LBMA)", icon: "🥇", unit: "troy oz", unitShort: "ozt", price: 3042.80, change: +18.50, category: "Precious", color: "#FFD700", hs: "7108.12.00", vessel: "SECURE TRADER", bl: "ST-2025-000042", origin: "ZA-DUR", dest: "GB-LON", cargoTons: 12, teus: null },
  { id: "coffee", symbol: "COFFEE", name: "Arabica Coffee C (ICO)", icon: "☕", unit: "lb", unitShort: "lb", price: 3.28, change: +0.14, category: "Softs", color: "#8B4513", hs: "0901.11.00", vessel: "EVER GOLDEN", bl: "EG-2025-009933", origin: "BR-SAN", dest: "DE-HAM", cargoTons: 9800, teus: 320 },
  { id: "iron", symbol: "IRON", name: "Iron Ore (62% Fe CFR)", icon: "⚙️", unit: "metric ton", unitShort: "MT", price: 108.45, change: -2.10, category: "Metals", color: "#90A4AE", hs: "2601.11.00", vessel: "VALE BRASIL", bl: "VB-2025-005501", origin: "BR-TUB", dest: "CN-BHI", cargoTons: 300000, teus: null },
  { id: "soy", symbol: "SOY", name: "Soybean (CBOT)", icon: "🫘", unit: "bushel", unitShort: "bu", price: 10.52, change: +0.23, category: "Grains", color: "#8BC34A", hs: "1201.90.00", vessel: "GOLDEN HORIZON", bl: "GH-2025-006672", origin: "AR-RSR", dest: "CN-NAN", cargoTons: 63000, teus: null },
];

const POOL_DATA = [
  { pair: "BEZ/USDC", tvl: 2840000, vol24h: 412000, apy: 18.4, fee: 0.05, token0: "BEZ", token1: "USDC" },
  { pair: "CARGO-BRENT/USDC", tvl: 980000, vol24h: 124000, apy: 12.1, fee: 0.3, token0: "CARGO-BRENT", token1: "USDC" },
  { pair: "CARGO-GOLD/USDT", tvl: 3200000, vol24h: 880000, apy: 8.4, fee: 0.05, token0: "CARGO-GOLD", token1: "USDT" },
  { pair: "CARGO-COPPER/BEZ", tvl: 560000, vol24h: 71000, apy: 24.2, fee: 0.3, token0: "CARGO-COPPER", token1: "BEZ" },
];

const MINTED_TOKENS = [
  { tokenId: "CARGO-BRENT-0001", commodity: "Brent Crude", qty: "80,000 bbl", totalValue: 6673600, fractions: 100000, pricePerFraction: 66.74, sold: 78, holder: "0x7f3a...c4e2", mintDate: "2025-03-10", expiry: "2025-06-10", status: "TRADING" },
  { tokenId: "CARGO-GOLD-0041", commodity: "Gold Bullion", qty: "12 MT", totalValue: 36513600, fractions: 500000, pricePerFraction: 73.03, sold: 62, holder: "0x2b8d...f901", mintDate: "2025-03-08", expiry: "2025-09-08", status: "TRADING" },
  { tokenId: "CARGO-COPPER-0012", commodity: "Copper Cathodes", qty: "25,000 MT", totalValue: 246187500, fractions: 1000000, pricePerFraction: 246.19, sold: 34, holder: "0xa12c...8834", mintDate: "2025-03-12", expiry: "2025-07-12", status: "TRADING" },
  { tokenId: "CARGO-WHEAT-0008", commodity: "Wheat HRW", qty: "55,000 MT", totalValue: 11759040, fractions: 200000, pricePerFraction: 58.80, sold: 91, holder: "0x5e9f...2217", mintDate: "2025-03-05", expiry: "2025-06-05", status: "REDEEMED" },
];

const fmt = (n, dec = 0) => n?.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: dec });
const fmtN = (n) => n?.toLocaleString("en-US");

// ─── MINI SPARKLINE ───────────────────────────────────────────────────────────
function Sparkline({ color, up }) {
  const pts = Array.from({ length: 20 }, (_, i) => {
    const base = 50 + (up ? i * 0.8 : -i * 0.5);
    return base + (Math.random() - 0.5) * 12;
  });
  const min = Math.min(...pts), max = Math.max(...pts);
  const norm = pts.map(p => 100 - ((p - min) / (max - min)) * 80 + 10);
  const d = norm.map((y, i) => `${i === 0 ? "M" : "L"} ${(i / 19) * 80} ${y}`).join(" ");
  return (
    <svg width={80} height={32} style={{ opacity: 0.8 }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function RWACargoAgent() {
  const bridge = useAgentBridge("rwa-cargo");
  const [tab, setTab] = useState("market");
  const [selected, setSelected] = useState(COMMODITIES[0]);
  const [mintStep, setMintStep] = useState(0);
  const [mintFractions, setMintFractions] = useState(10000);
  const [mintResult, setMintResult] = useState(null);
  const [tokens, setTokens] = useState(MINTED_TOKENS);
  const [prices, setPrices] = useState(COMMODITIES.reduce((a, c) => ({ ...a, [c.id]: c.price }), {}));
  const [log, setLog] = useState([
    "[ 07:00:01 ] RWA Cargo Agent INITIALIZED",
    "[ 07:00:02 ] Bloomberg Commodity API → CONNECTED",
    "[ 07:00:02 ] CME Group Futures Feed → LIVE",
    "[ 07:00:03 ] BeZhasRWAFactory.sol → LOADED",
    "[ 07:00:03 ] QualityOracle.sol → ACTIVE",
    "[ 07:00:04 ] QuickSwap V3 Router → CONNECTED",
    "[ 07:00:04 ] LayerZero Bridge → READY",
    "[ 07:00:05 ] Watching 8 commodity markets",
  ]);
  const [bezRevenue, setBezRevenue] = useState(14.8821);
  const [tvlTotal, setTvlTotal] = useState(48312400);

  const addLog = useCallback((msg) => {
    const ts = new Date().toTimeString().slice(0, 8);
    setLog(p => [`[ ${ts} ] ${msg}`, ...p].slice(0, 50));
  }, []);

  // Live price simulation
  useEffect(() => {
    const t = setInterval(() => {
      setPrices(prev => Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, +(v * (1 + (Math.random() - 0.499) * 0.002)).toFixed(v < 10 ? 4 : v < 100 ? 2 : 0)])
      ));
      setTvlTotal(p => +(p + (Math.random() - 0.4) * 5000));
      setBezRevenue(p => +(p + Math.random() * 0.01).toFixed(4));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const msgs = [
      `Bloomberg: ${selected.symbol} price updated → ${fmt(prices[selected.id], 2)}`,
      "QualityOracle: cargo valuation recalculated",
      `QuickSwap V3: pool ${POOL_DATA[Math.floor(Math.random() * POOL_DATA.length)].pair} rebalanced`,
      "LayerZero: cross-chain token transfer confirmed",
      `Chainlink: ${["OIL/USD", "XAU/USD", "COPPER/USD", "WHEAT/USD"][Math.floor(Math.random() * 4)]} feed updated`,
    ];
    const t = setInterval(() => addLog(msgs[Math.floor(Math.random() * msgs.length)]), 4500);
    return () => clearInterval(t);
  }, [selected, prices, addLog]);

  const calcCargoValue = (c) => {
    const p = prices[c.id] || c.price;
    if (c.id === "brent") return p * c.cargoTons * 7.33;
    if (c.id === "wheat" || c.id === "soy") return p * c.cargoTons * 36.744;
    if (c.id === "lng") return p * c.cargoTons * 52.0;
    if (c.id === "coffee") return p * c.cargoTons * 2204.62;
    return p * c.cargoTons;
  };

  const doMint = () => {
    setMintStep(1);
    setMintResult(null);
    const cargoVal = calcCargoValue(selected);
    const pricePerFrac = cargoVal / mintFractions;
    addLog(`🚀 Tokenizing ${selected.name} cargo — ${fmtN(mintFractions)} fractions`);
    const steps = [
      [1, 700,  `Fetching live price from Bloomberg: ${fmt(prices[selected.id], 2)} per ${selected.unitShort}`],
      [2, 1600, `Computing cargo value: ${fmt(cargoVal)} total`],
      [3, 2600, `Verifying Bill of Lading hash on QualityOracle...`],
      [4, 3700, `Minting ${fmtN(mintFractions)} ERC-1155 fractions on Polygon...`],
      [5, 4900, `Adding liquidity to QuickSwap V3 pool...`],
      [5.5, 5500, `Bridging tokens to BNB Chain via LayerZero...`],
      [6, 6400, `✅ CARGO-${selected.symbol}-00${tokens.length + 1} LIVE — ${fmt(pricePerFrac, 2)}/fraction`],
    ];
    steps.forEach(([step, delay, msg]) => {
      setTimeout(() => {
        setMintStep(Math.floor(step));
        addLog(msg);
        if (step === 6) {
          const newToken = {
            tokenId: `CARGO-${selected.symbol}-00${(tokens.length + 1).toString().padStart(2, "0")}`,
            commodity: selected.name,
            qty: `${fmtN(selected.cargoTons)} ${selected.id === "gold" ? "KG" : "MT"}`,
            totalValue: cargoVal,
            fractions: mintFractions,
            pricePerFraction: pricePerFrac,
            sold: 0,
            holder: "0x52Df...44E",
            mintDate: new Date().toISOString().slice(0, 10),
            expiry: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
            status: "TRADING",
          };
          setTokens(p => [newToken, ...p]);
          setMintResult(newToken);
          setBezRevenue(p => +(p + cargoVal * 0.02 / 100000).toFixed(4));
          setTimeout(() => setMintStep(0), 3000);
        }
      }, delay);
    });
  };

  const C = {
    bg: "#010810", panel: "#040D16", border: "rgba(15,60,90,0.5)",
    accent: "#00D4AA", gold: "#FFB700", red: "#FF4560",
    dim: "#081420", bright: "#E0F0FF",
  };

  const TABS = [
    { id: "market",   label: "COMMODITY MARKET", icon: "📊" },
    { id: "tokenize", label: "TOKENIZE CARGO",   icon: "🪙" },
    { id: "portfolio",label: "ACTIVE TOKENS",    icon: "📋" },
    { id: "defi",     label: "QUICKSWAP POOLS",  icon: "🔄" },
    { id: "oracle",   label: "ORACLE & CHAIN",   icon: "⛓️" },
        { id: "metrics", label: "📊 Metrics" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#8AB0C0", fontFamily: "'Courier New', monospace", fontSize: 12, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes slide { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes progress { from{width:0%} to{width:100%} }
        @keyframes flash { 0%,100%{background:transparent} 50%{background:rgba(0,212,170,0.08)} }
        .row:hover { background: rgba(0,212,170,0.04) !important; cursor: pointer; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,170,0.15); }
      `}</style>

      {/* ── TICKER ── */}
      <div style={{ background: "#020C14", borderBottom: `1px solid ${C.border}`, padding: "5px 0", overflow: "hidden", height: 24 }}>
        <div style={{ display: "flex", animation: "ticker 30s linear infinite", whiteSpace: "nowrap", width: "200%" }}>
          {[...COMMODITIES, ...COMMODITIES].map((c, i) => {
            const p = prices[c.id] || c.price;
            const chg = ((p - c.price) / c.price * 100).toFixed(2);
            const up = parseFloat(chg) >= 0;
            return (
              <span key={i} style={{ padding: "0 24px", fontSize: 10, color: up ? C.accent : C.red, display: "inline-flex", gap: 6 }}>
                <span style={{ color: "#2A5A70" }}>{c.icon}</span>
                <span style={{ color: "#5A8A9A" }}>{c.symbol}</span>
                <span>{c.id === "gold" ? fmt(p, 2) : c.id === "copper" || c.id === "iron" ? fmt(p, 2) : `$${p.toFixed(2)}`}</span>
                <span>{up ? "▲" : "▼"}{Math.abs(chg)}%</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ── HEADER ── */}
      <div style={{ background: "#020C14", borderBottom: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 24 }}>📦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.accent, letterSpacing: 3 }}>RWA CARGO AGENT</div>
            <div style={{ fontSize: 9, color: "#0A2A3A", letterSpacing: 2 }}>BEZHAS · PHYSICAL CARGO TOKENIZATION · BLOOMBERG API · QUICKSWAP V3</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginLeft: "auto", flexWrap: "wrap" }}>
          {[
            { l: "TVL TOKENIZED",   v: fmt(tvlTotal),                 c: C.gold },
            { l: "ACTIVE TOKENS",   v: tokens.filter(t => t.status === "TRADING").length, c: C.accent },
            { l: "BEZ MGMT FEE",    v: bezRevenue.toFixed(4) + " BEZ", c: "#FFD700" },
            { l: "BLOOMBERG FEED",  v: "● LIVE",                       c: C.accent, blink: true },
          ].map(({ l, v, c, blink }) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#0A2A3A", letterSpacing: 1 }}>{l}</div>
              <div style={{ color: c, fontWeight: 700, fontSize: 13, animation: blink ? "blink 2s infinite" : "none" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", background: "#020C14", borderBottom: `1px solid ${C.border}`, padding: "0 20px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "9px 16px", background: "none", border: "none",
            borderBottom: `2px solid ${tab === t.id ? C.accent : "transparent"}`,
            color: tab === t.id ? C.accent : "#0A2A3A",
            cursor: "pointer", fontSize: 10, fontFamily: "inherit", letterSpacing: 1,
            fontWeight: tab === t.id ? 700 : 400, transition: "all 0.15s",
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

          {/* ══ MARKET TAB ══ */}
          {tab === "market" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: C.accent, fontSize: 10, letterSpacing: 2 }}>COMMODITY MARKETS — BLOOMBERG REAL-TIME</span>
                    <span style={{ fontSize: 9, color: "#0A2A3A" }}>Click para seleccionar y tokenizar</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.4)" }}>
                        {["COMMODITY", "PRICE", "24H", "CARGO QTY", "CARGO VALUE", "VESSEL / B/L", "HS CODE", "CHART", "ACTION"].map(h => (
                          <th key={h} style={{ padding: "6px 10px", fontSize: 8, color: "#0A2A3A", letterSpacing: 1, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMMODITIES.map((c, i) => {
                        const p = prices[c.id] || c.price;
                        const chg = ((p - c.price) / c.price * 100);
                        const cargoVal = calcCargoValue(c);
                        const isSelected = selected?.id === c.id;
                        return (
                          <tr key={i} className="row" onClick={() => setSelected(c)}
                            style={{ borderTop: `1px solid ${C.border}22`, background: isSelected ? `${c.color}08` : i % 2 ? "rgba(0,0,0,0.15)" : "transparent", borderLeft: isSelected ? `2px solid ${c.color}` : "2px solid transparent", transition: "all 0.1s" }}>
                            <td style={{ padding: "8px 10px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 16 }}>{c.icon}</span>
                                <div>
                                  <div style={{ color: isSelected ? C.bright : "#A0C0D0", fontWeight: 700, fontSize: 11 }}>{c.symbol}</div>
                                  <div style={{ color: "#0A2A3A", fontSize: 9 }}>{c.category}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "8px 10px", fontFamily: "monospace", color: C.bright, fontWeight: 700, animation: "flash 0.5s" }}>
                              {p >= 1000 ? fmt(p, 2) : p >= 100 ? `$${p.toFixed(2)}` : `$${p.toFixed(4)}`}
                            </td>
                            <td style={{ padding: "8px 10px", color: chg >= 0 ? C.accent : C.red, fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>
                              {chg >= 0 ? "▲" : "▼"}{Math.abs(chg).toFixed(2)}%
                            </td>
                            <td style={{ padding: "8px 10px", color: "#5A8A9A", fontSize: 10 }}>
                              {fmtN(c.cargoTons)} {c.id === "gold" ? "KG" : "MT"}
                            </td>
                            <td style={{ padding: "8px 10px", color: C.gold, fontFamily: "monospace", fontWeight: 700, fontSize: 11 }}>
                              {cargoVal >= 1e9 ? `$${(cargoVal / 1e9).toFixed(2)}B` : cargoVal >= 1e6 ? `$${(cargoVal / 1e6).toFixed(1)}M` : fmt(cargoVal)}
                            </td>
                            <td style={{ padding: "8px 10px", fontSize: 9 }}>
                              <div style={{ color: "#4A7A8A" }}>{c.vessel}</div>
                              <div style={{ color: "#0A2A3A" }}>{c.bl}</div>
                            </td>
                            <td style={{ padding: "8px 10px", color: "#0A2A3A", fontFamily: "monospace", fontSize: 9 }}>{c.hs}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <Sparkline color={chg >= 0 ? C.accent : C.red} up={chg >= 0} />
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <button onClick={(e) => { e.stopPropagation(); setSelected(c); setTab("tokenize"); }}
                                style={{ padding: "4px 10px", background: `${c.color}18`, border: `1px solid ${c.color}44`, color: c.color, cursor: "pointer", fontFamily: "inherit", fontSize: 9, borderRadius: 2, whiteSpace: "nowrap" }}>
                                🪙 TOKENIZE
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Selected commodity detail */}
                {selected && (
                  <div style={{ background: C.panel, border: `1px solid ${selected.color}33`, borderRadius: 4, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 18 }}>{selected.icon} <span style={{ fontSize: 16, fontWeight: 700, color: C.bright }}>{selected.name}</span></div>
                        <div style={{ fontSize: 9, color: "#0A2A3A", marginTop: 3 }}>HS {selected.hs} | {selected.bl} | {selected.vessel}</div>
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: selected.color, fontFamily: "monospace" }}>
                        {fmt(prices[selected.id] || selected.price, 2)} <span style={{ fontSize: 12 }}>/{selected.unitShort}</span>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                      {[
                        ["CARGO QUANTITY", `${fmtN(selected.cargoTons)} ${selected.id === "gold" ? "KG" : "MT"}`],
                        ["TOTAL CARGO VALUE", fmt(calcCargoValue(selected))],
                        ["ROUTE", `${selected.origin} → ${selected.dest}`],
                        ["VESSEL", selected.vessel],
                      ].map(([l, v]) => (
                        <div key={l} style={{ background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 3 }}>
                          <div style={{ fontSize: 8, color: "#0A2A3A", letterSpacing: 1, marginBottom: 3 }}>{l}</div>
                          <div style={{ color: "#80B0C0", fontSize: 11 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setTab("tokenize")}
                      style={{ marginTop: 12, width: "100%", padding: "10px", background: `${selected.color}18`, border: `1px solid ${selected.color}66`, color: selected.color, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 2, borderRadius: 3 }}>
                      🪙 TOKENIZE THIS CARGO →
                    </button>
                  </div>
                )}
              </div>

              {/* Right panel: active tokens */}
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 14 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.gold }}>ACTIVE CARGO TOKENS</div>
                  {tokens.filter(t => t.status === "TRADING").map((t, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: C.accent, fontWeight: 700, fontSize: 10 }}>{t.tokenId}</span>
                        <span style={{ fontSize: 9, color: C.accent, animation: "blink 2s infinite" }}>● LIVE</span>
                      </div>
                      <div style={{ fontSize: 9, color: "#4A7A8A", marginTop: 2 }}>{t.commodity} — {t.qty}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                        <span style={{ fontSize: 9, color: "#0A2A3A" }}>{fmtN(t.fractions)} fractions</span>
                        <span style={{ fontSize: 9, color: C.gold, fontWeight: 700 }}>{fmt(t.pricePerFraction, 2)}/frac</span>
                      </div>
                      <div style={{ marginTop: 4, height: 3, background: "#0A1A28", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${t.sold}%`, background: C.accent, borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 8, color: "#0A2A3A", marginTop: 2 }}>{t.sold}% sold</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 12 }}>REVENUE MODEL</div>
                  {[
                    { l: "Management Fee", v: "2% anual sobre TVL", c: C.gold },
                    { l: "Tokenization Fee", v: "0.5% sobre cargo value", c: C.accent },
                    { l: "Trading Fee (DEX)", v: "0.3% por swap en pool", c: "#CE93D8" },
                    { l: "Redemption Fee", v: "0.2% al canjear físico", c: "#FF9100" },
                    { l: "Carried Interest", v: "15% sobre plusvalías", c: C.accent },
                  ].map(r => (
                    <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}22` }}>
                      <span style={{ fontSize: 10, color: "#2A5A70" }}>{r.l}</span>
                      <span style={{ fontSize: 10, color: r.c, fontWeight: 700 }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ TOKENIZE TAB ══ */}
          {tab === "tokenize" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 14 }}>SELECT COMMODITY TO TOKENIZE</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {["Energy", "Metals", "Grains", "Precious", "Softs"].map(cat => (
                      <span key={cat} style={{ padding: "3px 10px", fontSize: 9, background: "rgba(0,212,170,0.06)", border: `1px solid ${C.border}`, borderRadius: 2, color: "#4A7A8A" }}>{cat}</span>
                    ))}
                  </div>
                  {COMMODITIES.map(c => (
                    <div key={c.id} onClick={() => setSelected(c)}
                      style={{ padding: "10px 12px", borderRadius: 3, marginBottom: 6, cursor: "pointer", border: `1px solid ${selected?.id === c.id ? c.color : C.border}`, background: selected?.id === c.id ? `${c.color}10` : "rgba(0,0,0,0.2)", transition: "all 0.15s", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{c.icon}</span>
                        <div>
                          <div style={{ color: selected?.id === c.id ? C.bright : "#7A9BB5", fontWeight: 600, fontSize: 11 }}>{c.symbol} — {c.name}</div>
                          <div style={{ fontSize: 9, color: "#0A2A3A" }}>{fmtN(c.cargoTons)} MT | {c.origin}→{c.dest}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: c.color, fontWeight: 700, fontFamily: "monospace", fontSize: 11 }}>{fmt(calcCargoValue(c))}</div>
                        <div style={{ fontSize: 9, color: "#0A2A3A" }}>total cargo</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {selected && (
                  <div>
                    <div style={{ background: C.panel, border: `1px solid ${selected.color}33`, borderRadius: 4, padding: 16, marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: selected.color, letterSpacing: 2, marginBottom: 14 }}>
                        {selected.icon} TOKENIZATION PARAMETERS
                      </div>

                      {[
                        ["Commodity", `${selected.name} (${selected.symbol})`],
                        ["HS Code", selected.hs],
                        ["Bill of Lading", selected.bl],
                        ["Vessel", `${selected.vessel} | ${selected.origin}→${selected.dest}`],
                        ["Cargo Quantity", `${fmtN(selected.cargoTons)} ${selected.id === "gold" ? "KG" : "MT"}`],
                        ["Live Price (Bloomberg)", `${fmt(prices[selected.id] || selected.price, 2)} /${selected.unitShort}`],
                        ["Total Cargo Value", fmt(calcCargoValue(selected))],
                        ["Token Standard", "ERC-1155 (BeZhasRWAFactory.sol)"],
                        ["Network", "Polygon + BNB Chain (LayerZero)"],
                      ].map(([l, v]) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}22` }}>
                          <span style={{ color: "#0A2A3A", fontSize: 10 }}>{l}</span>
                          <span style={{ color: "#80B0C0", fontSize: 10, textAlign: "right", maxWidth: "55%" }}>{v}</span>
                        </div>
                      ))}

                      {/* Fraction slider */}
                      <div style={{ marginTop: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 9, color: "#0A2A3A", letterSpacing: 1 }}>NUMBER OF FRACTIONS</span>
                          <span style={{ color: C.accent, fontFamily: "monospace", fontWeight: 700 }}>{fmtN(mintFractions)}</span>
                        </div>
                        <input type="range" min={1000} max={1000000} step={1000} value={mintFractions}
                          onChange={e => setMintFractions(Number(e.target.value))}
                          style={{ width: "100%", accentColor: selected.color, cursor: "pointer" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#0A2A3A" }}>
                          <span>1,000</span><span>1,000,000</span>
                        </div>
                      </div>

                      <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 3, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 8, color: "#0A2A3A", letterSpacing: 1 }}>PRICE PER FRACTION</div>
                          <div style={{ color: C.gold, fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>
                            {fmt(calcCargoValue(selected) / mintFractions, 4)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: "#0A2A3A", letterSpacing: 1 }}>TOKENIZATION FEE (0.5%)</div>
                          <div style={{ color: C.accent, fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>
                            {fmt(calcCargoValue(selected) * 0.005)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: "#0A2A3A", letterSpacing: 1 }}>MGMT FEE/YEAR (2%)</div>
                          <div style={{ color: "#CE93D8", fontFamily: "monospace", fontSize: 12 }}>{fmt(calcCargoValue(selected) * 0.02)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: "#0A2A3A", letterSpacing: 1 }}>MIN INVESTMENT</div>
                          <div style={{ color: "#FF9100", fontFamily: "monospace", fontSize: 12 }}>
                            {fmt(calcCargoValue(selected) / mintFractions, 2)} (1 fraction)
                          </div>
                        </div>
                      </div>

                      {/* Mint button / flow */}
                      {mintStep === 0 && (
                        <button onClick={doMint}
                          style={{ marginTop: 14, width: "100%", padding: "12px", background: `linear-gradient(135deg, ${selected.color}33, ${selected.color}11)`, border: `1px solid ${selected.color}`, color: selected.color, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: 2, borderRadius: 3 }}>
                          🪙 MINT CARGO TOKEN ON POLYGON
                        </button>
                      )}

                      {mintStep > 0 && mintStep < 6 && (
                        <div style={{ marginTop: 14 }}>
                          {[
                            [1, "Fetching Bloomberg live price"],
                            [2, "Computing total cargo value"],
                            [3, "Verifying B/L hash on QualityOracle"],
                            [4, "Minting ERC-1155 fractions on Polygon"],
                            [5, "Adding liquidity to QuickSwap V3"],
                          ].map(([s, label]) => (
                            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                              <span style={{ color: mintStep > s ? C.accent : mintStep === s ? selected.color : "#0A2A3A", fontSize: 11, width: 14 }}>
                                {mintStep > s ? "✓" : mintStep === s ? "◐" : "○"}
                              </span>
                              <span style={{ color: mintStep >= s ? "#6A9AAA" : "#0A2A3A", fontSize: 10 }}>{label}</span>
                              {mintStep === s && <div style={{ flex: 1, height: 2, background: C.dim, borderRadius: 1 }}><div style={{ height: "100%", background: selected.color, animation: "progress 0.9s linear infinite", borderRadius: 1 }} /></div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {mintResult && mintStep === 0 && (
                        <div style={{ marginTop: 14, padding: 12, background: "rgba(0,212,170,0.06)", border: `1px solid ${C.accent}44`, borderRadius: 3 }}>
                          <div style={{ color: C.accent, fontWeight: 700, fontSize: 12, marginBottom: 6 }}>✅ TOKEN MINTED & LIVE ON QUICKSWAP</div>
                          <div style={{ fontSize: 10, color: "#4A7A8A" }}>Token ID: <span style={{ color: C.accent }}>{mintResult.tokenId}</span></div>
                          <div style={{ fontSize: 10, color: "#4A7A8A" }}>Price: <span style={{ color: C.gold }}>{fmt(mintResult.pricePerFraction, 4)}/fraction</span></div>
                          <div style={{ fontSize: 10, color: "#4A7A8A" }}>Pool: QuickSwap V3 {mintResult.tokenId}/USDC</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ PORTFOLIO TAB ══ */}
          {tab === "portfolio" && (
            <div>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ padding: "9px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: C.accent, fontSize: 10, letterSpacing: 2 }}>ALL CARGO TOKENS — BEZHASRWAFACTORY</span>
                  <span style={{ fontSize: 9, color: "#0A2A3A" }}>ERC-1155 | Polygon + BNB Chain</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.4)" }}>
                      {["TOKEN ID", "COMMODITY", "QTY", "TOTAL VALUE", "FRACTIONS", "PRICE/FRAC", "SOLD", "MINT DATE", "EXPIRY", "STATUS"].map(h => (
                        <th key={h} style={{ padding: "6px 10px", fontSize: 8, color: "#0A2A3A", letterSpacing: 1, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((t, i) => (
                      <tr key={i} className="row" style={{ borderTop: `1px solid ${C.border}22`, background: i % 2 ? "rgba(0,0,0,0.1)" : "transparent" }}>
                        <td style={{ padding: "9px 10px", color: C.accent, fontWeight: 700, fontFamily: "monospace", fontSize: 10 }}>{t.tokenId}</td>
                        <td style={{ padding: "9px 10px", color: C.bright, fontSize: 11 }}>{t.commodity}</td>
                        <td style={{ padding: "9px 10px", color: "#4A7A8A", fontSize: 10 }}>{t.qty}</td>
                        <td style={{ padding: "9px 10px", color: C.gold, fontFamily: "monospace", fontWeight: 700 }}>
                          {t.totalValue >= 1e9 ? `$${(t.totalValue / 1e9).toFixed(2)}B` : t.totalValue >= 1e6 ? `$${(t.totalValue / 1e6).toFixed(1)}M` : fmt(t.totalValue)}
                        </td>
                        <td style={{ padding: "9px 10px", color: "#4A7A8A", fontFamily: "monospace" }}>{fmtN(t.fractions)}</td>
                        <td style={{ padding: "9px 10px", color: "#80B0C0", fontFamily: "monospace" }}>{fmt(t.pricePerFraction, 4)}</td>
                        <td style={{ padding: "9px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ width: 50, height: 3, background: "#0A1A28", borderRadius: 2 }}>
                              <div style={{ height: "100%", width: `${t.sold}%`, background: t.sold > 80 ? C.accent : t.sold > 50 ? C.gold : "#4A7A8A", borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 9, color: "#4A7A8A" }}>{t.sold}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "9px 10px", color: "#0A2A3A", fontFamily: "monospace", fontSize: 9 }}>{t.mintDate}</td>
                        <td style={{ padding: "9px 10px", color: "#0A2A3A", fontFamily: "monospace", fontSize: 9 }}>{t.expiry}</td>
                        <td style={{ padding: "9px 10px" }}>
                          <span style={{ padding: "2px 8px", fontSize: 9, borderRadius: 2, background: t.status === "TRADING" ? "rgba(0,212,170,0.1)" : "rgba(100,100,100,0.1)", color: t.status === "TRADING" ? C.accent : "#4A7A8A", animation: t.status === "TRADING" ? "blink 3s infinite" : "none" }}>
                            {t.status === "TRADING" ? "● " : ""}{t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ DEFI TAB ══ */}
          {tab === "defi" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 14 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.accent }}>QUICKSWAP V3 LIQUIDITY POOLS</div>
                  {POOL_DATA.map((pool, i) => (
                    <div key={i} style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ color: C.bright, fontWeight: 700, fontSize: 12 }}>{pool.pair}</span>
                        <span style={{ color: C.accent, fontWeight: 700, fontFamily: "monospace" }}>APY {pool.apy}%</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                        {[["TVL", fmt(pool.tvl)], ["VOL 24H", fmt(pool.vol24h)], ["FEE TIER", `${pool.fee}%`]].map(([l, v]) => (
                          <div key={l}>
                            <div style={{ fontSize: 8, color: "#0A2A3A", letterSpacing: 1 }}>{l}</div>
                            <div style={{ fontSize: 11, color: C.gold, fontFamily: "monospace" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "#CE93D8", letterSpacing: 2, marginBottom: 12 }}>LAYERZERO CROSS-CHAIN BRIDGE</div>
                  {[
                    { from: "Polygon", to: "BNB Chain", token: "CARGO-BRENT", amount: "5,000 fractions", time: "3 min ago", status: "✅" },
                    { from: "BNB Chain", to: "Polygon", token: "CARGO-GOLD", amount: "12,000 fractions", time: "11 min ago", status: "✅" },
                    { from: "Polygon", to: "Arbitrum", token: "CARGO-COPPER", amount: "800 fractions", time: "32 min ago", status: "✅" },
                  ].map((b, i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 10, color: "#6A9AAA" }}>{b.from} → {b.to}</span>
                        <span style={{ fontSize: 9, color: "#0A2A3A" }}>{b.time}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <span style={{ fontSize: 9, color: C.accent }}>{b.token} {b.amount}</span>
                        <span>{b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.gold, letterSpacing: 2, marginBottom: 12 }}>DeFi YIELD STRATEGY</div>
                  {[
                    { step: "01", action: "Cargo tokenizado → ERC-1155 fractions en Polygon" },
                    { step: "02", action: "50% fractions → QuickSwap V3 pool como LP" },
                    { step: "03", action: "LP fees (0.05–0.3%) → distribuidas a holders" },
                    { step: "04", action: "Restante 50% → StakingPoolV2 generando APY" },
                    { step: "05", action: "Staking rewards en BEZ-Coin → demand sube" },
                    { step: "06", action: "Al vencimiento: token holders redimen carga física" },
                    { step: "07", action: "O liquidan en mercado secundario con ganancia" },
                  ].map(s => (
                    <div key={s.step} style={{ display: "flex", gap: 10, marginBottom: 9 }}>
                      <span style={{ color: C.accent, fontFamily: "monospace", fontSize: 10, fontWeight: 700, minWidth: 24 }}>{s.step}</span>
                      <span style={{ fontSize: 10, color: "#4A7A8A", lineHeight: 1.5 }}>{s.action}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 12 }}>REVENUE PROJECTION</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { ph: "PILOT", tvl: "$5M", rev: "$100K/yr", note: "1 commodity" },
                      { ph: "GROWTH", tvl: "$50M", rev: "$1M/yr", note: "4 commodities" },
                      { ph: "SCALE", tvl: "$500M", rev: "$10M/yr", note: "All sectors" },
                      { ph: "GLOBAL", tvl: "$5B+", rev: "$100M/yr", note: "Institutional" },
                    ].map(p => (
                      <div key={p.ph} style={{ padding: 10, background: "rgba(0,0,0,0.3)", borderRadius: 3, borderTop: `2px solid ${C.accent}` }}>
                        <div style={{ fontSize: 9, color: C.accent, letterSpacing: 1, marginBottom: 4 }}>{p.ph}</div>
                        <div style={{ fontSize: 9, color: "#0A2A3A" }}>TVL: {p.tvl}</div>
                        <div style={{ fontSize: 13, color: C.gold, fontWeight: 700 }}>{p.rev}</div>
                        <div style={{ fontSize: 9, color: "#2A5A70" }}>{p.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ ORACLE TAB ══ */}
          {tab === "oracle" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 14 }}>
                  <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 2, color: C.accent }}>CHAINLINK PRICE ORACLES</div>
                  {COMMODITIES.map((c, i) => {
                    const p = prices[c.id] || c.price;
                    const chg = ((p - c.price) / c.price * 100);
                    return (
                      <div key={i} style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}22`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{c.icon}</span>
                          <div>
                            <div style={{ fontSize: 10, color: "#80B0C0" }}>{c.symbol}/USD</div>
                            <div style={{ fontSize: 9, color: "#0A2A3A" }}>Chainlink Feed · 90s heartbeat</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span style={{ fontFamily: "monospace", color: C.bright, fontSize: 11, fontWeight: 700 }}>
                            {p >= 1000 ? fmt(p, 2) : `$${p.toFixed(4)}`}
                          </span>
                          <span style={{ fontSize: 9, color: chg >= 0 ? C.accent : C.red }}>{chg >= 0 ? "▲" : "▼"}{Math.abs(chg).toFixed(3)}%</span>
                          <span style={{ fontSize: 8, color: C.accent, animation: "blink 2s infinite" }}>●</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.gold, letterSpacing: 2, marginBottom: 12 }}>SMART CONTRACTS DEPLOYED</div>
                  {[
                    { name: "BeZhasRWAFactory.sol", desc: "Mint + manage cargo tokens ERC-1155", net: "Polygon", status: "ACTIVE" },
                    { name: "QualityOracle.sol", desc: "Cargo valuation + B/L verification", net: "Polygon", status: "ACTIVE" },
                    { name: "StakingPoolV2.sol", desc: "Yield generación sobre tokens bloqueados", net: "Polygon", status: "ACTIVE" },
                    { name: "BeZhasMarketplace.sol", desc: "P2P trading fracciones de carga", net: "BNB Chain", status: "ACTIVE" },
                    { name: "QuickSwap V3 Router", desc: "AMM liquidity pools CARGO/USDC", net: "Polygon", status: "EXTERNAL" },
                    { name: "LayerZero Endpoint", desc: "Cross-chain token transfers", net: "Multi-chain", status: "EXTERNAL" },
                  ].map((c, i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#90C0D0", fontSize: 10, fontWeight: 700 }}>{c.name}</span>
                        <span style={{ fontSize: 9, color: c.status === "ACTIVE" ? C.accent : C.gold }}>{c.status}</span>
                      </div>
                      <div style={{ fontSize: 9, color: "#0A2A3A", marginTop: 2 }}>{c.desc} | {c.net}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "#CE93D8", letterSpacing: 2, marginBottom: 12 }}>APIS CONECTADAS</div>
                  {[
                    ["Bloomberg Commodity API", "Precios tiempo real", "🟢"],
                    ["CME Group Futures", "Futuros commodity", "🟢"],
                    ["LBMA Gold Price", "Oro spot Londres", "🟢"],
                    ["LME Metals", "Cobre, aluminio, zinc", "🟢"],
                    ["CBOT (Chicago Board of Trade)", "Granos y softs", "🟢"],
                    ["Platts S&P", "Energía y petroquímica", "🟡 API KEY NEEDED"],
                    ["Brinks Vault API", "Custodia oro físico", "🔴 SETUP PENDING"],
                    ["Argus Media", "LNG y gas natural", "🟡 API KEY NEEDED"],
                  ].map(([name, desc, status]) => (
                    <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}22` }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#5A8A9A" }}>{name}</div>
                        <div style={{ fontSize: 8, color: "#0A2A3A" }}>{desc}</div>
                      </div>
                      <span style={{ fontSize: 10 }}>{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* ══ METRICS TAB (real data from API) ══ */}
          {tab === "metrics" && (
            <div>
              <div style={{ background: C.card || C.panel, border: "1px solid " + (C.border), borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — RWA-CARGO
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? "❌ " + bridge.error : "🟢 Connected — data from /api/agents/rwa-cargo/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="rwa-cargo" accentColor={C.accent} />
            </div>
          )}

        </div>

        {/* ── LIVE LOG ── */}
        <div style={{ width: 270, flexShrink: 0, background: "#020C14", borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "7px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 9, letterSpacing: 2, color: "#0A2A3A" }}>
            AGENT LOG <span style={{ color: C.accent, animation: "blink 1.5s infinite" }}>●</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            {log.map((e, i) => (
              <div key={i} style={{ padding: "3px 12px", fontSize: 9.5, lineHeight: 1.6, color: i === 0 ? (e.includes("✅") ? C.accent : e.includes("Bloomberg") ? C.gold : "#5A8A9A") : "#0A2A3A" }}>{e}</div>
            ))}
          </div>
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 8, color: "#0A2A3A", letterSpacing: 1, marginBottom: 4 }}>TOTAL TVL TOKENIZED</div>
            <div style={{ color: C.gold, fontWeight: 700, fontSize: 13 }}>{fmt(tvlTotal)}</div>
            <div style={{ fontSize: 8, color: "#0A2A3A", marginTop: 3 }}>BEZ Revenue: {bezRevenue.toFixed(4)} BEZ</div>
          </div>
        </div>
      </div>
    </div>
  );
}
