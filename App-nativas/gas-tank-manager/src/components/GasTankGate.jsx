import React from 'react';

// Explica qué falta (sesión u organización) o el error de carga, en lugar de mostrar cifras vacías.
export default function GasTankGate({ gas, children }) {
  if (gas.reason === 'login') return <div role="status" className="card">Inicia sesión para ver el Gas Tank de tu empresa.</div>;
  if (gas.reason === 'organization') {
    return <div role="status" className="card">Tu cuenta aún no pertenece a ninguna organización. Crea o únete a una desde el menú de cuenta para usar el Gas Tank.</div>;
  }
  if (gas.error) return <div role="alert" className="card">No se pudo cargar el Gas Tank: {gas.error}</div>;
  if (!gas.balance) return <div className="card">Cargando…</div>;
  return children;
}
