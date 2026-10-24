import React from 'react';

// Aviso común mientras el Gas Tank no tiene backend de saldo/consumo/ajustes
// (plan en docs/developer/GAS_TANK_PLAN_DESARROLLO.md). Sustituye a los datos de ejemplo.
export default function BetaNotice({ children }) {
  return (
    <div role="status" className="card" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
      <strong>Beta privada.</strong>{' '}
      {children || 'El Gas Tank aún no está conectado a datos reales: no se muestran saldos ni consumos.'}
    </div>
  );
}
