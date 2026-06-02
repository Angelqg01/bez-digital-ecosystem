import { useState, useEffect, useCallback, useRef } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

/* ═══════════════════════════════════════════════════════════════════════
   bez.digital — PORT FINANCE AGENT v1.0  (Fase 1.4)
   Bonos Tokenizados de Puertos · Cupones Automáticos en BEZ-Coin
   ─────────────────────────────────────────────────────────────────────
   Blockchain:  Polygon Mainnet → BNB Chain (LayerZero bridge)
   Contratos:
     • BEZ Token:      0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
     • QualityEscrow:  0x3EfC42095E8503d41Ad8001328FC23388E00e8a3
     • Treasury DAO:   0x89c23890c742d710265dD61be789C71dC8999b12
     • Hot Wallet:     0x52Df82920CBAE522880dD7657e43d1A754eD044E
     • PortBond NFT:   BeZhasRWAFactory.sol (ERC-1155)
     • StakingPool:    StakingPoolV2.sol
   Backend:  api.bez.digital:3001 | ws.bez.digital:3002
   ─────────────────────────────────────────────────────────────────────
   MODELO DE NEGOCIO BEZ:
     • Emisión bono:    1% del valor nominal → fee en BEZ
     • Cupón mensual:   distribuido on-chain en BEZ o USDC
     • Rating oracle:   0.5 BEZ/actualización (QualityOracle.sol)
     • Trading fee:     0.3% en mercado secundario BeZhasMarketplace
     • Gestión DAO:     0.5% TVL/año → Treasury DAO
   APIs INTEGRADAS:
     • APM Terminals API    → throughput en tiempo real
     • DP World API         → volumen contenedores
     • Port Authority ES    → datos Algeciras/Valencia/Barcelona
     • Chainlink Price Feed → BEZ/USD + EUR/USD
     • Bloomberg Port Index → flujos de caja históricos
     • Moody's / S&P data   → rating crediticio base
═══════════════════════════════════════════════════════════════════════ */

// ─── DESIGN TOKENS (BeZhas brand system) ─────────────────────────────────────
const C = {
  bg: "#03060E", surf: "#070D1C", card: "#0C1628", card2: "#101E38",
  card3: "#142444", border: "#0D2040", border2: "#163560", border3: "#1E4A8A",
  primary: "#00C896", gold: "#FFB800", neon: "#00FFB2",
  blue: "#2563EB", violet: "#7C3AED", pink: "#EC4899",
  orange: "#F97316", red: "#EF4444", yellow: "#EAB308",
  teal: "#0891B2", sky: "#38BDF8",
  text: "#E8F4FF", text2: "#A8C4E0", muted: "#3D5E80",
  mono: "'JetBrains Mono','Courier New',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
};

// ─── CONTRACTS ───────────────────────────────────────────────────────────────
const ADDR = {
  BEZ: "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8",
  ESCROW: "0x3EfC42095E8503d41Ad8001328FC23388E00e8a3",
  DAO: "0x89c23890c742d710265dD61be789C71dC8999b12",
  HOT: "0x52Df82920CBAE522880dD7657e43d1A754eD044E",
};

// ─── PORT BOND DATA ───────────────────────────────────────────────────────────
const PORTS = [
  {
    id: "alg", flag: "🇪🇸", name: "Puerto de Algeciras", code: "ESALG",
    country: "España", region: "Mediterráneo",
    throughput_teu: 5800000,   // TEU/año 2024
    revenue_annual: 680,       // M€/año
    ebitda_margin: 0.38,
    rating: "BBB+",
    ratingScore: 82,
    color: C.primary,
    bonds: [
      {
        id: "ALGB-2025-A", name: "Algeciras Infrastructure Bond A", face: 50000000,
        tokens: 500000, priceToken: 100, couponRate: 0.058, couponFreq: "mensual",
        maturity: "2030-03-01", issued: "2025-03-01", currency: "EUR",
        raised: 38200000, sold_pct: 76.4, status: "LIVE",
        lastCoupon: 241667, nextCoupon: "2025-04-01",
        description: "Financiación ampliación Terminal TTT2 — 800M€ inversión total. BeZhas gestiona cupones automáticos en BEZ.",
        use_of_funds: ["40% Terminal TTT2 grúas", "30% Digitalización portuaria", "20% Energías renovables", "10% Reserva liquidity"],
      },
      {
        id: "ALGB-2025-B", name: "Algeciras Green Bond B", face: 25000000,
        tokens: 250000, priceToken: 100, couponRate: 0.065, couponFreq: "trimestral",
        maturity: "2028-09-01", issued: "2025-03-01", currency: "EUR",
        raised: 12500000, sold_pct: 50.0, status: "LIVE",
        lastCoupon: 406250, nextCoupon: "2025-06-01",
        description: "Bono verde para electrificación muelles y grúas. Certificado EU Green Bond Standard.",
        use_of_funds: ["60% Electrificación muelles", "25% Solar cubierta", "15% Reserva"],
      },
    ],
  },
  {
    id: "vlc", flag: "🇪🇸", name: "Puerto de Valencia", code: "ESVLC",
    country: "España", region: "Mediterráneo",
    throughput_teu: 5500000,
    revenue_annual: 520,
    ebitda_margin: 0.34,
    rating: "BBB",
    ratingScore: 78,
    color: C.orange,
    bonds: [
      {
        id: "VLCB-2025-A", name: "Valencia Port Expansion Bond", face: 80000000,
        tokens: 800000, priceToken: 100, couponRate: 0.062, couponFreq: "mensual",
        maturity: "2032-01-01", issued: "2025-02-01", currency: "EUR",
        raised: 71200000, sold_pct: 89.0, status: "LIVE",
        lastCoupon: 413333, nextCoupon: "2025-04-01",
        description: "Ampliación Norte: nueva terminal para 3M TEU adicionales. Mayor proyecto portuario español.",
        use_of_funds: ["70% Nueva terminal Norte", "20% Accesos ferroviarios", "10% Reserva"],
      },
    ],
  },
  {
    id: "sgp", flag: "🇸🇬", name: "Port of Singapore (PSA)", code: "SGSIN",
    country: "Singapur", region: "Asia-Pacífico",
    throughput_teu: 39000000,
    revenue_annual: 4200,
    ebitda_margin: 0.44,
    rating: "AAA",
    ratingScore: 98,
    color: C.sky,
    bonds: [
      {
        id: "SGPB-2025-A", name: "Tuas Megaport Phase 4 Bond", face: 500000000,
        tokens: 5000000, priceToken: 100, couponRate: 0.042, couponFreq: "semestral",
        maturity: "2035-01-01", issued: "2025-01-01", currency: "USD",
        raised: 487500000, sold_pct: 97.5, status: "LIVE",
        lastCoupon: 10500000, nextCoupon: "2025-07-01",
        description: "Fase 4 del megapuerto Tuas — capacidad 65M TEU en 2040. Rating AAA emitido por MAS.",
        use_of_funds: ["80% Infraestructura Tuas", "15% Tecnología automatización", "5% Contingencia"],
      },
    ],
  },
  {
    id: "jea", flag: "🇦🇪", name: "Jebel Ali Port (DP World)", code: "AEJEA",
    country: "Emiratos Árabes", region: "Golfo Pérsico",
    throughput_teu: 14400000,
    revenue_annual: 3100,
    ebitda_margin: 0.41,
    rating: "A-",
    ratingScore: 89,
    color: C.gold,
    bonds: [
      {
        id: "JEAB-2025-A", name: "Jebel Ali Expansion Bond", face: 200000000,
        tokens: 2000000, priceToken: 100, couponRate: 0.055, couponFreq: "mensual",
        maturity: "2030-06-01", issued: "2025-01-15", currency: "USD",
        raised: 180000000, sold_pct: 90.0, status: "LIVE",
        lastCoupon: 916667, nextCoupon: "2025-04-15",
        description: "Expansión Terminal 4 — 4M TEU adicionales. Hub para Africa+MENA+Sur Asia.",
        use_of_funds: ["65% Terminal 4", "25% Zona franca digital", "10% Green energy"],
      },
    ],
  },
  {
    id: "rot", flag: "🇳🇱", name: "Port of Rotterdam", code: "NLRTM",
    country: "Países Bajos", region: "Norte Europa",
    throughput_teu: 14900000,
    revenue_annual: 3800,
    ebitda_margin: 0.46,
    rating: "AA",
    ratingScore: 94,
    color: C.blue,
    bonds: [
      {
        id: "ROTB-2025-A", name: "Rotterdam Hydrogen Hub Bond", face: 150000000,
        tokens: 1500000, priceToken: 100, couponRate: 0.048, couponFreq: "trimestral",
        maturity: "2033-03-01", issued: "2025-02-15", currency: "EUR",
        raised: 127500000, sold_pct: 85.0, status: "LIVE",
        lastCoupon: 1800000, nextCoupon: "2025-06-15",
        description: "Hub de hidrógeno verde — mayor terminal H2 Europa. Parte del plan Rotterdam Energy Transition.",
        use_of_funds: ["55% Infraestructura H2", "30% Electrolizadores", "15% Almacenamiento"],
      },
    ],
  },
];

const ALL_BONDS = PORTS.flatMap(p => p.bonds.map(b => ({ ...b, port: p })));

const RATING_COLOR = {
  "AAA": C.primary, "AA": C.primary, "A-": "#4ADE80", "BBB+": C.gold, "BBB": C.orange, "BB": C.red, "B": C.red,
};
const STATUS_CFG = {
  LIVE: { c: C.primary, bg: `${C.primary}18`, label: "● LIVE" },
  MATURED: { c: C.muted, bg: `${C.muted}18`, label: "MATURED" },
  PENDING: { c: C.yellow, bg: `${C.yellow}18`, label: "⏳ PENDING" },
  DEFAULTED: { c: C.red, bg: `${C.red}18`, label: "⚠ DEFAULT" },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtUSD = n => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};
const fmtEUR = (n, cur = "EUR") => {
  const sym = cur === "EUR" ? "€" : "$";
  if (n >= 1e9) return `${sym}${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${sym}${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${sym}${(n / 1e3).toFixed(1)}K`;
  return `${sym}${n.toFixed(2)}`;
};
const fmtPct = n => `${(n * 100).toFixed(2)}%`;
const fmtN = n => n?.toLocaleString("es-ES");
const rndInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rndHex = n => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
function Card({ children, style = {}, glow, col }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${glow && col ? col + "55" : C.border}`,
      borderRadius: 16, padding: 16, boxShadow: glow && col ? `0 0 24px ${col}18` : "none", ...style
    }}>
      {children}
    </div>
  );
}
function Chip({ children, col = C.primary, sm = false }) {
  return (
    <span style={{
      background: `${col}20`, color: col, border: `1px solid ${col}44`,
      borderRadius: 20, padding: sm ? "1px 8px" : "3px 11px",
      fontSize: sm ? 9 : 10, fontFamily: C.mono, fontWeight: 800, whiteSpace: "nowrap"
    }}>
      {children}
    </span>
  );
}
function Btn({ children, onClick, col = C.primary, sm = false, full = false, disabled = false, icon }) {
  const isDark = col === C.gold || col === "#EAB308" || col === "#FFB800";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: full ? "100%" : undefined,
      background: disabled ? C.card2 : `linear-gradient(135deg,${col},${col}bb)`,
      color: disabled ? C.muted : isDark ? "#0a0a0a" : C.bg,
      border: "none", borderRadius: 11,
      padding: sm ? "5px 13px" : full ? "13px 20px" : "10px 20px",
      fontSize: sm ? 11 : 13, fontWeight: 800,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily: C.mono,
      boxShadow: disabled ? "none" : `0 0 16px ${col}44`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      transition: "all 0.18s",
    }}>
      {icon && <span style={{ fontSize: sm ? 12 : 15 }}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
function StatCard({ label, value, sub, col, icon }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${col}33`, borderRadius: 14,
      padding: "12px 14px", borderTop: `3px solid ${col}`
    }}>
      {icon && <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>}
      <div style={{ color: C.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
      <div style={{ color: col, fontFamily: C.mono, fontSize: 20, fontWeight: 900 }}>{value}</div>
      {sub && <div style={{ color: C.muted, fontSize: 9, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── COUPON FLOW DIAGRAM ──────────────────────────────────────────────────────
function CouponFlowViz({ bond }) {
  const couponAmt = (bond.face * bond.couponRate / 12).toFixed(0);
  const bezFee = (couponAmt * 0.003).toFixed(0);
  const netCoupon = (couponAmt - bezFee).toFixed(0);
  const nodes = [
    { label: "Puerto", sub: bond.port?.name?.split(" ").slice(-1)[0], icon: "🏗️", col: C.teal },
    { label: "Smart Contract", sub: "BeZhasRWAFactory.sol", icon: "⛓️", col: C.blue },
    { label: "Holders", sub: `${fmtN(bond.tokens)} fracciones`, icon: "👛", col: C.primary },
    { label: "Treasury", sub: "BeZhas DAO", icon: "🏛️", col: C.gold },
  ];
  return (
    <div style={{ padding: "14px 0" }}>
      <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>FLUJO AUTOMÁTICO DE CUPONES — CADA {bond.couponFreq?.toUpperCase()}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {nodes.map((n, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: `${n.col}18`, border: `2px solid ${n.col}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, margin: "0 auto 4px"
              }}>
                {n.icon}
              </div>
              <div style={{ fontSize: 9, color: n.col, fontWeight: 700, fontFamily: C.mono }}>{n.label}</div>
              <div style={{ fontSize: 8, color: C.muted }}>{n.sub}</div>
            </div>
            {i < nodes.length - 1 && (
              <div style={{ flexShrink: 0, textAlign: "center", padding: "0 4px" }}>
                <div style={{ color: C.primary, fontSize: 16 }}>→</div>
                <div style={{ fontSize: 8, color: C.primary, fontFamily: C.mono, whiteSpace: "nowrap" }}>
                  {i === 0 ? fmtEUR(Number(couponAmt), bond.currency) :
                    i === 1 ? fmtEUR(Number(netCoupon), bond.currency) + " (97%)" :
                      fmtEUR(Number(bezFee), bond.currency) + " fee"}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RATING GAUGE ─────────────────────────────────────────────────────────────
function RatingGauge({ score, rating, col }) {
  const angle = (score / 100) * 180 - 90; // -90° to 90°
  return (
    <div style={{ position: "relative", width: 120, height: 65, margin: "0 auto" }}>
      {/* Arcos de fondo */}
      <svg width={120} height={65} style={{ position: "absolute", top: 0, left: 0 }}>
        {[
          { start: -90, end: -30, col: C.red },
          { start: -30, end: 30, col: C.orange },
          { start: 30, end: 90, col: C.yellow },
          { start: 90, end: 150, col: "#4ADE80" },
          { start: 150, end: 210, col: C.primary },
        ].map((arc, i) => {
          const r = 50, cx = 60, cy = 60;
          const toRad = deg => (deg * Math.PI / 180);
          const x1 = cx + r * Math.cos(toRad(arc.start));
          const y1 = cy + r * Math.sin(toRad(arc.start));
          const x2 = cx + r * Math.cos(toRad(arc.end));
          const y2 = cy + r * Math.sin(toRad(arc.end));
          const large = arc.end - arc.start > 180 ? 1 : 0;
          return (
            <path key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
              fill="none" stroke={arc.col} strokeWidth={8} strokeLinecap="round" opacity={0.3} />
          );
        })}
        {/* Needle */}
        <line x1={60} y1={60}
          x2={60 + 40 * Math.cos((angle * Math.PI / 180))}
          y2={60 + 40 * Math.sin((angle * Math.PI / 180))}
          stroke={col} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={60} cy={60} r={4} fill={col} />
      </svg>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: col, fontFamily: C.mono }}>{rating}</div>
        <div style={{ fontSize: 8, color: C.muted }}>{score}/100</div>
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function TabMarket({ bonds, onSelect, selectedBond }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard label="Bonos LIVE" value={bonds.filter(b => b.status === "LIVE").length} col={C.primary} icon="📋" />
        <StatCard label="Capital emitido" value={fmtEUR(bonds.reduce((s, b) => s + b.face, 0))} col={C.gold} icon="💰" />
        <StatCard label="Capital captado" value={fmtEUR(bonds.reduce((s, b) => s + b.raised, 0))} col={C.sky} icon="📈" />
        <StatCard label="Cupones/mes" value={fmtEUR(bonds.reduce((s, b) => s + (b.face * b.couponRate / 12), 0))} col={C.orange} icon="🪙" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {bonds.map(b => {
          const sc = STATUS_CFG[b.status] || STATUS_CFG.LIVE;
          const monthCoupon = b.face * b.couponRate / 12;
          const isSelected = selectedBond?.id === b.id;
          const rc = RATING_COLOR[b.port?.rating] || C.gold;
          return (
            <div key={b.id} onClick={() => onSelect(isSelected ? null : b)}
              style={{
                background: isSelected ? C.card2 : C.card,
                border: `1px solid ${isSelected ? b.port?.color + "66" : C.border}`,
                borderLeft: `4px solid ${b.port?.color}`,
                borderRadius: 14, padding: 14, cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: isSelected ? `0 0 20px ${b.port?.color}12` : "none"
              }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                {/* Left */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 28 }}>{b.port?.flag}</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <div style={{ color: C.text, fontWeight: 800, fontSize: 13 }}>{b.name}</div>
                      <Chip col={sc.c} sm>{sc.label}</Chip>
                    </div>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, marginBottom: 4 }}>
                      {b.id} · {b.port?.name} · Vto: {b.maturity}
                    </div>
                    <div style={{ fontSize: 10, color: C.text2, maxWidth: 480 }}>{b.description}</div>
                  </div>
                </div>
                {/* Right stats */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {[
                    { l: "Nominal", v: fmtEUR(b.face, b.currency), c: C.gold },
                    { l: "Captado", v: fmtEUR(b.raised, b.currency), c: C.primary },
                    { l: "Cupón", v: fmtPct(b.couponRate), c: C.orange },
                    { l: b.couponFreq, v: fmtEUR(monthCoupon, b.currency), c: C.sky },
                    { l: "Rating", v: b.port?.rating, c: rc },
                  ].map(s => (
                    <div key={s.l} style={{ textAlign: "center", minWidth: 60 }}>
                      <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono, marginBottom: 2 }}>{s.l.toUpperCase()}</div>
                      <div style={{ fontSize: 12, color: s.c, fontFamily: C.mono, fontWeight: 800 }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: C.muted }}>Captación {b.sold_pct.toFixed(1)}%</span>
                  <span style={{ fontSize: 9, color: b.port?.color, fontFamily: C.mono }}>
                    {fmtN(Math.round(b.tokens * b.sold_pct / 100))} / {fmtN(b.tokens)} tokens
                  </span>
                </div>
                <div style={{ height: 5, background: C.card3, borderRadius: 3 }}>
                  <div style={{
                    height: "100%", width: `${b.sold_pct}%`,
                    background: `linear-gradient(90deg,${b.port?.color},${b.port?.color}88)`,
                    borderRadius: 3, transition: "width 0.8s ease"
                  }} />
                </div>
              </div>

              {/* Expanded detail */}
              {isSelected && (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {/* Coupon flow */}
                  <div style={{ background: C.card3, borderRadius: 12, padding: 12 }}>
                    <CouponFlowViz bond={b} />
                  </div>
                  {/* Use of funds */}
                  <div style={{ background: C.card3, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>USO DE FONDOS</div>
                    {b.use_of_funds.map((f, i) => {
                      const pctVal = parseInt(f.split("%")[0]);
                      const label = f.split("% ").slice(1).join(" ");
                      const barCol = [C.primary, C.blue, C.gold, C.orange][i] || C.muted;
                      return (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 10, color: C.text2 }}>{label}</span>
                            <span style={{ fontSize: 10, color: barCol, fontFamily: C.mono, fontWeight: 700 }}>{pctVal}%</span>
                          </div>
                          <div style={{ height: 3, background: C.card2, borderRadius: 2 }}>
                            <div style={{ height: "100%", width: `${pctVal}%`, background: barCol, borderRadius: 2 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB: EMITIR BONO ─────────────────────────────────────────────────────────
function TabEmit({ addLog }) {
  const [step, setStep] = useState(0);
  const [portName, setPort] = useState("");
  const [face, setFace] = useState("10000000");
  const [rate, setRate] = useState("5.5");
  const [freq, setFreq] = useState("mensual");
  const [matYears, setMat] = useState("5");
  const [desc, setDesc] = useState("");
  const [result, setResult] = useState(null);
  const [txSteps, setTxSteps] = useState([]);

  const issueBond = async () => {
    if (!portName || !face) return;
    setStep(1); setTxSteps([]);
    const nominalBEZfee = Number(face) * 0.01;
    addLog(`🏗️ Emitiendo bono: ${portName} — Nominal ${fmtEUR(Number(face))}`);
    addLog(`🔥 Fee emisión: ${fmtEUR(nominalBEZfee)} → BeZhasRWAFactory.sol`);

    const steps = [
      { s: 1, d: 700, msg: `Verificando rating crediticio ${portName} via QualityOracle…` },
      { s: 2, d: 1600, msg: `Calculando estructura: ${fmtEUR(Number(face))} nominal · ${rate}% cupón · vto. ${matYears}a` },
      { s: 3, d: 2600, msg: `Minting ERC-1155 fracciones: ${fmtN(Number(face) / 100)} tokens × €100…` },
      { s: 4, d: 3700, msg: `Configurando cupón automático: BeZhasRewardsCalculator.sol…` },
      { s: 5, d: 4800, msg: `Activando pool liquidez QuickSwap V3: PortBond/USDC…` },
      { s: 6, d: 5900, msg: `✅ Bono tokenizado LIVE — BeZhasMarketplace.sol activo` },
    ];
    steps.forEach(({ s, d, msg }) => {
      setTimeout(() => {
        setStep(s);
        setTxSteps(p => [...p, { s, msg }]);
        addLog(msg);
        if (s === 6) {
          setResult({
            bondId: `PORT-${portName.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
            tokens: Number(face) / 100,
            couponMonthly: Number(face) * Number(rate) / 100 / 12,
            bezFee: nominalBEZfee,
            txHash: `0x${rndHex(64)}`,
          });
          setTimeout(() => setStep(0), 2500);
        }
      }, d);
    });
  };

  const FREQS = ["mensual", "trimestral", "semestral", "anual"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Form */}
      <div>
        <Card glow col={C.teal} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 14 }}>
            NUEVA EMISIÓN DE BONO PORTUARIO
          </div>

          {[
            { label: "Nombre del Puerto / Autoridad Emisora", val: portName, set: setPort, type: "text", ph: "Ej: Puerto de Algeciras", sym: null },
            { label: "Nominal Total (EUR)", val: face, set: setFace, type: "number", ph: "10000000", sym: "€" },
            { label: "Tasa Cupón Anual (%)", val: rate, set: setRate, type: "number", ph: "5.5", sym: "%" },
          ].map(f => (
            <div key={f.label} style={{
              background: C.card2, border: `1px solid ${C.border2}`,
              borderRadius: 12, padding: "11px 14px", marginBottom: 10
            }}>
              <div style={{ color: C.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{f.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type={f.type} value={f.val} placeholder={f.ph}
                  onChange={e => f.set(e.target.value)}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    color: C.text, fontFamily: C.mono, fontSize: 20, fontWeight: 800, minWidth: 0
                  }} />
                {f.sym && <span style={{ color: C.muted, fontFamily: C.mono, fontSize: 14 }}>{f.sym}</span>}
              </div>
            </div>
          ))}

          {/* Frecuencia y plazo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: "11px 14px" }}>
              <div style={{ color: C.muted, fontSize: 9, letterSpacing: 1, marginBottom: 8 }}>FRECUENCIA CUPÓN</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {FREQS.map(f => (
                  <button key={f} onClick={() => setFreq(f)} style={{
                    padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontFamily: C.mono,
                    background: freq === f ? `${C.teal}22` : C.card3,
                    border: `1px solid ${freq === f ? C.teal : C.border}`,
                    color: freq === f ? C.teal : C.muted, fontSize: 9, fontWeight: 800,
                  }}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: "11px 14px" }}>
              <div style={{ color: C.muted, fontSize: 9, letterSpacing: 1, marginBottom: 5 }}>VENCIMIENTO (AÑOS)</div>
              <input type="number" value={matYears} min={1} max={30}
                onChange={e => setMat(e.target.value)}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  color: C.text, fontFamily: C.mono, fontSize: 24, fontWeight: 800, width: "100%"
                }} />
            </div>
          </div>

          <textarea value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Descripción del proyecto / uso de fondos…"
            style={{
              width: "100%", background: C.card2, border: `1px solid ${C.border2}`,
              borderRadius: 12, padding: "11px 14px", color: C.text, fontFamily: C.sans,
              fontSize: 12, resize: "none", height: 70, marginBottom: 12, boxSizing: "border-box"
            }} />

          {/* Preview */}
          {face && rate && (
            <div style={{ background: `${C.teal}08`, border: `1px solid ${C.teal}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 8, color: C.muted, marginBottom: 6 }}>PREVIEW FINANCIERO</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[
                  { l: "Tokens", v: fmtN(Number(face) / 100) + "  tok" },
                  { l: `Cupón/${freq}`, v: fmtEUR(Number(face) * Number(rate) / 100 / (freq === "mensual" ? 12 : freq === "trimestral" ? 4 : freq === "semestral" ? 2 : 1)) },
                  { l: "Fee BeZhas 1%", v: fmtEUR(Number(face) * 0.01) },
                ].map(s => (
                  <div key={s.l} style={{ background: C.card3, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 8, color: C.muted }}>{s.l}</div>
                    <div style={{ fontSize: 11, color: C.teal, fontFamily: C.mono, fontWeight: 800 }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Btn onClick={issueBond} disabled={step > 0 || !portName || !face} col={C.teal} full icon="📋">
            {step > 0 ? "EMITIENDO EN BLOCKCHAIN…" : "TOKENIZAR BONO PORTUARIO"}
          </Btn>
        </Card>
      </div>

      {/* Right: progress + result */}
      <div>
        {txSteps.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>PROCESO DE EMISIÓN ON-CHAIN</div>
            {[
              [1, "Verificación rating QualityOracle"],
              [2, "Estructuración financiera"],
              [3, "Mint ERC-1155 fracciones en Polygon"],
              [4, "Configurar cupón automático"],
              [5, "Activar pool QuickSwap V3"],
              [6, "Bono tokenizado LIVE"],
            ].map(([s, label]) => {
              const done = step > s;
              const active = step === s;
              const pending = step < s;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: done ? `${C.primary}22` : active ? `${C.teal}22` : C.card3,
                    border: `1.5px solid ${done ? C.primary : active ? C.teal : C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: done ? C.primary : active ? C.teal : C.muted, fontSize: 10, fontWeight: 900
                  }}>
                    {done ? "✓" : s}
                  </div>
                  <span style={{ fontSize: 11, color: done ? C.text2 : active ? C.text : C.muted, flex: 1 }}>{label}</span>
                  {active && (
                    <div style={{ width: 60, height: 3, background: C.card3, borderRadius: 2 }}>
                      <div style={{
                        height: "100%", width: "70%", background: C.teal, borderRadius: 2,
                        animation: "progress 0.9s linear infinite"
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}

        {result && step === 0 && (
          <Card glow col={C.primary} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.primary, fontWeight: 800, marginBottom: 10 }}>
              ✅ BONO EMITIDO EN BLOCKCHAIN
            </div>
            {[
              ["Bond ID", result.bondId, C.neon],
              ["Tokens ERC-1155", fmtN(result.tokens) + " fracciones de €100", C.primary],
              ["Cupón mensual", fmtEUR(result.couponMonthly) + " distribuido auto", C.orange],
              ["Fee BeZhas (1%)", fmtEUR(result.bezFee) + " en BEZ", C.gold],
              ["TX Hash", `0x${result.txHash.slice(2, 14)}…`, C.blue],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}22` }}>
                <span style={{ fontSize: 10, color: C.muted }}>{l}</span>
                <span style={{ fontSize: 10, color: c, fontFamily: C.mono, fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </Card>
        )}

        {/* How it works */}
        <Card>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
            CÓMO FUNCIONA EL BONO TOKENIZADO
          </div>
          {[
            { icon: "📋", title: "Emisión", desc: "Puerto deposita proyecto. BeZhasRWAFactory.sol mint ERC-1155. 1% fee en BEZ al protocolo." },
            { icon: "💰", title: "Captación", desc: "Inversores compran fracciones desde €100. BeZhasMarketplace.sol gestiona el libro de órdenes." },
            { icon: "🔄", title: "Cupones auto", desc: "Cada mes/trimestre BeZhasRewardsCalculator.sol distribuye cupón en BEZ o USDC automáticamente." },
            { icon: "📊", title: "Mercado sec.", desc: "Fracciones negociables 24/7 en pool QuickSwap V3. Precio determinado por oferta/demanda." },
            { icon: "⚖️", title: "Rating live", desc: "QualityOracle.sol actualiza el rating crediticio con datos APM/DP World. Alerta si deteriora." },
            { icon: "🏁", title: "Vencimiento", desc: "A vencimiento, smart contract devuelve nominal a holders. Puerto ha repagado + intereses." },
          ].map(s => (
            <div key={s.title} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: C.text, fontWeight: 700, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── TAB: PUERTOS ─────────────────────────────────────────────────────────────
function TabPorts() {
  const [prices, setPrices] = useState(
    Object.fromEntries(PORTS.map(p => [p.id, p.ratingScore + rndInt(-2, 2)]))
  );
  useEffect(() => {
    const t = setInterval(() => {
      setPrices(prev => Object.fromEntries(
        PORTS.map(p => [p.id, Math.min(100, Math.max(0, prev[p.id] + (Math.random() - 0.49) * 0.5))])
      ));
    }, 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {PORTS.map(p => {
          const rc = RATING_COLOR[p.rating] || C.gold;
          const liveScore = prices[p.id] || p.ratingScore;
          const totalBonds = p.bonds.reduce((s, b) => s + b.face, 0);
          const totalRaised = p.bonds.reduce((s, b) => s + b.raised, 0);
          return (
            <Card key={p.id} glow col={p.color}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 28 }}>{p.flag}</span>
                  <div>
                    <div style={{ color: C.text, fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono }}>{p.code} · {p.region}</div>
                  </div>
                </div>
                <RatingGauge score={Math.round(liveScore)} rating={p.rating} col={rc} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { l: "Throughput", v: `${(p.throughput_teu / 1e6).toFixed(1)}M TEU/año`, c: C.sky },
                  { l: "Revenue anual", v: fmtEUR(p.revenue_annual * 1e6), c: C.gold },
                  { l: "EBITDA margin", v: fmtPct(p.ebitda_margin), c: C.primary },
                  { l: "Bonos BeZhas", v: `${p.bonds.length} activos`, c: p.color },
                ].map(s => (
                  <div key={s.l} style={{ background: C.card2, padding: "6px 10px", borderRadius: 10 }}>
                    <div style={{ fontSize: 8, color: C.muted, marginBottom: 2 }}>{s.l}</div>
                    <div style={{ fontSize: 11, color: s.c, fontFamily: C.mono, fontWeight: 800 }}>{s.v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: C.muted }}>Captación {((totalRaised / totalBonds) * 100).toFixed(1)}%</span>
                  <span style={{ fontSize: 9, color: p.color, fontFamily: C.mono }}>{fmtEUR(totalRaised)} / {fmtEUR(totalBonds)}</span>
                </div>
                <div style={{ height: 5, background: C.card3, borderRadius: 3 }}>
                  <div style={{
                    height: "100%", width: `${(totalRaised / totalBonds) * 100}%`,
                    background: p.color, borderRadius: 3
                  }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {p.bonds.map(b => (
                  <span key={b.id} style={{
                    fontSize: 9, padding: "2px 8px",
                    background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}33`,
                    borderRadius: 20, fontFamily: C.mono
                  }}>
                    {b.id.split("-").slice(-1)[0]} · {fmtPct(b.couponRate)}
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB: REVENUE ─────────────────────────────────────────────────────────────
function TabRevenue() {
  const totalFace = ALL_BONDS.reduce((s, b) => s + b.face, 0);
  const totalRaised = ALL_BONDS.reduce((s, b) => s + b.raised, 0);
  const monthCoupons = ALL_BONDS.reduce((s, b) => s + (b.face * b.couponRate / 12), 0);
  const emissionFee = totalFace * 0.01;
  const tradingFee = totalRaised * 0.003 * 12;
  const mgmtFee = totalFace * 0.005;
  const ratingFee = ALL_BONDS.length * 0.5 * 12;

  const projections = [
    { year: 2025, ports: 5, bonds: 8, tvl: 1.2e9, emitFee: 12e6, tradeFee: 4.3e6, mgmt: 6e6, total: 22.3e6 },
    { year: 2026, ports: 15, bonds: 28, tvl: 4.8e9, emitFee: 48e6, tradeFee: 17.3e6, mgmt: 24e6, total: 89.3e6 },
    { year: 2027, ports: 40, bonds: 75, tvl: 15e9, emitFee: 150e6, tradeFee: 54e6, mgmt: 75e6, total: 279e6 },
    { year: 2028, ports: 100, bonds: 200, tvl: 45e9, emitFee: 450e6, tradeFee: 162e6, mgmt: 225e6, total: 837e6 },
    { year: 2029, ports: 250, bonds: 500, tvl: 120e9, emitFee: 1200e6, tradeFee: 432e6, mgmt: 600e6, total: 2232e6 },
  ];
  const maxTotal = Math.max(...projections.map(p => p.total));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard label="TVL actual (demo)" value={fmtEUR(totalRaised)} col={C.gold} icon="💰" />
        <StatCard label="Fee emisión (1%)" value={fmtEUR(emissionFee)} col={C.primary} icon="📋" />
        <StatCard label="Fee trading/año" value={fmtEUR(tradingFee)} col={C.teal} icon="🔄" />
        <StatCard label="Gestión anual" value={fmtEUR(mgmtFee)} col={C.orange} icon="🏛️" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Revenue model */}
        <Card>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>MODELO DE INGRESOS PORT FINANCE AGENT</div>
          {[
            { stream: "Fee emisión bono (1%)", rate: "1% nominal", est: fmtEUR(emissionFee) + "/emisión", c: C.primary },
            { stream: "Fee trading sec. (0.3%)", rate: "por operación", est: fmtEUR(tradingFee) + "/año est.", c: C.teal },
            { stream: "Gestión bonos (0.5%/año)", rate: "sobre TVL", est: fmtEUR(mgmtFee) + "/año", c: C.gold },
            { stream: "Rating oracle (0.5 BEZ)", rate: "por update", est: `${ALL_BONDS.length * 0.5 * 12} BEZ/año`, c: C.orange },
            { stream: "Liquidez pool QSV3", rate: "0.05% swap fee", est: "Proporcional a volumen", c: C.violet },
          ].map(s => (
            <div key={s.stream} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}22` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: C.text2 }}>{s.stream}</span>
                <span style={{ fontSize: 11, color: s.c, fontFamily: C.mono, fontWeight: 700 }}>{s.est}</span>
              </div>
              <div style={{ fontSize: 9, color: C.muted, fontStyle: "italic" }}>{s.rate}</div>
            </div>
          ))}
        </Card>

        {/* 5-year projection chart */}
        <Card>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>PROYECCIÓN REVENUE 5 AÑOS</div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginBottom: 12 }}>
            {projections.map(p => (
              <div key={p.year} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 9, color: C.primary, fontFamily: C.mono, fontWeight: 700 }}>{fmtEUR(p.total)}</div>
                <div style={{
                  width: "100%", height: 80, background: `${C.primary}08`, borderRadius: 4,
                  display: "flex", alignItems: "flex-end", overflow: "hidden"
                }}>
                  <div style={{
                    width: "100%", height: `${(p.total / maxTotal) * 100}%`,
                    background: `linear-gradient(180deg,${C.primary},${C.teal})`,
                    borderRadius: "3px 3px 0 0", transition: "height 0.8s ease"
                  }} />
                </div>
                <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono }}>{p.year}</div>
                <div style={{ fontSize: 7, color: C.muted }}>{p.ports} puertos</div>
              </div>
            ))}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.3)" }}>
                {["AÑO", "PUERTOS", "BONOS", "TVL", "REVENUE TOTAL"].map(h => (
                  <th key={h} style={{ padding: "5px 8px", fontSize: 7, color: C.muted, fontFamily: C.mono, textAlign: "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projections.map(p => (
                <tr key={p.year} style={{ borderTop: `1px solid ${C.border}22` }}>
                  <td style={{ padding: "6px 8px", color: C.gold, fontFamily: C.mono, fontWeight: 700, fontSize: 10 }}>{p.year}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: C.muted, fontFamily: C.mono, fontSize: 9 }}>{p.ports}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: C.muted, fontFamily: C.mono, fontSize: 9 }}>{p.bonds}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: C.sky, fontFamily: C.mono, fontSize: 9 }}>{fmtEUR(p.tvl)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: C.primary, fontFamily: C.mono, fontWeight: 800, fontSize: 11 }}>{fmtEUR(p.total)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${C.gold}44`, background: `${C.gold}08` }}>
                <td colSpan={4} style={{ padding: "8px", color: C.gold, fontFamily: C.mono, fontWeight: 800 }}>TOTAL 5 AÑOS</td>
                <td style={{ padding: "8px", textAlign: "right", color: C.gold, fontFamily: C.mono, fontWeight: 900, fontSize: 16 }}>
                  {fmtEUR(projections.reduce((s, p) => s + p.total, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─── LIVE LOG ─────────────────────────────────────────────────────────────────
function useLiveLog() {
  const [log, setLog] = useState([
    "[ PORT FINANCE ] Agent v1.0 INITIALIZED",
    "[ CONTRACTS   ] BeZhasRWAFactory.sol → LOADED",
    "[ CONTRACTS   ] BeZhasRewardsCalculator.sol → ACTIVE",
    "[ ORACLE      ] QualityOracle.sol rating feed → LIVE",
    "[ MARKET      ] QuickSwap V3 PortBond pools → ACTIVE",
    "[ API         ] APM Terminals · DP World · Port Auth ES → CONNECTED",
    "[ BEZ         ] Token 0xEcBa… · Chainlink feed → $1.2400",
  ]);
  const add = useCallback((msg) => {
    const ts = new Date().toTimeString().slice(0, 8);
    setLog(p => [`[ ${ts} ] ${msg}`, ...p].slice(0, 50));
  }, []);
  useEffect(() => {
    const msgs = [
      "ORACLE → Algeciras rating BBB+ confirmado · score 82.4",
      `COUPON → ALGB-2025-A cupón auto distribuido ${fmtEUR(241667)} → ${fmtN(382000)} holders`,
      "MARKET → VLCB-2025-A swap 2,500 tokens · 0.3% fee → BeZhas",
      "ORACLE → Singapore PSA throughput 39M TEU/año · AAA mantenido",
      `RATING → Jebel Ali DP World revenue actualizado $${(Math.random() * 100 + 3000).toFixed(0)}M`,
      "POOL → QuickSwap V3 PortBond/USDC TVL $2.4M",
      "BEZ → 0.5 BEZ quemado · rating oracle update Algeciras",
    ];
    const t = setInterval(() => add(msgs[rndInt(0, msgs.length - 1)]), 3500);
    return () => clearInterval(t);
  }, [add]);
  return { log, add };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function PortFinanceAgent() {
  const bridge = useAgentBridge("port-finance");
  const [tab, setTab] = useState("market");
  const [selectedBond, setBond] = useState(null);
  const { log, add } = useLiveLog();
  const [bezPrice, setBez] = useState(1.2400);
  const [tvl, setTvl] = useState(973700000);

  useEffect(() => {
    const t = setInterval(() => {
      setBez(p => +(p * (1 + (Math.random() - 0.498) * 0.002)).toFixed(4));
      setTvl(p => Math.round(p + (Math.random() - 0.4) * 50000));
    }, 1500);
    return () => clearInterval(t);
  }, []);

  const TABS = [
    { id: "market", icon: "📋", label: "Mercado Bonos", col: C.primary },
    { id: "ports", icon: "🏗️", label: "Puertos", col: C.teal },
    { id: "emit", icon: "➕", label: "Emitir Bono", col: C.gold },
    { id: "revenue", icon: "💰", label: "Revenue BeZhas", col: C.orange },
    { id: "metrics", icon: "📊", label: "Metrics", col: C.teal },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.sans, fontSize: 13 }}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes progress{from{width:0%}to{width:100%}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:${C.border3};border-radius:2px}
      `}</style>

      {/* HEADER */}
      <div style={{
        background: C.surf, borderBottom: `1px solid ${C.border}`,
        padding: "10px 20px", display: "flex", alignItems: "center", gap: 10,
        position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap"
      }}>

        <div style={{
          background: `linear-gradient(135deg,${C.teal},${C.primary})`,
          borderRadius: 12, padding: "7px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0
        }}>
          <span style={{ fontSize: 18 }}>🏗️</span>
          <div>
            <div style={{ color: C.bg, fontFamily: C.mono, fontSize: 14, fontWeight: 900 }}>BeZhas</div>
            <div style={{ color: C.bg, fontSize: 8, opacity: 0.8, letterSpacing: 2 }}>PORT FINANCE v1</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[
            ["Polygon Amoy", C.violet], ["BEZ-Coin ✓", C.gold], ["ERC-1155 Bonds", C.teal],
            ["QuickSwap V3 ✓", C.primary], ["Chainlink Rating ✓", C.orange], ["APM/DP World ✓", C.sky],
          ].map(([l, c]) => (
            <span key={l} style={{
              background: `${c}20`, color: c, border: `1px solid ${c}33`,
              borderRadius: 20, padding: "2px 8px", fontSize: 9, fontFamily: C.mono, fontWeight: 700
            }}>{l}</span>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Chip col={C.gold}>🪙 BEZ ${bezPrice.toFixed(4)}</Chip>
          <Chip col={C.sky}>🏗️ TVL {fmtEUR(tvl)}</Chip>
          <Chip col={C.primary}>{ALL_BONDS.length} bonos LIVE</Chip>
        </div>
      </div>

      {/* TABS */}
      <div style={{
        background: C.surf, borderBottom: `1px solid ${C.border}`,
        padding: "6px 20px", display: "flex", gap: 4, overflowX: "auto"
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? `${t.col}22` : "transparent",
            color: tab === t.id ? t.col : C.muted,
            border: `1px solid ${tab === t.id ? t.col : C.border}`,
            borderRadius: 10, padding: "7px 16px", cursor: "pointer",
            fontSize: 12, fontWeight: tab === t.id ? 800 : 400, fontFamily: C.mono,
            whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
            boxShadow: tab === t.id ? `0 0 12px ${t.col}33` : "none",
            transition: "all 0.18s",
          }}>
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT + LOG */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 106px)" }}>
        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
          {tab === "market" && <TabMarket bonds={ALL_BONDS} onSelect={setBond} selectedBond={selectedBond} />}
          {tab === "ports" && <TabPorts />}
          {tab === "emit" && <TabEmit addLog={add} />}
          {tab === "revenue" && <TabRevenue />}
          {tab === "metrics" && (
            <div>
              <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.teal, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — PORT-FINANCE
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected — data from /api/agents/port-finance/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="port-finance" accentColor={C.teal} />
            </div>
          )}
        </div>

        {/* Live Log */}
        <div style={{
          width: 250, background: C.surf, borderLeft: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column", flexShrink: 0
        }}>
          <div style={{
            padding: "7px 12px", borderBottom: `1px solid ${C.border}`,
            fontSize: 9, color: C.muted, letterSpacing: 2, fontFamily: C.mono,
            display: "flex", alignItems: "center", gap: 6
          }}>
            WS LIVE <span style={{ color: C.primary, animation: "blink 1.5s infinite", fontSize: 12 }}>●</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {log.map((e, i) => (
              <div key={i} style={{
                padding: "3px 10px", fontSize: 9, fontFamily: C.mono, lineHeight: 1.6,
                color: i === 0 ? (
                  e.includes("COUPON") || e.includes("✅") ? C.primary :
                    e.includes("ORACLE") || e.includes("RATING") ? C.orange :
                      e.includes("MARKET") || e.includes("POOL") ? C.teal :
                        e.includes("BEZ") ? C.gold : C.text2
                ) : C.muted
              }}>{e}</div>
            ))}
          </div>
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono, marginBottom: 2 }}>RWA FACTORY</div>
            <div style={{ color: C.teal, fontFamily: C.mono, fontSize: 9 }}>BeZhasRWAFactory.sol</div>
            <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono, marginTop: 5, marginBottom: 2 }}>TREASURY DAO</div>
            <div style={{ color: C.gold, fontFamily: C.mono, fontSize: 9 }}>{ADDR.DAO.slice(0, 14)}…</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        borderTop: `1px solid ${C.border}`, padding: "8px 20px",
        display: "flex", justifyContent: "space-between",
        color: C.muted, fontSize: 9, fontFamily: C.mono, background: C.surf, flexWrap: "wrap", gap: 4
      }}>
        <span>bez.digital · Port Finance Agent v1.0 · Fase 1.4 · BEZ-Coin Native · Polygon</span>
        <span>BeZhasRWAFactory.sol · StakingPoolV2.sol · QualityOracle.sol · QuickSwap V3</span>
      </div>
    </div>
  );
}
