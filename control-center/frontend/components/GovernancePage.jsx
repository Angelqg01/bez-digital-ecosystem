/**
 * BeZhas Web3 — GovernancePage
 * Gobernanza DAO con propuestas, votación con BEZ y panel de compliance.
 * Ruta: /dashboard/governance
 *
 * Contratos: GovernanceSystem.sol · TreasuryVault.sol · PublicBudgetDAO.sol
 * Agente:    ComplianceAgent (MiCA · DAC8 · Modelo 720 · AEAT · AML)
 */

import { useState } from 'react';
import { useGovernance, useCompliance } from '../hooks/useGovernance';

const C = {
  bg:'#03060E', surface:'#070D1A', surface2:'#0A1225',
  teal:'#00C896', tealDim:'rgba(0,200,150,0.10)', tealBrd:'rgba(0,200,150,0.18)',
  gold:'#FFB800', goldDim:'rgba(255,184,0,0.10)', goldBrd:'rgba(255,184,0,0.22)',
  red:'#FF4D6A',  redDim:'rgba(255,77,106,0.10)',
  green:'#4ADE80', orange:'#FB923C', purple:'#A78BFA',
  text:'#C8D8F0', textDim:'#6B8099', muted:'#1A2535',
};

const fmtM = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 1e6) return `${(v/1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v/1e3).toFixed(1)}K`;
  return v.toFixed(0);
};

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS = {
  active:    { label:'Activa',    color:C.teal,   icon:'🟢' },
  pending:   { label:'Pendiente', color:C.gold,   icon:'⏳' },
  succeeded: { label:'Aprobada',  color:C.green,  icon:'✅' },
  defeated:  { label:'Rechazada', color:C.red,    icon:'❌' },
  executed:  { label:'Ejecutada', color:C.purple, icon:'⚡' },
  queued:    { label:'En cola',   color:C.orange, icon:'🔄' },
};

const CATEGORY = {
  tokenomics: { label:'Tokenomics', color:C.teal   },
  platform:   { label:'Plataforma', color:C.gold   },
  security:   { label:'Seguridad',  color:C.red    },
  treasury:   { label:'Treasury',   color:C.purple },
  compliance: { label:'Compliance', color:C.orange },
};

const COMPLIANCE_FRAMEWORKS = [
  { id:'mica',       label:'MiCA',       icon:'🇪🇺', desc:'Markets in Crypto-Assets Regulation',      status:'pending',  score:60 },
  { id:'dac8',       label:'DAC8',       icon:'📊', desc:'Reporting automático operaciones a AEAT',   status:'partial',  score:75 },
  { id:'modelo720',  label:'Modelo 720', icon:'🏦', desc:'Bienes y derechos en el extranjero',        status:'ok',       score:100 },
  { id:'aml',        label:'AML/KYC',    icon:'🔍', desc:'5ª Directiva Blanqueo Capitales',           status:'pending',  score:55 },
  { id:'irpf_is',    label:'IS/IRPF',    icon:'🧾', desc:'Impuesto Sociedades y Renta — AEAT',        status:'ok',       score:90 },
];

// ─── UI Atoms ──────────────────────────────────────────────────────────────

function Card({ children, accent = C.teal, style = {} }) {
  return (
    <div style={{
      background:C.surface, borderRadius:12,
      border:`1px solid ${accent}25`, padding:'22px 24px',
      position:'relative', overflow:'hidden', ...style,
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
        background:`linear-gradient(90deg,transparent,${accent}55,transparent)` }} />
      {children}
    </div>
  );
}

function SectionLabel({ children, icon, color = C.teal }) {
  return (
    <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700,
      color, textTransform:'uppercase', letterSpacing:'0.15em',
      marginBottom:14, display:'flex', alignItems:'center', gap:6 }}>
      {icon && <span>{icon}</span>}{children}
    </div>
  );
}

// ─── Vote Bar ──────────────────────────────────────────────────────────────

function VoteBar({ proposal }) {
  const total    = parseFloat(proposal.totalVotes || 1);
  const forPct   = total > 0 ? (parseFloat(proposal.forVotes)     / total * 100) : 0;
  const agPct    = total > 0 ? (parseFloat(proposal.againstVotes) / total * 100) : 0;
  const absPct   = total > 0 ? (parseFloat(proposal.abstainVotes) / total * 100) : 0;
  const quorumPct= proposal.quorum
    ? Math.min(100, (total / parseFloat(proposal.quorum)) * 100) : 0;

  return (
    <div>
      {/* Barra principal */}
      <div style={{ height:10, borderRadius:5, overflow:'hidden',
        background:C.muted, display:'flex', marginBottom:6 }}>
        <div style={{ width:`${forPct}%`,   background:C.teal,   transition:'width 0.5s' }} />
        <div style={{ width:`${agPct}%`,    background:C.red,    transition:'width 0.5s' }} />
        <div style={{ width:`${absPct}%`,   background:C.textDim,transition:'width 0.5s' }} />
      </div>

      {/* Labels */}
      <div style={{ display:'flex', gap:16, fontSize:11, fontFamily:'JetBrains Mono,monospace' }}>
        <span style={{ color:C.teal  }}>✅ {forPct.toFixed(1)}% ({fmtM(proposal.forVotes)})</span>
        <span style={{ color:C.red   }}>❌ {agPct.toFixed(1)}% ({fmtM(proposal.againstVotes)})</span>
        <span style={{ color:C.textDim }}>⬜ {absPct.toFixed(1)}% ({fmtM(proposal.abstainVotes)})</span>
      </div>

      {/* Quorum indicator */}
      {proposal.quorum && (
        <div style={{ marginTop:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            fontSize:10, color:C.textDim, marginBottom:3 }}>
            <span>Quórum</span>
            <span style={{ color: proposal.quorumReached ? C.teal : C.gold }}>
              {proposal.quorumReached ? '✅ Alcanzado' : `${quorumPct.toFixed(1)}% — falta ${fmtM(parseFloat(proposal.quorum) - total)} BEZ`}
            </span>
          </div>
          <div style={{ height:3, background:C.muted, borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:2, width:`${quorumPct}%`,
              background: proposal.quorumReached ? C.teal : C.gold,
              transition:'width 0.5s',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Proposal Card ─────────────────────────────────────────────────────────

function ProposalCard({ proposal, votingPower, onVote }) {
  const [expanded,   setExpanded]   = useState(false);
  const [voted,      setVoted]      = useState(null);
  const [txLoading,  setTxLoading]  = useState(false);
  const [txMsg,      setTxMsg]      = useState(null);

  const status   = STATUS[proposal.status]   || STATUS.pending;
  const category = CATEGORY[proposal.category] || CATEGORY.platform;
  const isActive = proposal.status === 'active';
  const canVote  = isActive && parseFloat(votingPower) > 0 && !voted;

  const daysLeft = Math.max(0, Math.ceil((new Date(proposal.deadline) - Date.now()) / 86400000));

  const handleVote = async (support) => {
    setTxLoading(true); setTxMsg(null);
    try {
      await onVote(proposal.id, support);
      setVoted(support);
      setTxMsg({ ok:true, text:`✅ Voto registrado: ${support === 1 ? 'A favor' : support === 0 ? 'En contra' : 'Abstención'}` });
    } catch (e) {
      setTxMsg({ ok:false, text:`❌ Error: ${e.message}` });
    } finally { setTxLoading(false); }
  };

  return (
    <div style={{
      background:C.surface, borderRadius:12,
      border:`1px solid ${isActive ? C.teal+'44' : C.tealBrd}`,
      overflow:'hidden', transition:'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ padding:'18px 20px', cursor:'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:C.textDim }}>
                BIP-{proposal.id}
              </span>
              <span style={{
                padding:'2px 7px', borderRadius:4, fontSize:10,
                background:`${status.color}18`, color:status.color,
                border:`1px solid ${status.color}33`,
                fontFamily:'JetBrains Mono,monospace',
              }}>{status.icon} {status.label}</span>
              <span style={{
                padding:'2px 7px', borderRadius:4, fontSize:10,
                background:`${category.color}15`, color:category.color,
                border:`1px solid ${category.color}30`,
                fontFamily:'JetBrains Mono,monospace',
              }}>{category.label}</span>
              {isActive && (
                <span style={{ fontSize:10, color:C.gold, fontFamily:'JetBrains Mono,monospace' }}>
                  ⏱️ {daysLeft}d restantes
                </span>
              )}
            </div>
            <h3 style={{ margin:0, fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700,
              color:C.text, lineHeight:1.3 }}>{proposal.title}</h3>
          </div>
          <span style={{ color:C.textDim, fontSize:14, flexShrink:0, marginTop:2 }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>

        {/* Vote bar mini (siempre visible) */}
        <div style={{ marginTop:14 }}>
          <VoteBar proposal={proposal} />
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop:`1px solid ${C.tealBrd}`, padding:'18px 20px', background:C.surface2 }}>
          <p style={{ fontSize:13, color:C.textDim, lineHeight:1.7, margin:'0 0 18px' }}>
            {proposal.description}
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
            {[
              { label:'Proponente', value:`${proposal.proposer?.slice(0,10)}...` },
              { label:'Creada',     value:new Date(proposal.created).toLocaleDateString('es-ES') },
              { label:'Deadline',   value:new Date(proposal.deadline).toLocaleDateString('es-ES') },
            ].map(({ label, value }) => (
              <div key={label} style={{ background:C.surface, borderRadius:8,
                padding:'10px 12px', border:`1px solid ${C.tealBrd}` }}>
                <div style={{ fontSize:10, color:C.textDim, marginBottom:3 }}>{label}</div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:C.text }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Botones de voto */}
          {canVote && (
            <div>
              <div style={{ fontSize:12, color:C.textDim, marginBottom:10 }}>
                Tu poder de voto: <span style={{ color:C.teal, fontWeight:700 }}>
                  {fmtM(votingPower)} BEZ
                </span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { support:1, label:'✅ A favor',   color:C.teal },
                  { support:0, label:'❌ En contra',  color:C.red  },
                  { support:2, label:'⬜ Abstención', color:C.textDim },
                ].map(({ support, label, color }) => (
                  <button key={support} onClick={() => handleVote(support)} disabled={txLoading}
                    style={{
                      padding:'10px', borderRadius:8, cursor: txLoading ? 'not-allowed' : 'pointer',
                      border:`1px solid ${color}`, background:`${color}15`,
                      color, fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:12,
                      opacity: txLoading ? 0.5 : 1, transition:'all 0.15s',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {voted !== null && (
            <div style={{ marginTop:10, padding:'8px 14px', borderRadius:8, fontSize:12,
              background:C.tealDim, border:`1px solid ${C.teal}33`, color:C.teal }}>
              ✅ Voto registrado con {fmtM(votingPower)} BEZ
            </div>
          )}

          {!isActive && proposal.status !== 'pending' && (
            <div style={{ marginTop:10, padding:'8px 14px', borderRadius:8, fontSize:12,
              color:C.textDim, background:C.muted, borderRadius:8 }}>
              Esta propuesta ya no está activa para votar.
            </div>
          )}

          {parseFloat(votingPower) === 0 && isActive && (
            <div style={{ marginTop:10, padding:'8px 14px', borderRadius:8, fontSize:12,
              background:C.goldDim, border:`1px solid ${C.gold}33`, color:C.gold }}>
              ⚠️ Sin poder de voto. Stakea BEZ para participar en la gobernanza.
            </div>
          )}

          {txMsg && (
            <div style={{ marginTop:10, padding:'8px 14px', borderRadius:8, fontSize:12,
              background: txMsg.ok ? C.tealDim : C.redDim,
              border:`1px solid ${txMsg.ok ? C.teal : C.red}33`,
              color: txMsg.ok ? C.teal : C.red }}>
              {txMsg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Compliance Panel ──────────────────────────────────────────────────────

function CompliancePanel({ compliance }) {
  const { lastReport, checkResult, loading, runCheck, generateAEAT } = compliance;
  const [txLoading, setTxLoading] = useState(false);
  const [txMsg,     setTxMsg]     = useState(null);

  const handleCheck = async () => {
    setTxLoading(true); setTxMsg(null);
    try {
      await runCheck({ entityType:'empresa', annualVolume: 850000, assetsAbroad: 0 });
      setTxMsg({ ok:true, text:'✅ Check compliance iniciado — resultado en Telegram/tasks' });
    } catch (e) {
      setTxMsg({ ok:false, text:`❌ ${e.message}` });
    } finally { setTxLoading(false); }
  };

  const handleAEAT = async () => {
    setTxLoading(true); setTxMsg(null);
    try {
      await generateAEAT({
        gains: 125000, losses: 32000, revenue: 850000,
        entityType:'empresa', taxRegime:'startup',
        year: new Date().getFullYear() - 1,
      });
      setTxMsg({ ok:true, text:'✅ Informe AEAT iniciado — llega vía Telegram' });
    } catch (e) {
      setTxMsg({ ok:false, text:`❌ ${e.message}` });
    } finally { setTxLoading(false); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Frameworks */}
      <Card>
        <SectionLabel icon="⚖️">Estado Regulatorio</SectionLabel>
        {COMPLIANCE_FRAMEWORKS.map(fw => {
          const color = fw.status === 'ok' ? C.teal : fw.status === 'partial' ? C.gold : C.red;
          const icon  = fw.status === 'ok' ? '✅' : fw.status === 'partial' ? '🟡' : '🔴';
          return (
            <div key={fw.id} style={{ display:'flex', alignItems:'center', gap:12,
              padding:'10px 0', borderBottom:`1px solid ${C.tealBrd}` }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{fw.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                  <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:12, color:C.text }}>
                    {fw.label}
                  </span>
                  <span style={{ fontSize:10 }}>{icon}</span>
                </div>
                <div style={{ fontSize:10, color:C.textDim }}>{fw.desc}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:14, fontWeight:700, color }}>
                  {fw.score}%
                </div>
                <div style={{ height:3, width:48, background:C.muted, borderRadius:2, overflow:'hidden', marginTop:3 }}>
                  <div style={{ height:'100%', borderRadius:2, width:`${fw.score}%`, background:color }} />
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Acciones */}
      <Card>
        <SectionLabel icon="🤖">ComplianceAgent</SectionLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[
            { label:'🔍 Check MiCA + DAC8 + AML',   action: handleCheck,  color:C.teal },
            { label:'🧾 Generar Informe AEAT IS/IRPF', action: handleAEAT, color:C.gold },
          ].map(({ label, action, color }) => (
            <button key={label} onClick={action} disabled={txLoading}
              style={{
                width:'100%', padding:'11px 14px', borderRadius:9,
                border:`1px solid ${color}`, background:`${color}12`,
                color, cursor: txLoading ? 'not-allowed' : 'pointer',
                fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:12,
                textAlign:'left', opacity: txLoading ? 0.5 : 1,
              }}>
              {txLoading ? '⏳ Procesando...' : label}
            </button>
          ))}
        </div>

        {txMsg && (
          <div style={{ marginTop:10, padding:'8px 14px', borderRadius:8, fontSize:12,
            background: txMsg.ok ? C.tealDim : C.redDim,
            border:`1px solid ${txMsg.ok ? C.teal : C.red}33`,
            color: txMsg.ok ? C.teal : C.red }}>
            {txMsg.text}
          </div>
        )}

        <div style={{ marginTop:14, padding:'10px 12px', borderRadius:8,
          background:C.surface2, border:`1px solid ${C.tealBrd}`,
          fontSize:11, color:C.textDim, lineHeight:1.6 }}>
          <strong style={{ color:C.text }}>Próximas obligaciones:</strong><br />
          📅 Modelo 172/173 — Enero 2027 (datos 2026)<br />
          📅 Modelo 200 IS — Julio 2027 (ejercicio 2026)<br />
          📅 Whitepaper MiCA — Pendiente registro CNMV<br />
          📅 Registro VASP — Pendiente Banco de España
        </div>
      </Card>

      {/* Treasury */}
      <Card accent={C.gold}>
        <SectionLabel icon="🏦" color={C.gold}>Treasury DAO</SectionLabel>
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10,
          color:C.textDim, marginBottom:8, wordBreak:'break-all' }}>
          0x89c23890c742d710265dD61be789C71dC8999b12
        </div>
        {[
          { label:'Balance estimado', value:'—' },
          { label:'Propuestas aprobadas', value:'2' },
          { label:'Fondos asignados', value:'500K BEZ' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display:'flex', justifyContent:'space-between',
            fontSize:12, padding:'5px 0', borderBottom:`1px solid ${C.goldBrd}` }}>
            <span style={{ color:C.textDim }}>{label}</span>
            <span style={{ color:C.gold, fontFamily:'JetBrains Mono,monospace', fontWeight:600 }}>{value}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────

export default function GovernancePage({ userAddress }) {
  const { proposals, govStats, votingPower, loading, castVote } = useGovernance(userAddress);
  const compliance = useCompliance();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? proposals
    : proposals.filter(p => p.status === filter);

  const activeCount    = proposals.filter(p => p.status === 'active').length;
  const succeededCount = proposals.filter(p => p.status === 'succeeded').length;
  const totalVotes     = proposals.reduce((s, p) => s + parseFloat(p.totalVotes || 0), 0);

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter,sans-serif' }}>
      <style>{`* { box-sizing:border-box; }`}</style>

      <div style={{ maxWidth:1300, margin:'0 auto', padding:'32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>
            DAO <span style={{ color:C.teal }}>Governance</span>
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:C.textDim }}>
            GovernanceSystem.sol · TreasuryVault.sol · ComplianceAgent (MiCA · DAC8 · AEAT)
          </p>
        </div>

        {/* ── Stats ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:24 }}>
          {[
            { label:'Propuestas activas', value:activeCount,                   color:C.teal },
            { label:'Aprobadas',          value:succeededCount,                color:C.green },
            { label:'Total propuestas',   value:proposals.length,              color:C.text },
            { label:'Mi poder de voto',   value:`${fmtM(votingPower)} BEZ`,   color:C.gold },
            { label:'Votos emitidos',     value:`${fmtM(totalVotes)} BEZ`,    color:C.teal },
          ].map(({ label, value, color }) => (
            <Card key={label} accent={color} style={{ padding:'15px 18px' }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:19, fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:10, color:C.textDim, marginTop:2, textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</div>
            </Card>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>

          {/* ── Left: Proposals ── */}
          <div>
            {/* Filter tabs */}
            <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:`1px solid ${C.tealBrd}` }}>
              {[
                { id:'all',       label:'Todas' },
                { id:'active',    label:'Activas' },
                { id:'pending',   label:'Pendientes' },
                { id:'succeeded', label:'Aprobadas' },
                { id:'defeated',  label:'Rechazadas' },
              ].map(t => (
                <button key={t.id} onClick={() => setFilter(t.id)} style={{
                  padding:'8px 14px', background:'none', border:'none',
                  borderBottom: filter === t.id ? `2px solid ${C.teal}` : '2px solid transparent',
                  color: filter === t.id ? C.teal : C.textDim,
                  fontFamily:'Syne,sans-serif', fontSize:12, fontWeight:700,
                  cursor:'pointer', marginBottom:-1, transition:'all 0.15s',
                }}>{t.label}</button>
              ))}
            </div>

            {/* Proposals list */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {filtered.length === 0 ? (
                <Card>
                  <p style={{ color:C.textDim, textAlign:'center', margin:0, fontSize:13 }}>
                    Sin propuestas en este filtro
                  </p>
                </Card>
              ) : (
                filtered.map(p => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    votingPower={votingPower}
                    onVote={castVote}
                  />
                ))
              )}
            </div>

            {/* Info box */}
            <div style={{ marginTop:16, padding:'14px 18px', borderRadius:10,
              background:C.surface, border:`1px solid ${C.tealBrd}`, fontSize:12, color:C.textDim }}>
              ℹ️ El <strong style={{ color:C.text }}>poder de voto</strong> es proporcional al BEZ stakeado.
              Stakea más BEZ en <a href="/dashboard/staking" style={{ color:C.teal }}>Staking</a> para
              aumentar tu influencia. El quórum mínimo es <strong style={{ color:C.text }}>
                {fmtM(govStats?.quorum || 10000000)} BEZ
              </strong> por propuesta.
            </div>
          </div>

          {/* ── Right: Compliance Panel ── */}
          <CompliancePanel compliance={compliance} />
        </div>
      </div>
    </div>
  );
}
