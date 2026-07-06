// Previews de Button — variantes reales del DS sobre fondo oscuro (la app es dark-first).
import React from 'react';
import { Button } from 'bezhas-frontend';

const dark: React.CSSProperties = { background: '#080911', padding: 24, display: 'flex', gap: 12, alignItems: 'center', borderRadius: 12 };

export const Variantes = () => (
  <div style={dark}>
    <Button variant="primary">Empezar ahora</Button>
    <Button variant="secondary">Ver demo</Button>
    <Button variant="outline">Hablar con ventas</Button>
  </div>
);

export const Deshabilitado = () => (
  <div style={dark}>
    <Button variant="primary" disabled>Procesando…</Button>
    <Button variant="outline" disabled>No disponible</Button>
  </div>
);
