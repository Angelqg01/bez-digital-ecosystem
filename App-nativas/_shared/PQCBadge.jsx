/**
 * PQCBadge.jsx — Indicador visual de protección post-cuántica
 *
 * Uso en cualquier SubApp:
 *   import PQCBadge from '../_shared/PQCBadge';
 *   <PQCBadge token={session.token} />
 *
 * Variantes:
 *   <PQCBadge token={token} size="sm" />   ← chip compacto (para navbars)
 *   <PQCBadge token={token} size="md" />   ← card expandida (para dashboards)
 *   <PQCBadge token={token} showDetails />  ← muestra alg + pub snippet
 */

import { useState, useEffect } from 'react';
import { getTokenPqcStatus } from './bezhas-pqc.js';

const COLORS = {
  'quantum-safe': { bg: '#00D4AA18', border: '#00D4AA', text: '#00D4AA', dot: '#00D4AA' },
  'classical':    { bg: '#FFD70018', border: '#FFD700', text: '#FFD700', dot: '#FFD700' },
  'invalid':      { bg: '#FF6B9D18', border: '#FF6B9D', text: '#FF6B9D', dot: '#FF6B9D' },
};

const ICONS = {
  'quantum-safe': '⬡',   // hexágono = red/cripto avanzada
  'classical':    '◈',   // escudo clásico
  'invalid':      '⚠',
};

export default function PQCBadge({ token, size = 'sm', showDetails = false, className = '' }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setStatus(null); setLoading(false); return; }
    setLoading(true);
    getTokenPqcStatus(token)
      .then(s => { setStatus(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (!token || loading) return null;
  if (!status) return null;

  const c = COLORS[status.level] || COLORS['classical'];

  // ── Tamaño sm: chip una línea ─────────────────────────────────────────────
  if (size === 'sm') {
    return (
      <span
        className={className}
        title={status.label}
        style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          '5px',
          padding:      '2px 8px',
          borderRadius: '99px',
          fontSize:     '11px',
          fontFamily:   'Space Mono, monospace',
          fontWeight:   600,
          background:   c.bg,
          border:       `1px solid ${c.border}`,
          color:        c.text,
          userSelect:   'none',
        }}
      >
        <span>{ICONS[status.level]}</span>
        {status.level === 'quantum-safe' ? 'PQC' : status.level === 'invalid' ? 'PQC ERR' : 'ECDSA'}
      </span>
    );
  }

  // ── Tamaño md: card con detalle ────────────────────────────────────────────
  return (
    <div
      className={className}
      style={{
        padding:      '12px 16px',
        borderRadius: '10px',
        background:   c.bg,
        border:       `1px solid ${c.border}`,
        fontFamily:   'Space Mono, monospace',
        fontSize:     '12px',
      }}
    >
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: showDetails ? '8px' : 0 }}>
        <span style={{ fontSize: '16px' }}>{ICONS[status.level]}</span>
        <span style={{ color: c.text, fontWeight: 700, fontSize: '13px' }}>
          {status.level === 'quantum-safe'
            ? 'Protección Post-Cuántica'
            : status.level === 'invalid'
            ? 'Firma PQC Inválida'
            : 'Protección Clásica'}
        </span>
        <span
          style={{
            marginLeft:   'auto',
            width:        '8px',
            height:       '8px',
            borderRadius: '50%',
            background:   c.dot,
            boxShadow:    `0 0 6px ${c.dot}`,
          }}
        />
      </div>

      {/* Detalles opcionales */}
      {showDetails && (
        <div style={{ color: '#aaa', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span>Algoritmo: <span style={{ color: c.text }}>{status.alg}</span></span>
          {status.pubSnippet && (
            <span>Clave pública: <span style={{ color: '#888' }}>{status.pubSnippet}</span></span>
          )}
          {status.reason && (
            <span style={{ color: '#FF6B9D' }}>Error: {status.reason}</span>
          )}
          {status.exp && (
            <span>Expira: <span style={{ color: '#888' }}>{new Date(status.exp * 1000).toLocaleString()}</span></span>
          )}
          <span style={{ marginTop: '4px', color: '#555', fontSize: '10px' }}>NIST FIPS 204 (ML-DSA-65)</span>
        </div>
      )}
    </div>
  );
}
