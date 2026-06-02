/**
 * BeZhas-Hub — GovernancePage
 * Dashboard de Gobernanza DAO para BeZhas-Hub.
 * Permite votar en propuestas, delegar poder y ver estadísticas de la DAO.
 */

import { useState, useCallback, useMemo } from 'react';
import { useGovernance } from '../hooks/useGovernance';

const C = {
  bg:'#03060E', surface:'#070D1A', surface2:'#0A1225',
  teal:'#00C896', tealDim:'rgba(0,200,150,0.10)', tealBrd:'rgba(0,200,150,0.18)',
  gold:'#FFB800', goldDim:'rgba(255,184,0,0.10)', goldBrd:'rgba(255,184,0,0.20)',
  purple:'#8B5CF6', purpleDim:'rgba(139,92,246,0.10)',
  text:'#C8D8F0', textDim:'#6B8099', muted:'#1A2535',
  red:'#FF4D6A', green:'#00C896',
};

const STATE_META = {
  0: { label:'Pendiente', color:C.textDim },
  1: { label:'Activa',    color:C.teal },
  2: { label:'Canceled',  color:C.red },
  3: { label:'Defeated',  color:C.red },
  4: { label:'Succeeded', color:C.gold },
  5: { label:'Queued',    color:C.purple },
  6: { label:'Expired',   color:C.textDim },
  7: { label:'Executed',  color:C.gold },
};

const fmtN = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 1e6) return `${(v/1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v/1e3).toFixed(2)}K`;
  return v.toLocaleString();
};

// ─── UI Atoms ──────────────────────────────────────────────────────────────

function Card({ children, accent = C.teal, style = {} }) {
  return (
    <div style={{
      background:C.surface, borderRadius:12,
      border:`1px solid ${accent}25`, padding:'20px 24px',
      position:'relative', overflow:'hidden', ...style,
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
        background:`linear-gradient(90deg,transparent,${accent}55,transparent)` }} />
      {children}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <Card accent={color} style={{ padding:'16px 20px' }}>
      <div style={{ fontSize:22, fontWeight:800, color, fontFamily:'JetBrains Mono,monospace' }}>{value}</div>
      <div style={{ fontSize:10, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.1em', marginTop:4 }}>{label}</div>
    </Card>
  );
}

// ─── Proposal Row ──────────────────────────────────────────────────────────

function ProposalRow({ proposal, onClick }) {
  const meta = STATE_META[proposal.state] || STATE_META[0];
  const totalVotes = parseFloat(proposal.forVotes) + parseFloat(proposal.againstVotes) + parseFloat(proposal.abstainVotes);
  const forPct = totalVotes > 0 ? (parseFloat(proposal.forVotes) / totalVotes * 100) : 0;
  
  return (
    <div onClick={onClick} style={{
      background:C.surface2, border:`1px solid ${C.tealBrd}`, borderRadius:10,
      padding:'16px 20px', cursor:'pointer', transition:'all 0.2s', marginBottom:12,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
            <span style={{
              fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4,
              background:`${meta.color}15`, color:meta.color, border:`1px solid ${meta.color}33`,
              textTransform:'uppercase'
            }}>{meta.label}</span>
            <span style={{ fontSize:10, color:C.textDim, fontFamily:'JetBrains Mono,monospace' }}>
              ID: #{proposal.id} · Proposer: {proposal.proposer}
            </span>
          </div>
          <h3 style={{ fontSize:16, fontWeight:700, margin:0, color:C.text }}>{proposal.title}</h3>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.teal }}>{fmtN(totalVotes)} BEZ</div>
          <div style={{ fontSize:10, color:C.textDim }}>Total Votes</div>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ flex:1, height:6, background:C.muted, borderRadius:3, overflow:'hidden', display:'flex' }}>
          <div style={{ width:`${forPct}%`, background:C.teal, height:'100%' }} />
          <div style={{ width:`${100 - forPct}%`, background:C.red, height:'100%', opacity:0.6 }} />
        </div>
        <div style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:C.textDim }}>
          <span style={{ color:C.teal }}>{forPct.toFixed(1)}%</span> / <span style={{ color:C.red }}>{(100-forPct).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────

export default function GovernancePage({ userAddress }) {
  const { proposals, stats, userPower, delegated, loading, castVote, delegate } = useGovernance(userAddress);

  const [selectedProposal, setSelectedProposal] = useState(null);
  const [voteLoading, setVoteLoading] = useState(false);
  const [delegateLoading, setDelegateLoading] = useState(false);
  const [delegateAddr, setDelegateAddr] = useState('');

  const handleVote = async (support) => {
    if (!selectedProposal) return;
    setVoteLoading(true);
    try {
      await castVote(selectedProposal.id, support);
      setSelectedProposal(null);
    } catch (e) {
      alert('Error voting: ' + e.message);
    } finally { setVoteLoading(false); }
  };

  const handleDelegate = async () => {
    if (!delegateAddr) return;
    setDelegateLoading(true);
    try {
      await delegate(delegateAddr);
      setDelegateAddr('');
    } catch (e) {
      alert('Error delegating: ' + e.message);
    } finally { setDelegateLoading(false); }
  };

  if (loading && proposals.length === 0) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:C.teal, fontFamily:'JetBrains Mono,monospace' }}>Conectando a la DAO...</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter,sans-serif' }}>
      <style>{`* { box-sizing:border-box; }`}</style>
      
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'40px 24px' }}>
        
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:32 }}>
          <div>
            <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:32, fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>
              BeZhas-Hub <span style={{ color:C.teal }}>Governance</span>
            </h1>
            <p style={{ color:C.textDim, margin:'4px 0 0', fontSize:14 }}>
              Participa en las decisiones clave del protocolo a través de la DAO.
            </p>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:12, color:C.textDim, marginBottom:4 }}>Tu Poder de Voto</div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:24, fontWeight:800, color:C.teal, fontFamily:'JetBrains Mono,monospace' }}>
                {fmtN(userPower)}
              </span>
              <span style={{ fontSize:12, color:C.textDim, fontWeight:600 }}>BEZ</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:32 }}>
          <StatCard label="Total Propuestas" value={stats.totalProposals} color={C.teal} />
          <StatCard label="Propuestas Activas" value={stats.activeProposals} color={C.gold} />
          <StatCard label="Votos Emitidos" value="1.2M+" color={C.purple} />
          <StatCard label="Quorum Actual" value="15%" color={C.text} />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:24 }}>
          
          {/* Main List */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Propuestas Recientes</h2>
              <div style={{ display:'flex', gap:8 }}>
                {['Todas', 'Activas', 'Cerradas'].map(f => (
                  <button key={f} style={{
                    background:C.surface2, border:`1px solid ${C.tealBrd}`,
                    borderRadius:6, padding:'4px 12px', fontSize:12, color:C.textDim,
                    cursor:'pointer', transition:'all 0.2s'
                  }}>{f}</button>
                ))}
              </div>
            </div>
            
            {proposals.map(p => (
              <ProposalRow key={p.id} proposal={p} onClick={() => setSelectedProposal(p)} />
            ))}
            
            {proposals.length === 0 && (
              <Card style={{ textAlign:'center', padding:'40px' }}>
                <div style={{ fontSize:40, marginBottom:16 }}>🗳️</div>
                <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>No hay propuestas pendientes</div>
                <div style={{ fontSize:13, color:C.textDim }}>La DAO está tranquila por ahora. Vuelve pronto.</div>
              </Card>
            )}
          </div>

          {/* Sidebar Tools */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            
            {/* Delegation Card */}
            <Card accent={C.purple}>
              <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 12px', color:C.purple }}>Delegación</h3>
              <p style={{ fontSize:12, color:C.textDim, lineHeight:1.5, marginBottom:16 }}>
                Si no tienes tiempo para votar, delega tu poder a un representante de confianza. Puedes revocarlo en cualquier momento.
              </p>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>Delegado Actual</div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:C.text }}>
                  {delegated === '0x0000000000000000000000000000000000000000' ? 'Self-Delegated' : delegated || 'Sin delegar'}
                </div>
              </div>
              <input 
                placeholder="Dirección 0x..." 
                value={delegateAddr} onChange={e => setDelegateAddr(e.target.value)}
                style={{
                  width:'100%', background:C.bg, border:`1px solid ${C.tealBrd}`,
                  borderRadius:8, padding:'10px 12px', color:C.text, fontSize:12,
                  fontFamily:'JetBrains Mono,monospace', marginBottom:12, outline:'none'
                }}
              />
              <button 
                onClick={handleDelegate}
                disabled={delegateLoading || !delegateAddr}
                style={{
                  width:'100%', padding:'10px', borderRadius:8,
                  background:C.purple, color:'#fff', fontWeight:700, fontSize:13,
                  cursor:'pointer', border:'none', opacity: delegateAddr ? 1 : 0.5
                }}>
                {delegateLoading ? '⏳ Procesando...' : 'Delegar Votos'}
              </button>
            </Card>

            {/* Treasury Card */}
            <Card accent={C.gold}>
              <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 12px', color:C.gold }}>DAO Treasury</h3>
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:12, color:C.textDim }}>BEZ Liquidez</span>
                  <span style={{ fontSize:12, fontWeight:700 }}>4.5M BEZ</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:12, color:C.textDim }}>USDT / USDC</span>
                  <span style={{ fontSize:12, fontWeight:700 }}>$1.2M</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, color:C.textDim }}>Staked Eth</span>
                  <span style={{ fontSize:12, fontWeight:700 }}>250 stETH</span>
                </div>
              </div>
              <button style={{
                width:'100%', padding:'10px', borderRadius:8,
                background:'transparent', border:`1px solid ${C.gold}`,
                color:C.gold, fontWeight:700, fontSize:13, cursor:'pointer'
              }}>Ver Dashboard Financiero</button>
            </Card>

            {/* Documentation */}
            <div style={{ padding:'16px', borderRadius:12, border:`1px solid ${C.tealBrd}`, fontSize:12, color:C.textDim, lineHeight:1.6 }}>
              ℹ️ <strong>Documentación:</strong> Para crear una propuesta necesitas al menos 100,000 BEZ. Las votaciones duran 7 días naturales con un delay de 2 días.
            </div>
          </div>
        </div>

        {/* Proposal Detail Overlay */}
        {selectedProposal && (
          <div style={{
            fixed:0, position:'fixed', top:0, left:0, right:0, bottom:0,
            background:'rgba(0,0,0,0.85)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:100,
            padding:20
          }} onClick={() => setSelectedProposal(null)}>
            <Card style={{ maxWidth:600, width:'100%', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
                <h2 style={{ fontSize:22, fontWeight:800, margin:0 }}>{selectedProposal.title}</h2>
                <button onClick={() => setSelectedProposal(null)} style={{ background:'none', border:'none', color:C.textDim, cursor:'pointer', fontSize:20 }}>✕</button>
              </div>
              
              <div style={{ marginBottom:20, fontSize:14, color:C.textDim, lineHeight:1.6 }}>
                {selectedProposal.description}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
                <div style={{ padding:14, background:C.surface2, borderRadius:10, border:`1px solid ${C.tealBrd}` }}>
                  <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>Votos a Favor</div>
                  <div style={{ fontSize:18, fontWeight:800, color:C.teal }}>{fmtN(selectedProposal.forVotes)} BEZ</div>
                </div>
                <div style={{ padding:14, background:C.surface2, borderRadius:10, border:`1px solid ${C.tealBrd}` }}>
                  <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>Votos en Contra</div>
                  <div style={{ fontSize:18, fontWeight:800, color:C.red }}>{fmtN(selectedProposal.againstVotes)} BEZ</div>
                </div>
              </div>

              {selectedProposal.state === 1 && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  <button onClick={() => handleVote(1)} disabled={voteLoading} style={{
                    padding:'14px', borderRadius:10, background:C.teal, color:'#000',
                    fontWeight:800, cursor:'pointer', border:'none'
                  }}>A Favor</button>
                  <button onClick={() => handleVote(0)} disabled={voteLoading} style={{
                    padding:'14px', borderRadius:10, background:C.red, color:'#fff',
                    fontWeight:800, cursor:'pointer', border:'none'
                  }}>En Contra</button>
                  <button onClick={() => handleVote(2)} disabled={voteLoading} style={{
                    padding:'14px', borderRadius:10, background:C.surface2, color:C.text,
                    fontWeight:800, cursor:'pointer', border:`1px solid ${C.tealBrd}`
                  }}>Abstenerse</button>
                </div>
              )}
              
              {voteLoading && <div style={{ textAlign:'center', marginTop:16, color:C.teal, fontSize:12 }}>Enviando voto a la blockchain...</div>}
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
