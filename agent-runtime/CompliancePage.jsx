/**
 * BeZhas Web3 — CompliancePage
 * Dashboard regulatorio completo:
 *   MiCA · DAC8 · Modelo 720 · AEAT (172/173/100/200) · AML/KYC
 * Ruta: /dashboard/compliance
 * Agente: ComplianceAgent
 */

import { useState, useCallback } from 'react';
import { useCompliance } from '../hooks/useGovernance';

const C = {
  bg:'#03060E', surface:'#070D1A', surface2:'#0A1225',
  teal:'#00C896', tealDim:'rgba(0,200,150,0.10)', tealBrd:'rgba(0,200,150,0.18)',
  gold:'#FFB800', goldDim:'rgba(255,184,0,0.10)',
  red:'#FF4D6A',  redDim:'rgba(255,77,106,0.10)',
  green:'#4ADE80', orange:'#FB923C', purple:'#A78BFA',
  text:'#C8D8F0', textDim:'#6B8099', muted:'#1A2535',
};

const fmtEUR = (n) =>
  parseFloat(n || 0).toLocaleString('es-ES', { style:'currency', currency:'EUR', maximumFractionDigits:0 });

// ─── Framework definitions ─────────────────────────────────────────────────

const FRAMEWORKS = [
  {
    id:       'mica',
    name:     'MiCA',
    fullName: 'Markets in Crypto-Assets Regulation (EU 2023/1114)',
    icon:     '🇪🇺',
    color:    C.teal,
    status:   'pending',
    score:    60,
    authority:'CNMV / ESMA',
    deadline: '2024-12-30',
    items: [
      { label:'Clasificación token',        done:true,  text:'BEZ-Coin → Utility Token (Art. 4 MiCA)' },
      { label:'Whitepaper registrado',      done:false, text:'Pendiente presentación ante CNMV' },
      { label:'Registro VASP',              done:false, text:'Pendiente solicitud Banco de España' },
      { label:'Política AML/KYC',           done:false, text:'Pendiente implementación completa' },
      { label:'Informe actividad anual',    done:false, text:'Requerido a partir de registro (Art. 22)' },
      { label:'Límites stablecoin',         done:true,  text:'No aplica — BEZ no es EMT/ART' },
    ],
  },
  {
    id:       'dac8',
    name:     'DAC8',
    fullName: 'Directiva sobre Cooperación Administrativa (2023/2226/UE)',
    icon:     '📊',
    color:    C.gold,
    status:   'partial',
    score:    75,
    authority:'AEAT',
    deadline: 'Enero cada año',
    items: [
      { label:'Reporting tx > 1.000€',      done:true,  text:'Sistema de alertas implementado' },
      { label:'Reporting anual > 10.000€',  done:false, text:'Pendiente integración Modelo 173 AEAT' },
      { label:'Intercambio datos UE',        done:false, text:'Automático vía AEAT — pendiente activación' },
      { label:'Modelo 172 (saldos)',         done:false, text:'Pendiente — reporta el exchange' },
      { label:'Modelo 173 (operaciones)',    done:false, text:'Pendiente implementación' },
      { label:'Identificación usuarios',     done:true,  text:'KYC básico implementado' },
    ],
  },
  {
    id:       'modelo720',
    name:     'Modelo 720',
    fullName: 'Declaración de Bienes y Derechos en el Extranjero',
    icon:     '🏦',
    color:    C.green,
    status:   'ok',
    score:    100,
    authority:'AEAT',
    deadline: '31 de marzo',
    items: [
      { label:'Evaluación activos extranjeros', done:true, text:'< 50.000€ — sin obligación' },
      { label:'Wallets fuera de España',         done:true, text:'Valoración documentada' },
      { label:'DeFi positions externas',         done:true, text:'Monitorizadas via TokenomicsConnector' },
      { label:'NFTs custodios extranjero',       done:true, text:'Sin posiciones > umbral' },
    ],
  },
  {
    id:       'aml',
    name:     'AML/KYC',
    fullName: '5ª Directiva de Blanqueo de Capitales (2018/843/UE)',
    icon:     '🔍',
    color:    C.orange,
    status:   'pending',
    score:    55,
    authority:'SEPBLAC / Banco de España',
    deadline: 'Continuo',
    items: [
      { label:'KYC básico (< 1.000€)',      done:true,  text:'Email + nombre implementado' },
      { label:'KYC estándar (> 1.000€)',    done:false, text:'Pendiente integración Jumio/Onfido' },
      { label:'KYC reforzado (> 10.000€)', done:false, text:'Pendiente proveedor KYC externo' },
      { label:'SEPBLAC reporting (SAR)',    done:false, text:'Pendiente conexión API SEPBLAC' },
      { label:'Países alto riesgo FATF',   done:true,  text:'Lista negra implementada en AML check' },
      { label:'Monitorización continua',   done:false, text:'Pendiente — AegisConnector v2' },
    ],
  },
  {
    id:       'fiscal',
    name:     'IS / IRPF',
    fullName: 'Impuesto sobre Sociedades e IRPF — AEAT España',
    icon:     '🧾',
    color:    C.purple,
    status:   'partial',
    score:    85,
    authority:'AEAT',
    deadline: 'Junio / Julio cada año',
    items: [
      { label:'Régimen fiscal',              done:true, text:'Sociedad Limitada — Startup 15% IS' },
      { label:'Modelo 200 (IS)',             done:true, text:'Presentación anual — Julio' },
      { label:'Modelo 202 (pago fraccionado)',done:false, text:'Pendiente configuración trimestral' },
      { label:'Modelo 100 (IRPF socios)',    done:true, text:'Ganancias patrimoniales cripto' },
      { label:'IVA crypto-fiat',             done:true, text:'Exento (TJUE C-264/14 Hedqvist)' },
      { label:'ZEC Canarias',                done:false, text:'Evaluar si aplica (4% IS)' },
    ],
  },
];

// ─── UI Atoms ──────────────────────────────────────────────────────────────

function Card({ children, accent = C.teal, style = {} }) {
  return (
    <div style={{
      background:C.surface, borderRadius:12,
      border:`1px solid ${accent}25`, padding:'20px 22px',
      position:'relative', overflow:'hidden', ...style,
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
        background:`linear-gradient(90deg,transparent,${accent}55,transparent)` }} />
      {children}
    </div>
  );
}

function StatusDot({ status }) {
  const colors = { ok:'#4ADE80', partial:C.gold, pending:C.red };
  const labels = { ok:'Conforme', partial:'Parcial', pending:'Pendiente' };
  const c = colors[status] || C.textDim;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5,
      fontFamily:'JetBrains Mono,monospace', fontSize:10, color:c }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:c,
        boxShadow:`0 0 6px ${c}88` }} />
      {labels[status] || status}
    </span>
  );
}

// ─── Score Ring ────────────────────────────────────────────────────────────

function ScoreRing({ score, color, size = 90 }) {
  const r    = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.muted} strokeWidth={10} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transform:`rotate(-90deg)`, transformOrigin:`${size/2}px ${size/2}px`,
            transition:'stroke-dasharray 0.7s ease' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:16,
          fontWeight:700, color, lineHeight:1 }}>{score}</span>
        <span style={{ fontSize:8, color:C.textDim, letterSpacing:'0.05em' }}>/ 100</span>
      </div>
    </div>
  );
}

// ─── Framework Card (expandible) ──────────────────────────────────────────

function FrameworkCard({ fw }) {
  const [open, setOpen] = useState(false);
  const doneCount = fw.items.filter(i => i.done).length;

  return (
    <div style={{
      background:C.surface, borderRadius:12,
      border:`1px solid ${fw.color}${fw.score === 100 ? '55' : '25'}`,
      overflow:'hidden', transition:'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ padding:'16px 20px', cursor:'pointer', userSelect:'none' }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <ScoreRing score={fw.score} color={fw.color} size={72} />

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
              <span style={{ fontSize:20 }}>{fw.icon}</span>
              <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:16, color:C.text }}>
                {fw.name}
              </span>
              <StatusDot status={fw.status} />
            </div>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:6 }}>{fw.fullName}</div>
            <div style={{ display:'flex', gap:16, fontSize:11 }}>
              <span style={{ color:C.textDim }}>Autoridad: <span style={{ color:fw.color }}>{fw.authority}</span></span>
              <span style={{ color:C.textDim }}>Deadline: <span style={{ color:C.text }}>{fw.deadline}</span></span>
              <span style={{ color:C.teal }}>{doneCount}/{fw.items.length} ítems</span>
            </div>
          </div>

          <span style={{ color:C.textDim, fontSize:14, flexShrink:0 }}>{open ? '▲' : '▼'}</span>
        </div>

        {/* Progress mini bar */}
        <div style={{ marginTop:12, height:4, background:C.muted, borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:2,
            width:`${fw.score}%`, background:fw.color, transition:'width 0.5s' }} />
        </div>
      </div>

      {/* Checklist expandida */}
      {open && (
        <div style={{ borderTop:`1px solid ${fw.color}22`, padding:'16px 20px', background:C.surface2 }}>
          {fw.items.map((item, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10,
              padding:'8px 0', borderBottom: i < fw.items.length - 1 ? `1px solid ${C.tealBrd}` : 'none' }}>
              <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>
                {item.done ? '✅' : '⏳'}
              </span>
              <div>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:12, fontWeight:700,
                  color: item.done ? C.text : C.textDim, marginBottom:2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize:11, color:C.textDim }}>{item.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AEAT Tax Calculator ───────────────────────────────────────────────────

function TaxCalculator({ onGenerate }) {
  const [form, setForm] = useState({
    gains:      '',
    losses:     '',
    revenue:    '',
    taxRegime:  'startup',
    year:       String(new Date().getFullYear() - 1),
  });
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);

  const TAX_RATES = { general:0.25, startup:0.15, zec:0.04 };

  const preview = useCallback(() => {
    const gains   = parseFloat(form.gains   || 0);
    const losses  = parseFloat(form.losses  || 0);
    const revenue = parseFloat(form.revenue || 0);
    const rate    = TAX_RATES[form.taxRegime] || 0.15;
    const netGain = gains - losses;
    const isDue   = revenue * rate;
    let irpf = 0;
    if (netGain > 0) {
      const bands = [[0,6000,0.19],[6000,50000,0.21],[50000,200000,0.23],[200000,Infinity,0.26]];
      let rem = netGain;
      for (const [f, t, r] of bands) {
        if (rem <= 0) break;
        const taxable = Math.min(rem, t - f);
        irpf += taxable * r; rem -= taxable;
      }
    }
    setResult({ isDue, irpf, netGain, rate, total: isDue + irpf });
  }, [form]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await onGenerate({
        gains: parseFloat(form.gains || 0), losses: parseFloat(form.losses || 0),
        revenue: parseFloat(form.revenue || 0),
        taxRegime: form.taxRegime, year: parseInt(form.year),
        entityType: 'empresa',
      });
    } finally { setLoading(false); }
  };

  const field = (key, label, placeholder) => (
    <div>
      <div style={{ fontSize:11, color:C.textDim, marginBottom:5 }}>{label}</div>
      <div style={{ position:'relative' }}>
        <input
          type="number" value={form[key]} placeholder={placeholder}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          onBlur={preview}
          style={{ width:'100%', padding:'9px 40px 9px 12px',
            background:C.surface2, border:`1px solid ${C.tealBrd}`,
            borderRadius:8, color:C.text, fontSize:13,
            fontFamily:'JetBrains Mono,monospace', outline:'none', appearance:'textfield' }}
        />
        <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
          fontSize:10, color:C.textDim }}>€</span>
      </div>
    </div>
  );

  return (
    <Card accent={C.purple}>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700,
        color:C.purple, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:14 }}>
        🧾 Calculadora Fiscal AEAT
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
        {field('revenue', 'Revenue / Ingresos (base IS)', '850000')}
        {field('gains',   'Ganancias patrimoniales cripto', '125000')}
        {field('losses',  'Pérdidas patrimoniales cripto',  '32000')}

        <div>
          <div style={{ fontSize:11, color:C.textDim, marginBottom:5 }}>Régimen fiscal</div>
          <select value={form.taxRegime}
            onChange={e => { setForm(f => ({...f, taxRegime:e.target.value})); setTimeout(preview, 50); }}
            style={{ width:'100%', padding:'9px 12px',
              background:C.surface2, border:`1px solid ${C.tealBrd}`,
              borderRadius:8, color:C.text, fontSize:12,
              fontFamily:'JetBrains Mono,monospace', outline:'none', cursor:'pointer' }}>
            <option value="startup">Startup 15% IS</option>
            <option value="general">General 25% IS</option>
            <option value="zec">ZEC Canarias 4% IS</option>
          </select>
        </div>
      </div>

      {/* Preview */}
      {result && (
        <div style={{ background:C.surface2, borderRadius:9, padding:'12px 14px',
          border:`1px solid ${C.purple}33`, marginBottom:12 }}>
          {[
            { label:'IS estimado',          value:fmtEUR(result.isDue),   color:C.purple },
            { label:'IRPF ganancias cripto',value:fmtEUR(result.irpf),    color:C.orange },
            { label:'Ganancia neta cripto', value:fmtEUR(result.netGain), color:result.netGain >= 0 ? C.teal : C.red },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between',
              fontSize:12, padding:'4px 0', borderBottom:`1px solid ${C.tealBrd}` }}>
              <span style={{ color:C.textDim }}>{label}</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', color, fontWeight:700 }}>{value}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between',
            fontSize:13, padding:'8px 0 0', fontWeight:700 }}>
            <span style={{ color:C.text }}>Total obligaciones</span>
            <span style={{ fontFamily:'JetBrains Mono,monospace', color:C.purple }}>
              {fmtEUR(result.total)}
            </span>
          </div>
        </div>
      )}

      <button onClick={handleGenerate} disabled={loading} style={{
        width:'100%', padding:'11px', borderRadius:9,
        border:`1px solid ${C.purple}`, background:`${C.purple}15`,
        color:C.purple, cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:12,
        opacity: loading ? 0.5 : 1,
      }}>
        {loading ? '⏳ Generando...' : '🤖 Generar informe con ComplianceAgent'}
      </button>
    </Card>
  );
}

// ─── Obligations Calendar ──────────────────────────────────────────────────

const OBLIGATIONS = [
  { date:'Enero 2027',    model:'Modelo 172/173', desc:'Saldos y operaciones cripto 2026',    done:false, urgent:false },
  { date:'Marzo 2027',    model:'Modelo 720',     desc:'Bienes extranjeros si > 50.000€',      done:false, urgent:false },
  { date:'Abril 2027',    model:'VASP MICA',      desc:'Renovación anual registro Banco de España', done:false, urgent:false },
  { date:'Julio 2027',    model:'Modelo 200',     desc:'Impuesto Sociedades ejercicio 2026',   done:false, urgent:false },
  { date:'Julio 2027',    model:'Modelo 100',     desc:'IRPF socios — ganancias cripto 2026',  done:false, urgent:false },
  { date:'Continuo',      model:'DAC8',           desc:'Reporting automático tx > 1.000€',     done:true,  urgent:false },
  { date:'Pendiente',     model:'Whitepaper MiCA',desc:'Registro ante CNMV (Art. 6 MiCA)',     done:false, urgent:true  },
  { date:'Pendiente',     model:'VASP',           desc:'Solicitud registro Banco de España',   done:false, urgent:true  },
];

function ObligationRow({ ob }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'110px 120px 1fr 60px',
      alignItems:'center', padding:'9px 0',
      borderBottom:`1px solid ${C.tealBrd}`, fontSize:12 }}>
      <span style={{
        fontFamily:'JetBrains Mono,monospace', fontSize:10,
        color: ob.urgent ? C.red : C.textDim,
        fontWeight: ob.urgent ? 700 : 400,
      }}>{ob.date}</span>
      <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:C.teal }}>{ob.model}</span>
      <span style={{ color:C.textDim, fontSize:11 }}>{ob.desc}</span>
      <span style={{ textAlign:'right' }}>
        {ob.done
          ? <span style={{ color:C.green, fontSize:13 }}>✅</span>
          : ob.urgent
            ? <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9,
                background:C.redDim, color:C.red, padding:'2px 5px', borderRadius:3 }}>URGENTE</span>
            : <span style={{ color:C.textDim, fontSize:13 }}>⏳</span>
        }
      </span>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const { lastReport, checkResult, loading, runCheck, generateAEAT } = useCompliance();
  const [activeTab, setActiveTab] = useState('frameworks');

  // Score global
  const globalScore = Math.round(
    FRAMEWORKS.reduce((s, f) => s + f.score, 0) / FRAMEWORKS.length
  );
  const pendingCount = FRAMEWORKS.filter(f => f.status === 'pending').length;
  const okCount      = FRAMEWORKS.filter(f => f.status === 'ok').length;
  const urgentCount  = OBLIGATIONS.filter(o => o.urgent && !o.done).length;

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter,sans-serif' }}>
      <style>{`* { box-sizing:border-box; } input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none} select option { background:${C.surface2}; }`}</style>

      <div style={{ maxWidth:1300, margin:'0 auto', padding:'32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>
            Regulatory <span style={{ color:C.teal }}>Compliance</span>
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:C.textDim }}>
            MiCA · DAC8 · Modelo 720 · AEAT (172/173/100/200) · AML/KYC · ComplianceAgent
          </p>
        </div>

        {/* ── Stats strip ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:24 }}>
          {[
            { label:'Score Global',         value:`${globalScore}%`,  color: globalScore >= 80 ? C.teal : globalScore >= 60 ? C.gold : C.red },
            { label:'Frameworks OK',         value:okCount,            color:C.green },
            { label:'Pendientes',            value:pendingCount,       color:C.red },
            { label:'Obligaciones urgentes', value:urgentCount,        color:urgentCount > 0 ? C.red : C.teal },
            { label:'Próximo deadline',      value:'Enero 2027',       color:C.textDim },
          ].map(({ label, value, color }) => (
            <Card key={label} accent={color} style={{ padding:'15px 18px' }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:20, fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:10, color:C.textDim, marginTop:2, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
            </Card>
          ))}
        </div>

        {/* ── Urgent banner ── */}
        {urgentCount > 0 && (
          <div style={{ background:C.redDim, border:`1px solid ${C.red}44`,
            borderRadius:10, padding:'14px 20px', marginBottom:20,
            display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:20 }}>🚨</span>
            <div>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, color:C.red, fontSize:14 }}>
                {urgentCount} obligación(es) urgente(s) sin completar
              </div>
              <div style={{ fontSize:12, color:C.textDim, marginTop:2 }}>
                Whitepaper MiCA y registro VASP en Banco de España pendientes
              </div>
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20 }}>

          {/* ── Left: Tabs ── */}
          <div>
            <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:`1px solid ${C.tealBrd}` }}>
              {[
                { id:'frameworks',   label:'⚖️ Frameworks' },
                { id:'obligations',  label:`📅 Calendario (${OBLIGATIONS.length})` },
                { id:'reports',      label:'📋 Informes' },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  padding:'8px 16px', background:'none', border:'none',
                  borderBottom: activeTab === t.id ? `2px solid ${C.teal}` : '2px solid transparent',
                  color: activeTab === t.id ? C.teal : C.textDim,
                  fontFamily:'Syne,sans-serif', fontSize:12, fontWeight:700,
                  cursor:'pointer', marginBottom:-1, transition:'all 0.15s',
                }}>{t.label}</button>
              ))}
            </div>

            {/* Frameworks */}
            {activeTab === 'frameworks' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {FRAMEWORKS.map(fw => <FrameworkCard key={fw.id} fw={fw} />)}
              </div>
            )}

            {/* Obligations */}
            {activeTab === 'obligations' && (
              <Card>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700,
                  color:C.teal, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:14 }}>
                  📅 Calendario de Obligaciones Regulatorias
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'110px 120px 1fr 60px',
                  fontSize:10, color:C.textDim, fontFamily:'JetBrains Mono,monospace',
                  textTransform:'uppercase', letterSpacing:'0.08em',
                  padding:'0 0 8px', borderBottom:`1px solid ${C.tealBrd}` }}>
                  <span>Fecha</span><span>Modelo</span><span>Descripción</span><span style={{ textAlign:'right' }}>Estado</span>
                </div>
                {OBLIGATIONS.map((ob, i) => <ObligationRow key={i} ob={ob} />)}
              </Card>
            )}

            {/* Reports */}
            {activeTab === 'reports' && (
              <Card>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700,
                  color:C.teal, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:14 }}>
                  📋 Último Informe ComplianceAgent
                </div>

                {lastReport?.report ? (
                  <div style={{ fontSize:13, color:C.text, lineHeight:1.7,
                    whiteSpace:'pre-wrap', fontFamily:'Inter,sans-serif' }}>
                    {lastReport.report}
                  </div>
                ) : (
                  <div style={{ textAlign:'center', padding:'30px 0' }}>
                    <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
                    <div style={{ color:C.textDim, fontSize:13, marginBottom:16 }}>
                      Sin informes generados aún.
                    </div>
                    <button
                      onClick={() => runCheck({ entityType:'empresa', annualVolume:850000 })}
                      disabled={loading}
                      style={{
                        padding:'10px 20px', borderRadius:9,
                        border:`1px solid ${C.teal}`, background:C.tealDim,
                        color:C.teal, cursor:'pointer', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:13,
                      }}>
                      {loading ? '⏳ Generando...' : '🤖 Generar primer informe'}
                    </button>
                  </div>
                )}

                {checkResult && (
                  <div style={{ marginTop:16, padding:'12px 14px', borderRadius:9,
                    background:C.tealDim, border:`1px solid ${C.teal}33` }}>
                    <div style={{ fontSize:12, color:C.teal, fontWeight:700, marginBottom:6 }}>
                      ✅ Check iniciado — resultado en Telegram y /api/tasks
                    </div>
                    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:C.textDim }}>
                      Task ID: {checkResult.taskId}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* ── Right: Tools ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <TaxCalculator onGenerate={generateAEAT} />

            {/* Quick actions */}
            <Card>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700,
                color:C.teal, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:12 }}>
                ⚡ Acciones Rápidas
              </div>
              {[
                { label:'🔍 Check MiCA + DAC8 + AML',         action: () => runCheck({ entityType:'empresa' }),      color:C.teal   },
                { label:'📊 Check DAC8 transacción',           action: () => runCheck({ txAmount:5000 }),             color:C.gold   },
                { label:'🔴 Check AML / SEPBLAC',              action: () => runCheck({ txAmount:15000 }),            color:C.orange },
                { label:'📋 Generar informe trimestral',       action: () => runCheck({ type:'compliance:report' }), color:C.purple },
              ].map(({ label, action, color }) => (
                <button key={label} onClick={action} disabled={loading}
                  style={{
                    width:'100%', padding:'10px 14px', marginBottom:8,
                    background:`${color}10`, border:`1px solid ${color}33`,
                    borderRadius:8, color, cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:11,
                    textAlign:'left', opacity: loading ? 0.6 : 1, transition:'all 0.15s',
                  }}>
                  {loading ? '⏳...' : label}
                </button>
              ))}
            </Card>

            {/* Legal notice */}
            <div style={{ padding:'14px 16px', borderRadius:10,
              background:C.surface, border:`1px solid ${C.tealBrd}`,
              fontSize:11, color:C.textDim, lineHeight:1.7 }}>
              <strong style={{ color:C.text }}>⚠️ Aviso legal:</strong> Este dashboard es
              informativo. Las estimaciones fiscales son orientativas.
              Consulta siempre con un <strong style={{ color:C.gold }}>asesor fiscal
              especializado en cripto</strong> antes de presentar declaraciones ante la AEAT.
              Última actualización regulatoria: <strong style={{ color:C.text }}>MiCA vigente desde jun-2024</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
