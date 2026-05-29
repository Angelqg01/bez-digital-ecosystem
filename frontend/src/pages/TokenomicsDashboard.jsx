/**
 * BeZhas-Hub — TokenomicsDashboard
 * Vista 360° del ecosistema tokenómico BEZ-Coin.
 * Ruta: /dashboard/tokenomics
 *
 * Design system BeZhas: bg #03060E · teal #00C896 · gold #FFB800
 * Fonts: JetBrains Mono · Syne · Inter
 */

import { useState } from 'react';
import { useTokenomics } from '../hooks/useTokenomics';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#03060E',  surface: '#070D1A',  surface2: '#0A1225',
  teal:    '#00C896',  tealDim: 'rgba(0,200,150,0.10)',  tealBrd: 'rgba(0,200,150,0.18)',
  gold:    '#FFB800',  goldDim: 'rgba(255,184,0,0.10)',
  red:     '#FF4D6A',  redDim:  'rgba(255,77,106,0.10)',
  orange:  '#FB923C',  green:   '#4ADE80',
  text:    '#C8D8F0',  textDim: '#6B8099',
  muted:   '#1A2535',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt    = (n, d = 2) => parseFloat(n || 0).toLocaleString('es-ES', { maximumFractionDigits: d });
const fmtM   = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(2);
};

function PulsingDot({ color = C.teal }) {
  return (
    <span style={{ position:'relative', display:'inline-block', width:8, height:8 }}>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:color, opacity:0.35, animation:'bezPulse 2s infinite' }} />
      <span style={{ position:'absolute', inset:2, borderRadius:'50%', background:color }} />
    </span>
  );
}

function Card({ children, accent = C.teal, style = {} }) {
  return (
    <div style={{
      background: C.surface, borderRadius: 12,
      border: `1px solid ${accent}28`,
      padding: '20px 22px', position: 'relative',
      overflow: 'hidden', ...style,
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
        background:`linear-gradient(90deg,transparent,${accent}55,transparent)` }} />
      {children}
    </div>
  );
}

function MetricBox({ label, value, sub, color = C.teal, accent }) {
  return (
    <Card accent={accent || color} style={{ padding: '18px 20px' }}>
      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:24, fontWeight:700, color, marginBottom:4 }}>
        {value}
      </div>
      <div style={{ fontSize:10, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.12em' }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:C.textDim, marginTop:4 }}>{sub}</div>}
    </Card>
  );
}

// ─── Supply Ring ─────────────────────────────────────────────────────────────

function SupplyRing({ stakedPct = 0, circulatingPct = 100 }) {
  const r   = 52;
  const circ= 2 * Math.PI * r;
  const stkDash = (stakedPct / 100) * circ;

  return (
    <div style={{ position:'relative', width:140, height:140, flexShrink:0 }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Track */}
        <circle cx="70" cy="70" r={r} fill="none" stroke={C.muted} strokeWidth="12" />
        {/* Staked arc — teal */}
        <circle cx="70" cy="70" r={r} fill="none" stroke={C.teal} strokeWidth="12"
          strokeDasharray={`${stkDash} ${circ - stkDash}`}
          strokeLinecap="round"
          style={{ transform:'rotate(-90deg)', transformOrigin:'70px 70px', transition:'stroke-dasharray 0.8s ease' }} />
        {/* Circulating arc — gold (resto) */}
        <circle cx="70" cy="70" r={r} fill="none" stroke={C.gold} strokeWidth="5" strokeOpacity="0.4"
          strokeDasharray={`${circ - stkDash} ${stkDash}`}
          strokeDashoffset={-stkDash}
          style={{ transform:'rotate(-90deg)', transformOrigin:'70px 70px' }} />
      </svg>
      <div style={{
        position:'absolute', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
      }}>
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:18, fontWeight:700, color:C.teal }}>
          {stakedPct}%
        </div>
        <div style={{ fontSize:9, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.1em' }}>staked</div>
      </div>
    </div>
  );
}

// ─── Pool Bar ─────────────────────────────────────────────────────────────────

function PoolBar({ pool, onHarvest }) {
  const hasDeposit = parseFloat(pool.userDeposit || 0) > 0;

  return (
    <div style={{
      background: C.surface2, borderRadius:10,
      border:`1px solid ${hasDeposit ? C.teal+'44' : C.tealBrd}`,
      padding:'14px 16px', display:'flex', gap:14, alignItems:'center',
    }}>
      <div style={{ width:44, height:44, borderRadius:10,
        background:`linear-gradient(135deg,${C.tealDim},${C.goldDim})`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'JetBrains Mono,monospace', fontSize:9, color:C.teal, textAlign:'center',
        fontWeight:700, flexShrink:0,
      }}>
        {pool.name?.replace('/','\n')}
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:13, color:C.text }}>{pool.name}</span>
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, color:C.teal, fontWeight:700 }}>
            {pool.apy !== '—' ? `${pool.apy}% APY` : '— APY'}
          </span>
        </div>

        <div style={{ display:'flex', gap:16, fontSize:11, color:C.textDim }}>
          <span>TVL: {pool.tvl !== '—' ? `$${fmtM(pool.tvl)}` : '—'}</span>
          <span>{pool.chain}</span>
          {hasDeposit && <span style={{ color:C.gold }}>Mi posición: {fmtM(pool.userDeposit)} LP</span>}
        </div>

        {parseFloat(pool.pendingBez || 0) > 0 && (
          <div style={{ marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, color:C.gold }}>
              🌾 Pending: {fmtM(pool.pendingBez)} BEZ
            </span>
            <button onClick={() => onHarvest?.(pool.id)} style={{
              padding:'4px 12px', borderRadius:6,
              border:`1px solid ${C.gold}`, background:C.goldDim,
              color:C.gold, fontSize:11, cursor:'pointer',
              fontFamily:'JetBrains Mono,monospace',
            }}>Harvest</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Event Row ────────────────────────────────────────────────────────────────

const EVENT_ICONS = {
  staked:'📥', unstaked:'📤', rewards_claimed:'🎁', slashing:'⚔️',
  bridge_deposit:'🌉', large_transfer:'💸', payment:'💳',
};

function EventRow({ event }) {
  const icon = EVENT_ICONS[event.type] || '📌';
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'28px 1fr auto',
      gap:8, padding:'8px 0', alignItems:'center',
      borderBottom:`1px solid ${C.tealBrd}`, fontSize:12,
    }}>
      <span style={{ textAlign:'center' }}>{icon}</span>
      <div>
        <span style={{ color:C.text, fontFamily:'JetBrains Mono,monospace' }}>{event.type}</span>
        {event.amount && <span style={{ color:C.teal, marginLeft:8 }}>{fmtM(event.amount)} BEZ</span>}
      </div>
      <span style={{ color:C.textDim, fontFamily:'JetBrains Mono,monospace', fontSize:10 }}>
        {event.timestamp ? new Date(event.timestamp).toLocaleTimeString('es-ES') : '—'}
      </span>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function TokenomicsDashboard({ userAddress }) {
  const { snapshot, userStake, userFarms, events, loading, wsLive, farmHarvest, refresh } = useTokenomics(userAddress);
  const [activeTab, setActiveTab] = useState('overview');

  const snap   = snapshot || {};
  const supply = snap.supply  || {};
  const staking = snap.staking || {};
  const vals   = snap.validators || {};
  const pays   = snap.payments  || {};
  const pools  = snap.farming?.pools || [];

  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:C.teal, fontFamily:'JetBrains Mono,monospace', textAlign:'center' }}>
        <div style={{ fontSize:28, marginBottom:12 }}>⬡</div>Cargando ecosistema tokenómico...
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter,sans-serif' }}>
      <style>{`
        @keyframes bezPulse { 0%,100%{transform:scale(1);opacity:0.35} 50%{transform:scale(2.5);opacity:0} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.tealBrd};border-radius:2px}
      `}</style>

      <div style={{ maxWidth:1400, margin:'0 auto', padding:'32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:32 }}>
          <div>
            <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>
              BEZ <span style={{ color:C.teal }}>Tokenomics</span>
            </h1>
            <p style={{ margin:'4px 0 0', fontSize:13, color:C.textDim }}>
              Ecosistema completo — Polygon · BNB Chain · L2 BeZhas-Hub
            </p>
          </div>

          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11,
              fontFamily:'JetBrains Mono,monospace', color: wsLive ? C.teal : C.textDim }}>
              <PulsingDot color={wsLive ? C.teal : C.textDim} />
              {wsLive ? 'LIVE' : 'polling'}
            </div>
            <button onClick={refresh} style={{
              padding:'7px 14px', borderRadius:8, border:`1px solid ${C.tealBrd}`,
              background:C.tealDim, color:C.teal, cursor:'pointer',
              fontFamily:'JetBrains Mono,monospace', fontSize:11,
            }}>↻ Refresh</button>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:24 }}>
          <MetricBox label="Supply Total" value={fmtM(supply.total)}      sub="BEZ"     color={C.teal} />
          <MetricBox label="Circulante"   value={fmtM(supply.circulating)} sub="BEZ"    color={C.text} />
          <MetricBox label="En Staking"   value={fmtM(staking.totalStaked)} sub={`${supply.stakedPercent||0}% del supply`} color={C.gold} />
          <MetricBox label="APY Staking"  value={`${staking.apy||0}%`}    sub={`Epoch ${staking.epoch||0}`} color={C.green} />
          <MetricBox label="Validators"   value={vals.total||0}            sub={`Slashed: ${fmtM(vals.totalSlashed)} BEZ`} color={C.teal} />
          <MetricBox label="Vol. Pagos"   value={fmtM(pays.totalVolume)}   sub={`${pays.txCount||0} txs`} color={C.text} />
        </div>

        {/* ── Supply visual + Tabs ── */}
        <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20, marginBottom:24 }}>

          {/* Supply ring */}
          <Card style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:'24px' }}>
            <SupplyRing stakedPct={parseFloat(supply.stakedPercent||0)} />
            <div style={{ width:'100%' }}>
              {[
                { label:'En staking', value:fmtM(staking.totalStaked)+' BEZ', color:C.teal },
                { label:'Circulante', value:fmtM(supply.circulating)+' BEZ',  color:C.gold },
                { label:'Slashing (quemado)', value:fmtM(vals.totalSlashed)+' BEZ', color:C.red },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between',
                  fontSize:11, padding:'4px 0', borderBottom:`1px solid ${C.tealBrd}` }}>
                  <span style={{ color:C.textDim }}>{label}</span>
                  <span style={{ color, fontFamily:'JetBrains Mono,monospace', fontWeight:600 }}>{value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Tabs área */}
          <Card style={{ padding:0, overflow:'hidden' }}>
            {/* Tab headers */}
            <div style={{ display:'flex', borderBottom:`1px solid ${C.tealBrd}`, padding:'0 20px' }}>
              {[
                { id:'overview', label:'📊 Overview' },
                { id:'farming',  label:`🌾 Farming (${pools.length})` },
                { id:'events',   label:`📡 Eventos (${events.length})` },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  padding:'14px 16px', background:'none', border:'none',
                  borderBottom: activeTab === t.id ? `2px solid ${C.teal}` : '2px solid transparent',
                  color: activeTab === t.id ? C.teal : C.textDim,
                  fontFamily:'Syne,sans-serif', fontSize:12, fontWeight:700,
                  cursor:'pointer', marginBottom:-1, transition:'all 0.15s',
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ padding:'20px' }}>

              {/* Overview */}
              {activeTab === 'overview' && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  {[
                    { title:'🏦 Staking',     rows:[
                      ['Total staked', fmtM(staking.totalStaked)+' BEZ'],
                      ['APY', `${staking.apy||0}%`],
                      ['Epoch actual', staking.epoch||0],
                    ]},
                    { title:'⚔️ Validators',  rows:[
                      ['Activos', vals.total||0],
                      ['BEZ slashed', fmtM(vals.totalSlashed)],
                    ]},
                    { title:'💳 Pagos',        rows:[
                      ['Volumen total', fmtM(pays.totalVolume)+' BEZ'],
                      ['Transacciones', pays.txCount||0],
                    ]},
                    { title:'🔒 Escrow',       rows:[
                      ['Total bloqueado', fmtM(snap.escrow?.totalEscrowed)+' BEZ'],
                      ['Escrows activos', snap.escrow?.activeEscrows||0],
                    ]},
                  ].map(({ title, rows }) => (
                    <div key={title} style={{ background:C.surface2, borderRadius:8, padding:'14px 16px', border:`1px solid ${C.tealBrd}` }}>
                      <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700,
                        color:C.teal, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>{title}</div>
                      {rows.map(([k, v]) => (
                        <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0' }}>
                          <span style={{ color:C.textDim }}>{k}</span>
                          <span style={{ color:C.text, fontFamily:'JetBrains Mono,monospace', fontWeight:600 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Farming pools */}
              {activeTab === 'farming' && (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {pools.length === 0
                    ? <p style={{ color:C.textDim, fontSize:13 }}>Sin datos de farming disponibles</p>
                    : pools.map(pool => (
                        <PoolBar key={pool.id} pool={pool}
                          onHarvest={() => farmHarvest(pool.id)} />
                      ))
                  }
                </div>
              )}

              {/* Events feed */}
              {activeTab === 'events' && (
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'28px 1fr auto',
                    gap:8, fontSize:10, color:C.textDim, fontFamily:'JetBrains Mono,monospace',
                    textTransform:'uppercase', letterSpacing:'0.1em',
                    padding:'0 0 8px', borderBottom:`1px solid ${C.tealBrd}` }}>
                    <span>#</span><span>Tipo / Detalle</span><span>Hora</span>
                  </div>
                  {events.length === 0
                    ? <p style={{ color:C.textDim, fontSize:13, marginTop:12 }}>Sin eventos recientes</p>
                    : events.slice(0, 25).map((e, i) => <EventRow key={i} event={e} />)
                  }
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── User position strip (si hay wallet conectada) ── */}
        {userAddress && userStake && (
          <Card accent={C.gold} style={{ marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:13, fontWeight:700, color:C.gold,
                textTransform:'uppercase', letterSpacing:'0.12em' }}>
                Mi posición BEZ
              </div>
              <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
                {[
                  { label:'Staked',   value:`${fmtM(userStake.staked)} BEZ` },
                  { label:'Rewards',  value:`${fmtM(userStake.rewards)} BEZ`,  color:C.teal },
                  { label:'Unlock',   value: userStake.locked ? `${new Date(userStake.unlockTime*1000).toLocaleDateString('es-ES')}` : '✅ Libre' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize:10, color:C.textDim, marginBottom:2 }}>{label}</div>
                    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:14, fontWeight:700, color: color||C.text }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
