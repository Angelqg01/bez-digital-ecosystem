/**
 * BeZhas-Hub — BridgePage
 * Cross-chain BEZ: Polygon ↔ BNB Chain ↔ L2 BeZhas-Hub.
 * Ruta: /dashboard/bridge
 * Contratos: BEZPolygonBridge.sol · BeZhasBridgeL2.sol · BeZhasL1Bridge.sol
 */

import { useState, useCallback, useEffect } from 'react';
import { useTokenomics } from '../hooks/useTokenomics';

const C = {
  bg:'#03060E', surface:'#070D1A', surface2:'#0A1225',
  teal:'#00C896', tealDim:'rgba(0,200,150,0.10)', tealBrd:'rgba(0,200,150,0.18)',
  gold:'#FFB800', goldDim:'rgba(255,184,0,0.10)',
  red:'#FF4D6A',  redDim:'rgba(255,77,106,0.10)',
  text:'#C8D8F0', textDim:'#6B8099', muted:'#1A2535',
};

const CHAIN_META = {
  137:   { name:'Polygon',    icon:'🟣', color:'#8247E5', symbol:'MATIC' },
  56:    { name:'BNB Chain',  icon:'🟡', color:'#F0B90B', symbol:'BNB'  },
  31337: { name:'L2 BeZhas', icon:'🔷', color:'#00C896', symbol:'BEZ'  },
  1:     { name:'Ethereum',   icon:'⟠',  color:'#627EEA', symbol:'ETH'  },
};

const STATUS_META = {
  pending:   { label:'Pendiente',   color:'#6B8099' },
  confirmed: { label:'Confirmado',  color:'#FFB800' },
  finalized: { label:'Finalizado',  color:'#00C896' },
  failed:    { label:'Fallido',     color:'#FF4D6A' },
};

const fmtM = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 1e6) return `${(v/1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v/1e3).toFixed(2)}K`;
  return v.toFixed(4);
};

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

function ChainPill({ chainId, selected, onClick }) {
  const meta  = CHAIN_META[chainId] || { name:`Chain ${chainId}`, icon:'⬡', color:C.teal };
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
      borderRadius:10, border:`1px solid ${selected ? meta.color+'88' : C.tealBrd}`,
      background: selected ? `${meta.color}18` : C.surface2,
      color: selected ? meta.color : C.textDim,
      cursor:'pointer', transition:'all 0.15s', fontFamily:'Syne,sans-serif',
      fontSize:13, fontWeight:700,
    }}>
      <span style={{ fontSize:18 }}>{meta.icon}</span>
      <div style={{ textAlign:'left' }}>
        <div>{meta.name}</div>
        <div style={{ fontSize:10, fontFamily:'JetBrains Mono,monospace', opacity:0.7 }}>{meta.symbol}</div>
      </div>
    </button>
  );
}

// ─── Bridge Route Selector ─────────────────────────────────────────────────

function RouteSelector({ routes, selectedRoute, onSelect }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {routes.map(route => {
        const isSelected = selectedRoute?.id === route.id;
        const fromMeta   = CHAIN_META[route.from?.chainId] || {};
        const toMeta     = CHAIN_META[route.to?.chainId]   || {};

        return (
          <div key={route.id} onClick={() => onSelect(route)}
            style={{
              padding:'14px 16px', borderRadius:10, cursor:'pointer',
              border:`1px solid ${isSelected ? C.teal+'66' : C.tealBrd}`,
              background: isSelected ? C.tealDim : C.surface2,
              transition:'all 0.15s',
            }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:16 }}>{fromMeta.icon}</span>
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, color:C.textDim }}>→</span>
                <span style={{ fontSize:16 }}>{toMeta.icon}</span>
                <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:13,
                  color: isSelected ? C.teal : C.text }}>{route.name}</span>
              </div>
              <div style={{ textAlign:'right', fontSize:11, fontFamily:'JetBrains Mono,monospace' }}>
                <div style={{ color: route.available ? C.teal : C.red }}>
                  {route.available ? '✅ Online' : '🔴 Paused'}
                </div>
                <div style={{ color:C.textDim }}>{route.fee || '0.1%'} fee · {route.avgTime}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TX History Row ────────────────────────────────────────────────────────

function TxRow({ tx }) {
  const status = STATUS_META[tx.status] || STATUS_META.pending;

  return (
    <div style={{
      display:'grid', gridTemplateColumns:'1fr 100px 80px 80px',
      alignItems:'center', padding:'10px 0',
      borderBottom:`1px solid ${C.tealBrd}`, fontSize:12,
    }}>
      <div>
        <div style={{ fontFamily:'JetBrains Mono,monospace', color:C.text }}>
          {tx.amount} BEZ
        </div>
        <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{tx.route}</div>
      </div>
      <div>
        <span style={{
          padding:'2px 7px', borderRadius:4, fontSize:10,
          background:`${status.color}18`, color:status.color,
          border:`1px solid ${status.color}33`,
          fontFamily:'JetBrains Mono,monospace',
        }}>{status.label}</span>
      </div>
      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:C.textDim }}>
        #{tx.depositId?.slice(-8) || '—'}
      </div>
      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:C.textDim, textAlign:'right' }}>
        {tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString('es-ES') : '—'}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────

export default function BridgePage({ userAddress }) {
  const { bridgeRoutes, loading, bridgeDeposit, refresh } = useTokenomics(userAddress);

  const [selectedRoute, setSelectedRoute] = useState(null);
  const [amount,        setAmount]        = useState('');
  const [recipient,     setRecipient]     = useState(userAddress || '');
  const [feeEstimate,   setFeeEstimate]   = useState(null);
  const [txHistory,     setTxHistory]     = useState([]);
  const [txLoading,     setTxLoading]     = useState(false);
  const [txMsg,         setTxMsg]         = useState(null);

  // Auto-select first available route
  useEffect(() => {
    if (bridgeRoutes.length > 0 && !selectedRoute) {
      setSelectedRoute(bridgeRoutes.find(r => r.available) || bridgeRoutes[0]);
    }
  }, [bridgeRoutes, selectedRoute]);

  // Estimar fee al cambiar monto o ruta
  useEffect(() => {
    if (!selectedRoute || !amount || parseFloat(amount) <= 0) {
      setFeeEstimate(null);
      return;
    }
    const feeAmt = parseFloat(amount) * parseFloat(selectedRoute.feePercent || 0.1) / 100;
    setFeeEstimate({
      feePercent: selectedRoute.feePercent || '0.10',
      feeAmount:  feeAmt.toFixed(6),
      netAmount:  (parseFloat(amount) - feeAmt).toFixed(6),
      time:       selectedRoute.avgTime,
    });
  }, [selectedRoute, amount]);

  const handleBridge = useCallback(async () => {
    if (!selectedRoute || !amount || !recipient) return;
    setTxLoading(true); setTxMsg(null);

    try {
      const result = await bridgeDeposit(selectedRoute.id, amount, recipient);
      setTxMsg({ ok:true, text:`✅ Bridge iniciado · ID: ${result.depositId?.slice(-12) || '—'}` });
      setTxHistory(prev => [result, ...prev]);
      setAmount('');
    } catch (e) {
      setTxMsg({ ok:false, text:`❌ Error: ${e.message}` });
    } finally { setTxLoading(false); }
  }, [selectedRoute, amount, recipient, bridgeDeposit]);

  // Stats globales de bridges
  const totalBridged  = bridgeRoutes.reduce((s, r) => s + parseFloat(r.totalBridged || 0), 0);
  const activeRoutes  = bridgeRoutes.filter(r => r.available).length;

  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:C.teal, fontFamily:'JetBrains Mono,monospace' }}>Cargando bridges...</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter,sans-serif' }}>
      <style>{`* { box-sizing:border-box; } input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}`}</style>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>
            BEZ <span style={{ color:C.teal }}>Bridge</span>
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:C.textDim }}>
            BEZPolygonBridge.sol · BeZhasBridgeL2.sol · BeZhasL1Bridge.sol en BeZhas-Hub
          </p>
        </div>

        {/* ── Stats ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
          {[
            { label:'Rutas Activas',   value:`${activeRoutes} / ${bridgeRoutes.length}`, color:C.teal },
            { label:'Total Bridgeado', value:`${fmtM(totalBridged)} BEZ`,                color:C.gold },
            { label:'Mis Transfers',   value:txHistory.length,                           color:C.text },
          ].map(({ label, value, color }) => (
            <Card key={label} accent={color} style={{ padding:'16px 18px' }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:22, fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:10, color:C.textDim, marginTop:2, textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</div>
            </Card>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:20 }}>

          {/* ── Left: Routes + History ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            <Card>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700,
                color:C.teal, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:14 }}>
                🌉 Rutas Disponibles
              </div>
              {bridgeRoutes.length === 0 ? (
                <p style={{ color:C.textDim, fontSize:13 }}>
                  No hay rutas disponibles. Verifica que los bridges estén desplegados y configurados en .env
                </p>
              ) : (
                <RouteSelector
                  routes={bridgeRoutes}
                  selectedRoute={selectedRoute}
                  onSelect={setSelectedRoute}
                />
              )}
            </Card>

            {/* Diagrama de redes */}
            <Card style={{ padding:'20px 24px' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700,
                color:C.teal, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:16 }}>
                🗺️ Mapa de Redes
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-around' }}>
                {[137, 56, 31337].map((chainId, i) => {
                  const meta = CHAIN_META[chainId];
                  return (
                    <div key={chainId} style={{ display:'flex', alignItems:'center', gap: i < 2 ? 0 : 0 }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{
                          width:56, height:56, borderRadius:'50%', margin:'0 auto 8px',
                          background:`${meta.color}18`, border:`2px solid ${meta.color}44`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:24,
                        }}>{meta.icon}</div>
                        <div style={{ fontFamily:'Syne,sans-serif', fontSize:12, fontWeight:700, color:meta.color }}>
                          {meta.name}
                        </div>
                        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:C.textDim }}>
                          Chain {chainId}
                        </div>
                      </div>
                      {i < 2 && (
                        <div style={{ display:'flex', alignItems:'center', margin:'0 12px', marginTop:-24 }}>
                          <div style={{ width:40, height:1, background:`linear-gradient(90deg,${C.teal},${C.gold})` }} />
                          <span style={{ fontSize:10, color:C.teal, margin:'0 4px' }}>↔</span>
                          <div style={{ width:40, height:1, background:`linear-gradient(90deg,${C.gold},${C.teal})` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize:11, color:C.textDim, textAlign:'center', marginTop:16, marginBottom:0 }}>
                Todos los bridges utilizan BEZ como token nativo. Los fees se distribuyen al Treasury DAO.
              </p>
            </Card>

            {/* TX History */}
            {txHistory.length > 0 && (
              <Card>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700,
                  color:C.teal, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:14 }}>
                  📋 Mis Transfers
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 80px 80px',
                  fontSize:10, color:C.textDim, fontFamily:'JetBrains Mono,monospace',
                  textTransform:'uppercase', letterSpacing:'0.08em',
                  padding:'0 0 8px', borderBottom:`1px solid ${C.tealBrd}` }}>
                  <span>Monto / Ruta</span><span>Estado</span><span>ID</span><span style={{ textAlign:'right' }}>Hora</span>
                </div>
                {txHistory.slice(0, 10).map((tx, i) => <TxRow key={i} tx={tx} />)}
              </Card>
            )}
          </div>

          {/* ── Right: Form ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            <Card>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:11, fontWeight:700,
                color:C.teal, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:18 }}>
                🚀 Iniciar Bridge
              </div>

              {/* Ruta seleccionada */}
              {selectedRoute && (
                <div style={{
                  display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
                  background:C.surface2, borderRadius:10, border:`1px solid ${C.tealBrd}`,
                  marginBottom:16,
                }}>
                  <span style={{ fontSize:18 }}>
                    {CHAIN_META[selectedRoute.from?.chainId]?.icon}
                  </span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, color:C.textDim }}>→</span>
                  <span style={{ fontSize:18 }}>
                    {CHAIN_META[selectedRoute.to?.chainId]?.icon}
                  </span>
                  <span style={{ fontFamily:'Syne,sans-serif', fontSize:12, fontWeight:700, color:C.teal, flex:1 }}>
                    {selectedRoute.name}
                  </span>
                  <span style={{ fontSize:10, fontFamily:'JetBrains Mono,monospace', color:C.textDim }}>
                    {selectedRoute.avgTime}
                  </span>
                </div>
              )}

              {/* Cantidad */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:C.textDim, marginBottom:6 }}>Cantidad BEZ</div>
                <div style={{ position:'relative' }}>
                  <input
                    type="number" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    style={{
                      width:'100%', padding:'13px 60px 13px 16px',
                      background:C.surface2, border:`1px solid ${C.tealBrd}`,
                      borderRadius:10, color:C.text, fontSize:16,
                      fontFamily:'JetBrains Mono,monospace', outline:'none',
                      appearance:'textfield',
                    }}
                  />
                  <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                    fontFamily:'JetBrains Mono,monospace', fontSize:12, color:C.teal, fontWeight:700 }}>
                    BEZ
                  </span>
                </div>

                {selectedRoute && (
                  <div style={{ display:'flex', gap:12, marginTop:6 }}>
                    {[
                      { label:'Min', value:selectedRoute.minAmount },
                      { label:'Max', value:selectedRoute.maxAmount },
                    ].map(({ label, value }) => (
                      <button key={label} onClick={() => setAmount(value)} style={{
                        padding:'3px 8px', background:'none', cursor:'pointer',
                        border:`1px solid ${C.tealBrd}`, borderRadius:5,
                        fontFamily:'JetBrains Mono,monospace', fontSize:10, color:C.textDim,
                      }}>{label}: {fmtM(value)}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Recipient */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:C.textDim, marginBottom:6 }}>
                  Dirección destino (L2 BeZhas-Hub)
                </div>
                <input
                  value={recipient} onChange={e => setRecipient(e.target.value)}
                  placeholder="0x..."
                  style={{
                    width:'100%', padding:'11px 14px',
                    background:C.surface2, border:`1px solid ${C.tealBrd}`,
                    borderRadius:10, color:C.text, fontSize:13,
                    fontFamily:'JetBrains Mono,monospace', outline:'none',
                  }}
                />
              </div>

              {/* Fee estimate */}
              {feeEstimate && (
                <div style={{
                  background:C.surface2, border:`1px solid ${C.tealBrd}`,
                  borderRadius:10, padding:'12px 14px', marginBottom:14,
                }}>
                  <div style={{ fontFamily:'Syne,sans-serif', fontSize:10, fontWeight:700,
                    color:C.textDim, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>
                    Estimación
                  </div>
                  {[
                    { label:'Fee',              value:`${feeEstimate.feePercent}% = ${feeEstimate.feeAmount} BEZ` },
                    { label:'Recibirás',        value:`${feeEstimate.netAmount} BEZ`, color:C.teal },
                    { label:'Tiempo estimado',  value:feeEstimate.time },
                  ].map(({ label, value, color: vc }) => (
                    <div key={label} style={{ display:'flex', justifyContent:'space-between',
                      fontSize:12, padding:'3px 0' }}>
                      <span style={{ color:C.textDim }}>{label}</span>
                      <span style={{ fontFamily:'JetBrains Mono,monospace',
                        color: vc || C.text, fontWeight: vc ? 700 : 400 }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleBridge}
                disabled={txLoading || !selectedRoute || !amount || !recipient || !selectedRoute?.available}
                style={{
                  width:'100%', padding:'14px', borderRadius:10,
                  border:`1px solid ${C.teal}`, background:C.tealDim,
                  color:C.teal, cursor: txLoading || !amount ? 'not-allowed' : 'pointer',
                  fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:14,
                  letterSpacing:'0.03em',
                  opacity: !amount || !selectedRoute?.available ? 0.5 : 1,
                  transition:'all 0.2s',
                }}>
                {txLoading ? '⏳ Procesando...' : `Bridge ${amount || '0'} BEZ`}
              </button>

              {/* TX result */}
              {txMsg && (
                <div style={{
                  marginTop:12, padding:'10px 14px', borderRadius:8, fontSize:12,
                  background: txMsg.ok ? C.tealDim : C.redDim,
                  border:`1px solid ${txMsg.ok ? C.teal : C.red}33`,
                  color: txMsg.ok ? C.teal : C.red,
                }}>{txMsg.text}</div>
              )}
            </Card>

            {/* Warning */}
            <div style={{ padding:'14px 16px', borderRadius:10,
              background:C.surface, border:`1px solid ${C.goldDim}`,
              fontSize:11, color:C.textDim, lineHeight:1.6 }}>
              ⚠️ <strong style={{ color:C.gold }}>Importante:</strong>{' '}
              Los bridges tienen latencia variable. Polygon ↔ L2: ~5 min.
              BNB Chain ↔ L2: ~3 min. Ethereum ↔ L2: ~15 min (finality L1).
              Verifica siempre la dirección destino antes de confirmar.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
