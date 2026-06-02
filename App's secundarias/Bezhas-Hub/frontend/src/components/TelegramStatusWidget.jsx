/**
 * BeZhas-Hub — TelegramStatusWidget
 * Widget compacto del estado del canal Telegram.
 * Incrustable en cualquier página del dashboard.
 */

import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  bg: '#03060E', surface: '#070D1A', surface2: '#0A1225',
  teal: '#00C896', tealDim: 'rgba(0,200,150,0.10)', tealBrd: 'rgba(0,200,150,0.18)',
  gold: '#FFB800', goldDim: 'rgba(255,184,0,0.10)',
  red: '#FF4D6A', redDim: 'rgba(255,77,106,0.10)',
  text: '#C8D8F0', textDim: '#6B8099',
};

export default function TelegramStatusWidget({ compact = false }) {
  const [status, setStatus] = useState(null);
  const [hitl,   setHitl]   = useState([]);
  const [error,  setError]   = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const [s, h] = await Promise.all([
          fetch(`${API_BASE}/api/telegram/status`).then(r => r.json()),
          fetch(`${API_BASE}/api/hitl/pending`).then(r => r.json()),
        ]);
        setStatus(s);
        setHitl(h.pending || []);
        setError(false);
      } catch {
        setError(true);
      }
    };
    fetch_();
    const iv = setInterval(fetch_, 10_000);
    return () => clearInterval(iv);
  }, []);

  const online  = status?.botActive && !error;
  const dotColor = online ? C.teal : C.red;

  if (compact) {
    // Modo compacto — solo dot + label
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 6,
        background: online ? C.tealDim : C.redDim,
        border: `1px solid ${online ? C.teal : C.red}33`,
        fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
        color: online ? C.teal : C.red,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dotColor, display: 'inline-block',
          boxShadow: `0 0 6px ${dotColor}`,
        }} />
        TG {online ? 'ONLINE' : 'OFFLINE'}
        {hitl.length > 0 && (
          <span style={{
            marginLeft: 4, background: C.gold, color: C.bg,
            borderRadius: 10, padding: '0 5px', fontSize: 9, fontWeight: 700,
          }}>{hitl.length}</span>
        )}
      </div>
    );
  }

  // Modo completo
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.tealBrd}`,
      borderRadius: 12, padding: '18px 20px', minWidth: 260,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700,
          color: C.teal, letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          💬 Telegram
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
          color: dotColor,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
          {online ? 'ACTIVO' : error ? 'ERROR' : 'OFFLINE'}
        </div>
      </div>

      {/* Bot info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Bot',       value: status?.botUsername ? `@${status.botUsername}` : '—' },
          { label: 'Chats',     value: status?.chatCount ?? '—' },
          { label: 'Usuarios',  value: status?.allowedUsers?.join(', ') || 'Todos' },
          { label: 'HITL',      value: `${hitl.length} pendiente(s)` },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.textDim }}>{label}</span>
            <span style={{
              fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              color: label === 'HITL' && hitl.length > 0 ? C.gold : C.text,
            }}>{value}</span>
          </div>
        ))}
      </div>

      {/* HITL pendientes */}
      {hitl.length > 0 && (
        <div style={{
          background: C.goldDim, border: `1px solid ${C.gold}33`,
          borderRadius: 8, padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11, color: C.gold, fontWeight: 600, marginBottom: 6 }}>
            ⏳ {hitl.length} confirmación(es) pendiente(s)
          </div>
          {hitl.slice(0, 2).map(h => (
            <div key={h.taskId} style={{
              fontSize: 10, color: C.textDim, fontFamily: 'JetBrains Mono, monospace',
              padding: '3px 0', borderTop: `1px solid ${C.gold}22`,
            }}>
              #{h.taskId?.slice(-8)} — {h.context?.title?.slice(0, 28) || 'Pendiente'}
            </div>
          ))}
          {hitl.length > 2 && (
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>
              +{hitl.length - 2} más — ver en el dashboard
            </div>
          )}
        </div>
      )}
    </div>
  );
}
