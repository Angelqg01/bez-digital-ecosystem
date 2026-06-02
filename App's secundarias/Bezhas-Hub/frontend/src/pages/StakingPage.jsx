/**
 * BeZhas-Hub — StakingPage
 * Stake / Unstake BEZ + historial de rewards + info de epochs.
 * Ruta: /dashboard/staking
 * Contratos: StakingPool.sol · ValidatorRegistry.sol · SlashingManager.sol
 */

import { useState, useCallback } from 'react';
import { useTokenomics } from '../hooks/useTokenomics';

const C = {
  bg:'#03060E', surface:'#070D1A', surface2:'#0A1225',
  teal:'#00C896', tealDim:'rgba(0,200,150,0.10)', tealBrd:'rgba(0,200,150,0.18)',
  gold:'#FFB800', goldDim:'rgba(255,184,0,0.10)', goldBrd:'rgba(255,184,0,0.22)',
  red:'#FF4D6A',  redDim:'rgba(255,77,106,0.10)',
  green:'#4ADE80',
  text:'#C8D8F0', textDim:'#6B8099', muted:'#1A2535',
};

const fmt  = (n, d = 2) => parseFloat(n || 0).toLocaleString('es-ES', { maximumFractionDigits: d });
const fmtM = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(4);
};

// ─── UI Primitives ─────────────────────────────────────────────────────────

function Card({ children, accent = C.teal, style = {} }) {
  return (
    <div style={{
      background: C.surface, borderRadius: 12,
      border: `1px solid ${accent}28`, padding: '22px 24px',
      position: 'relative', overflow: 'hidden', ...style,
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
        background:`linear-gradient(90deg,transparent,${accent}55,transparent)` }} />
      {children}
    </div>
  );
}

function SectionLabel({ children, icon }) {
  return (
    <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700,
      color:C.teal, textTransform:'uppercase', letterSpacing:'0.15em',
      marginBottom:14, display:'flex', alignItems:'center', gap:6 }}>
      {icon}<span>{children}</span>
    </div>
  );
}

function InputBEZ({ value, onChange, max, placeholder = '0.00', disabled = false }) {
  return (
    <div style={{ position:'relative' }}>
      <input
        type="number" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        style={{
          width:'100%', padding:'12px 70px 12px 16px',
          background:C.surface2, border:`1px solid ${C.tealBrd}`,
          borderRadius:10, color:C.text, fontSize:16,
          fontFamily:'JetBrains Mono,monospace', outline:'none',
          appearance:'textfield',
        }}
      />
      <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
        fontFamily:'JetBrains Mono,monospace', fontSize:12, color:C.teal, fontWeight:700 }}>
        BEZ
      </span>
      {max && (
        <button onClick={() => onChange(max)} style={{
          position:'absolute', right:52, top:'50%', transform:'translateY(-50%)',
          background:'none', border:'none', color:C.textDim,
          fontSize:10, cursor:'pointer', fontFamily:'JetBrains Mono,monospace',
          textDecoration:'underline',
        }}>MAX</button>
      )}
    </div>
  );
}

function PrimaryBtn({ children, onClick, loading, color = C.teal, disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      width:'100%', padding:'13px', borderRadius:10,
      border:`1px solid ${color}`, background:`${color}18`,
      color, fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:14,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled || loading ? 0.5 : 1,
      transition:'all 0.2s', letterSpacing:'0.03em',
    }}>
      {loading ? '⏳ Procesando...' : children}
    </button>
  );
}

// ─── Epoch Progress Bar ────────────────────────────────────────────────────

function EpochProgress({ epoch = 0, epochDuration = 604800 }) {
  const now         = Math.floor(Date.now() / 1000);
  const epochStart  = epoch * epochDuration;
  const pct         = Math.min(100, ((now % epochDuration) / epochDuration) * 100);
  const daysLeft    = Math.floor((epochDuration - (now % epochDuration)) / 86400);
  const hoursLeft   = Math.floor(((epochDuration - (now % epochDuration)) % 86400) / 3600);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:12, color:C.textDim }}>Epoch #{epoch}</span>
        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:C.teal }}>
          {daysLeft}d {hoursLeft}h restantes
        </span>
      </div>
      <div style={{ height:6, background:C.muted, borderRadius:3, overflow:'hidden' }}>
        <div style={{
          height:'100%', borderRadius:3,
          width:`${pct}%`,
          background:`linear-gradient(90deg,${C.teal},${C.gold})`,
          transition:'width 0.5s ease',
        }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:10, color:C.textDim }}>
        <span>Inicio</span>
        <span>{pct.toFixed(1)}%</span>
        <span>Siguiente epoch</span>
      </div>
    </div>
  );
}

// ─── Validator Row ─────────────────────────────────────────────────────────

function ValidatorRow({ rank, address, stake, slashCount, active }) {
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'32px 1fr 120px 80px 64px',
      alignItems:'center', padding:'10px 0',
      borderBottom:`1px solid ${C.tealBrd}`, fontSize:12,
    }}>
      <span style={{ fontFamily:'JetBrains Mono,monospace', color:C.textDim, textAlign:'center' }}>
        {rank}
      </span>
      <span style={{ fontFamily:'JetBrains Mono,monospace', color:C.text }}>
        {address?.slice(0,10)}…{address?.slice(-6)}
      </span>
      <span style={{ fontFamily:'JetBrains Mono,monospace', color:C.teal }}>
        {fmtM(stake)} BEZ
      </span>
      <span style={{ fontFamily:'JetBrains Mono,monospace',
        color: slashCount > 0 ? C.red : C.textDim }}>
        {slashCount > 0 ? `⚔️ ${slashCount}` : '✅ 0'}
      </span>
      <span style={{
        padding:'2px 7px', borderRadius:4, fontSize:10, textAlign:'center',
        background: active ? `${C.teal}18` : `${C.red}18`,
        color: active ? C.teal : C.red,
        border:`1px solid ${active ? C.teal : C.red}33`,
        fontFamily:'JetBrains Mono,monospace',
      }}>
        {active ? 'ACTIVO' : 'OFF'}
      </span>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────

export default function StakingPage({ userAddress }) {
  const {
    snapshot, userStake, loading,
    stake, unstake, claimRewards, refresh,
  } = useTokenomics(userAddress);

  const staking  = snapshot?.staking    || {};
  const supply   = snapshot?.supply     || {};
  const vals     = snapshot?.validators || {};

  const [stakeAmt,   setStakeAmt]   = useState('');
  const [unstakeAmt, setUnstakeAmt] = useState('');
  const [tab,        setTab]        = useState('stake');   // stake | unstake | validators
  const [txLoading,  setTxLoading]  = useState(false);
  const [txMsg,      setTxMsg]      = useState(null);

  const handleStake = useCallback(async () => {
    if (!stakeAmt || parseFloat(stakeAmt) <= 0) return;
    setTxLoading(true); setTxMsg(null);
    try {
      const res = await stake(stakeAmt);
      setTxMsg({ ok: true,  text: `✅ Staking de ${stakeAmt} BEZ iniciado. TX: ${res.txHash || 'pending'}` });
      setStakeAmt('');
      setTimeout(refresh, 3000);
    } catch (e) {
      setTxMsg({ ok: false, text: `❌ Error: ${e.message}` });
    } finally { setTxLoading(false); }
  }, [stakeAmt, stake, refresh]);

  const handleUnstake = useCallback(async () => {
    if (!unstakeAmt || parseFloat(unstakeAmt) <= 0) return;
    if (userStake?.locked) { setTxMsg({ ok:false, text:'⏳ Fondos bloqueados hasta el unlock' }); return; }
    setTxLoading(true); setTxMsg(null);
    try {
      const res = await unstake(unstakeAmt);
      setTxMsg({ ok:true, text:`✅ Unstake de ${unstakeAmt} BEZ iniciado.` });
      setUnstakeAmt('');
      setTimeout(refresh, 3000);
    } catch (e) {
      setTxMsg({ ok:false, text:`❌ Error: ${e.message}` });
    } finally { setTxLoading(false); }
  }, [unstakeAmt, unstake, userStake, refresh]);

  const handleClaim = useCallback(async () => {
    setTxLoading(true); setTxMsg(null);
    try {
      await claimRewards();
      setTxMsg({ ok:true, text:`✅ Rewards de ${fmtM(userStake?.rewards)} BEZ reclamados.` });
      setTimeout(refresh, 3000);
    } catch (e) {
      setTxMsg({ ok:false, text:`❌ Error: ${e.message}` });
    } finally { setTxLoading(false); }
  }, [claimRewards, userStake, refresh]);

  // Mock validators para UI
  const mockValidators = [
    { rank:1, address:'0x52Df82920CBAE522880dD7657e43d1A754eD044E', stake:'500000', slashCount:0, active:true },
    { rank:2, address:'0x89c23890c742d710265dD61be789C71dC8999b12', stake:'350000', slashCount:0, active:true },
    { rank:3, address:'0x3EfC42095E8503d41Ad8001328FC23388E00e8a3', stake:'280000', slashCount:1, active:true },
  ];

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter,sans-serif' }}>
      <style>{`* { box-sizing:border-box; } input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }`}</style>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:32 }}>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>
            BEZ <span style={{ color:C.teal }}>Staking</span>
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:C.textDim }}>
            StakingPool.sol · ValidatorRegistry.sol · SlashingManager.sol
          </p>
        </div>

        {/* ── KPIs ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
          {[
            { label:'Total Staked',    value:`${fmtM(staking.totalStaked)} BEZ`,  color:C.teal },
            { label:'APY Actual',      value:`${staking.apy || 0}%`,              color:C.green },
            { label:'% Supply Locked', value:`${supply.stakedPercent || 0}%`,     color:C.gold },
            { label:'Validators',      value:vals.total || 0,                     color:C.teal },
          ].map(({ label, value, color }) => (
            <Card key={label} accent={color} style={{ padding:'16px 18px' }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:22, fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:10, color:C.textDim, marginTop:3, textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</div>
            </Card>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:20 }}>

          {/* ── Left: Epoch + Tabs ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Epoch progress */}
            <Card>
              <SectionLabel icon="🔄">Epoch Progress</SectionLabel>
              <EpochProgress epoch={staking.epoch || 0} epochDuration={staking.epochDuration || 604800} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:16 }}>
                {[
                  { label:'Cooldown',  value:`${staking.cooldownDays || 7} días` },
                  { label:'Min Stake', value:`${fmtM(staking.minStakeAmount || 1000)} BEZ` },
                  { label:'Duración',  value:`${(staking.epochDuration || 604800) / 86400}d / epoch` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background:C.surface2, borderRadius:8, padding:'10px 12px', border:`1px solid ${C.tealBrd}` }}>
                    <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>{label}</div>
                    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:13, fontWeight:700, color:C.text }}>{value}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Validator table */}
            <Card>
              <SectionLabel icon="🏛️">Validators Activos</SectionLabel>
              <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 120px 80px 64px',
                fontSize:10, color:C.textDim, fontFamily:'JetBrains Mono,monospace',
                textTransform:'uppercase', letterSpacing:'0.08em',
                padding:'0 0 8px', borderBottom:`1px solid ${C.tealBrd}` }}>
                <span>#</span><span>Dirección</span><span>Stake</span><span>Slashing</span><span>Estado</span>
              </div>
              {mockValidators.map(v => <ValidatorRow key={v.rank} {...v} />)}
              <div style={{ marginTop:10, fontSize:11, color:C.textDim, textAlign:'center' }}>
                {vals.total || mockValidators.length} validators · {fmtM(vals.totalSlashed)} BEZ total slashed
              </div>
            </Card>
          </div>

          {/* ── Right: Action panel ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* User position */}
            {userAddress && userStake && (
              <Card accent={C.gold}>
                <SectionLabel icon="💼">Mi Posición</SectionLabel>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                  {[
                    { label:'BEZ en staking', value:`${fmtM(userStake.staked)} BEZ`,    color:C.gold },
                    { label:'Rewards acumulados', value:`${fmtM(userStake.rewards)} BEZ`, color:C.teal },
                    { label:'Estado',         value: userStake.locked ? `🔒 Bloqueado hasta ${new Date(userStake.unlockTime*1000).toLocaleDateString('es-ES')}` : '🔓 Libre', color: userStake.locked ? C.red : C.teal },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display:'flex', justifyContent:'space-between',
                      padding:'6px 0', borderBottom:`1px solid ${C.tealBrd}`, fontSize:13 }}>
                      <span style={{ color:C.textDim }}>{label}</span>
                      <span style={{ color, fontFamily:'JetBrains Mono,monospace', fontWeight:600 }}>{value}</span>
                    </div>
                  ))}
                </div>

                {parseFloat(userStake?.rewards || 0) > 0 && (
                  <PrimaryBtn onClick={handleClaim} loading={txLoading} color={C.gold}>
                    🎁 Reclamar {fmtM(userStake.rewards)} BEZ
                  </PrimaryBtn>
                )}
              </Card>
            )}

            {/* Stake / Unstake form */}
            <Card>
              {/* Tab selector */}
              <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:`1px solid ${C.tealBrd}` }}>
                {[{ id:'stake', label:'📥 Stake' }, { id:'unstake', label:'📤 Unstake' }].map(t => (
                  <button key={t.id} onClick={() => { setTab(t.id); setTxMsg(null); }} style={{
                    padding:'9px 18px', background:'none', border:'none',
                    borderBottom: tab === t.id ? `2px solid ${C.teal}` : '2px solid transparent',
                    color: tab === t.id ? C.teal : C.textDim,
                    fontFamily:'Syne,sans-serif', fontSize:13, fontWeight:700,
                    cursor:'pointer', marginBottom:-1,
                  }}>{t.label}</button>
                ))}
              </div>

              {tab === 'stake' && (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div>
                    <div style={{ fontSize:12, color:C.textDim, marginBottom:8 }}>Cantidad a stakear</div>
                    <InputBEZ value={stakeAmt} onChange={setStakeAmt} />
                  </div>

                  <div style={{ background:C.surface2, borderRadius:8, padding:'12px 14px',
                    border:`1px solid ${C.tealBrd}`, fontSize:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', color:C.textDim, marginBottom:6 }}>
                      <span>APY estimado</span>
                      <span style={{ color:C.teal, fontWeight:700 }}>{staking.apy || 0}%</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', color:C.textDim, marginBottom:6 }}>
                      <span>Rewards/año</span>
                      <span style={{ color:C.gold }}>{fmtM((parseFloat(stakeAmt||0) * (staking.apy||0)) / 100)} BEZ</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', color:C.textDim }}>
                      <span>Cooldown</span>
                      <span>{staking.cooldownDays || 7} días para unstake</span>
                    </div>
                  </div>

                  <PrimaryBtn onClick={handleStake} loading={txLoading}
                    disabled={!stakeAmt || parseFloat(stakeAmt) <= 0}>
                    📥 Stake {stakeAmt || '0'} BEZ
                  </PrimaryBtn>
                </div>
              )}

              {tab === 'unstake' && (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {userStake?.locked && (
                    <div style={{ background:C.redDim, border:`1px solid ${C.red}33`,
                      borderRadius:8, padding:'10px 14px', fontSize:12, color:C.red }}>
                      ⏳ Fondos bloqueados hasta {new Date((userStake.unlockTime||0)*1000).toLocaleDateString('es-ES')}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize:12, color:C.textDim, marginBottom:8 }}>
                      Cantidad a retirar (max: {fmtM(userStake?.staked || 0)} BEZ)
                    </div>
                    <InputBEZ value={unstakeAmt} onChange={setUnstakeAmt}
                      max={userStake?.staked} disabled={userStake?.locked} />
                  </div>
                  <PrimaryBtn onClick={handleUnstake} loading={txLoading}
                    color={C.red}
                    disabled={!unstakeAmt || parseFloat(unstakeAmt) <= 0 || userStake?.locked}>
                    📤 Unstake {unstakeAmt || '0'} BEZ
                  </PrimaryBtn>
                </div>
              )}

              {/* TX feedback */}
              {txMsg && (
                <div style={{
                  marginTop:14, padding:'10px 14px', borderRadius:8,
                  background: txMsg.ok ? C.tealDim : C.redDim,
                  border:`1px solid ${txMsg.ok ? C.teal : C.red}33`,
                  fontSize:12, color: txMsg.ok ? C.teal : C.red,
                }}>{txMsg.text}</div>
              )}
            </Card>

            {/* Info card */}
            <Card style={{ padding:'16px 18px' }}>
              <SectionLabel icon="ℹ️">Cómo funciona</SectionLabel>
              {[
                '1. Aprueba BEZ para el contrato StakingPool',
                '2. Deposita mínimo '+(staking.minStakeAmount||'1000')+' BEZ',
                '3. Rewards acumulan cada bloque',
                '4. Cooldown de '+(staking.cooldownDays||7)+' días al unstakear',
                '5. Recoge rewards en cualquier momento',
              ].map((s, i) => (
                <div key={i} style={{ fontSize:12, color:C.textDim, padding:'4px 0',
                  borderBottom:`1px solid ${C.tealBrd}` }}>{s}</div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
