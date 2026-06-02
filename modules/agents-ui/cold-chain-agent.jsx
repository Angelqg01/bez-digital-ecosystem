import { useState, useEffect, useCallback, useRef } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

/* ═══════════════════════════════════════════════════════════════════════
   bez.digital — COLD CHAIN AGENT v1.0  (Fase 1.6 — ÚLTIMO DE FASE 1)
   Cadena de Frío · IoT Tiempo Real · Penalización Automática · BCM NFT
   ─────────────────────────────────────────────────────────────────────
   Blockchain:  Polygon Mainnet
   Contratos:
     • BEZ Token:           0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
     • QualityEscrow:       0x3EfC42095E8503d41Ad8001328FC23388E00e8a3
     • QualityOracle:       QualityOracle.sol
     • LogisticsContainer:  LogisticsContainer.sol
     • BeZhasNFT (BCM):     BeZhasNFT.sol ERC-1155
   APIs:
     • Sensitech TempTale 4 · ELPRO · Emerson Cold Chain
     • EU FMD (Falsified Medicines Directive) · EFSA · FDA 21 CFR
     • HACCP / GDP · AEMPS España · EMA EudraVigilance
     • Chainlink Weather Oracle · AIS Marine Traffic
═══════════════════════════════════════════════════════════════════════ */

const C = {
  bg: "#03060E", surf: "#070D1C", card: "#0C1628", card2: "#101E38",
  card3: "#142444", border: "#0D2040", border2: "#163560", border3: "#1E4A8A",
  primary: "#00C896", gold: "#FFB800", neon: "#00FFB2",
  blue: "#2563EB", violet: "#7C3AED", pink: "#EC4899",
  orange: "#F97316", red: "#EF4444", yellow: "#EAB308",
  ice: "#38BDF8", frost: "#7DD3FC", snow: "#E0F2FE",
  text: "#E8F4FF", text2: "#A8C4E0", muted: "#3D5E80",
  mono: "'JetBrains Mono','Courier New',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
};

const ADDR = {
  BEZ: "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8",
  ESCROW: "0x3EfC42095E8503d41Ad8001328FC23388E00e8a3",
  HOT: "0x52Df82920CBAE522880dD7657e43d1A754eD044E",
};

// ─── TEMPERATURE PROFILES POR CATEGORÍA ──────────────────────────────────────
const COLD_PROFILES = [
  { id: "frozen", icon: "🧊", name: "Congelado", min: -25, max: -15, warn: -13, danger: -10, unit: "°C", col: C.ice, sector: "Alimentación" },
  { id: "chill", icon: "❄️", name: "Refrigerado", min: 0, max: 5, warn: 7, danger: 9, unit: "°C", col: C.frost, sector: "Alimentación" },
  { id: "pharma", icon: "💊", name: "Farmacéutico", min: 2, max: 8, warn: 10, danger: 12, unit: "°C", col: C.blue, sector: "Pharma" },
  { id: "flower", icon: "🌸", name: "Flores/Plantas", min: 2, max: 8, warn: 12, danger: 15, unit: "°C", col: C.pink, sector: "Horticultura" },
  { id: "wine", icon: "🍷", name: "Vinos/Licores", min: 12, max: 18, warn: 22, danger: 25, unit: "°C", col: C.violet, sector: "Bebidas" },
  { id: "biomed", icon: "🧬", name: "Biomédico", min: -80, max: -60, warn: -55, danger: -50, unit: "°C", col: C.primary, sector: "Pharma/Lab" },
];

// ─── SHIPMENTS DATA ───────────────────────────────────────────────────────────
function makeHistory(baseTemp, noiseAmp, breachAt, breachVal, points = 48) {
  return Array.from({ length: points }, (_, i) => {
    const h = points - 1 - i;
    const isBreachZone = h < (breachAt || 0);
    const t = isBreachZone
      ? breachVal + (Math.random() - 0.5) * 1.5
      : baseTemp + (Math.random() - 0.5) * noiseAmp;
    return { h, t: +t.toFixed(1) };
  }).reverse();
}

const INIT_SHIPMENTS = [
  {
    id: "CC-2025-0441", bl: "MAEU240312001", flag: "🇩🇰",
    vessel: "MAERSK EDMONTON", route: "ES-ALG → DE-HAM",
    product: "Vacunas COVID-19 (Pfizer BioNTech)", category: "pharma",
    quantity: "12,400 vials", value: 2480000, collateral: 248000,
    shipper: "ROVI Pharma SA", consignee: "Bayer Germany GmbH",
    status: "OK", tempNow: -0.2 + 2, humNow: 42, lastUpdate: "hace 3 min",
    sensorId: "TT4-ES-0441", sensorBrand: "Sensitech TempTale 4",
    bcmNft: "BCM-2025-0441", bcmStatus: "CERTIFIED",
    breakCount: 0, penaltyBEZ: 0,
    tempHistory: makeHistory(4, 1.5, 0, 0),
    regulatoryRef: "EU FMD 2011/62/EU · GDP 2013/C 343/01",
    gdpCompliant: true, fdaCompliant: true,
  },
  {
    id: "CC-2025-0440", bl: "MSCU724519843", flag: "🇵🇦",
    vessel: "MSC OSCAR", route: "CN-QIN → NL-RTM",
    product: "Carne de Vacuno Refrigerada (Chuletón)", category: "chill",
    quantity: "18,400 KG", value: 368000, collateral: 73600,
    shipper: "JBS Foods Brasil", consignee: "Makro España SL",
    status: "WARNING", tempNow: 7.8, humNow: 88, lastUpdate: "hace 1 min",
    sensorId: "ELPRO-LIBERO-440", sensorBrand: "ELPRO Libero Ti",
    bcmNft: "BCM-2025-0440", bcmStatus: "WARNING",
    breakCount: 2, penaltyBEZ: 1200,
    tempHistory: makeHistory(2, 1.2, 8, 8.5),
    regulatoryRef: "EU 853/2004 Higiene Productos Animales",
    gdpCompliant: false, fdaCompliant: true,
  },
  {
    id: "CC-2025-0439", bl: "COSU6285041960", flag: "🇨🇳",
    vessel: "COSCO ANDES", route: "MX-MZN → ES-VLC",
    product: "Fresas Huelva Premium (Fragaria x ananassa)", category: "chill",
    quantity: "9,200 KG", value: 46000, collateral: 9200,
    shipper: "Fresón de Palos SCA", consignee: "Mercadona SA",
    status: "BREACH", tempNow: 11.4, humNow: 76, lastUpdate: "hace 8 min",
    sensorId: "EMR-G4-0439", sensorBrand: "Emerson GoReal4",
    bcmNft: "BCM-2025-0439", bcmStatus: "COMPROMISED",
    breakCount: 5, penaltyBEZ: 4600,
    tempHistory: makeHistory(2, 1.0, 20, 11),
    regulatoryRef: "EU 852/2004 Higiene Alimentaria · HACCP",
    gdpCompliant: false, fdaCompliant: false,
  },
  {
    id: "CC-2025-0438", bl: "EGLV143100209734", flag: "🇵🇦",
    vessel: "EVER GIVEN", route: "IN-MUN → GB-LON",
    product: "Insulina Humalog (Eli Lilly)", category: "pharma",
    quantity: "84,000 unidades", value: 8400000, collateral: 840000,
    shipper: "Eli Lilly India Ltd", consignee: "NHS England",
    status: "OK", tempNow: 5.1, humNow: 55, lastUpdate: "hace 2 min",
    sensorId: "TT4-IN-0438", sensorBrand: "Sensitech TempTale 4",
    bcmNft: "BCM-2025-0438", bcmStatus: "CERTIFIED",
    breakCount: 0, penaltyBEZ: 0,
    tempHistory: makeHistory(5, 1.0, 0, 0),
    regulatoryRef: "WHO Technical Report 961 · EMA GDP · FDA 21 CFR 211",
    gdpCompliant: true, fdaCompliant: true,
  },
  {
    id: "CC-2025-0437", bl: "OOLU7156238550", flag: "🇳🇱",
    vessel: "OOCL NETHERLANDS", route: "NL-RTM → AE-DXB",
    product: "Tulipanes Holanda (Bulbos y flores corte)", category: "flower",
    quantity: "240,000 tallos", value: 72000, collateral: 14400,
    shipper: "Royal FloraHolland BV", consignee: "Dubai Flower Centre",
    status: "OK", tempNow: 5.8, humNow: 91, lastUpdate: "hace 5 min",
    sensorId: "ELPRO-LIBERO-437", sensorBrand: "ELPRO Libero Wi",
    bcmNft: "BCM-2025-0437", bcmStatus: "CERTIFIED",
    breakCount: 0, penaltyBEZ: 0,
    tempHistory: makeHistory(5, 0.8, 0, 0),
    regulatoryRef: "IATA Perishable Cargo Regulations · CFIA",
    gdpCompliant: true, fdaCompliant: true,
  },
];

const STATUS_CFG = {
  OK: { c: C.primary, bg: `${C.primary}15`, icon: "✅", label: "DENTRO RANGO" },
  WARNING: { c: C.yellow, bg: `${C.yellow}15`, icon: "⚠️", label: "ALERTA TEMP" },
  BREACH: { c: C.red, bg: `${C.red}15`, icon: "🚨", label: "RUPTURA CADENA" },
  RESOLVED: { c: C.muted, bg: `${C.muted}10`, icon: "🔵", label: "RESUELTO" },
};
const BCM_CFG = {
  CERTIFIED: { c: C.primary, label: "CERTIFICADO" },
  WARNING: { c: C.yellow, label: "EN REVISIÓN" },
  COMPROMISED: { c: C.red, label: "COMPROMETIDO" },
};

const rndInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rndHex = n => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const fmtUSD = n => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n}`;
const fmtBEZ = n => `${Math.round(n).toLocaleString("es-ES")} BEZ`;
const fmtT = ts => new Date(ts).toTimeString().slice(0, 8);

// ─── UI ───────────────────────────────────────────────────────────────────────
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
    borderRadius: 20, padding: sm ? "1px 8px" : "3px 10px",
    fontSize: sm ? 9 : 10, fontFamily: C.mono, fontWeight: 800, whiteSpace: "nowrap"
  }}>
    {children}
  </span>
);
const Btn = ({ children, onClick, col = C.primary, sm, full, disabled, icon }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: full ? "100%" : undefined,
    background: disabled ? C.card2 : `linear-gradient(135deg,${col},${col}bb)`,
    color: disabled ? C.muted : (col === C.gold ? "#0a0a0a" : C.bg),
    border: "none", borderRadius: 11, padding: sm ? "5px 12px" : full ? "13px 20px" : "10px 18px",
    fontSize: sm ? 11 : 13, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: C.mono, boxShadow: disabled ? "none" : `0 0 16px ${col}44`,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.18s",
  }}>
    {icon && <span style={{ fontSize: sm ? 12 : 14 }}>{icon}</span>}
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

// ─── MINI TEMP CHART ──────────────────────────────────────────────────────────
function TempChart({ history, profile, height = 60, width = 200 }) {
  if (!history?.length) return null;
  const temps = history.map(h => h.t);
  const minT = Math.min(...temps, profile.min) - 2;
  const maxT = Math.max(...temps, profile.danger) + 2;
  const range = maxT - minT;
  const W = width, H = height;
  const toX = i => (i / (history.length - 1)) * W;
  const toY = t => H - ((t - minT) / range) * H;

  // Build path
  const pts = history.map((h, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(h.t).toFixed(1)}`).join(" ");

  // Danger zone fill
  const dangerY = toY(profile.danger);
  const warnY = toY(profile.warn);

  return (
    <svg width={W} height={H} style={{ display: "block", borderRadius: 6, overflow: "visible" }}>
      {/* Danger band */}
      <rect x={0} y={0} width={W} height={Math.min(dangerY, H)} fill={`${C.red}12`} />
      {/* Warn band */}
      <rect x={0} y={dangerY} width={W} height={Math.max(0, warnY - dangerY)} fill={`${C.orange}10`} />
      {/* Safe band */}
      <rect x={0} y={warnY} width={W} height={H - warnY} fill={`${C.primary}08`} />
      {/* Threshold lines */}
      <line x1={0} y1={dangerY} x2={W} y2={dangerY} stroke={C.red} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.6} />
      <line x1={0} y1={warnY} x2={W} y2={warnY} stroke={C.orange} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.6} />
      {/* Temperature line */}
      <path d={pts} fill="none" stroke={profile.col} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle cx={toX(history.length - 1)} cy={toY(history[history.length - 1].t)} r={3}
        fill={profile.col} stroke={C.bg} strokeWidth={1.5} />
    </svg>
  );
}

// ─── THERMOMETER ─────────────────────────────────────────────────────────────
function Thermometer({ temp, profile }) {
  const range = profile.danger - profile.min + 10;
  const pct = Math.min(100, Math.max(0, ((temp - profile.min) / range) * 100));
  const color = temp >= profile.danger ? C.red : temp >= profile.warn ? C.orange : profile.col;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: 16, height: 80, background: C.card3, borderRadius: 8,
        display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden",
        border: `1px solid ${C.border2}`, position: "relative"
      }}>
        <div style={{
          width: "100%", height: `${pct}%`, background: color,
          borderRadius: "0 0 6px 6px", transition: "height 0.8s ease"
        }} />
        <div style={{
          position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
          width: 14, height: 14, borderRadius: "50%", background: color, border: `2px solid ${C.border2}`
        }} />
      </div>
      <div style={{ fontSize: 11, color, fontFamily: C.mono, fontWeight: 800 }}>{temp}°C</div>
    </div>
  );
}

// ─── PENALTY ENGINE ───────────────────────────────────────────────────────────
async function executePenalty(shipment, addLog, setPenaltyStep) {
  addLog(`🚨 Ruptura cadena frío detectada: ${shipment.id}`);
  addLog(`📊 Temp: ${shipment.tempNow}°C | Máx permitido: ${COLD_PROFILES.find(p => p.id === shipment.category)?.max}°C`);

  const steps = [
    [1, 600, "IoT Gateway: confirmando lectura sensor múltiples veces…"],
    [2, 1400, "Chainlink Weather: temperatura ambiente exterior verificada…"],
    [3, 2400, "QualityOracle.sol: registrando evento on-chain en Polygon…"],
    [4, 3400, "Claude AI: analizando gravedad + tiempo de exposición…"],
    [5, 4400, `QualityEscrow: aplicando penalización ${fmtBEZ(shipment.collateral * 0.5)}…`],
    [6, 5400, "BCM NFT: actualizando estado → COMPROMISED on-chain…"],
    [7, 6200, `✅ TX confirmada — ${fmtBEZ(shipment.collateral * 0.5)} retenido del colateral`],
  ];
  for (const [s, d, msg] of steps) {
    await new Promise(r => setTimeout(r, d - (steps[steps.indexOf([s, d, msg]) > 0 ? steps.indexOf([s, d, msg]) - 1 : 0]?.[1] || 0)));
    setPenaltyStep(s);
    addLog(msg);
  }
}

// ─── TAB: MONITOR ─────────────────────────────────────────────────────────────
function TabMonitor({ shipments, setShipments, addLog }) {
  const [selected, setSelected] = useState(null);
  const [penaltyStep, setPenaltyStep] = useState(0);
  const [processing, setProcessing] = useState(null);

  // Live IoT simulation
  useEffect(() => {
    const t = setInterval(() => {
      setShipments(prev => prev.map(s => {
        const profile = COLD_PROFILES.find(p => p.id === s.category);
        if (!profile) return s;
        const newTemp = +(s.tempNow + (Math.random() - 0.49) * 0.3).toFixed(1);
        const newStatus = newTemp >= profile.danger ? "BREACH"
          : newTemp >= profile.warn ? "WARNING" : "OK";
        const newHistory = [...s.tempHistory.slice(1), { h: 0, t: newTemp }];
        return {
          ...s, tempNow: newTemp, status: newStatus, tempHistory: newHistory,
          lastUpdate: "hace 1 min"
        };
      }));
    }, 2500);
    return () => clearInterval(t);
  }, [setShipments]);

  const triggerPenalty = async (s) => {
    setProcessing(s.id); setPenaltyStep(0);
    await executePenalty(s, addLog, setPenaltyStep);
    setShipments(prev => prev.map(p => p.id === s.id
      ? {
        ...p, status: "BREACH", bcmStatus: "COMPROMISED",
        breakCount: p.breakCount + 1, penaltyBEZ: p.penaltyBEZ + (p.collateral * 0.5)
      }
      : p
    ));
    setProcessing(null); setPenaltyStep(0);
    addLog(`✅ Penalización completada para ${s.id}`);
  };

  const total = shipments.length;
  const ok = shipments.filter(s => s.status === "OK").length;
  const warn = shipments.filter(s => s.status === "WARNING").length;
  const breach = shipments.filter(s => s.status === "BREACH").length;
  const totalPen = shipments.reduce((sum, s) => sum + s.penaltyBEZ, 0);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard label="En ruta" value={total} col={C.ice} icon="🚢" />
        <StatCard label="OK" value={ok} col={C.primary} icon="✅" />
        <StatCard label="Alertas" value={warn} col={C.yellow} icon="⚠️" />
        <StatCard label="Rupturas" value={breach} col={C.red} icon="🚨" />
        <StatCard label="Penaliz. BEZ" value={fmtBEZ(totalPen)} col={C.gold} icon="🔥" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shipments.map(s => {
          const profile = COLD_PROFILES.find(p => p.id === s.category);
          const sc = STATUS_CFG[s.status] || STATUS_CFG.OK;
          const bc = BCM_CFG[s.bcmStatus] || BCM_CFG.CERTIFIED;
          const isOpen = selected === s.id;
          const isPenalizing = processing === s.id;

          return (
            <div key={s.id}
              onClick={() => setSelected(isOpen ? null : s.id)}
              style={{
                background: isOpen ? C.card2 : C.card,
                border: `1px solid ${isOpen ? sc.c + "66" : C.border}`,
                borderLeft: `4px solid ${sc.c}`,
                borderRadius: 14, padding: 14, cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: isOpen ? `0 0 20px ${sc.c}10` : "none"
              }}>

              {/* Top row */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 26 }}>{s.flag}</span>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                      <span style={{ color: C.text, fontWeight: 800, fontSize: 13 }}>{s.vessel}</span>
                      <Chip col={sc.c} sm>{sc.icon} {sc.label}</Chip>
                      <Chip col={profile?.col} sm>{profile?.icon} {profile?.name}</Chip>
                    </div>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono }}>
                      {s.id} · {s.route} · {s.product}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  {/* Live thermometer */}
                  {profile && <Thermometer temp={s.tempNow} profile={profile} />}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { l: "Valor carga", v: fmtUSD(s.value), c: C.gold },
                      { l: "Colateral", v: fmtBEZ(s.collateral), c: C.primary },
                      { l: "Sensor", v: s.sensorBrand.split(" ")[0], c: C.muted },
                      { l: "BCM NFT", v: bc.label, c: bc.c },
                    ].map(r => (
                      <div key={r.l} style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 7, color: C.muted, fontFamily: C.mono }}>{r.l}</div>
                        <div style={{ fontSize: 9, color: r.c, fontFamily: C.mono, fontWeight: 700 }}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mini chart */}
              {profile && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 8, color: C.muted }}>
                      Historial 48h · rango permitido {profile.min}°C a {profile.max}°C
                    </span>
                    <span style={{ fontSize: 8, color: C.muted }}>
                      Rupturas: {s.breakCount} · Pen: {fmtBEZ(s.penaltyBEZ)}
                    </span>
                  </div>
                  <TempChart history={s.tempHistory} profile={profile} height={50} width={500} />
                </div>
              )}

              {/* Compliance strip */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { l: "EU GDP", v: s.gdpCompliant },
                  { l: "FDA 21 CFR", v: s.fdaCompliant },
                  { l: "HACCP", v: s.status === "OK" },
                  { l: "BCM On-chain", v: s.bcmStatus === "CERTIFIED" },
                ].map(r => (
                  <div key={r.l} style={{
                    display: "flex", gap: 4, alignItems: "center",
                    padding: "2px 8px", background: r.v ? `${C.primary}12` : `${C.red}12`,
                    border: `1px solid ${r.v ? C.primary : C.red}33`, borderRadius: 20
                  }}>
                    <span style={{ fontSize: 9 }}>{r.v ? "✓" : "✗"}</span>
                    <span style={{ fontSize: 8, color: r.v ? C.primary : C.red, fontFamily: C.mono }}>{r.l}</span>
                  </div>
                ))}
              </div>

              {/* Expanded */}
              {isOpen && (
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Detail */}
                  <div style={{ background: C.card3, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>
                      DETALLES ENVÍO
                    </div>
                    {[
                      ["Producto", s.product],
                      ["Cantidad", s.quantity],
                      ["Shipper", s.shipper],
                      ["Consignee", s.consignee],
                      ["Sensor ID", s.sensorId],
                      ["Sensor Brand", s.sensorBrand],
                      ["Regulación", s.regulatoryRef],
                      ["B/L", s.bl],
                      ["BCM NFT", s.bcmNft],
                    ].map(([l, v]) => (
                      <div key={l} style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "4px 0", borderBottom: `1px solid ${C.border}22`
                      }}>
                        <span style={{ fontSize: 9, color: C.muted }}>{l}</span>
                        <span style={{
                          fontSize: 9, color: C.text2, fontFamily: C.mono,
                          fontWeight: 700, maxWidth: "55%", textAlign: "right"
                        }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action panel */}
                  <div style={{ background: C.card3, borderRadius: 12, padding: 12 }}>
                    {s.status === "BREACH" && !isPenalizing && s.bcmStatus !== "COMPROMISED" && (
                      <>
                        <div style={{ fontSize: 8, color: C.red, letterSpacing: 2, marginBottom: 10 }}>
                          🚨 RUPTURA CADENA FRÍO DETECTADA
                        </div>
                        <div style={{
                          padding: "8px 10px", background: `${C.red}10`,
                          border: `1px solid ${C.red}33`, borderRadius: 8, marginBottom: 10
                        }}>
                          <div style={{ fontSize: 10, color: C.red, marginBottom: 3 }}>
                            Temperatura actual: <strong>{s.tempNow}°C</strong>
                          </div>
                          <div style={{ fontSize: 9, color: C.muted }}>
                            Máximo permitido: {profile?.max}°C
                            · Exceso: +{(s.tempNow - (profile?.max || 0)).toFixed(1)}°C
                          </div>
                        </div>
                        <Btn onClick={() => triggerPenalty(s)} col={C.red} full icon="⚡">
                          EJECUTAR PENALIZACIÓN AUTO
                        </Btn>
                      </>
                    )}

                    {isPenalizing && (
                      <div>
                        <div style={{ fontSize: 8, color: C.orange, letterSpacing: 2, marginBottom: 12 }}>
                          PROCESO DE PENALIZACIÓN ON-CHAIN
                        </div>
                        {[
                          [1, "IoT: confirmación sensor"],
                          [2, "Chainlink Weather check"],
                          [3, "QualityOracle.sol registro"],
                          [4, "Claude AI análisis daños"],
                          [5, "QualityEscrow penalización"],
                          [6, "BCM NFT actualización"],
                        ].map(([step, label]) => (
                          <div key={step} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                              background: penaltyStep > step ? `${C.primary}22` : penaltyStep === step ? `${C.red}22` : C.card2,
                              border: `1.5px solid ${penaltyStep > step ? C.primary : penaltyStep === step ? C.red : C.border}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: penaltyStep > step ? C.primary : penaltyStep === step ? C.red : C.muted,
                              fontSize: 9, fontWeight: 900
                            }}>
                              {penaltyStep > step ? "✓" : step}
                            </div>
                            <span style={{ fontSize: 10, color: penaltyStep >= step ? C.text2 : C.muted }}>
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {s.bcmStatus === "COMPROMISED" && (
                      <div style={{
                        padding: 12, background: `${C.red}08`,
                        border: `1px solid ${C.red}33`, borderRadius: 10, textAlign: "center"
                      }}>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>🚨</div>
                        <div style={{ fontSize: 11, color: C.red, fontWeight: 800 }}>BCM NFT COMPROMETIDO</div>
                        <div style={{ fontSize: 14, color: C.gold, fontFamily: C.mono, fontWeight: 900, marginTop: 4 }}>
                          {fmtBEZ(s.penaltyBEZ)} penalizado
                        </div>
                        <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>
                          Carrier responsable · Reclamación abierta
                        </div>
                      </div>
                    )}

                    {s.status === "OK" && (
                      <div>
                        <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>
                          MONITORIZACIÓN CONTINUA
                        </div>
                        {[
                          { l: "Temp actual", v: `${s.tempNow}°C`, c: C.primary },
                          { l: "Rango permitido", v: `${profile?.min}–${profile?.max}°C`, c: C.ice },
                          { l: "Humedad", v: `${s.humNow}%`, c: C.blue },
                          { l: "Actualizaciones", v: "cada 15 min", c: C.muted },
                          { l: "Alertas enviadas", v: "0", c: C.primary },
                          { l: "Días sin ruptura", v: "12", c: C.primary },
                        ].map(([l, v, c]) => (
                          <div key={l} style={{
                            display: "flex", justifyContent: "space-between",
                            padding: "5px 0", borderBottom: `1px solid ${C.border}22`
                          }}>
                            <span style={{ fontSize: 10, color: C.muted }}>{l}</span>
                            <span style={{ fontSize: 10, color: c, fontFamily: C.mono, fontWeight: 700 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {s.status === "WARNING" && !isPenalizing && (
                      <div>
                        <div style={{ fontSize: 8, color: C.yellow, letterSpacing: 2, marginBottom: 10 }}>
                          ⚠️ ALERTA TEMPERATURA
                        </div>
                        <div style={{
                          padding: "8px 10px", background: `${C.yellow}10`,
                          border: `1px solid ${C.yellow}22`, borderRadius: 8, marginBottom: 10
                        }}>
                          <div style={{ fontSize: 10, color: C.yellow }}>
                            Temperatura {s.tempNow}°C — umbral de alerta: {profile?.warn}°C
                          </div>
                          <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>
                            Monitorización intensificada. Si supera {profile?.danger}°C se activa penalización.
                          </div>
                        </div>
                        <div style={{ fontSize: 9, color: C.muted, marginBottom: 6 }}>
                          Acción recomendada: Verificar refrigeración del contenedor.
                        </div>
                        <Btn col={C.yellow} full sm icon="📞">
                          NOTIFICAR AL CARRIER
                        </Btn>
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

// ─── TAB: CATEGORÍAS ─────────────────────────────────────────────────────────
function TabCategories() {
  return (
    <div>
      <div style={{
        padding: "10px 16px", background: `${C.ice}08`, border: `1px solid ${C.ice}22`,
        borderRadius: 12, marginBottom: 16
      }}>
        <div style={{ fontSize: 10, color: C.ice, letterSpacing: 2, marginBottom: 4 }}>
          PERFILES DE TEMPERATURA — BEZHAS COLD CHAIN AGENT
        </div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
          Cada categoría tiene un perfil de temperatura parametrizado en QualityOracle.sol. El agente monitoriza automáticamente, activa alertas, aplica penalizaciones y actualiza el BCM NFT on-chain según estos umbrales regulatorios.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10, marginBottom: 16 }}>
        {COLD_PROFILES.map(p => (
          <Card key={p.id} glow col={p.col}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 28 }}>{p.icon}</span>
                <div>
                  <div style={{ color: C.text, fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{p.sector}</div>
                </div>
              </div>
              <Chip col={p.col}>{p.min}°C / {p.max}°C</Chip>
            </div>

            {/* Temperature range visual */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 8, color: C.muted }}>
                <span>MIN {p.min}°C</span>
                <span>WARN {p.warn}°C</span>
                <span>DANGER {p.danger}°C</span>
              </div>
              <div style={{ height: 8, background: C.card3, borderRadius: 4, display: "flex", overflow: "hidden" }}>
                <div style={{ flex: 3, background: `${p.col}44`, borderRadius: "4px 0 0 4px" }} />
                <div style={{ flex: 1, background: `${C.yellow}55` }} />
                <div style={{ flex: 1, background: `${C.red}55`, borderRadius: "0 4px 4px 0" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 7, color: C.muted }}>
                <span>✅ Rango seguro</span>
                <span style={{ color: C.yellow }}>⚠️ Alerta</span>
                <span style={{ color: C.red }}>🚨 Ruptura</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { l: "Rango óptimo", v: `${p.min}°C a ${p.max}°C`, c: p.col },
                { l: "Umbral alerta", v: `${p.warn}°C`, c: C.yellow },
                { l: "Umbral ruptura", v: `${p.danger}°C`, c: C.red },
                { l: "Sector", v: p.sector, c: C.muted },
              ].map(s => (
                <div key={s.l} style={{ background: C.card2, padding: "6px 9px", borderRadius: 9 }}>
                  <div style={{ fontSize: 7, color: C.muted, marginBottom: 2 }}>{s.l}</div>
                  <div style={{ fontSize: 10, color: s.c, fontFamily: C.mono, fontWeight: 700 }}>{s.v}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Regulatory compliance table */}
      <Card>
        <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
          MARCO REGULATORIO INTEGRADO — BEZHAS COLD CHAIN
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8 }}>
          {[
            { reg: "EU GDP 2013/C 343/01", sector: "Pharma", desc: "Good Distribution Practice — temperatura 2-8°C trazabilidad completa", icon: "💊" },
            { reg: "EU FMD 2011/62/EU", sector: "Pharma", desc: "Falsified Medicines Directive — serialización + verificación on-chain", icon: "🔐" },
            { reg: "FDA 21 CFR Part 211", sector: "Pharma/US", desc: "US Current Good Manufacturing Practice — 2-8°C documentado", icon: "🇺🇸" },
            { reg: "EU 853/2004", sector: "Carne", desc: "Higiene productos de origen animal — refrigerado ≤5°C, congelado ≤-18°C", icon: "🥩" },
            { reg: "EU 852/2004", sector: "Alimentación", desc: "Higiene alimentaria general — HACCP + trazabilidad cadena frío", icon: "🍎" },
            { reg: "IATA PCR", sector: "Aéreo", desc: "Perishable Cargo Regulations — estándares temperatura transporte aéreo", icon: "✈️" },
            { reg: "HACCP Codex Alimentarius", sector: "Global", desc: "Análisis peligros y puntos críticos control — monitorización continua IoT", icon: "⚖️" },
            { reg: "WHO TRS 961", sector: "Pharma", desc: "WHO Technical Report Series — vacunas y biológicos 2-8°C verificados", icon: "🌡️" },
          ].map(r => (
            <div key={r.reg} style={{
              padding: "10px 12px", background: C.card2,
              border: `1px solid ${C.border}`, borderRadius: 12
            }}>
              <div style={{ fontSize: 18, marginBottom: 5 }}>{r.icon}</div>
              <div style={{ fontSize: 10, color: C.ice, fontWeight: 700, marginBottom: 3 }}>{r.reg}</div>
              <Chip col={C.blue} sm>{r.sector}</Chip>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── TAB: REVENUE ─────────────────────────────────────────────────────────────
function TabRevenue() {
  const projs = [
    { y: "2025", sensors: 500, shipments: 8000, penalties: 124e3, saas: 360e3, total: 484e3 },
    { y: "2026", sensors: 3000, shipments: 55000, penalties: 980e3, saas: 2.4e6, total: 3.38e6 },
    { y: "2027", sensors: 15000, shipments: 280000, penalties: 5.2e6, saas: 12e6, total: 17.2e6 },
    { y: "2028", sensors: 60000, shipments: 1.1e6, penalties: 21e6, saas: 48e6, total: 69e6 },
    { y: "2029", sensors: 200000, shipments: 4e6, penalties: 78e6, saas: 180e6, total: 258e6 },
  ];
  const maxTotal = Math.max(...projs.map(p => p.total));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <Card>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
            STREAMS DE REVENUE
          </div>
          {[
            { s: "SaaS por shipment (€0.5-2/envío)", est: "$180M/año (2029)", c: C.primary, icon: "📦" },
            { s: "Penalizaciones retenidas (50%)", est: "$39M/año (2029)", c: C.red, icon: "⚡" },
            { s: "Fee IoT oracle update (0.2 BEZ)", est: "$8M/año (2029)", c: C.gold, icon: "📡" },
            { s: "Premium pharma (GDP certified)", est: "$25M/año (2029)", c: C.blue, icon: "💊" },
            { s: "BCM NFT minting (1 BEZ/cert.)", est: "$4M/año (2029)", c: C.violet, icon: "🪙" },
            { s: "API compliance (AEMPS/FDA access)", est: "$2M/año (2029)", c: C.cyan, icon: "⚖️" },
          ].map(r => (
            <div key={r.s} style={{
              display: "flex", gap: 10, padding: "8px 0",
              borderBottom: `1px solid ${C.border}22`, alignItems: "center"
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: C.text2 }}>{r.s}</div>
              </div>
              <span style={{ fontSize: 10, color: r.c, fontFamily: C.mono, fontWeight: 700, flexShrink: 0 }}>
                {r.est}
              </span>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
            PROYECCIÓN 5 AÑOS
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "flex-end", marginBottom: 12 }}>
            {projs.map(p => (
              <div key={p.y} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ fontSize: 9, color: C.ice, fontFamily: C.mono, fontWeight: 700 }}>
                  {fmtUSD(p.total)}
                </div>
                <div style={{
                  width: "100%", height: 80, background: `${C.ice}08`, borderRadius: 4,
                  display: "flex", alignItems: "flex-end", overflow: "hidden"
                }}>
                  <div style={{
                    width: "100%", height: `${(p.total / maxTotal) * 100}%`,
                    background: `linear-gradient(180deg,${C.ice},${C.primary})`,
                    borderRadius: "3px 3px 0 0", transition: "height 0.8s ease"
                  }} />
                </div>
                <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono }}>{p.y}</div>
                <div style={{ fontSize: 7, color: C.muted }}>{fmtUSD(p.sensors)} sensors</div>
              </div>
            ))}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.3)" }}>
                {["AÑO", "SENSORS", "ENVÍOS", "PENALIZAC.", "SaaS", "TOTAL"].map(h => (
                  <th key={h} style={{
                    padding: "5px 7px", fontSize: 7, color: C.muted,
                    fontFamily: C.mono, textAlign: "right"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projs.map(p => (
                <tr key={p.y} style={{ borderTop: `1px solid ${C.border}22` }}>
                  <td style={{ padding: "6px 7px", color: C.gold, fontFamily: C.mono, fontWeight: 700, fontSize: 10 }}>{p.y}</td>
                  <td style={{ padding: "6px 7px", textAlign: "right", color: C.muted, fontFamily: C.mono, fontSize: 9 }}>{fmtUSD(p.sensors)}</td>
                  <td style={{ padding: "6px 7px", textAlign: "right", color: C.muted, fontFamily: C.mono, fontSize: 9 }}>{fmtUSD(p.shipments)}</td>
                  <td style={{ padding: "6px 7px", textAlign: "right", color: C.red, fontFamily: C.mono, fontSize: 9 }}>{fmtUSD(p.penalties)}</td>
                  <td style={{ padding: "6px 7px", textAlign: "right", color: C.primary, fontFamily: C.mono, fontSize: 9 }}>{fmtUSD(p.saas)}</td>
                  <td style={{ padding: "6px 7px", textAlign: "right", color: C.ice, fontFamily: C.mono, fontWeight: 800, fontSize: 11 }}>{fmtUSD(p.total)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${C.gold}44`, background: `${C.gold}08` }}>
                <td colSpan={5} style={{ padding: "8px 7px", color: C.gold, fontFamily: C.mono, fontWeight: 800 }}>
                  TOTAL 5 AÑOS
                </td>
                <td style={{
                  padding: "8px 7px", textAlign: "right", color: C.gold, fontFamily: C.mono,
                  fontWeight: 900, fontSize: 16
                }}>
                  {fmtUSD(projs.reduce((s, p) => s + p.total, 0))}
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
    "[ COLD CHAIN ] Agent v1.0 INITIALIZED — Fase 1.6",
    "[ IOT        ] Sensitech · ELPRO · Emerson → 5 sensores activos",
    "[ ORACLE     ] QualityOracle.sol → perfiles temperatura cargados",
    "[ BLOCKCHAIN ] LogisticsContainer.sol + BeZhasNFT.sol → READY",
    "[ PHARMA     ] EU FMD · GDP · FDA 21 CFR → compliance activo",
    "[ WEATHER    ] Chainlink Weather Oracle → rutas monitorizadas",
    "[ BEZ        ] 0.2 BEZ por oracle update · 50% penalty a BeZhas",
  ]);
  const add = useCallback((msg) => {
    const ts = new Date().toTimeString().slice(0, 8);
    setLog(p => [`[ ${ts} ] ${msg}`, ...p].slice(0, 50));
  }, []);
  useEffect(() => {
    const msgs = [
      "IOT → CC-2025-0441 Pfizer: temp 4.2°C · humedad 41% ✅",
      "IOT → CC-2025-0440 Carne: temp 7.8°C — alerta umbral ⚠️",
      "ORACLE → CC-2025-0439 Fresas: temp 11.4°C → BREACH activado",
      "BCM → NFT CC-2025-0441 status CERTIFIED confirmed on-chain",
      "BEZ → 0.2 BEZ quemado · oracle update CC-2025-0438",
      "WEATHER → Ruta CN-QIN→NL-RTM: temperatura exterior 32°C alerta",
      "PENALTY → CC-2025-0439 penalización automática ejecutada",
    ];
    const t = setInterval(() => add(msgs[rndInt(0, msgs.length - 1)]), 3500);
    return () => clearInterval(t);
  }, [add]);
  return { log, add };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function ColdChainAgent() {
  const bridge = useAgentBridge('cold-chain');
  const [tab, setTab] = useState("monitor");
  const [shipments, setShipments] = useState(INIT_SHIPMENTS);
  const { log, add } = useLiveLog();
  const [bezPrice, setBez] = useState(1.2400);

  useEffect(() => {
    if (bridge.bezPrice != null) setBez(bridge.bezPrice);
  }, [bridge.bezPrice]);

  useEffect(() => {
    const t = setInterval(() => setBez(p => +(p * (1 + (Math.random() - 0.498) * 0.002)).toFixed(4)), 1500);
    return () => clearInterval(t);
  }, []);

  const breaches = shipments.filter(s => s.status === "BREACH").length;
  const warnings = shipments.filter(s => s.status === "WARNING").length;
  const totalPen = shipments.reduce((s, p) => s + p.penaltyBEZ, 0);

  const TABS = [
    { id: "monitor", icon: "🌡️", label: "Monitor IoT", col: C.ice },
    { id: "categories", icon: "📊", label: "Categorías", col: C.frost },
    { id: "revenue", icon: "💰", label: "Revenue", col: C.gold },
    { id: "metrics", icon: "📈", label: "Metrics", col: "#00C896" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.sans, fontSize: 13 }}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:${C.border3};border-radius:2px}
      `}</style>

      {/* HEADER */}
      <div style={{
        background: C.surf, borderBottom: `1px solid ${C.border}`, padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap"
      }}>
        <div style={{
          background: `linear-gradient(135deg,${C.ice},${C.primary})`,
          borderRadius: 12, padding: "7px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0
        }}>
          <span style={{ fontSize: 18 }}>❄️</span>
          <div>
            <div style={{ color: C.bg, fontFamily: C.mono, fontSize: 14, fontWeight: 900 }}>BeZhas</div>
            <div style={{ color: C.bg, fontSize: 8, opacity: 0.8, letterSpacing: 2 }}>COLD CHAIN v1</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[["Polygon ✓", C.violet], ["BEZ-Coin ✓", C.gold], ["Sensitech IoT", C.ice],
          ["EU GDP/FMD ✓", C.blue], ["FDA 21 CFR", C.primary], ["Chainlink ✓", C.orange]].map(([l, c]) => (
            <span key={l} style={{
              background: `${c}20`, color: c, border: `1px solid ${c}33`,
              borderRadius: 20, padding: "2px 8px", fontSize: 9, fontFamily: C.mono, fontWeight: 700
            }}>{l}</span>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Chip col={C.gold}>🪙 BEZ ${bezPrice.toFixed(4)}</Chip>
          {breaches > 0 && <Chip col={C.red}>🚨 {breaches} ruptura{breaches > 1 ? "s" : ""}</Chip>}
          {warnings > 0 && <Chip col={C.yellow}>⚠️ {warnings} alerta{warnings > 1 ? "s" : ""}</Chip>}
          {totalPen > 0 && <Chip col={C.orange}>⚡ {fmtBEZ(totalPen)} penalizado</Chip>}
          <Chip col={C.primary}>{shipments.filter(s => s.status === "OK").length} en rango</Chip>
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
          {tab === "monitor" && <TabMonitor shipments={shipments} setShipments={setShipments} addLog={add} />}
          {tab === "categories" && <TabCategories />}
          {tab === "revenue" && <TabRevenue />}
          {tab === "metrics" && <AgentDetailPanel agentId="cold-chain" accentColor="#00C8FF" />}
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
            IOT LIVE <span style={{ color: C.ice, animation: "blink 1.5s infinite", fontSize: 12 }}>●</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {log.map((e, i) => (
              <div key={i} style={{
                padding: "3px 10px", fontSize: 9, fontFamily: C.mono, lineHeight: 1.6,
                color: i === 0 ? (
                  e.includes("BREACH") || e.includes("PENALTY") ? C.red :
                    e.includes("alerta") || e.includes("⚠") ? C.yellow :
                      e.includes("✅") || e.includes("CERTIFIED") ? C.primary :
                        e.includes("BEZ") ? C.gold : C.text2
                ) : C.muted
              }}>{e}</div>
            ))}
          </div>
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono, marginBottom: 2 }}>QUALITY ESCROW</div>
            <div style={{ color: C.ice, fontFamily: C.mono, fontSize: 9 }}>{ADDR.ESCROW.slice(0, 14)}…</div>
            <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono, marginTop: 5, marginBottom: 2 }}>HOT WALLET</div>
            <div style={{ color: C.gold, fontFamily: C.mono, fontSize: 9 }}>{ADDR.HOT.slice(0, 14)}…</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        borderTop: `1px solid ${C.border}`, padding: "8px 20px",
        display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 9,
        fontFamily: C.mono, background: C.surf, flexWrap: "wrap", gap: 4
      }}>
        <span>bez.digital · Cold Chain Agent v1.0 · Fase 1.6 · FASE 1 COMPLETA ✅ · BEZ-Coin Native</span>
        <span>QualityOracle.sol · LogisticsContainer.sol · BeZhasNFT.sol · Sensitech · EU GDP/FMD</span>
      </div>
    </div>
  );
}
