/**
 * BeZhas-Hub — AegisDashboard
 * Monitor de seguridad AEGIS en tiempo real.
 * Ruta: /dashboard/security
 */

import { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_BASE  = import.meta.env.VITE_WS_URL  || 'ws://localhost:3002';

const C = {
  bg: '#03060E', surface: '#070D1A', surface2: '#0A1225',
  teal: '#00C896', tealDim: 'rgba(0,200,150,0.10)', tealBrd: 'rgba(0,200,150,0.18)',
  gold: '#FFB800', red: '#FF4D6A', redDim: 'rgba(255,77,106,0.10)',
  orange: '#FB923C', green: '#4ADE80',
  text: '#C8D8F0', textDim: '#6B8099', muted: '#1A2535',
};

const SEV = {
  0: { label: 'LOW',      color: C.green  },
  1: { label: 'MEDIUM',   color: C.gold   },
  2: { label: 'HIGH',     color: C.orange },
  3: { label: 'CRITICAL', color: C.red    },
};

function useAegis() {
  const [alerts,    setAlerts]    = useState([]);
  const [stats,     setStats]     = useState({ total: 0, critical: 0, high: 0 });
  const [lastBlock, setLastBlock] = useState(0);
  const [wsLive,    setWsLive]    = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    // REST fetch inicial
    fetch(`${API_BASE}/api/aegis/alerts?limit=50`)
      .then(r => r.json())
      .then(d => {
        setAlerts(d.alerts || []);
        setStats(d.stats || { total: 0, critical: 0, high: 0 });
        setLastBlock(d.lastBlock || 0);
      }).catch(() => {});

    // WebSocket para real-time
    const ws = new WebSocket(`${WS_BASE}/aegis`);
    wsRef.current = ws;

    ws.onopen  = () => setWsLive(true);
    ws.onclose = () => {
      setWsLive(false);
      setTimeout(() => { /* reconnect handled by parent */ }, 3000);
    };
    ws.onmessage = (e) => {
      try {
        const { type, data } = JSON.parse(e.data);
        if (type === 'aegis:alert') {
          setAlerts(prev => [data, ...prev].slice(0, 100));
          setStats(prev => ({
            total:    prev.total + 1,
            critical: prev.critical + (data.severity >= 3 ? 1 : 0),
            high:     prev.high     + (data.severity === 2 ? 1 : 0),
          }));
          setLastBlock(data.blockNumber || lastBlock);
        }
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, []);

  return { alerts, stats, lastBlock, wsLive };
}

function ThreatRadar({ alerts }) {
  // Mini visualización de frecuencia de amenazas por tipo
  const counts = alerts.reduce((acc, a) => {
    acc[a.threatType] = (acc[a.threatType] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max    = sorted[0]?.[1] || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map(([type, count]) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            color: C.textDim, width: 160, flexShrink: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{type}</div>
          <div style={{ flex: 1, height: 4, background: C.muted, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${(count / max) * 100}%`,
              background: `linear-gradient(90deg, ${C.teal}, ${C.red})`,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.teal, width: 20, textAlign: 'right' }}>
            {count}
          </div>
        </div>
      ))}
      {sorted.length === 0 && (
        <div style={{ color: C.teal, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          ✅ Sin amenazas detectadas
        </div>
      )}
    </div>
  );
}

function AlertFeed({ alerts }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {alerts.slice(0, 30).map((alert, i) => {
        const sev   = SEV[alert.severity] || SEV[0];
        const score = alert.mlScore ? `${(alert.mlScore * 100).toFixed(0)}%` : '—';

        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '84px 1fr 52px 90px 80px',
            alignItems: 'center', padding: '11px 0',
            borderBottom: `1px solid ${C.tealBrd}`,
            fontSize: 12,
            animation: i === 0 ? 'slideIn 0.3s ease' : 'none',
          }}>
            {/* Severity */}
            <span style={{
              padding: '2px 7px', borderRadius: 4, fontSize: 10,
              background: sev.color + '20', color: sev.color,
              border: `1px solid ${sev.color}40`,
              fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em',
              display: 'inline-block',
            }}>{sev.label}</span>

            {/* Type */}
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: C.text, paddingLeft: 12 }}>
              {alert.threatType}
            </span>

            {/* ML Score */}
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', color: C.teal, textAlign: 'center',
              fontWeight: alert.mlScore >= 0.9 ? 700 : 400,
            }}>{score}</span>

            {/* Target */}
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: C.textDim,
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {alert.target ? `${alert.target.slice(0, 6)}…${alert.target.slice(-4)}` : '—'}
            </span>

            {/* Time */}
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: C.textDim, textAlign: 'right',
            }}>
              {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString('es-ES') : '—'}
            </span>
          </div>
        );
      })}

      {alerts.length === 0 && (
        <div style={{ color: C.teal, textAlign: 'center', padding: '40px 0', fontSize: 14 }}>
          ✅ Sin alertas en el período actual
        </div>
      )}
    </div>
  );
}

export default function AegisDashboard() {
  const { alerts, stats, lastBlock, wsLive } = useAegis();
  const [filter, setFilter] = useState('ALL');

  const filtered = filter === 'ALL'
    ? alerts
    : alerts.filter(a => SEV[a.severity]?.label === filter);

  const criticalAlerts = alerts.filter(a => a.severity >= 3);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes critBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              AEGIS <span style={{ color: C.teal }}>Security</span>
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textDim }}>
              BeZhas-Hub — Monitor de amenazas blockchain en tiempo real
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.textDim,
            }}>
              Último bloque: <span style={{ color: C.teal }}>{lastBlock.toLocaleString()}</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              color: wsLive ? C.teal : C.red,
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: wsLive ? C.teal : C.red,
                display: 'inline-block',
                animation: wsLive ? 'none' : 'critBlink 1s infinite',
              }} />
              {wsLive ? 'LIVE' : 'OFFLINE'}
            </div>
          </div>
        </div>

        {/* ── Critical banner ── */}
        {criticalAlerts.length > 0 && (
          <div style={{
            background: C.redDim, border: `1px solid ${C.red}44`,
            borderRadius: 10, padding: '14px 20px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12,
            animation: 'critBlink 2s infinite',
          }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: C.red, fontSize: 14 }}>
                {criticalAlerts.length} amenaza(s) CRÍTICA(S) detectada(s)
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                {criticalAlerts[0]?.threatType} — score: {criticalAlerts[0]?.mlScore ? `${(criticalAlerts[0].mlScore * 100).toFixed(0)}%` : '—'}
              </div>
            </div>
          </div>
        )}

        {/* ── Stats strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Alertas',   value: stats.total,    color: C.teal   },
            { label: 'Críticas',        value: stats.critical, color: C.red    },
            { label: 'Altas',           value: stats.high,     color: C.orange },
            { label: 'Score Promedio',  value: alerts.length
              ? `${(alerts.reduce((s, a) => s + (a.mlScore || 0), 0) / alerts.length * 100).toFixed(0)}%`
              : '—',
              color: C.teal },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: C.surface, border: `1px solid ${C.tealBrd}`,
              borderRadius: 10, padding: '14px 18px',
            }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 700, color }}>
                {value}
              </div>
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>

          {/* Alert feed */}
          <div style={{ background: C.surface, border: `1px solid ${C.tealBrd}`, borderRadius: 12, padding: '20px 24px' }}>
            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${C.tealBrd}` }}>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700,
                color: C.teal, letterSpacing: '0.15em', textTransform: 'uppercase',
                marginRight: 'auto', display: 'flex', alignItems: 'center',
              }}>🛡️ Feed de Alertas</div>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '6px 12px', background: 'none', border: 'none',
                  borderBottom: filter === f ? `2px solid ${C.teal}` : '2px solid transparent',
                  color: filter === f ? C.teal : C.textDim,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: -1,
                }}>{f}</button>
              ))}
            </div>

            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '84px 1fr 52px 90px 80px',
              fontSize: 10, color: C.textDim, fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '0 0 8px', borderBottom: `1px solid ${C.tealBrd}`,
            }}>
              <span>Severidad</span><span style={{ paddingLeft: 12 }}>Tipo</span>
              <span style={{ textAlign: 'center' }}>Score</span>
              <span>Target</span><span style={{ textAlign: 'right' }}>Hora</span>
            </div>

            <AlertFeed alerts={filtered} />
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Threat radar */}
            <div style={{ background: C.surface, border: `1px solid ${C.tealBrd}`, borderRadius: 12, padding: '20px' }}>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700,
                color: C.teal, letterSpacing: '0.15em', textTransform: 'uppercase',
                marginBottom: 14,
              }}>📡 Radar de Amenazas</div>
              <ThreatRadar alerts={alerts} />
            </div>

            {/* Quick actions */}
            <div style={{ background: C.surface, border: `1px solid ${C.tealBrd}`, borderRadius: 12, padding: '20px' }}>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700,
                color: C.teal, letterSpacing: '0.15em', textTransform: 'uppercase',
                marginBottom: 14,
              }}>⚡ Acciones</div>
              {[
                { label: 'Analizar dirección', icon: '🔍', color: C.teal },
                { label: 'Exportar reporte',   icon: '📄', color: C.textDim },
                { label: 'Configurar alertas', icon: '⚙️',  color: C.textDim },
              ].map(({ label, icon, color }) => (
                <button key={label} style={{
                  width: '100%', padding: '10px 14px', marginBottom: 8,
                  background: C.surface2, border: `1px solid ${C.tealBrd}`,
                  borderRadius: 8, color, cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'Inter, sans-serif', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'border-color 0.15s',
                }}>
                  <span>{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
