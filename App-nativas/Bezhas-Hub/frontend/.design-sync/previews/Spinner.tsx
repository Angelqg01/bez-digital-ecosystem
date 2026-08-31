// Previews de Spinner — los 3 tamaños del DS. El SVG usa currentColor (text-blue-500).
import React from 'react';
import { Spinner } from 'bezhas-frontend';

const dark: React.CSSProperties = { background: '#080911', padding: 24, display: 'flex', gap: 24, alignItems: 'center', borderRadius: 12 };

export const Tamanos = () => (
  <div style={dark}>
    <Spinner size="sm" />
    <Spinner size="md" />
    <Spinner size="lg" />
  </div>
);
