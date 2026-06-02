import { useState, useEffect, useCallback } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

/* ═══════════════════════════════════════════════════════════════════════
   bez.digital — MARITIME INSURANCE AGENT v1.0  (Fase 1.5)
   Seguros Marítimos P&I On-Chain · Liquidación Automática IoT · Reservas en Staking
   ─────────────────────────────────────────────────────────────────────
   Blockchain:  Polygon Mainnet → BNB Chain (LayerZero)
   Contratos:
     • BEZ Token:      0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
     • QualityEscrow:  0x3EfC42095E8503d41Ad8001328FC23388E00e8a3
     • QualityOracle:  QualityOracle.sol (siniestros)
     • StakingPool:    StakingPoolV2.sol (reservas APY 8-15%)
     • NFT Policy:     BeZhasNFT.sol ERC-721 (póliza tokenizada)
   Backend:  api.bez.digital:3001 | ws.bez.digital:3002
   ─────────────────────────────────────────────────────────────────────
   MODELO BEZ:
     • Prima pagada en BEZ-Coin (o convertida automáticamente)
     • 80% prima → StakingPoolV2 generando APY 8-15% (reserva técnica)
     • 15% prima → Treasury DAO (margen de beneficio BeZhas)
     • 5%  prima → Fondo de garantía multilateral
     • Siniestro: QualityOracle verifica → liquidación on-chain automática
     • Reservas stakeadas: generan rendimiento MIENTRAS no hay siniestro
   APIS INTEGRADAS:
     • Chainlink Weather Oracle  → datos meteorológicos en ruta
     • AIS Marine Traffic API    → posición/velocidad buque en tiempo real
     • IoT Sensor Gateway        → temperatura, impactos, humedad
     • Lloyd's Open Market API   → historial de siniestros
     • IMO / IACS databases      → clasificación y estado del buque
     • Chainlink VRF             → aleatoriedad para pricing actuarial
═══════════════════════════════════════════════════════════════════════ */

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  bg: "#03060E", surf: "#070D1C", card: "#0C1628", card2: "#101E38",
  card3: "#142444", border: "#0D2040", border2: "#163560", border3: "#1E4A8A",
  primary: "#00C896", gold: "#FFB800", neon: "#00FFB2",
  blue: "#2563EB", violet: "#7C3AED", pink: "#EC4899",
  orange: "#F97316", red: "#EF4444", yellow: "#EAB308",
  cyan: "#06B6D4", emerald: "#10B981",
  text: "#E8F4FF", text2: "#A8C4E0", muted: "#3D5E80",
  mono: "'JetBrains Mono','Courier New',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
};

const ADDR = {
  BEZ: "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8",
  ESCROW: "0x3EfC42095E8503d41Ad8001328FC23388E00e8a3",
  DAO: "0x89c23890c742d710265dD61be789C71dC8999b12",
  HOT: "0x52Df82920CBAE522880dD7657e43d1A754eD044E",
};

// ─── PRODUCT TYPES ───────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    id: "hull", icon: "🚢", name: "Hull & Machinery",
    desc: "Daños físicos al casco, maquinaria y equipos del buque.",
    baseRate: 0.0045, maxCoverage: 200e6, currency: "USD",
    color: C.cyan, risk: "MEDIO",
    triggers: ["colisión", "encallamiento", "incendio", "hundimiento", "temporal severo"],
  },
  {
    id: "pi", icon: "⚓", name: "P&I (Protection & Indemnity)",
    desc: "Responsabilidad civil frente a terceros, tripulación y carga.",
    baseRate: 0.0032, maxCoverage: 1e9, currency: "USD",
    color: C.blue, risk: "ALTO",
    triggers: ["contaminación", "lesiones tripulación", "daños a terceros", "carga defectuosa"],
  },
  {
    id: "cargo", icon: "📦", name: "Cargo & Freight",
    desc: "Pérdida o daño de la mercancía durante el transporte marítimo.",
    baseRate: 0.0055, maxCoverage: 50e6, currency: "USD",
    color: C.primary, risk: "BAJO",
    triggers: ["robo", "daño agua", "rotura", "temperatura fuera rango", "pérdida total"],
  },
  {
    id: "war", icon: "⚠️", name: "War Risk",
    desc: "Cobertura de riesgos de guerra, piratería y actos terroristas.",
    baseRate: 0.0018, maxCoverage: 500e6, currency: "USD",
    color: C.orange, risk: "MUY ALTO",
    triggers: ["piratería", "acto terrorista", "embargo gubernamental", "zona de guerra"],
  },
];

// ─── ACTIVE POLICIES ─────────────────────────────────────────────────────────
const INIT_POLICIES = [
  {
    id: "POL-2025-0441", vessel: "MAERSK EDMONTON", imo: "9858648", flag: "🇩🇰",
    product: "hull", coverage: 85e6, premium: 382500, premiumBEZ: 308468,
    voyageFrom: "ES-ALG", voyageTo: "CN-SHA", cargo: "Electronics",
    startDate: "2025-03-01", endDate: "2025-09-01",
    status: "ACTIVE", riskScore: 72,
    iotTemp: 18.2, iotHumidity: 62, iotImpacts: 0,
    weatherAlert: false, routeRisk: "LOW",
    reserveStaked: 306000, reserveAPY: 9.2,
    stakingEarned: 2352,
    claimHistory: 0, lastPosition: "36.14°N 5.35°E",
  },
  {
    id: "POL-2025-0440", vessel: "MSC OSCAR", imo: "9703291", flag: "🇵🇦",
    product: "pi", coverage: 450e6, premium: 1440000, premiumBEZ: 1161290,
    voyageFrom: "CN-QIN", voyageTo: "DE-HAM", cargo: "Mixed Cargo",
    startDate: "2025-02-15", endDate: "2025-08-15",
    status: "ACTIVE", riskScore: 68,
    iotTemp: 22.1, iotHumidity: 71, iotImpacts: 2,
    weatherAlert: true, routeRisk: "MEDIUM",
    reserveStaked: 1152000, reserveAPY: 10.4,
    stakingEarned: 9984,
    claimHistory: 1, lastPosition: "38.92°N 1.45°E",
  },
  {
    id: "POL-2025-0438", vessel: "EVER GIVEN", imo: "9811000", flag: "🇵🇦",
    product: "cargo", coverage: 28e6, premium: 154000, premiumBEZ: 124194,
    voyageFrom: "KR-BUS", voyageTo: "NL-RTM", cargo: "Steel Coils",
    startDate: "2025-03-10", endDate: "2025-06-10",
    status: "CLAIM_OPEN", riskScore: 55,
    iotTemp: 24.8, iotHumidity: 88, iotImpacts: 7,
    weatherAlert: true, routeRisk: "HIGH",
    reserveStaked: 123200, reserveAPY: 11.1,
    stakingEarned: 1138,
    claimHistory: 2, lastPosition: "30.70°N 32.34°E",
    claimAmount: 4200000, claimStatus: "VERIFYING",
  },
  {
    id: "POL-2025-0437", vessel: "PRISM COURAGE", imo: "9628462", flag: "🇲🇭",
    product: "war", coverage: 320e6, premium: 576000, premiumBEZ: 464516,
    voyageFrom: "QA-RAS", voyageTo: "JP-TOK", cargo: "LNG",
    startDate: "2025-01-20", endDate: "2025-07-20",
    status: "ACTIVE", riskScore: 61,
    iotTemp: null, iotHumidity: null, iotImpacts: 0,
    weatherAlert: false, routeRisk: "HIGH",
    reserveStaked: 460800, reserveAPY: 13.5,
    stakingEarned: 5180,
    claimHistory: 0, lastPosition: "24.15°N 58.42°E",
  },
];

const STATUS_CFG = {
  ACTIVE: { c: C.primary, label: "● ACTIVA" },
  CLAIM_OPEN: { c: C.orange, label: "⚠ SINIESTRO" },
  CLAIM_PAID: { c: C.gold, label: "💰 LIQUIDADO" },
  EXPIRED: { c: C.muted, label: "EXPIRADA" },
  PENDING: { c: C.yellow, label: "⏳ PENDIENTE" },
};
const RISK_CFG = {
  LOW: { c: C.primary, label: "BAJO" },
  MEDIUM: { c: C.yellow, label: "MEDIO" },
  HIGH: { c: C.orange, label: "ALTO" },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmtUSD = n => {
  if (!n && n !== 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};
const fmtBEZ = n => n ? `${Math.round(n).toLocaleString("es-ES")} BEZ` : "—";
const fmtPct = n => `${(n * 100).toFixed(2)}%`;
const rndInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rndHex = n => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
const Card = ({ children, style = {}, glow, col }) => (
  <div style={{
    background: C.card, border: `1px solid ${glow && col ? col + "55" : C.border}`,
    borderRadius: 16, padding: 16, boxShadow: glow && col ? `0 0 22px ${col}18` : "none", ...style
  }}>
    {children}
  </div>
);
const Chip = ({ children, col = C.primary, sm }) => (
  <span style={{
    background: `${col}20`, color: col, border: `1px solid ${col}44`,
    borderRadius: 20, padding: sm ? "1px 8px" : "3px 11px",
    fontSize: sm ? 9 : 10, fontFamily: C.mono, fontWeight: 800, whiteSpace: "nowrap"
  }}>
    {children}
  </span>
);
const Btn = ({ children, onClick, col = C.primary, sm, full, disabled, icon }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: full ? "100%" : undefined,
    background: disabled ? C.card2 : `linear-gradient(135deg,${col},${col}bb)`,
    color: disabled ? C.muted : (col === C.gold || col === "#EAB308" ? "#0a0a0a" : C.bg),
    border: "none", borderRadius: 11, padding: sm ? "5px 13px" : full ? "13px 20px" : "10px 20px",
    fontSize: sm ? 11 : 13, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: C.mono, boxShadow: disabled ? "none" : `0 0 16px ${col}44`,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.18s",
  }}>
    {icon && <span style={{ fontSize: sm ? 12 : 15 }}>{icon}</span>}
    <span>{children}</span>
  </button>
);
const StatCard = ({ label, value, sub, col, icon }) => (
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

// ─── IOT GAUGE ────────────────────────────────────────────────────────────────
function IoTGauge({ label, value, unit, min, max, warn, danger, col }) {
  if (value === null || value === undefined) return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 8, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ color: C.muted, fontFamily: C.mono, fontSize: 12 }}>N/A</div>
    </div>
  );
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const color = value >= danger ? C.red : value >= warn ? C.orange : col;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 8, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, color, fontFamily: C.mono, fontWeight: 900, marginBottom: 4 }}>
        {value}{unit}
      </div>
      <div style={{ height: 3, background: C.card3, borderRadius: 2, width: 60, margin: "0 auto" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function TabPolicies({ policies, setPolicies, addLog }) {
  const [selected, setSelected] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimStep, setClaimStep] = useState(0);

  const openClaim = async (pol) => {
    setClaiming(true); setClaimStep(0);
    addLog(`⚠️ Apertura siniestro ${pol.id} — ${pol.vessel}`);
    const steps = [
      [1, 700, "IoT Gateway: verificando sensores de impacto en tiempo real…"],
      [2, 1600, "Chainlink Weather: consultando condiciones meteorológicas en ruta…"],
      [3, 2600, "AIS: confirmando posición y velocidad del buque…"],
      [4, 3700, "QualityOracle.sol: evaluando evidencias on-chain…"],
      [5, 4800, "Claude AI: análisis multimodal de daños + estimación…"],
      [6, 5900, "✅ Siniestro verificado — iniciando liquidación automática desde escrow"],
    ];
    steps.forEach(([s, d, msg]) => {
      setTimeout(() => {
        setClaimStep(s);
        addLog(msg);
        if (s === 6) {
          setPolicies(prev => prev.map(p =>
            p.id === pol.id
              ? {
                ...p, status: "CLAIM_PAID", claimStatus: "PAID",
                claimAmount: pol.claimAmount || pol.coverage * 0.15
              }
              : p
          ));
          setClaiming(false); setClaimStep(0);
          addLog(`💰 Pago automático: ${fmtUSD(pol.claimAmount || pol.coverage * 0.15)} → ${pol.vessel}`);
        }
      }, d);
    });
  };

  const totalPremium = policies.reduce((s, p) => s + p.premiumBEZ, 0);
  const totalCoverage = policies.reduce((s, p) => s + p.coverage, 0);
  const totalStaked = policies.reduce((s, p) => s + p.reserveStaked, 0);
  const totalEarned = policies.reduce((s, p) => s + p.stakingEarned, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard label="Pólizas activas" value={policies.filter(p => p.status === "ACTIVE").length} col={C.primary} icon="📋" />
        <StatCard label="Cobertura total" value={fmtUSD(totalCoverage)} col={C.cyan} icon="🛡️" />
        <StatCard label="Reserva stakeada" value={fmtBEZ(totalStaked)} col={C.gold} icon="🏦" />
        <StatCard label="APY ganado" value={fmtBEZ(totalEarned)} col={C.emerald} icon="📈" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {policies.map(pol => {
          const sc = STATUS_CFG[pol.status] || STATUS_CFG.ACTIVE;
          const prd = PRODUCTS.find(p => p.id === pol.product);
          const rc = RISK_CFG[pol.routeRisk] || RISK_CFG.LOW;
          const isOpen = selected === pol.id;

          return (
            <div key={pol.id}
              onClick={() => setSelected(isOpen ? null : pol.id)}
              style={{
                background: isOpen ? C.card2 : C.card,
                border: `1px solid ${isOpen ? prd?.color + "66" : C.border}`,
                borderLeft: `4px solid ${prd?.color}`,
                borderRadius: 14, padding: 14, cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: isOpen ? `0 0 20px ${prd?.color}10` : "none"
              }}>

              {/* Header row */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                flexWrap: "wrap", gap: 8, marginBottom: 10
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 26 }}>{pol.flag}</span>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                      <span style={{ color: C.text, fontWeight: 800, fontSize: 13 }}>{pol.vessel}</span>
                      <Chip col={sc.c} sm>{sc.label}</Chip>
                      <Chip col={prd?.color} sm>{prd?.icon} {prd?.name}</Chip>
                    </div>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono }}>
                      {pol.id} · IMO {pol.imo} · {pol.voyageFrom} → {pol.voyageTo}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {[
                    { l: "Cobertura", v: fmtUSD(pol.coverage), c: C.cyan },
                    { l: "Prima (BEZ)", v: fmtBEZ(pol.premiumBEZ), c: C.gold },
                    { l: "Ruta", v: rc.label, c: rc.c },
                    { l: "Risk Score", v: `${pol.riskScore}/100`, c: pol.riskScore > 75 ? C.primary : pol.riskScore > 55 ? C.yellow : C.orange },
                  ].map(s => (
                    <div key={s.l} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono }}>{s.l}</div>
                      <div style={{ fontSize: 11, color: s.c, fontFamily: C.mono, fontWeight: 800 }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* IoT strip */}
              <div style={{
                display: "flex", gap: 20, padding: "8px 14px",
                background: C.card3, borderRadius: 10, marginBottom: 8,
                justifyContent: "space-around", flexWrap: "wrap"
              }}>
                <IoTGauge label="TEMPERATURA" value={pol.iotTemp} unit="°C"
                  min={-20} max={60} warn={35} danger={45} col={C.cyan} />
                <IoTGauge label="HUMEDAD" value={pol.iotHumidity} unit="%"
                  min={0} max={100} warn={80} danger={90} col={C.blue} />
                <IoTGauge label="IMPACTOS" value={pol.iotImpacts} unit="g"
                  min={0} max={20} warn={5} danger={10} col={C.primary} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: C.muted, marginBottom: 4 }}>ALERTA CLIMA</div>
                  <div style={{ fontSize: 20 }}>{pol.weatherAlert ? "⛈️" : "☀️"}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: C.muted, marginBottom: 4 }}>RESERVA APY</div>
                  <div style={{ fontSize: 14, color: C.emerald, fontFamily: C.mono, fontWeight: 800 }}>
                    {pol.reserveAPY}%
                  </div>
                </div>
              </div>

              {/* Reserve bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: C.muted }}>
                    Reserva técnica stakeada (80% prima)
                  </span>
                  <span style={{ fontSize: 9, color: C.emerald, fontFamily: C.mono }}>
                    +{fmtBEZ(pol.stakingEarned)} ganado
                  </span>
                </div>
                <div style={{ height: 4, background: C.card3, borderRadius: 2 }}>
                  <div style={{
                    height: "100%", width: "80%",
                    background: `linear-gradient(90deg,${C.emerald},${C.primary})`,
                    borderRadius: 2
                  }} />
                </div>
              </div>

              {/* Expanded */}
              {isOpen && (
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Detail */}
                  <div style={{ background: C.card3, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>
                      DETALLES PÓLIZA
                    </div>
                    {[
                      ["Carga asegurada", pol.cargo],
                      ["Prima USD", fmtUSD(pol.premium)],
                      ["Prima BEZ", fmtBEZ(pol.premiumBEZ)],
                      ["Reserva stakeada", fmtBEZ(pol.reserveStaked)],
                      ["APY reserva", `${pol.reserveAPY}%`],
                      ["Inicio vigencia", pol.startDate],
                      ["Fin vigencia", pol.endDate],
                      ["Siniestros prev.", pol.claimHistory],
                      ["Última posición", pol.lastPosition],
                    ].map(([l, v]) => (
                      <div key={l} style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "4px 0", borderBottom: `1px solid ${C.border}22`
                      }}>
                        <span style={{ fontSize: 10, color: C.muted }}>{l}</span>
                        <span style={{ fontSize: 10, color: C.text2, fontFamily: C.mono, fontWeight: 700 }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Claim or staking */}
                  <div style={{ background: C.card3, borderRadius: 12, padding: 12 }}>
                    {pol.status === "CLAIM_OPEN" && !claiming && (
                      <>
                        <div style={{ fontSize: 8, color: C.orange, letterSpacing: 2, marginBottom: 10 }}>
                          ⚠️ SINIESTRO ABIERTO — VERIFICACIÓN IA
                        </div>
                        <div style={{
                          padding: "8px 10px", background: `${C.orange}10`,
                          border: `1px solid ${C.orange}33`, borderRadius: 8, marginBottom: 10
                        }}>
                          <div style={{ fontSize: 10, color: C.orange, marginBottom: 4 }}>
                            Importe reclamado: {fmtUSD(pol.claimAmount)}
                          </div>
                          <div style={{ fontSize: 9, color: C.muted }}>
                            Impactos IoT: {pol.iotImpacts}g · Humedad: {pol.iotHumidity}% · Alerta clima activa
                          </div>
                        </div>
                        {claimStep === 0 && (
                          <Btn onClick={() => openClaim(pol)} col={C.orange} full icon="🤖">
                            VERIFICAR Y LIQUIDAR CON IA
                          </Btn>
                        )}
                      </>
                    )}
                    {claiming && selected === pol.id && (
                      <div>
                        <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
                          PROCESO DE VERIFICACIÓN
                        </div>
                        {[
                          [1, "IoT Gateway — sensores impacto"],
                          [2, "Chainlink Weather Oracle"],
                          [3, "AIS posición buque"],
                          [4, "QualityOracle.sol on-chain"],
                          [5, "Claude AI análisis daños"],
                          [6, "Liquidación automática"],
                        ].map(([s, label]) => (
                          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                              background: claimStep > s ? `${C.primary}22` : claimStep === s ? `${C.orange}22` : C.card2,
                              border: `1.5px solid ${claimStep > s ? C.primary : claimStep === s ? C.orange : C.border}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: claimStep > s ? C.primary : claimStep === s ? C.orange : C.muted,
                              fontSize: 9, fontWeight: 900
                            }}>
                              {claimStep > s ? "✓" : s}
                            </div>
                            <span style={{ fontSize: 10, color: claimStep >= s ? C.text2 : C.muted }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {pol.status === "CLAIM_PAID" && (
                      <div style={{
                        padding: 12, background: `${C.primary}08`,
                        border: `1px solid ${C.primary}33`, borderRadius: 10, textAlign: "center"
                      }}>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
                        <div style={{ fontSize: 11, color: C.primary, fontWeight: 800 }}>SINIESTRO LIQUIDADO</div>
                        <div style={{ fontSize: 14, color: C.gold, fontFamily: C.mono, fontWeight: 900, marginTop: 4 }}>
                          {fmtUSD(pol.claimAmount)}
                        </div>
                        <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>
                          Pagado automáticamente desde QualityEscrow
                        </div>
                      </div>
                    )}
                    {pol.status === "ACTIVE" && (
                      <div>
                        <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>
                          RESERVA TÉCNICA — STAKING ACTIVO
                        </div>
                        {[
                          { l: "Reserva stakeada", v: fmtBEZ(pol.reserveStaked), c: C.gold },
                          { l: "APY actual", v: `${pol.reserveAPY}%`, c: C.emerald },
                          { l: "Ganado hasta hoy", v: fmtBEZ(pol.stakingEarned), c: C.emerald },
                          { l: "Contrato", v: "StakingPoolV2.sol", c: C.blue },
                        ].map(([l, v, c]) => (
                          <div key={l} style={{
                            display: "flex", justifyContent: "space-between",
                            padding: "5px 0", borderBottom: `1px solid ${C.border}22`
                          }}>
                            <span style={{ fontSize: 10, color: C.muted }}>{l}</span>
                            <span style={{ fontSize: 10, color: c, fontFamily: C.mono, fontWeight: 700 }}>{v}</span>
                          </div>
                        ))}
                        <div style={{
                          marginTop: 10, padding: "8px 10px",
                          background: `${C.emerald}10`, border: `1px solid ${C.emerald}22`,
                          borderRadius: 8, fontSize: 9, color: C.muted
                        }}>
                          💡 El 80% de la prima está stakeando. Si no hay siniestro, BeZhas gana el APY. Si hay siniestro, la reserva cubre el pago instantáneamente.
                        </div>
                      </div>
                    )}
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

// ─── TAB: NUEVA PÓLIZA ───────────────────────────────────────────────────────
function TabNewPolicy({ addLog }) {
  const [vessel, setVessel] = useState("");
  const [imo, setImo] = useState("");
  const [product, setProduct] = useState("hull");
  const [coverage, setCov] = useState("5000000");
  const [voyage, setVoyage] = useState("");
  const [cargo, setCargo] = useState("");
  const [step, setStep] = useState(0);
  const [quote, setQuote] = useState(null);
  const [issued, setIssued] = useState(null);

  const prd = PRODUCTS.find(p => p.id === product);

  const calcQuote = () => {
    if (!vessel || !coverage) return;
    const nom = Number(coverage);
    const riskMult = product === "war" ? 1.8 : product === "pi" ? 1.3 : 1.0;
    const premium = nom * prd.baseRate * riskMult;
    const premBEZ = premium / 1.24;
    const reserve = premBEZ * 0.80;
    const daoFee = premBEZ * 0.15;
    const fund = premBEZ * 0.05;
    const apy = 8 + Math.random() * 7;
    setQuote({ nom, premium, premBEZ, reserve, daoFee, fund, apy: +apy.toFixed(1) });
  };

  const issuePolicy = async () => {
    if (!quote) return;
    setStep(1);
    addLog(`📋 Emitiendo póliza: ${vessel} — ${prd.name}`);
    const stepList = [
      [1, 700, "Verificando IMO + historial Lloyd's…"],
      [2, 1600, "QualityOracle: calculando risk score…"],
      [3, 2500, "Staking 80% prima en StakingPoolV2.sol…"],
      [4, 3500, "Minting NFT póliza ERC-721 en Polygon…"],
      [5, 4500, "Activando oráculos IoT + Weather + AIS…"],
      [6, 5400, "✅ Póliza ACTIVA — cobertura on-chain"],
    ];
    stepList.forEach(([s, d, msg]) => {
      setTimeout(() => {
        setStep(s); addLog(msg);
        if (s === 6) {
          setIssued({
            id: `POL-2025-0${rndInt(450, 999)}`,
            txHash: `0x${rndHex(64)}`,
            nftId: rndInt(1000, 9999),
          });
          setTimeout(() => setStep(0), 2500);
        }
      }, d);
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Card glow col={C.cyan} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 14 }}>
            NUEVA PÓLIZA MARÍTIMA ON-CHAIN
          </div>

          {/* Product selector */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 8 }}>TIPO DE SEGURO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {PRODUCTS.map(p => (
                <button key={p.id} onClick={() => setProduct(p.id)} style={{
                  padding: "8px 10px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                  background: product === p.id ? `${p.color}18` : C.card2,
                  border: `1px solid ${product === p.id ? p.color : C.border}`,
                  transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: 16, marginBottom: 3 }}>{p.icon}</div>
                  <div style={{ fontSize: 10, color: product === p.id ? p.color : C.text2, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 8, color: C.muted }}>{fmtPct(p.baseRate)} base</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          {[
            { l: "Nombre del buque", val: vessel, set: setVessel, ph: "Ej: MAERSK EDMONTON", t: "text" },
            { l: "IMO Number", val: imo, set: setImo, ph: "9858648", t: "text" },
            { l: "Suma asegurada (USD)", val: coverage, set: setCov, ph: "5000000", t: "number" },
            { l: "Viaje (origen→destino)", val: voyage, set: setVoyage, ph: "ES-ALG → CN-SHA", t: "text" },
            { l: "Tipo de carga", val: cargo, set: setCargo, ph: "Electronics / Oil…", t: "text" },
          ].map(f => (
            <div key={f.l} style={{
              background: C.card2, border: `1px solid ${C.border2}`,
              borderRadius: 11, padding: "10px 13px", marginBottom: 8
            }}>
              <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>{f.l}</div>
              <input type={f.t} value={f.val} placeholder={f.ph}
                onChange={e => f.set(e.target.value)}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  color: C.text, fontFamily: C.mono, fontSize: 18, fontWeight: 800, width: "100%"
                }} />
            </div>
          ))}

          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={calcQuote} col={C.cyan} full icon="🧮" disabled={!vessel || !coverage}>
              CALCULAR PRIMA
            </Btn>
          </div>
        </Card>
      </div>

      {/* Quote + issue */}
      <div>
        {quote && (
          <Card glow col={C.primary} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
              COTIZACIÓN — {prd?.icon} {prd?.name}
            </div>
            {[
              { l: "Suma asegurada", v: fmtUSD(quote.nom), c: C.cyan },
              { l: "Prima anual (USD)", v: fmtUSD(quote.premium), c: C.gold },
              { l: "Prima en BEZ", v: fmtBEZ(quote.premBEZ), c: C.gold },
              { l: "80% → StakingPool", v: fmtBEZ(quote.reserve), c: C.emerald },
              { l: "APY estimado", v: `${quote.apy}%`, c: C.emerald },
              { l: "15% → DAO Treasury", v: fmtBEZ(quote.daoFee), c: C.orange },
              { l: "5% → Fondo garantía", v: fmtBEZ(quote.fund), c: C.blue },
            ].map(r => (
              <div key={r.l} style={{
                display: "flex", justifyContent: "space-between",
                padding: "6px 0", borderBottom: `1px solid ${C.border}22`
              }}>
                <span style={{ fontSize: 10, color: C.muted }}>{r.l}</span>
                <span style={{ fontSize: 11, color: r.c, fontFamily: C.mono, fontWeight: 800 }}>{r.v}</span>
              </div>
            ))}

            <div style={{
              marginTop: 12, padding: "8px 12px", background: `${C.emerald}10`,
              border: `1px solid ${C.emerald}22`, borderRadius: 10, marginBottom: 12
            }}>
              <div style={{ fontSize: 9, color: C.emerald, marginBottom: 2 }}>💡 Reserva técnica trabajando para ti</div>
              <div style={{ fontSize: 10, color: C.muted }}>
                Si no hay siniestro en 12 meses, la reserva genera +{fmtBEZ(quote.reserve * quote.apy / 100)} en BEZ. BeZhas comparte ese rendimiento contigo: 50% retorno al asegurado al vencimiento.
              </div>
            </div>

            {step === 0 && !issued && (
              <Btn onClick={issuePolicy} col={C.primary} full icon="📋">
                EMITIR PÓLIZA ON-CHAIN (1% comisión gestión)
              </Btn>
            )}

            {step > 0 && step < 6 && (
              <div style={{ marginTop: 4 }}>
                {[[1, "Lloyd's IMO verificación"], [2, "Risk score oracle"], [3, "Staking reserva"], [4, "NFT póliza mint"], [5, "Oráculos IoT/AIS"]].map(([s, l]) => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                      background: step > s ? `${C.primary}22` : step === s ? `${C.cyan}22` : C.card3,
                      border: `1.5px solid ${step > s ? C.primary : step === s ? C.cyan : C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: step > s ? C.primary : step === s ? C.cyan : C.muted, fontSize: 9, fontWeight: 900
                    }}>
                      {step > s ? "✓" : s}
                    </div>
                    <span style={{ fontSize: 10, color: step >= s ? C.text2 : C.muted }}>{l}</span>
                  </div>
                ))}
              </div>
            )}

            {issued && step === 0 && (
              <div style={{
                marginTop: 10, padding: 12, background: `${C.primary}08`,
                border: `1px solid ${C.primary}33`, borderRadius: 10
              }}>
                <div style={{ fontSize: 11, color: C.primary, fontWeight: 800, marginBottom: 8 }}>
                  ✅ PÓLIZA EMITIDA
                </div>
                {[
                  ["Policy ID", issued.id],
                  ["NFT Token", `#${issued.nftId}`],
                  ["TX Hash", `0x${issued.txHash.slice(2, 12)}…`],
                ].map(([l, v]) => (
                  <div key={l} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "4px 0", borderBottom: `1px solid ${C.border}22`
                  }}>
                    <span style={{ fontSize: 9, color: C.muted }}>{l}</span>
                    <span style={{ fontSize: 9, color: C.primary, fontFamily: C.mono }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* How it works */}
        <Card>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
            MODELO ÚNICO — RESERVA TÉCNICA EN STAKING
          </div>
          {[
            { icon: "💳", t: "Prima en BEZ", d: "Cliente paga prima en BEZ-Coin. Conversión automática desde cualquier token via Smart Swap." },
            { icon: "🏦", t: "80% → StakingPoolV2", d: "La reserva técnica no duerme: genera APY 8-15% mientras la póliza está activa." },
            { icon: "🤖", t: "IoT + IA verifica", d: "Sensores en tiempo real + Claude AI analizan cualquier incidente automáticamente." },
            { icon: "⚡", t: "Liquidación en minutos", d: "Siniestro verificado → QualityOracle.sol → pago instantáneo desde escrow. Sin gestores." },
            { icon: "🏁", t: "Sin siniestro → bonus", d: "Al vencimiento, 50% del rendimiento de staking devuelto al asegurado como incentivo." },
          ].map(s => (
            <div key={s.t} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: C.text, fontWeight: 700, marginBottom: 2 }}>{s.t}</div>
                <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.6 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── TAB: RESERVAS ───────────────────────────────────────────────────────────
function TabReserves({ policies }) {
  const [apyLive, setApy] = useState(
    Object.fromEntries(INIT_POLICIES.map(p => [p.id, p.reserveAPY]))
  );
  useEffect(() => {
    const t = setInterval(() => {
      setApy(prev => Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, +(v + (Math.random() - 0.49) * 0.1).toFixed(1)])
      ));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const totalStaked = policies.reduce((s, p) => s + p.reserveStaked, 0);
  const totalEarned = policies.reduce((s, p) => s + p.stakingEarned, 0);
  const avgAPY = policies.reduce((s, p) => s + (apyLive[p.id] || p.reserveAPY), 0) / policies.length;

  const projections = [
    { y: "2025", tvl: 2.1e6, earned: 168e3, policies: 12 },
    { y: "2026", tvl: 18e6, earned: 1.8e6, policies: 85 },
    { y: "2027", tvl: 95e6, earned: 10.9e6, policies: 420 },
    { y: "2028", tvl: 380e6, earned: 45.6e6, policies: 1800 },
    { y: "2029", tvl: 1.2e9, earned: 156e6, policies: 6500 },
  ];
  const maxTvl = Math.max(...projections.map(p => p.tvl));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard label="Total reserva stakeada" value={fmtBEZ(totalStaked)} col={C.gold} icon="🏦" />
        <StatCard label="APY promedio" value={`${avgAPY.toFixed(1)}%`} col={C.emerald} icon="📈" />
        <StatCard label="Rendimiento acumulado" value={fmtBEZ(totalEarned)} col={C.primary} icon="💰" />
        <StatCard label="Pólizas activas" value={policies.filter(p => p.status === "ACTIVE").length} col={C.cyan} icon="📋" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Staking pools por póliza */}
        <Card>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
            RESERVAS POR PÓLIZA — STAKING POOL V2
          </div>
          {policies.map(pol => {
            const apy = apyLive[pol.id] || pol.reserveAPY;
            const monthEarn = pol.reserveStaked * (apy / 100) / 12;
            return (
              <div key={pol.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}22` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 14 }}>{pol.flag}</span>
                    <span style={{ fontSize: 10, color: C.text2, fontWeight: 700 }}>
                      {pol.vessel.split(" ").pop()}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 8, color: C.muted }}>STAKED</div>
                      <div style={{ fontSize: 10, color: C.gold, fontFamily: C.mono, fontWeight: 700 }}>
                        {fmtBEZ(pol.reserveStaked)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 8, color: C.muted }}>APY LIVE</div>
                      <div style={{ fontSize: 11, color: C.emerald, fontFamily: C.mono, fontWeight: 900 }}>
                        {apy.toFixed(1)}%
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 8, color: C.muted }}>/MES</div>
                      <div style={{ fontSize: 10, color: C.primary, fontFamily: C.mono, fontWeight: 700 }}>
                        +{fmtBEZ(monthEarn)}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ height: 3, background: C.card3, borderRadius: 2 }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, (pol.reserveStaked / totalStaked) * 100 * 3)}%`,
                    background: `linear-gradient(90deg,${C.emerald},${C.primary})`, borderRadius: 2
                  }} />
                </div>
              </div>
            );
          })}
          <div style={{
            marginTop: 12, padding: "8px 12px",
            background: `${C.emerald}10`, border: `1px solid ${C.emerald}22`, borderRadius: 10
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: C.muted }}>Rendimiento total/mes</span>
              <span style={{ color: C.emerald, fontFamily: C.mono, fontWeight: 800, fontSize: 12 }}>
                +{fmtBEZ(totalStaked * (avgAPY / 100) / 12)}
              </span>
            </div>
          </div>
        </Card>

        {/* 5Y projection */}
        <Card>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
            PROYECCIÓN TVL RESERVAS — 5 AÑOS
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "flex-end", marginBottom: 12 }}>
            {projections.map(p => (
              <div key={p.y} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ fontSize: 9, color: C.emerald, fontFamily: C.mono, fontWeight: 700 }}>
                  {fmtUSD(p.tvl)}
                </div>
                <div style={{
                  width: "100%", height: 80, background: `${C.emerald}08`, borderRadius: 4,
                  display: "flex", alignItems: "flex-end", overflow: "hidden"
                }}>
                  <div style={{
                    width: "100%", height: `${(p.tvl / maxTvl) * 100}%`,
                    background: `linear-gradient(180deg,${C.emerald},${C.primary})`,
                    borderRadius: "3px 3px 0 0", transition: "height 0.8s ease"
                  }} />
                </div>
                <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono }}>{p.y}</div>
                <div style={{ fontSize: 7, color: C.muted }}>{p.policies} pólizas</div>
              </div>
            ))}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.3)" }}>
                {["AÑO", "TVL RESERVAS", "RENDIMIENTO", "PÓLIZAS"].map(h => (
                  <th key={h} style={{
                    padding: "5px 8px", fontSize: 7, color: C.muted,
                    fontFamily: C.mono, textAlign: "right"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projections.map(p => (
                <tr key={p.y} style={{ borderTop: `1px solid ${C.border}22` }}>
                  <td style={{ padding: "6px 8px", color: C.gold, fontFamily: C.mono, fontSize: 10, fontWeight: 700 }}>{p.y}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: C.cyan, fontFamily: C.mono, fontSize: 9 }}>{fmtUSD(p.tvl)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: C.emerald, fontFamily: C.mono, fontSize: 10, fontWeight: 700 }}>{fmtUSD(p.earned)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: C.muted, fontFamily: C.mono, fontSize: 9 }}>{p.policies}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${C.gold}44`, background: `${C.gold}08` }}>
                <td colSpan={2} style={{ padding: "8px", color: C.gold, fontFamily: C.mono, fontWeight: 800 }}>TOTAL RENDIMIENTO 5A</td>
                <td colSpan={2} style={{ padding: "8px", textAlign: "right", color: C.emerald, fontFamily: C.mono, fontWeight: 900, fontSize: 16 }}>
                  {fmtUSD(projections.reduce((s, p) => s + p.earned, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─── LIVE LOG HOOK ────────────────────────────────────────────────────────────
function useLiveLog() {
  const [log, setLog] = useState([
    "[ INSURANCE ] Maritime Insurance Agent v1.0 INITIALIZED",
    "[ STAKING   ] StakingPoolV2.sol → reservas técnicas ACTIVAS",
    "[ IOT       ] Sensor gateway → 4 buques monitorizados",
    "[ ORACLE    ] Chainlink Weather + AIS feed → LIVE",
    "[ AI        ] Claude Sonnet siniestros → READY",
    "[ BEZ       ] Token 0xEcBa… | Prima en BEZ activa",
    "[ LLOYDS    ] Lloyd's Open Market API → CONNECTED",
  ]);
  const add = useCallback((msg) => {
    const ts = new Date().toTimeString().slice(0, 8);
    setLog(p => [`[ ${ts} ] ${msg}`, ...p].slice(0, 50));
  }, []);
  useEffect(() => {
    const msgs = [
      "IOT → MAERSK EDMONTON: temp 18.2°C · humedad 62% · OK",
      "WEATHER → MSC OSCAR: alerta ciclón tropical zona Mediterráneo",
      "AIS → EVER GIVEN: posición 30.70°N 32.34°E · velocidad 14.2kn",
      "STAKING → Reserva ALGB-POL-0441 APY 9.2% → +12.8 BEZ/hora",
      `ORACLE → Risk recalculated: PRISM COURAGE War Risk score 61/100`,
      "CLAIM → EVER GIVEN: IoT impact 7g detectado · apertura automática",
      "BEZ → 0.5 BEZ quemado · oracle rating update",
    ];
    const t = setInterval(() => add(msgs[rndInt(0, msgs.length - 1)]), 3500);
    return () => clearInterval(t);
  }, [add]);
  return { log, add };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function MaritimeInsuranceAgent() {
  const bridge = useAgentBridge("maritime-insurance");
  const [tab, setTab] = useState("policies");
  const [policies, setPolicies] = useState(INIT_POLICIES);
  const { log, add } = useLiveLog();
  const [bezPrice, setBez] = useState(1.2400);
  const [totalTVL, setTvl] = useState(2041000);

  useEffect(() => {
    const t = setInterval(() => {
      setBez(p => +(p * (1 + (Math.random() - 0.498) * 0.002)).toFixed(4));
      setTvl(p => Math.round(p + (Math.random() - 0.4) * 500));
    }, 1500);
    return () => clearInterval(t);
  }, []);

  const activeClaims = policies.filter(p => p.status === "CLAIM_OPEN").length;
  const totalCov = policies.reduce((s, p) => s + p.coverage, 0);
  const totalPrem = policies.reduce((s, p) => s + p.premiumBEZ, 0);

  const TABS = [
    { id: "policies", icon: "📋", label: "Pólizas", col: C.primary },
    { id: "new", icon: "➕", label: "Nueva Póliza", col: C.cyan },
    { id: "reserves", icon: "🏦", label: "Reservas APY", col: C.emerald },
    { id: "metrics", icon: "📊", label: "Metrics", col: C.cyan },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.sans, fontSize: 13 }}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes progress{from{width:0%}to{width:100%}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:${C.border3};border-radius:2px}
      `}</style>

      {/* HEADER */}
      <div style={{
        background: C.surf, borderBottom: `1px solid ${C.border}`, padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap"
      }}>

        <div style={{
          background: `linear-gradient(135deg,${C.cyan},${C.primary})`,
          borderRadius: 12, padding: "7px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0
        }}>
          <span style={{ fontSize: 18 }}>⚓</span>
          <div>
            <div style={{ color: C.bg, fontFamily: C.mono, fontSize: 14, fontWeight: 900 }}>BeZhas</div>
            <div style={{ color: C.bg, fontSize: 8, opacity: 0.8, letterSpacing: 2 }}>MARITIME INSUR. v1</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[
            ["Polygon ✓", C.violet], ["BEZ-Coin ✓", C.gold], ["IoT Oracles ✓", C.cyan],
            ["Chainlink Weather", C.orange], ["StakingPool V2 ✓", C.emerald], ["Lloyd's API", C.blue],
          ].map(([l, c]) => (
            <span key={l} style={{
              background: `${c}20`, color: c, border: `1px solid ${c}33`,
              borderRadius: 20, padding: "2px 8px", fontSize: 9, fontFamily: C.mono, fontWeight: 700
            }}>{l}</span>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Chip col={C.gold}>🪙 BEZ ${bezPrice.toFixed(4)}</Chip>
          <Chip col={C.emerald}>🏦 {fmtUSD(totalTVL)} staked</Chip>
          {activeClaims > 0 && (
            <Chip col={C.orange}>⚠️ {activeClaims} siniestro{activeClaims > 1 ? "s" : ""}</Chip>
          )}
          <Chip col={C.primary}>{policies.filter(p => p.status === "ACTIVE").length} pólizas LIVE</Chip>
        </div>
      </div>

      {/* TABS */}
      <div style={{
        background: C.surf, borderBottom: `1px solid ${C.border}`,
        padding: "6px 20px", display: "flex", gap: 4, overflowX: "auto"
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? `${t.col}22` : "transparent", color: tab === t.id ? t.col : C.muted,
            border: `1px solid ${tab === t.id ? t.col : C.border}`, borderRadius: 10,
            padding: "7px 16px", cursor: "pointer", fontSize: 12,
            fontWeight: tab === t.id ? 800 : 400, fontFamily: C.mono,
            whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
            boxShadow: tab === t.id ? `0 0 12px ${t.col}33` : "none", transition: "all 0.18s",
          }}>
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT + LOG */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 106px)" }}>
        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
          {tab === "policies" && <TabPolicies policies={policies} setPolicies={setPolicies} addLog={add} />}
          {tab === "new" && <TabNewPolicy addLog={add} />}
          {tab === "reserves" && <TabReserves policies={policies} />}
          {tab === "metrics" && (
            <div>
              <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.cyan, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — MARITIME-INSURANCE
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected — data from /api/agents/maritime-insurance/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="maritime-insurance" accentColor={C.cyan} />
            </div>
          )}
        </div>

        {/* Live log */}
        <div style={{
          width: 250, background: C.surf, borderLeft: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column", flexShrink: 0
        }}>
          <div style={{
            padding: "7px 12px", borderBottom: `1px solid ${C.border}`,
            fontSize: 9, color: C.muted, letterSpacing: 2, fontFamily: C.mono,
            display: "flex", alignItems: "center", gap: 6
          }}>
            IOT LIVE <span style={{ color: C.cyan, animation: "blink 1.5s infinite", fontSize: 12 }}>●</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {log.map((e, i) => (
              <div key={i} style={{
                padding: "3px 10px", fontSize: 9, fontFamily: C.mono, lineHeight: 1.6,
                color: i === 0 ? (
                  e.includes("CLAIM") || e.includes("alerta") ? C.orange :
                    e.includes("STAKING") || e.includes("APY") ? C.emerald :
                      e.includes("IOT") || e.includes("WEATHER") ? C.cyan :
                        e.includes("BEZ") ? C.gold : C.text2
                ) : C.muted
              }}>{e}</div>
            ))}
          </div>
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono, marginBottom: 2 }}>QUALITY ESCROW</div>
            <div style={{ color: C.cyan, fontFamily: C.mono, fontSize: 9 }}>{ADDR.ESCROW.slice(0, 14)}…</div>
            <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono, marginTop: 5, marginBottom: 2 }}>STAKING POOL V2</div>
            <div style={{ color: C.emerald, fontFamily: C.mono, fontSize: 9 }}>StakingPoolV2.sol · APY live</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        borderTop: `1px solid ${C.border}`, padding: "8px 20px",
        display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 9,
        fontFamily: C.mono, background: C.surf, flexWrap: "wrap", gap: 4
      }}>
        <span>bez.digital · Maritime Insurance Agent v1.0 · Fase 1.5 · BEZ-Coin Native · Polygon</span>
        <span>QualityOracle.sol · StakingPoolV2.sol · BeZhasNFT.sol · Chainlink IoT · Lloyd's API</span>
      </div>
    </div>
  );
}
