/**
 * BeZhas-Hub — FarmingPage
 * Liquidity Farming — 5 pools BEZ. Deposit / Withdraw / Harvest.
 * Ruta: /dashboard/farming
 * Contrato: LiquidityFarming.sol (BeZhasWorkflowRegistry → farming rewards)
 */

import { useState, useCallback } from 'react';
import { useTokenomics } from '../hooks/useTokenomics';

const C = {
  bg:'#03060E', surface:'#070D1A', surface2:'#0A1225',
  teal:'#00C896', tealDim:'rgba(0,200,150,0.10)', tealBrd:'rgba(0,200,150,0.18)',
  gold:'#FFB800', goldDim:'rgba(255,184,0,0.10)',
  red:'#FF4D6A',  redDim:'rgba(255,77,106,0.10)',
  green:'#4ADE80', orange:'#FB923C',
  text:'#C8D8F0', textDim:'#6B8099', muted:'#1A2535',
};

const fmtM = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 1e6) return `${(v/1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v/1e3).toFixed(2)}K`;
  return v.toFixed(4);
};

// Colores por pool
const POOL_COLORS = [C.teal, C.gold, C.orange, '#A78BFA', '#38BDF8'];

const POOL_DESCRIPTIONS = {
  'BEZ/USDT': 'Pool estable. Menor riesgo impermanente. Ideal para posiciones largas.',
  'BEZ/BNB':  'Pool nativo BNB Chain. Alta liquidez en mercado BNB.',
  'BEZ/ETH':  'Pool cross-chain vía Polygon. Mayor exposición al ecosistema ETH.',
  'BEZ/MATIC':'Pool nativo Polygon. Fee bajo. Rotación rápida.',
  'BEZ/USDC': 'Pool estable alternativo. Separación de riesgo USDT/USDC.',
};

// ─── UI Atoms ──────────────────────────────────────────────────────────────

function Card({ children, accent = C.teal, style = {} }) {
  return (
    <div style={{
      background:C.surface, borderRadius:12, border:`1px solid ${accent}25`,
      padding:'22px 24px', position:'relative', overflow:'hidden', ...style,
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
        background:`linear-gradient(90deg,transparent,${accent}55,transparent)` }} />
      {children}
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span style={{
      padding:'2px 8px', borderRadius:4, fontSize:10,
      background:`${color}18`, color,
      border:`1px solid ${color}33`,
      fontFamily:'JetBrains Mono,monospace', letterSpacing:'0.04em',
      textTransform:'uppercase',
    }}>{label}</span>
  );
}

// ─── Pool APY Sparkline (mock barras) ─────────────────────────────────────

function APYBar({ apy, color }) {
  const pct = Math.min(100, parseFloat(apy || 0));
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:4, background:C.muted, borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:2, width:`${pct}%`,
          background:`linear-gradient(90deg,${color},${color}aa)`,
          transition:'width 0.6s ease',
        }} />
      </div>
      <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, color, fontWeight:700, width:52, textAlign:'right' }}>
        {apy !== '—' ? `${apy}%` : '—'}
      </span>
    </div>
  );
}

// ─── Pool Card ─────────────────────────────────────────────────────────────

function PoolCard({ pool, color, userFarm, onDeposit, onWithdraw, onHarvest }) {
  const [open,       setOpen]       = useState(false);
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt,setWithdrawAmt]= useState('');
  const [loading,    setLoading]    = useState(false);
  const [txMsg,      setTxMsg]      = useState(null);

  const pendingBez  = parseFloat(userFarm?.pendingBez  || pool.pendingBez  || 0);
  const myDeposit   = parseFloat(userFarm?.deposited   || pool.userDeposit || 0);
  const hasPosition = myDeposit > 0 || pendingBez > 0;

  const handle = async (action, amount) => {
    setLoading(true); setTxMsg(null);
    try {
      await action(amount);
      setTxMsg({ ok:true, text:'✅ Transacción enviada' });
      setDepositAmt(''); setWithdrawAmt('');
    } catch (e) {
      setTxMsg({ ok:false, text:`❌ ${e.message}` });
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      background:C.surface, borderRadius:12,
      border:`1px solid ${hasPosition ? color+'44' : color+'18'}`,
      overflow:'hidden', transition:'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ padding:'18px 20px', cursor:'pointer', userSelect:'none' }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>

          {/* Pool icon */}
          <div style={{
            width:48, height:48, borderRadius:12, flexShrink:0,
            background:`linear-gradient(135deg,${color}22,${color}08)`,
            border:`1px solid ${color}33`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'JetBrains Mono,monospace', fontSize:8.5, color,
            fontWeight:700, textAlign:'center', lineHeight:1.2,
          }}>
            {pool.name?.replace('/', '\n')}
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:15, color:C.text }}>
                {pool.name}
              </span>
              <Badge label={pool.chain} color={color} />
              {hasPosition && <Badge label="MY POOL" color={C.gold} />}
            </div>
            <APYBar apy={pool.apy} color={color} />
          </div>

          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:13, color:C.textDim, marginBottom:3 }}>
              TVL {pool.tvl !== '—' ? `$${fmtM(pool.tvl)}` : '—'}
            </div>
            {pendingBez > 0 && (
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:C.gold }}>
                🌾 {fmtM(pendingBez)} BEZ
              </div>
            )}
          </div>

          <span style={{ color:C.textDim, fontSize:16, marginLeft:4 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded panel */}
      {open && (
        <div style={{ borderTop:`1px solid ${color}22`, padding:'18px 20px',
          background:C.surface2, display:'flex', flexDirection:'column', gap:16 }}>

          {/* Pool description */}
          <p style={{ fontSize:12, color:C.textDim, margin:0, lineHeight:1.6 }}>
            {POOL_DESCRIPTIONS[pool.name] || ''}
          </p>

          {/* Pool stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {[
              { label:'BEZ / bloque', value: pool.bezPerDay !== '—' ? fmtM(pool.bezPerDay) : '—' },
              { label:'Mi depósito',  value: myDeposit > 0 ? `${fmtM(myDeposit)} LP` : '—', color:C.gold },
              { label:'Pendiente',    value: pendingBez > 0 ? `${fmtM(pendingBez)} BEZ` : '—', color:C.teal },
            ].map(({ label, value, color: vc }) => (
              <div key={label} style={{ background:C.surface, borderRadius:8,
                padding:'10px 12px', border:`1px solid ${color}22` }}>
                <div style={{ fontSize:10, color:C.textDim, marginBottom:3 }}>{label}</div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:13, fontWeight:700, color: vc || C.text }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

            {/* Deposit */}
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:6 }}>Depositar LP tokens</div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  type="number" value={depositAmt}
                  onChange={e => setDepositAmt(e.target.value)}
                  placeholder="0.00" disabled={loading}
                  style={{
                    flex:1, padding:'9px 12px',
                    background:C.surface, border:`1px solid ${color}33`,
                    borderRadius:8, color:C.text, fontSize:13,
                    fontFamily:'JetBrains Mono,monospace', outline:'none',
                    appearance:'textfield',
                  }}
                />
                <button onClick={() => handle(() => onDeposit(pool.id, depositAmt), depositAmt)}
                  disabled={!depositAmt || loading}
                  style={{
                    padding:'9px 16px', borderRadius:8,
                    border:`1px solid ${color}`, background:`${color}18`,
                    color, cursor:'pointer', fontWeight:700, fontSize:12,
                    fontFamily:'Syne,sans-serif', opacity: !depositAmt ? 0.5 : 1,
                  }}>
                  +
                </button>
              </div>
            </div>

            {/* Withdraw */}
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:6 }}>
                Retirar (max: {fmtM(myDeposit)} LP)
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  type="number" value={withdrawAmt}
                  onChange={e => setWithdrawAmt(e.target.value)}
                  placeholder="0.00" disabled={loading || myDeposit <= 0}
                  style={{
                    flex:1, padding:'9px 12px',
                    background:C.surface, border:`1px solid ${C.red}33`,
                    borderRadius:8, color:C.text, fontSize:13,
                    fontFamily:'JetBrains Mono,monospace', outline:'none',
                    appearance:'textfield',
                    opacity: myDeposit <= 0 ? 0.4 : 1,
                  }}
                />
                <button
                  onClick={() => handle(() => onWithdraw(pool.id, withdrawAmt), withdrawAmt)}
                  disabled={!withdrawAmt || loading || myDeposit <= 0}
                  style={{
                    padding:'9px 14px', borderRadius:8,
                    border:`1px solid ${C.red}`, background:C.redDim,
                    color:C.red, cursor:'pointer', fontWeight:700, fontSize:12,
                    fontFamily:'Syne,sans-serif', opacity: myDeposit <= 0 ? 0.4 : 1,
                  }}>
                  −
                </button>
              </div>
            </div>
          </div>

          {/* Harvest button */}
          {pendingBez > 0.0001 && (
            <button onClick={() => handle(() => onHarvest(pool.id))}
              disabled={loading}
              style={{
                width:'100%', padding:'11px', borderRadius:9,
                border:`1px solid ${C.gold}`, background:C.goldDim,
                color:C.gold, cursor:'pointer', fontWeight:700, fontSize:13,
                fontFamily:'Syne,sans-serif', letterSpacing:'0.03em',
              }}>
              🌾 Harvest {fmtM(pendingBez)} BEZ
            </button>
          )}

          {/* TX feedback */}
          {txMsg && (
            <div style={{
              padding:'9px 14px', borderRadius:8, fontSize:12,
              background: txMsg.ok ? C.tealDim : C.redDim,
              border:`1px solid ${txMsg.ok ? C.teal : C.red}33`,
              color: txMsg.ok ? C.teal : C.red,
            }}>{txMsg.text}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────

export default function FarmingPage({ userAddress }) {
  const {
    snapshot, userFarms, loading,
    farmDeposit, farmHarvest, refresh,
  } = useTokenomics(userAddress);

  const pools = snapshot?.farming?.pools || [];

  // Harvest todos los pools con pending
  const harvestAll = useCallback(async () => {
    const pending = pools.filter(p => parseFloat(p.pendingBez || 0) > 0.0001);
    await Promise.allSettled(pending.map(p => farmHarvest(p.id)));
    setTimeout(refresh, 3000);
  }, [pools, farmHarvest, refresh]);

  const totalPending   = pools.reduce((s, p) => s + parseFloat(p.pendingBez || 0), 0);
  const totalTVL       = pools.reduce((s, p) => s + parseFloat(p.tvl !== '—' ? p.tvl : 0), 0);
  const bestAPY        = pools.reduce((best, p) => {
    const a = parseFloat(p.apy !== '—' ? p.apy : 0);
    return a > best ? a : best;
  }, 0);
  const activePools    = pools.filter(p => parseFloat(p.userDeposit || 0) > 0).length;

  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:C.teal, fontFamily:'JetBrains Mono,monospace' }}>Cargando farming pools...</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter,sans-serif' }}>
      <style>{`* { box-sizing:border-box; } input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}`}</style>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:28 }}>
          <div>
            <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>
              BEZ <span style={{ color:C.teal }}>Farming</span>
            </h1>
            <p style={{ margin:'4px 0 0', fontSize:13, color:C.textDim }}>
              LiquidityFarming.sol · 5 pares activos en BeZhas-Hub
            </p>
          </div>

          {totalPending > 0.01 && (
            <button onClick={harvestAll} style={{
              padding:'10px 20px', borderRadius:10,
              border:`1px solid ${C.gold}`, background:C.goldDim,
              color:C.gold, cursor:'pointer', fontFamily:'Syne,sans-serif',
              fontWeight:700, fontSize:13,
            }}>
              🌾 Harvest All ({fmtM(totalPending)} BEZ)
            </button>
          )}
        </div>

        {/* ── Stats ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
          {[
            { label:'TVL Total',      value:`$${fmtM(totalTVL)}`,       color:C.teal },
            { label:'Mejor APY',      value:`${bestAPY.toFixed(1)}%`,   color:C.green },
            { label:'BEZ Pendiente',  value:`${fmtM(totalPending)}`,    color:C.gold },
            { label:'Mis Pools',      value:`${activePools}/${pools.length}`, color:C.text },
          ].map(({ label, value, color }) => (
            <Card key={label} accent={color} style={{ padding:'15px 18px' }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:22, fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:10, color:C.textDim, marginTop:2, textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</div>
            </Card>
          ))}
        </div>

        {/* ── APY Comparator ── */}
        <Card style={{ marginBottom:20 }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700, color:C.teal,
            textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:14 }}>
            📊 Comparativa APY
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[...pools].sort((a, b) => parseFloat(b.apy||0) - parseFloat(a.apy||0)).map((pool, i) => {
              const color = POOL_COLORS[pools.findIndex(p => p.id === pool.id)] || C.teal;
              return (
                <div key={pool.id} style={{ display:'grid', gridTemplateColumns:'100px 1fr', gap:12, alignItems:'center' }}>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color }}>{pool.name}</span>
                  <APYBar apy={pool.apy} color={color} />
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Pools ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {pools.length === 0 ? (
            <Card>
              <p style={{ color:C.textDim, textAlign:'center', margin:0 }}>
                Sin datos de farming disponibles. ¿LiquidityFarming.sol está desplegado?
              </p>
            </Card>
          ) : (
            pools.map((pool, i) => {
              const color   = POOL_COLORS[i] || C.teal;
              const myFarm  = userFarms?.find(f => f.id === pool.id);
              return (
                <PoolCard
                  key={pool.id}
                  pool={pool}
                  color={color}
                  userFarm={myFarm}
                  onDeposit={(poolId, amount) => {
                    farmDeposit(poolId, amount);
                    setTimeout(refresh, 3000);
                  }}
                  onWithdraw={async (poolId, amount) => {
                    // withdraw vía API
                    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/tokenomics/farming/withdraw`, {
                      method:'POST', headers:{'Content-Type':'application/json'},
                      body: JSON.stringify({ poolId, amount, userAddress }),
                    });
                    setTimeout(refresh, 3000);
                  }}
                  onHarvest={(poolId) => {
                    farmHarvest(poolId);
                    setTimeout(refresh, 3000);
                  }}
                />
              );
            })
          )}
        </div>

        {/* ── Risk notice ── */}
        <div style={{ marginTop:20, padding:'14px 18px', borderRadius:10,
          background:C.surface2, border:`1px solid ${C.tealBrd}`, fontSize:12, color:C.textDim }}>
          ⚠️ <strong style={{ color:C.text }}>Riesgo de impermanencia:</strong>{' '}
          Los pools de liquidez exponen al riesgo de pérdida impermanente cuando el precio de BEZ cambia 
          respecto al par. Los pools BEZ/stablecoin (USDT, USDC) tienen menor exposición a este riesgo.
          El APY mostrado es variable y depende del volumen y la liquidez total del pool.
        </div>
      </div>
    </div>
  );
}
