import React from 'react';

// Reusable tiny origin indicator
export default function OrigenChip({ source }) {
    if (!source) return null;
    const color = source === 'API' ? '#10b981' : source === 'Contrato' ? '#6366f1' : '#f59e0b';
    return (
        <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            fontSize: 12,
            borderRadius: 999,
            background: color,
            color: '#fff',
            marginLeft: 8
        }}>
            Origen: {source}
        </span>
    );
}
