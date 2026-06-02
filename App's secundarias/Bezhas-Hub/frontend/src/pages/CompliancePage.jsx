/**
 * BeZhas-Hub — CompliancePage
 * Dashboard de Cumplimiento Legal y Regulatorio.
 * Monitoreo de AML/KYC, Smart Legal Contracts y Auditorías de Seguridad.
 */

import { useState, useEffect } from 'react';

const C = {
  bg:'#03060E', surface:'#070D1A', surface2:'#0A1225',
  teal:'#00C896', tealDim:'rgba(0,200,150,0.10)', tealBrd:'rgba(0,200,150,0.18)',
  gold:'#FFB800', goldDim:'rgba(255,184,0,0.10)',
  purple:'#8B5CF6', purpleDim:'rgba(139,92,246,0.10)',
  red:'#FF4D6A', green:'#00C896',
  text:'#C8D8F0', textDim:'#6B8099', muted:'#1A2535',
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

function StatusBadge({ status }) {
  const meta = {
    'PASS':    { color:C.green, bg:`${C.green}15` },
    'WARNING': { color:C.gold,  bg:`${C.gold}15` },
    'FAIL':    { color:C.red,   bg:`${C.red}15` },
    'PENDING': { color:C.textDim, bg:`${C.textDim}15` },
  }[status] || { color:C.textDim, bg:C.muted };

  return (
    <span style={{
      fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:4,
      background:meta.bg, color:meta.color, border:`1px solid ${meta.color}33`,
      textTransform:'uppercase'
    }}>{status}</span>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  const TABS = [
    { id:'overview',  label:'Resumen',   icon:'🛡️' },
    { id:'kycaml',    label:'AML / KYC', icon:'👤' },
    { id:'contracts', label:'Legal',     icon:'📜' },
    { id:'audits',    label:'Auditorías', icon:'🔍' },
  ];

  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:C.teal, fontFamily:'JetBrains Mono,monospace' }}>Verificando protocolos de seguridad...</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter,sans-serif' }}>
      <style>{`* { box-sizing:border-box; }`}</style>
      
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'40px 24px' }}>
        
        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:32, fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>
            Compliance & <span style={{ color:C.teal }}>Legal</span>
          </h1>
          <p style={{ color:C.textDim, margin:'4px 0 0', fontSize:14 }}>
            Monitoreo en tiempo real de normativas, contratos inteligentes y seguridad de BeZhas-Hub.
          </p>
        </div>

        {/* Tabs Navigation */}
        <div style={{ display:'flex', gap:8, marginBottom:24, borderBottom:`1px solid ${C.tealBrd}`, paddingBottom:12 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: activeTab === t.id ? C.tealDim : 'transparent',
              border: `1px solid ${activeTab === t.id ? C.teal : 'transparent'}`,
              borderRadius:8, padding:'8px 16px', color: activeTab === t.id ? C.teal : C.textDim,
              cursor:'pointer', transition:'all 0.2s', fontWeight:600, fontSize:13,
              display:'flex', alignItems:'center', gap:8
            }}>
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Sections */}
        {activeTab === 'overview' && (
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              
              {/* Compliance Score Card */}
              <Card accent={C.teal} style={{ padding:'30px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 8px', color:C.teal }}>Global Compliance Score</h3>
                    <div style={{ fontSize:48, fontWeight:800, color:C.text }}>98.4<span style={{ fontSize:20, color:C.textDim }}>/100</span></div>
                    <div style={{ fontSize:12, color:C.green, marginTop:4 }}>🟢 Óptimo • Actualizado hace 4 minutos</div>
                  </div>
                  <div style={{ width:120, height:120, borderRadius:'50%', border:`8px solid ${C.tealDim}`, borderTopColor:C.teal, display:'grid', placeItems:'center' }}>
                    <span style={{ fontSize:24, fontWeight:800 }}>98%</span>
                  </div>
                </div>
              </Card>

              {/* Activity Log */}
              <Card>
                <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 16px' }}>Registro de Actividad Reciente</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[
                    { msg: 'Auditoría de Smart Contract BEZ-Bridge completada', time: 'hace 2h', status: 'PASS' },
                    { msg: 'Nueva transacción sospechosa detectada (AML Flag)', time: 'hace 5h', status: 'WARNING' },
                    { msg: 'Actualización de términos de servicio en BeZhas-Hub', time: 'hace 1d', status: 'PASS' },
                    { msg: 'Verificación trimestral de colateral RWA', time: 'hace 2d', status: 'PASS' },
                  ].map((log, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.tealBrd}` }}>
                      <div>
                        <div style={{ fontSize:13 }}>{log.msg}</div>
                        <div style={{ fontSize:11, color:C.textDim }}>{log.time}</div>
                      </div>
                      <StatusBadge status={log.status} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <Card accent={C.purple}>
                <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 12px', color:C.purple }}>Regulatory Watch</h3>
                <div style={{ fontSize:12, color:C.textDim, lineHeight:1.6 }}>
                  Monitoreo activo de cambios en:
                  <ul style={{ paddingLeft:16, marginTop:8 }}>
                    <li>MiCA (European Union)</li>
                    <li>SEC / CFTC Guidelines</li>
                    <li>FATF Recommendations</li>
                  </ul>
                </div>
              </Card>

              <Card accent={C.gold}>
                <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 12px', color:C.gold }}>Seguridad On-chain</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ color:C.textDim }}>Honeypot Check</span>
                    <span style={{ color:C.green }}>Limpio</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ color:C.textDim }}>Proxy Ownership</span>
                    <span style={{ color:C.green }}>Timelock (48h)</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ color:C.textDim }}>Multi-sig Active</span>
                    <span style={{ color:C.green }}>3/5 Signs</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'kycaml' && (
          <div style={{ display:'grid', gap:20 }}>
            <Card>
              <h3 style={{ fontSize:16, fontWeight:700, marginBottom:20 }}>Estadísticas de Identidad (Digital Passport)</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
                {[
                  { label: 'Usuarios KYC', value: '1,240', color: C.teal },
                  { label: 'AML Flags', value: '12', color: C.red },
                  { label: 'Países Sancionados', value: '0', color: C.green },
                  { label: 'KYB (Empresas)', value: '85', color: C.purple },
                ].map((s, i) => (
                  <div key={i} style={{ padding:16, background:C.surface2, borderRadius:10, textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:11, color:C.textDim, marginTop:4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Queue de Verificación</h3>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ textAlign:'left', color:C.textDim, borderBottom:`1px solid ${C.tealBrd}` }}>
                    <th style={{ padding:10 }}>Usuario ID</th>
                    <th style={{ padding:10 }}>Tipo</th>
                    <th style={{ padding:10 }}>País</th>
                    <th style={{ padding:10 }}>Estado</th>
                    <th style={{ padding:10 }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: '0x88...1A', type: 'Individual', country: 'España', status: 'PENDING' },
                    { id: '0x32...FF', type: 'Entity (KYB)', country: 'Suiza', status: 'PENDING' },
                    { id: '0xBC...E0', type: 'Individual', country: 'México', status: 'WARNING' },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.muted}` }}>
                      <td style={{ padding:10, fontFamily:'JetBrains Mono,monospace' }}>{row.id}</td>
                      <td style={{ padding:10 }}>{row.type}</td>
                      <td style={{ padding:10 }}>{row.country}</td>
                      <td style={{ padding:10 }}><StatusBadge status={row.status} /></td>
                      <td style={{ padding:10 }}><button style={{ background:C.tealDim, color:C.teal, border:'none', borderRadius:4, padding:'4px 8px', fontSize:10, cursor:'pointer' }}>Revisar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {activeTab === 'contracts' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20 }}>
            {[
              { id:'SLC-001', title: 'Acuerdo de Liquidez v2', status:'ACTIVE', date:'2026-03-15' },
              { id:'SLC-002', title: 'Socio Estratégico RWA', status:'PENDING', date:'2026-04-10' },
              { id:'SLC-003', title: 'Términos de Staking', status:'ACTIVE', date:'2025-12-01' },
            ].map((c, i) => (
              <Card key={i}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                  <span style={{ fontSize:10, color:C.textDim, fontFamily:'JetBrains Mono,monospace' }}>{c.id}</span>
                  <StatusBadge status={c.status} />
                </div>
                <h4 style={{ fontSize:15, fontWeight:700, margin:'0 0 4px' }}>{c.title}</h4>
                <div style={{ fontSize:11, color:C.textDim, marginBottom:16 }}>Creado: {c.date}</div>
                <button style={{ width:'100%', padding:'8px', background:C.surface2, border:`1px solid ${C.tealBrd}`, borderRadius:6, color:C.text, fontSize:12, cursor:'pointer' }}>Ver Documento On-chain</button>
              </Card>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
