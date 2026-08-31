// Previews de Input — campo oscuro del DS, compuesto con Label como en la app real.
import React from 'react';
import { Input, Label } from 'bezhas-frontend';

const dark: React.CSSProperties = { background: '#080911', padding: 24, borderRadius: 12, maxWidth: 380 };

export const ConLabel = () => (
  <div style={dark}>
    <Label htmlFor="empresa" required>Nombre de tu empresa</Label>
    <Input id="empresa" placeholder="Acme Logistics S.L." />
  </div>
);

export const Estados = () => (
  <div style={{ ...dark, display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Input type="email" placeholder="contacto@tuempresa.com" />
    <Input value="ES-B12345678" onChange={() => {}} />
    <Input placeholder="No editable" disabled />
  </div>
);
