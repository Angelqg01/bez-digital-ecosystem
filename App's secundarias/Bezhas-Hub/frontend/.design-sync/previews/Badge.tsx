// Previews de Badge — barrido del eje de variantes (7 reales del DS).
import React from 'react';
import { Badge } from 'bezhas-frontend';

const dark: React.CSSProperties = { background: '#080911', padding: 24, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', borderRadius: 12 };

export const Variantes = () => (
  <div style={dark}>
    <Badge variant="default">General</Badge>
    <Badge variant="primary">Plan Business</Badge>
    <Badge variant="success">Socio verificado</Badge>
    <Badge variant="warning">Pendiente</Badge>
    <Badge variant="danger">Vencido</Badge>
    <Badge variant="info">Beta</Badge>
    <Badge variant="outline">Enterprise</Badge>
  </div>
);
