// Previews de Label — normal y requerido, sobre fondo oscuro de la app.
import React from 'react';
import { Label } from 'bezhas-frontend';

const dark: React.CSSProperties = { background: '#080911', padding: 24, borderRadius: 12 };

export const Normal = () => (
  <div style={dark}>
    <Label htmlFor="sector">Sector de actividad</Label>
  </div>
);

export const Requerido = () => (
  <div style={dark}>
    <Label htmlFor="cif" required>CIF de la empresa</Label>
  </div>
);
