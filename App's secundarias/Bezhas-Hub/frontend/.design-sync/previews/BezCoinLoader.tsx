// Preview de BezCoinLoader — loader de marca (moneda BEZ 3D) en sus tamaños.
import React from 'react';
import { BezCoinLoader } from 'bezhas-frontend';

const dark: React.CSSProperties = { background: '#080911', borderRadius: 12, padding: 8 };

export const Mediano = () => (
  <div style={dark}>
    <BezCoinLoader size="md" text="Sincronizando socios…" showProgress={false} />
  </div>
);

export const GrandeConProgreso = () => (
  <div style={dark}>
    <BezCoinLoader size="lg" text="Conectando con la red…" showProgress />
  </div>
);
