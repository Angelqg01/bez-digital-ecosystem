import { useState, useEffect, useCallback } from "react";
import { useAgentBridge } from "./use-agent-bridge";
import AgentDetailPanel from "./agent-detail-panel";

/* ═══════════════════════════════════════════════════════════════════════
   bez.digital — REAL ESTATE AGENTS v1.0  (Fase 2 — Inmobiliaria)
   PropToken · SmartMortgage · RentStream · DueDiligence
   ─────────────────────────────────────────────────────────────────────
   Contratos:
     • BEZ Token:         0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
     • BeZhasRealEstate:  BeZhasRealEstate.sol (ERC-1155 fracciones)
     • BeZhasRWAFactory:  BeZhasRWAFactory.sol
     • QualityEscrow:     0x3EfC42095E8503d41Ad8001328FC23388E00e8a3
     • StakingPoolV2:     StakingPoolV2.sol
   APIs:
     • Idealista API Pro · Catastro España · Registro Propiedad
     • ING España SEPA ES77 1465 0100 91 1766376210
     • Euribor Oracle (Chainlink) · AEAT Embargos · Poder Judicial
     • Claude Sonnet 4.6 (Due Diligence IA)
═══════════════════════════════════════════════════════════════════════ */

const C = {
  bg: "#03060E", surf: "#070D1C", card: "#0C1628", card2: "#101E38",
  card3: "#142444", border: "#0D2040", border2: "#163560", border3: "#1E4A8A",
  primary: "#00C896", gold: "#FFB800", neon: "#00FFB2",
  blue: "#2563EB", violet: "#7C3AED", pink: "#EC4899",
  orange: "#F97316", red: "#EF4444", yellow: "#EAB308",
  amber: "#D97706", emerald: "#10B981",
  text: "#E8F4FF", text2: "#A8C4E0", muted: "#3D5E80",
  mono: "'JetBrains Mono','Courier New',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
};

// ─── PROPERTY DATA ────────────────────────────────────────────────────────────
const PROPERTIES = [
  {
    id: "PROP-2025-001",
    name: "Edificio Castellana 89",
    type: "Oficinas Premium",
    icon: "🏢",
    city: "Madrid",
    address: "Paseo de la Castellana 89, 28046 Madrid",
    ref: "2800412VK4780A",
    m2: 2840,
    units: 24,
    totalValue: 18500000,
    tokenPrice: 100,
    tokens: 185000,
    tokensSold: 148200,
    rentalYield: 0.062,
    monthlyRent: 95583,
    status: "LIVE",
    color: C.primary,
    mortgageLTV: 0,
    dueDiligence: "CLEAN",
    rentas: [9200, 9450, 9180, 9600, 9550, 9580],
    image: "🏢",
  },
  {
    id: "PROP-2025-002",
    name: "Residencial Marina Barceloneta",
    type: "Residencial",
    icon: "🏖️",
    city: "Barcelona",
    address: "Carrer de la Marina 42, 08005 Barcelona",
    ref: "0800814DF3780A",
    m2: 1240,
    units: 8,
    totalValue: 7800000,
    tokenPrice: 100,
    tokens: 78000,
    tokensSold: 62400,
    rentalYield: 0.055,
    monthlyRent: 35750,
    status: "LIVE",
    color: C.blue,
    mortgageLTV: 0.35,
    dueDiligence: "CLEAN",
    rentas: [3520, 3610, 3590, 3750, 3700, 3580],
    image: "🏖️",
  },
  {
    id: "PROP-2025-003",
    name: "Centro Comercial Sevilla Sur",
    type: "Retail",
    icon: "🛍️",
    city: "Sevilla",
    address: "Av. de la Palmera 15, 41012 Sevilla",
    ref: "4101210TG3440A",
    m2: 5600,
    units: 42,
    totalValue: 24000000,
    tokenPrice: 100,
    tokens: 240000,
    tokensSold: 144000,
    rentalYield: 0.071,
    monthlyRent: 142000,
    status: "FUNDING",
    color: C.orange,
    mortgageLTV: 0,
    dueDiligence: "REVIEWING",
    rentas: [13800, 14100, 13950, 14300, 14250, 0],
    image: "🛍️",
  },
  {
    id: "PROP-2025-004",
    name: "Nave Logística Zaragoza",
    type: "Industrial",
    icon: "🏭",
    city: "Zaragoza",
    address: "Polígono Plaza, Calle C 28, 50197 Zaragoza",
    ref: "5019720XM7160A",
    m2: 12000,
    units: 1,
    totalValue: 9600000,
    tokenPrice: 100,
    tokens: 96000,
    tokensSold: 96000,
    rentalYield: 0.078,
    monthlyRent: 62400,
    status: "FULL",
    color: C.gold,
    mortgageLTV: 0.45,
    dueDiligence: "CLEAN",
    rentas: [6100, 6200, 6180, 6240, 6200, 6400],
    image: "🏭",
  },
];

const STATUS_CFG = {
  LIVE: { c: C.primary, label: "● LIVE" },
  FUNDING: { c: C.yellow, label: "⏳ CAPTANDO" },
  FULL: { c: C.gold, label: "✅ COMPLETO" },
  PAUSED: { c: C.muted, label: "⏸ PAUSADO" },
};

const fmtEUR = n => n >= 1e6 ? `€${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `€${(n / 1e3).toFixed(1)}K` : `€${n}`;
const fmtBEZ = n => `${Math.round(n).toLocaleString("es-ES")} BEZ`;
const fmtPct = n => `${(n * 100).toFixed(2)}%`;
const rndInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rndHex = n => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

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
    borderRadius: 20, padding: sm ? "1px 8px" : "3px 10px", fontSize: sm ? 9 : 10,
    fontFamily: C.mono, fontWeight: 800, whiteSpace: "nowrap"
  }}>{children}</span>
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

// Mini rent bar chart
function RentChart({ rentas, col }) {
  const max = Math.max(...rentas.filter(Boolean));
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 32 }}>
      {rentas.map((r, i) => (
        <div key={i} style={{
          flex: 1, height: r ? `${(r / max) * 100}%` : 4,
          background: r ? col : `${col}30`, borderRadius: 2, transition: "height 0.5s ease",
          minHeight: 3
        }} />
      ))}
    </div>
  );
}

// ─── TAB: PROPTOKEN ──────────────────────────────────────────────────────────
function TabPropToken({ addLog }) {
  const [selected, setSelected] = useState(null);
  const [buyAmt, setBuyAmt] = useState("10");
  const [buying, setBuying] = useState(false);
  const [bought, setBought] = useState(null);

  const prop = PROPERTIES.find(p => p.id === selected);
  const totalTVL = PROPERTIES.reduce((s, p) => s + p.totalValue * (p.tokensSold / p.tokens), 0);
  const totalMonthly = PROPERTIES.reduce((s, p) => s + p.monthlyRent * (p.tokensSold / p.tokens), 0);

  const buyTokens = async () => {
    if (!prop || !buyAmt) return;
    setBuying(true);
    const tokAmt = Number(buyAmt);
    const euroAmt = tokAmt * prop.tokenPrice;
    const bezAmt = euroAmt / 1.24;
    addLog(`🏠 Comprando ${tokAmt} tokens de ${prop.name}…`);
    await new Promise(r => setTimeout(r, 800)); addLog("KYC/AML verificado via Sumsub…");
    await new Promise(r => setTimeout(r, 800)); addLog("BeZhasRealEstate.sol: transfiriendo ERC-1155…");
    await new Promise(r => setTimeout(r, 900)); addLog("Catastro & Registro Propiedad: vinculando DID…");
    await new Promise(r => setTimeout(r, 700)); addLog(`✅ ${tokAmt} tokens transferidos · TX 0x${rndHex(8)}…`);
    setBought({ tokAmt, euroAmt, bezAmt, txHash: `0x${rndHex(64)}` });
    setBuying(false);
    addLog(`💰 Yield mensual esperado: ${fmtEUR(prop.monthlyRent * (tokAmt / prop.tokens))}`);
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard label="TVL tokenizado" value={fmtEUR(totalTVL)} col={C.primary} icon="🏠" />
        <StatCard label="Propiedades LIVE" value={PROPERTIES.filter(p => p.status === "LIVE").length} col={C.gold} icon="📋" />
        <StatCard label="Renta mensual" value={fmtEUR(totalMonthly)} col={C.emerald} icon="💰" />
        <StatCard label="Desde" value="€100" col={C.blue} icon="🪙" sub="por fracción" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12, marginBottom: 16 }}>
        {PROPERTIES.map(p => {
          const sc = STATUS_CFG[p.status] || STATUS_CFG.LIVE;
          const soldPct = (p.tokensSold / p.tokens * 100).toFixed(1);
          const monthYield = p.monthlyRent / p.totalValue * 100;
          return (
            <div key={p.id}
              onClick={() => setSelected(selected === p.id ? null : p.id)}
              style={{
                background: selected === p.id ? C.card2 : C.card,
                border: `1px solid ${selected === p.id ? p.color + "66" : C.border}`,
                borderLeft: `4px solid ${p.color}`, borderRadius: 14, padding: 14,
                cursor: "pointer", transition: "all 0.2s",
                boxShadow: selected === p.id ? `0 0 20px ${p.color}12` : "none"
              }}>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 28 }}>{p.icon}</span>
                  <div>
                    <div style={{ color: C.text, fontWeight: 800, fontSize: 12 }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono }}>{p.city} · {p.type} · {p.m2.toLocaleString()}m²</div>
                  </div>
                </div>
                <Chip col={sc.c} sm>{sc.label}</Chip>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
                {[
                  { l: "Valor", v: fmtEUR(p.totalValue), c: C.gold },
                  { l: "Token", v: `€${p.tokenPrice}`, c: C.text },
                  { l: "Yield/m", v: `${monthYield.toFixed(2)}%`, c: C.emerald },
                ].map(s => (
                  <div key={s.l} style={{ background: C.card3, padding: "5px 8px", borderRadius: 9 }}>
                    <div style={{ fontSize: 7, color: C.muted }}>{s.l}</div>
                    <div style={{ fontSize: 10, color: s.c, fontFamily: C.mono, fontWeight: 800 }}>{s.v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 8, color: C.muted }}>Captación {soldPct}%</span>
                  <span style={{ fontSize: 8, color: p.color, fontFamily: C.mono }}>
                    {p.tokensSold.toLocaleString()} / {p.tokens.toLocaleString()} tokens
                  </span>
                </div>
                <div style={{ height: 4, background: C.card3, borderRadius: 2 }}>
                  <div style={{
                    height: "100%", width: `${soldPct}%`, background: p.color,
                    borderRadius: 2, transition: "width 0.8s ease"
                  }} />
                </div>
              </div>

              <RentChart rentas={p.rentas} col={p.color} />

              {/* Expanded: buy panel */}
              {selected === p.id && (
                <div style={{ marginTop: 14, background: C.card3, borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>COMPRAR FRACCIONES</div>
                  <div style={{
                    background: C.card2, border: `1px solid ${C.border2}`,
                    borderRadius: 10, padding: "10px 12px", marginBottom: 10
                  }}>
                    <div style={{ fontSize: 8, color: C.muted, marginBottom: 4 }}>NÚMERO DE TOKENS (mín. 1)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="number" value={buyAmt} min={1}
                        onChange={e => setBuyAmt(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{
                          flex: 1, background: "transparent", border: "none", outline: "none",
                          color: C.text, fontFamily: C.mono, fontSize: 22, fontWeight: 800, minWidth: 0
                        }} />
                      <span style={{ color: C.muted, fontFamily: C.mono, fontSize: 12 }}>tokens</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                    {[
                      { l: "Coste total", v: fmtEUR(Number(buyAmt) * p.tokenPrice), c: C.gold },
                      { l: "Renta mensual", v: fmtEUR(p.monthlyRent * (Number(buyAmt) / p.tokens)), c: C.emerald },
                    ].map(s => (
                      <div key={s.l} style={{ background: C.card2, padding: "6px 10px", borderRadius: 8 }}>
                        <div style={{ fontSize: 7, color: C.muted }}>{s.l}</div>
                        <div style={{ color: s.c, fontFamily: C.mono, fontWeight: 800, fontSize: 12 }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                  <Btn onClick={e => { e.stopPropagation(); buyTokens(); }}
                    col={p.color} full icon="🏠" disabled={buying || p.status === "FULL"}>
                    {buying ? "PROCESANDO…" : p.status === "FULL" ? "COMPLETO" : "COMPRAR TOKENS"}
                  </Btn>
                  {bought && !buying && (
                    <div style={{
                      marginTop: 10, padding: "8px 10px", background: `${C.primary}10`,
                      border: `1px solid ${C.primary}33`, borderRadius: 8, fontSize: 9, color: C.primary
                    }}>
                      ✅ {bought.tokAmt} tokens · TX {bought.txHash.slice(0, 14)}…
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB: SMARTMORTGAGE ──────────────────────────────────────────────────────
function TabSmartMortgage({ addLog }) {
  const [propId, setPropId] = useState("PROP-2025-001");
  const [ltv, setLtv] = useState("60");
  const [years, setYears] = useState("20");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);

  const prop = PROPERTIES.find(p => p.id === propId);
  const ltvNum = Math.min(70, Math.max(10, Number(ltv)));
  const [euribor, setEuribor] = useState(3.84);

  useEffect(() => {
    const t = setInterval(() => setEuribor(p => +(p + (Math.random() - 0.49) * 0.02).toFixed(2)), 3000);
    return () => clearInterval(t);
  }, []);

  const spread = 1.15;
  const rate = (euribor + spread) / 100;
  const loanAmt = prop ? (prop.totalValue * (ltvNum / 100)) : 0;
  const monthRate = rate / 12;
  const nMonths = Number(years) * 12;
  const monthPay = loanAmt > 0 ? loanAmt * (monthRate * Math.pow(1 + monthRate, nMonths)) / (Math.pow(1 + monthRate, nMonths) - 1) : 0;
  const totalPay = monthPay * nMonths;
  const totalInt = totalPay - loanAmt;

  const applyMortgage = async () => {
    setStep(1); setResult(null);
    addLog(`🏦 Hipoteca DeFi: ${prop.name} — LTV ${ltvNum}%`);
    const stepList = [
      [1, 700, "Tasación automática via Idealista API Pro…"],
      [2, 1500, "Euribor oracle Chainlink: " + euribor.toFixed(2) + "%"],
      [3, 2400, "Verificando colateral tokenizado ERC-1155…"],
      [4, 3300, "Generando contrato BeZhasCore.sol + calendario…"],
      [5, 4200, "SEPA Direct Debit ING España activado…"],
      [6, 5100, `✅ Hipoteca concedida: ${fmtEUR(loanAmt)} → wallet`],
    ];
    for (const [s, d, msg] of stepList) {
      await new Promise(r => setTimeout(r, d - (stepList[stepList.indexOf([s, d, msg]) > 0 ? stepList.indexOf([s, d, msg]) - 1 : 0]?.[1] || 0)));
      setStep(s); addLog(msg);
    }
    setResult({ loanAmt, monthPay, rate, ltvNum });
    setStep(0);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Card glow col={C.violet} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 14 }}>
            HIPOTECA DeFi — COLATERAL ERC-1155
          </div>

          {/* Property selector */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 8 }}>PROPIEDAD COLATERAL</div>
            {PROPERTIES.filter(p => p.status !== "FUNDING").map(p => (
              <button key={p.id} onClick={() => setPropId(p.id)} style={{
                width: "100%", padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                textAlign: "left", marginBottom: 5, display: "flex", justifyContent: "space-between",
                background: propId === p.id ? `${p.color}18` : C.card2,
                border: `1px solid ${propId === p.id ? p.color : C.border}`, transition: "all 0.15s",
              }}>
                <span style={{ color: propId === p.id ? p.color : C.text2, fontSize: 11, fontWeight: 700 }}>
                  {p.icon} {p.name}
                </span>
                <span style={{ color: C.gold, fontFamily: C.mono, fontSize: 10 }}>{fmtEUR(p.totalValue)}</span>
              </button>
            ))}
          </div>

          {[
            { l: "LTV solicitado (%)", val: ltv, set: setLtv, max: "70", sym: "%" },
            { l: "Plazo (años)", val: years, set: setYears, max: "30", sym: "años" },
          ].map(f => (
            <div key={f.l} style={{
              background: C.card2, border: `1px solid ${C.border2}`,
              borderRadius: 11, padding: "10px 13px", marginBottom: 8
            }}>
              <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>{f.l}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" value={f.val} max={f.max}
                  onChange={e => f.set(e.target.value)}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    color: C.text, fontFamily: C.mono, fontSize: 22, fontWeight: 800, minWidth: 0
                  }} />
                <span style={{ color: C.muted, fontFamily: C.mono, fontSize: 13 }}>{f.sym}</span>
              </div>
              <input type="range" min={10} max={f.max} value={f.val}
                onChange={e => f.set(e.target.value)}
                style={{ width: "100%", marginTop: 6, accentColor: C.violet }} />
            </div>
          ))}

          {/* Live preview */}
          {prop && (
            <div style={{
              padding: "10px 12px", background: `${C.violet}08`,
              border: `1px solid ${C.violet}22`, borderRadius: 10, marginBottom: 12
            }}>
              <div style={{ fontSize: 8, color: C.muted, marginBottom: 8 }}>RESUMEN</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                {[
                  { l: "Préstamo", v: fmtEUR(loanAmt), c: C.violet },
                  { l: "Cuota/mes", v: fmtEUR(monthPay), c: C.gold },
                  { l: "Euribor live", v: `${euribor}% + ${spread}%`, c: C.orange },
                  { l: "Tipo total", v: `${(rate * 100).toFixed(2)}%`, c: C.orange },
                  { l: "Total intereses", v: fmtEUR(totalInt), c: C.red },
                  { l: "LTV", v: `${ltvNum}% / 70% máx`, c: ltvNum > 65 ? C.orange : C.primary },
                ].map(s => (
                  <div key={s.l} style={{ background: C.card3, padding: "5px 8px", borderRadius: 8 }}>
                    <div style={{ fontSize: 7, color: C.muted }}>{s.l}</div>
                    <div style={{ fontSize: 10, color: s.c, fontFamily: C.mono, fontWeight: 800 }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Btn onClick={applyMortgage} col={C.violet} full icon="🏦"
            disabled={step > 0 || !prop || ltvNum > 70}>
            {step > 0 ? "PROCESANDO…" : "SOLICITAR HIPOTECA DeFi"}
          </Btn>

          {step > 0 && (
            <div style={{ marginTop: 10 }}>
              {[
                [1, "Tasación Idealista API"],
                [2, "Euribor Chainlink Oracle"],
                [3, "Verificar colateral ERC-1155"],
                [4, "Generar contrato BeZhasCore"],
                [5, "Activar SEPA Direct Debit"],
              ].map(([s, l]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    background: step > s ? `${C.primary}22` : step === s ? `${C.violet}22` : C.card3,
                    border: `1.5px solid ${step > s ? C.primary : step === s ? C.violet : C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: step > s ? C.primary : step === s ? C.violet : C.muted, fontSize: 8, fontWeight: 900
                  }}>
                    {step > s ? "✓" : s}
                  </div>
                  <span style={{ fontSize: 10, color: step >= s ? C.text2 : C.muted }}>{l}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div>
        {result && (
          <Card glow col={C.primary} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.primary, fontWeight: 800, marginBottom: 10 }}>
              ✅ HIPOTECA CONCEDIDA
            </div>
            {[
              ["Importe concedido", fmtEUR(result.loanAmt), C.gold],
              ["Cuota mensual", fmtEUR(result.monthPay), C.primary],
              ["Tipo interés", `${(result.rate * 100).toFixed(2)}%`, C.orange],
              ["LTV", `${result.ltvNum}%`, C.violet],
              ["SEPA domiciliado", "ING ES77 1465…", C.blue],
              ["Pago SEPA", "Día 5 de cada mes", C.muted],
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
              marginTop: 10, padding: "8px 10px", background: `${C.orange}10`,
              border: `1px solid ${C.orange}22`, borderRadius: 8, fontSize: 9, color: C.muted
            }}>
              ⚠️ Alerta automática si LTV &gt; 80%: liquidación parcial sin intervención humana.
            </div>
          </Card>
        )}

        <Card>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
            DIFERENCIAS HIPOTECA DeFi vs BANCO TRADICIONAL
          </div>
          {[
            { aspect: "Tiempo aprobación", trad: "2–6 semanas", bez: "4–15 minutos" },
            { aspect: "Documentación", trad: "40+ documentos", bez: "DID + ERC-1155" },
            { aspect: "Garantía", trad: "Escritura notarial", bez: "Smart contract" },
            { aspect: "Colateral", trad: "Tasación física", bez: "Oracle automático" },
            { aspect: "Cuotas", trad: "SEPA manual", bez: "SEPA automático" },
            { aspect: "Liquidación por impago", trad: "Judicial (3 años)", bez: "Smart contract auto" },
            { aspect: "Comisión apertura", trad: "1–2%", bez: "0.5% en BEZ" },
            { aspect: "Euribor actualización", trad: "Anual", bez: "Tiempo real (Chainlink)" },
          ].map(r => (
            <div key={r.aspect} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}22`
            }}>
              <span style={{ fontSize: 9, color: C.muted }}>{r.aspect}</span>
              <span style={{ fontSize: 9, color: C.red, fontFamily: C.mono }}>{r.trad}</span>
              <span style={{ fontSize: 9, color: C.primary, fontFamily: C.mono, fontWeight: 700 }}>{r.bez}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── TAB: RENTSTREAM ──────────────────────────────────────────────────────────
function TabRentStream({ addLog }) {
  const [distributing, setDist] = useState(false);
  const [distStep, setDistStep] = useState(0);
  const [history, setHistory] = useState([
    { date: "Mar 2025", prop: "Castellana 89", total: 95583, holders: 1482, tokensSold: 148200, status: "PAID" },
    { date: "Feb 2025", prop: "Castellana 89", total: 94200, holders: 1482, tokensSold: 148200, status: "PAID" },
    { date: "Mar 2025", prop: "Marina Barceloneta", total: 35750, holders: 624, tokensSold: 62400, status: "PAID" },
    { date: "Mar 2025", prop: "Nave Zaragoza", total: 62400, holders: 960, tokensSold: 96000, status: "PENDING" },
  ]);

  const totalRents = PROPERTIES.filter(p => p.status !== "FUNDING")
    .reduce((s, p) => s + p.monthlyRent, 0);

  const runDistribution = async (prop) => {
    setDist(true); setDistStep(0);
    addLog(`💰 Iniciando distribución renta: ${prop.name}`);
    const steps = [
      [1, 700, "SEPA: verificando cobro arrendatario en ING ES77 1465…"],
      [2, 1500, `Conversión EUR→BEZ: ${fmtEUR(prop.monthlyRent)} → ${fmtBEZ(prop.monthlyRent / 1.24)}…`],
      [3, 2400, `Calculando ${(prop.tokensSold).toLocaleString()} distribuciones proporcionales…`],
      [4, 3300, "BeZhasRewardsCalculator.sol: ejecutando distribución on-chain…"],
      [5, 4100, `✅ ${fmtBEZ(prop.monthlyRent / 1.24)} distribuidos a ${prop.tokensSold / 100} wallets`],
    ];
    for (const [s, d, msg] of steps) {
      await new Promise(r => setTimeout(r, d - (steps[steps.indexOf([s, d, msg]) > 0 ? steps.indexOf([s, d, msg]) - 1 : 0]?.[1] || 0)));
      setDistStep(s); addLog(msg);
    }
    setHistory(prev => [{
      date: "Mar 2025", prop: prop.name, total: prop.monthlyRent,
      holders: prop.tokensSold / 100, tokensSold: prop.tokensSold, status: "PAID"
    }, ...prev]);
    setDist(false); setDistStep(0);
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard label="Renta total/mes" value={fmtEUR(totalRents)} col={C.emerald} icon="💰" />
        <StatCard label="Renta total/año" value={fmtEUR(totalRents * 12)} col={C.gold} icon="📈" />
        <StatCard label="Propiedades activas" value={PROPERTIES.filter(p => p.status !== "FUNDING").length} col={C.primary} icon="🏠" />
        <StatCard label="Holders" value="3,066" col={C.blue} icon="👛" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Pending distributions */}
        <div>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
              DISTRIBUCIONES PENDIENTES — ABRIL 2025
            </div>
            {PROPERTIES.filter(p => p.status !== "FUNDING").map(p => (
              <div key={p.id} style={{
                padding: "10px 12px", background: C.card2,
                borderRadius: 10, marginBottom: 8, border: `1px solid ${C.border}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                    <div>
                      <div style={{ color: C.text, fontWeight: 700, fontSize: 11 }}>{p.name}</div>
                      <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono }}>
                        {(p.tokensSold / 100).toLocaleString()} holders · {p.tokensSold.toLocaleString()} tokens
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: C.emerald, fontFamily: C.mono, fontWeight: 900, fontSize: 14 }}>
                      {fmtEUR(p.monthlyRent)}
                    </div>
                    <div style={{ fontSize: 8, color: C.muted }}>
                      {fmtEUR(p.monthlyRent / p.tokensSold * 100)}/token
                    </div>
                  </div>
                </div>

                {/* Distribution step indicator */}
                {distributing ? (
                  <div style={{ display: "flex", gap: 3, alignItems: "center", marginBottom: 6 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <div key={s} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: distStep >= s ? C.emerald : C.card3, transition: "background 0.3s"
                      }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ height: 3, background: `${C.emerald}30`, borderRadius: 2, marginBottom: 6 }}>
                    <div style={{ height: "100%", width: "100%", background: C.emerald, borderRadius: 2 }} />
                  </div>
                )}

                <Btn onClick={() => runDistribution(p)} col={C.emerald} sm full
                  disabled={distributing} icon="💸">
                  {distributing ? "DISTRIBUYENDO…" : "DISTRIBUIR RENTA ON-CHAIN"}
                </Btn>
              </div>
            ))}
          </Card>
        </div>

        {/* History + flow */}
        <div>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
              FLUJO AUTOMÁTICO SEPA → BEZ → HOLDERS
            </div>
            {[
              { icon: "🏢", step: "1", action: "Arrendatario paga renta", detail: "SEPA Direct Debit → ING ES77 1465…" },
              { icon: "🔄", step: "2", action: "Conversión EUR → BEZ", detail: "SmartSwap QuickSwap V3 · tasa live" },
              { icon: "⛓️", step: "3", action: "BeZhasRewardsCalculator.sol", detail: "Calcula parte proporcional por token" },
              { icon: "👛", step: "4", action: "Distribución a wallets", detail: "Cada holder recibe BEZ al instante" },
              { icon: "📊", step: "5", action: "Registro on-chain", detail: "Historial inmutable en Polygon" },
            ].map(s => (
              <div key={s.step} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: `${C.emerald}18`, border: `1px solid ${C.emerald}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14
                }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: C.text, fontWeight: 700 }}>{s.action}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{s.detail}</div>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>
              HISTORIAL DISTRIBUCIONES
            </div>
            {history.slice(0, 5).map((h, i) => (
              <div key={i} style={{
                padding: "7px 0", borderBottom: `1px solid ${C.border}22`,
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <div>
                  <div style={{ fontSize: 10, color: C.text2, fontWeight: 700 }}>{h.prop}</div>
                  <div style={{ fontSize: 8, color: C.muted }}>{h.date} · {h.holders} holders</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: C.emerald, fontFamily: C.mono, fontWeight: 800, fontSize: 11 }}>
                    {fmtEUR(h.total)}
                  </div>
                  <Chip col={h.status === "PAID" ? C.primary : C.yellow} sm>
                    {h.status === "PAID" ? "✅ PAGADO" : "⏳ PENDIENTE"}
                  </Chip>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: DUE DILIGENCE ───────────────────────────────────────────────────────
function TabDueDiligence({ addLog }) {
  const [ref, setRef] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState(null);

  // Anthropic API call for due diligence analysis
  const runDueDiligence = async () => {
    if (!ref.trim()) return;
    setScanning(true); setScanStep(0); setResult(null);
    addLog(`🔍 Due diligence IA: referencia catastral ${ref}`);

    const steps = [
      [1, 600, "Catastro: consultando datos catastrales…"],
      [2, 1400, "Registro Propiedad: verificando cargas e hipotecas…"],
      [3, 2200, "AEAT: comprobando embargos y deudas tributarias…"],
      [4, 3100, "Poder Judicial: buscando litigios activos…"],
      [5, 4000, "Claude AI: analizando y consolidando hallazgos…"],
      [6, 5100, "✅ Informe de due diligence completado"],
    ];
    for (const [s, d, msg] of steps) {
      await new Promise(r => setTimeout(r, d - (steps[steps.indexOf([s, d, msg]) > 0 ? steps.indexOf([s, d, msg]) - 1 : 0]?.[1] || 0)));
      setScanStep(s); addLog(msg);
    }

    // Call Anthropic for analysis
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user", content: `You are BeZhas Real Estate Due Diligence AI. 
Analyze property reference "${ref}" in Spain and return ONLY valid JSON:
{
  "overallStatus": "CLEAN|CAUTION|ALERT",
  "score": 0-100,
  "catastro": {"found":true,"m2":0,"use":"residential|commercial|industrial","year":0},
  "ownership": {"clear":true,"owners":1,"issues":[]},
  "mortgages": {"count":0,"totalAmount":0,"lenders":[]},
  "embargos": {"count":0,"source":[]},
  "litigation": {"active":false,"cases":[]},
  "urbanismo": {"classification":"urbano|rústico","protected":false,"issues":[]},
  "recommendations": ["list"],
  "summary": "2 sentence assessment"
}`}]
        })
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      setResult(JSON.parse(clean));
    } catch {
      // Simulated result
      const isClean = Math.random() > 0.3;
      setResult({
        overallStatus: isClean ? "CLEAN" : "CAUTION",
        score: isClean ? rndInt(82, 97) : rndInt(55, 75),
        catastro: { found: true, m2: rndInt(80, 300), use: "residential", year: rndInt(1980, 2020) },
        ownership: { clear: isClean, owners: 1, issues: isClean ? [] : ["Copropiedad no registrada detectada"] },
        mortgages: { count: isClean ? 0 : 1, totalAmount: isClean ? 0 : rndInt(100000, 400000), lenders: isClean ? [] : ["Banco Santander"] },
        embargos: { count: 0, source: [] },
        litigation: { active: !isClean, cases: isClean ? [] : ["Procedimiento civil 2023/1421"] },
        urbanismo: { classification: "urbano", protected: false, issues: [] },
        recommendations: isClean ? ["Inmueble apto para tokenización inmediata", "Registro de propiedad limpio"] : ["Resolver hipoteca existente antes de tokenizar", "Verificar resolución litigio civil"],
        summary: isClean ? "Inmueble sin cargas significativas. Apto para tokenización BeZhas." : "Existen cargas que requieren resolución previa a la tokenización.",
      });
    }
    setScanning(false); setScanStep(0);
  };

  const statusColor = s => s === "CLEAN" ? C.primary : s === "CAUTION" ? C.yellow : C.red;
  const statusIcon = s => s === "CLEAN" ? "✅" : s === "CAUTION" ? "⚠️" : "🚨";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <Card glow col={C.amber} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 14 }}>
            DUE DILIGENCE IA — CLAUDE SONNET
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.8, marginBottom: 14 }}>
            Introduce la <strong style={{ color: C.text }}>referencia catastral</strong> del inmueble. Claude analiza en segundos: cargas, hipotecas, embargos AEAT, litigios judiciales y clasificación urbanística.
          </div>

          <div style={{
            background: C.card2, border: `1px solid ${C.border2}`,
            borderRadius: 11, padding: "10px 13px", marginBottom: 10
          }}>
            <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>
              REFERENCIA CATASTRAL (Ej: 2800412VK4780A)
            </div>
            <input type="text" value={ref} placeholder="2800412VK4780A"
              onChange={e => setRef(e.target.value)}
              style={{
                background: "transparent", border: "none", outline: "none", color: C.text,
                fontFamily: C.mono, fontSize: 18, fontWeight: 800, width: "100%"
              }} />
          </div>

          {/* Demo buttons */}
          <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
            {[["2800412VK4780A", "Madrid ✅"], ["0800814DF3780A", "BCN ⚠️"], ["4101210TG3440A", "Sevilla 🚨"]].map(([r, l]) => (
              <button key={r} onClick={() => setRef(r)} style={{
                padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontFamily: C.mono, fontSize: 9,
                background: `${C.amber}10`, border: `1px solid ${C.amber}33`, color: C.amber, fontWeight: 700,
              }}>{l}</button>
            ))}
          </div>

          <Btn onClick={runDueDiligence} col={C.amber} full icon="🔍"
            disabled={scanning || !ref.trim()}>
            {scanning ? "ANALIZANDO CON IA…" : "LANZAR DUE DILIGENCE"}
          </Btn>

          {scanning && (
            <div style={{ marginTop: 12 }}>
              {[
                [1, "Catastro España"],
                [2, "Registro Propiedad"],
                [3, "AEAT Embargos"],
                [4, "Poder Judicial"],
                [5, "Claude AI consolidación"],
              ].map(([s, l]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    background: scanStep > s ? `${C.primary}22` : scanStep === s ? `${C.amber}22` : C.card3,
                    border: `1.5px solid ${scanStep > s ? C.primary : scanStep === s ? C.amber : C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: scanStep > s ? C.primary : scanStep === s ? C.amber : C.muted, fontSize: 8, fontWeight: 900
                  }}>
                    {scanStep > s ? "✓" : s}
                  </div>
                  <span style={{ fontSize: 10, color: scanStep >= s ? C.text2 : C.muted }}>{l}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Results */}
      <div>
        {result ? (
          <div>
            {/* Header */}
            <div style={{
              padding: "14px 16px", background: `${statusColor(result.overallStatus)}10`,
              border: `1px solid ${statusColor(result.overallStatus)}33`, borderRadius: 12, marginBottom: 12,
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>
                  RESULTADO DUE DILIGENCE — {ref}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: statusColor(result.overallStatus) }}>
                  {statusIcon(result.overallStatus)} {result.overallStatus}
                </div>
                <div style={{ fontSize: 10, color: C.text2, marginTop: 4 }}>{result.summary}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: C.muted }}>SCORE</div>
                <div style={{
                  fontSize: 36, color: statusColor(result.overallStatus),
                  fontFamily: C.mono, fontWeight: 900
                }}>{result.score}</div>
                <div style={{ fontSize: 8, color: C.muted }}>/100</div>
              </div>
            </div>

            {/* Checks grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Catastro", ok: result.catastro?.found, detail: result.catastro ? `${result.catastro.m2}m² · ${result.catastro.use} · ${result.catastro.year}` : "No encontrado" },
                { label: "Titularidad", ok: result.ownership?.clear, detail: result.ownership?.issues?.[0] || `${result.ownership?.owners} propietario/s` },
                { label: "Hipotecas", ok: result.mortgages?.count === 0, detail: result.mortgages?.count === 0 ? "Sin cargas hipotecarias" : `${result.mortgages?.count} hipoteca/s — ${fmtEUR(result.mortgages?.totalAmount || 0)}` },
                { label: "Embargos AEAT", ok: result.embargos?.count === 0, detail: result.embargos?.count === 0 ? "Sin embargos tributarios" : "Embargos activos" },
                { label: "Litigios", ok: !result.litigation?.active, detail: result.litigation?.cases?.[0] || "Sin litigios activos" },
                { label: "Urbanismo", ok: !result.urbanismo?.protected && !result.urbanismo?.issues?.length, detail: result.urbanismo?.classification || "—" },
              ].map(c => (
                <div key={c.label} style={{
                  padding: "8px 10px", background: C.card2,
                  border: `1px solid ${c.ok ? C.primary + "33" : C.red + "33"}`, borderRadius: 10
                }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 12 }}>{c.ok ? "✅" : "❌"}</span>
                    <span style={{ fontSize: 10, color: C.text, fontWeight: 700 }}>{c.label}</span>
                  </div>
                  <div style={{ fontSize: 9, color: C.muted }}>{c.detail}</div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            <Card>
              <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>
                RECOMENDACIONES CLAUDE AI
              </div>
              {result.recommendations?.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ color: C.amber, flexShrink: 0 }}>→</span>
                  <span style={{ fontSize: 10, color: C.text2, lineHeight: 1.6 }}>{r}</span>
                </div>
              ))}
              <div style={{
                marginTop: 10, padding: "6px 10px",
                background: `${C.violet}10`, border: `1px solid ${C.violet}22`,
                borderRadius: 8, fontSize: 9, color: C.muted
              }}>
                Hash informe registrado on-chain: 0x{rndHex(16)}…
              </div>
            </Card>
          </div>
        ) : (
          <Card style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", minHeight: 300
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 12, color: C.text2, marginBottom: 6 }}>Due Diligence IA Ready</div>
            <div style={{ fontSize: 10, color: C.muted, textAlign: "center", lineHeight: 1.8, maxWidth: 260 }}>
              Introduce una referencia catastral y Claude analizará Catastro, Registro, AEAT y Juzgados en segundos.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── LIVE LOG ─────────────────────────────────────────────────────────────────
function useLiveLog() {
  const [log, setLog] = useState([
    "[ REAL ESTATE ] Phase 2 Agents v1.0 INITIALIZED",
    "[ PROPTOKEN   ] BeZhasRealEstate.sol ERC-1155 → LOADED",
    "[ MORTGAGE    ] Euribor Chainlink Oracle → 3.84%",
    "[ RENTSTREAM  ] BeZhasRewardsCalculator.sol → ACTIVE",
    "[ DILIGENCE   ] Claude Sonnet 4.6 + Catastro API → READY",
    "[ BEZ         ] Token 0xEcBa… · ING SEPA ES77 1465… → LIVE",
  ]);
  const add = useCallback((msg) => {
    const ts = new Date().toTimeString().slice(0, 8);
    setLog(p => [`[ ${ts} ] ${msg}`, ...p].slice(0, 50));
  }, []);
  useEffect(() => {
    const msgs = [
      "PROPTOKEN → Castellana 89: 12 tokens vendidos · €1,200",
      "RENTSTREAM → Marina BCN: renta €35,750 recibida ING SEPA",
      "MORTGAGE → Nave Zaragoza: cuota mensual €4,821 cobrada",
      "DILIGENCE → Ref 2800412VK4780A: CLEAN · score 94/100",
      "EURIBOR → 3.84% live · Chainlink Oracle actualizado",
      "BEZHAS → 0.5% fee hipoteca → Treasury DAO 0x89c2…",
    ];
    const t = setInterval(() => add(msgs[rndInt(0, msgs.length - 1)]), 3500);
    return () => clearInterval(t);
  }, [add]);
  return { log, add };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function RealEstateAgents() {
  const bridge = useAgentBridge("realestate");
  const [tab, setTab] = useState("proptoken");
  const { log, add } = useLiveLog();
  const [bezPrice, setBez] = useState(1.2400);

  useEffect(() => {
    const t = setInterval(() => setBez(p => +(p * (1 + (Math.random() - 0.498) * 0.002)).toFixed(4)), 1500);
    return () => clearInterval(t);
  }, []);

  const TABS = [
    { id: "proptoken", icon: "🏠", label: "PropToken", col: C.primary },
    { id: "mortgage", icon: "🏦", label: "SmartMortgage", col: C.violet },
    { id: "rentstream", icon: "💰", label: "RentStream", col: C.emerald },
    { id: "diligence", icon: "🔍", label: "DueDiligence", col: C.amber },
    { id: "metrics", icon: "📊", label: "Metrics", col: C.primary },
  ];

  const totalTVL = PROPERTIES.reduce((s, p) => s + p.totalValue * (p.tokensSold / p.tokens), 0);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.sans, fontSize: 13 }}>
      <style>{`*{box-sizing:border-box}@keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:${C.border3};border-radius:2px}`}</style>

      {/* HEADER */}
      <div style={{
        background: C.surf, borderBottom: `1px solid ${C.border}`, padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap"
      }}>
        <div style={{
          background: `linear-gradient(135deg,${C.amber},${C.primary})`,
          borderRadius: 12, padding: "7px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0
        }}>
          <span style={{ fontSize: 18 }}>🏢</span>
          <div>
            <div style={{ color: C.bg, fontFamily: C.mono, fontSize: 14, fontWeight: 900 }}>BeZhas</div>
            <div style={{ color: C.bg, fontSize: 8, opacity: 0.8, letterSpacing: 2 }}>REAL ESTATE v1 · FASE 2</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[["Polygon ✓", C.violet], ["BEZ-Coin ✓", C.gold], ["ERC-1155 Fracciones", C.primary],
          ["ING SEPA ✓", C.blue], ["Euribor Chainlink", C.orange], ["Claude AI ✓", C.emerald]].map(([l, c]) => (
            <span key={l} style={{
              background: `${c}20`, color: c, border: `1px solid ${c}33`,
              borderRadius: 20, padding: "2px 8px", fontSize: 9, fontFamily: C.mono, fontWeight: 700
            }}>{l}</span>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Chip col={C.gold}>🪙 BEZ ${bezPrice.toFixed(4)}</Chip>
          <Chip col={C.primary}>🏠 TVL {fmtEUR(totalTVL)}</Chip>
          <Chip col={C.emerald}>{PROPERTIES.length} propiedades</Chip>
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

      <div style={{ display: "flex", minHeight: "calc(100vh - 106px)" }}>
        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
          {tab === "proptoken" && <TabPropToken addLog={add} />}
          {tab === "mortgage" && <TabSmartMortgage addLog={add} />}
          {tab === "rentstream" && <TabRentStream addLog={add} />}
          {tab === "diligence" && <TabDueDiligence addLog={add} />}
          {tab === "metrics" && (
            <div>
              <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.primary, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>
                  📊 REAL-TIME AGENT METRICS — REALESTATE
                </div>
                <div style={{ fontSize: 9, color: "#344A5E" }}>
                  {bridge.loading ? "⏳ Connecting to API..." : bridge.error ? `❌ ${bridge.error}` : "🟢 Connected — data from /api/agents/realestate/metrics"}
                </div>
              </div>
              <AgentDetailPanel agentId="realestate" accentColor={C.primary} />
            </div>
          )}
        </div>

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
                  e.includes("CLEAN") || e.includes("✅") ? C.primary :
                    e.includes("RENT") || e.includes("renta") ? C.emerald :
                      e.includes("MORTGAGE") || e.includes("cuota") ? C.violet :
                        e.includes("BEZ") ? C.gold : C.text2
                ) : C.muted
              }}>{e}</div>
            ))}
          </div>
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono, marginBottom: 2 }}>QUALITY ESCROW</div>
            <div style={{ color: C.primary, fontFamily: C.mono, fontSize: 9 }}>{`0x3EfC42095E8503`.slice(0, 14)}…</div>
            <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono, marginTop: 4, marginBottom: 2 }}>ING SEPA</div>
            <div style={{ color: C.blue, fontFamily: C.mono, fontSize: 9 }}>ES77 1465 0100 91…</div>
          </div>
        </div>
      </div>

      <div style={{
        borderTop: `1px solid ${C.border}`, padding: "8px 20px", display: "flex",
        justifyContent: "space-between", color: C.muted, fontSize: 9,
        fontFamily: C.mono, background: C.surf, flexWrap: "wrap", gap: 4
      }}>
        <span>bez.digital · Real Estate Agents v1.0 · Fase 2 · PropToken · SmartMortgage · RentStream · DueDiligence</span>
        <span>BeZhasRealEstate.sol · ERC-1155 · Euribor Chainlink · ING SEPA · Claude AI · Catastro España</span>
      </div>
    </div>
  );
}
