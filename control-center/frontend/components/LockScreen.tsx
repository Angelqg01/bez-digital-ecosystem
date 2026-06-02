'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';

interface LockScreenProps {
    title?: string;
    description?: string;
}

export default function LockScreen({ 
    title = "Acceso Restringido", 
    description = "Para probar las características operativas de la BeZhas Blockchain (firmas, contratos de custodia, transferencias de gas en tiempo real y DePIN), debes estar registrado o autenticado." 
}: LockScreenProps) {
    const { openLoginModal } = useAuth() as any;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '40px 20px',
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.45)',
            borderRadius: '24px',
            border: '1px dashed rgba(255, 255, 255, 0.08)',
            margin: '20px',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        }}>
            <div style={{
                fontSize: '64px',
                marginBottom: '20px',
            }}>
                🔒
            </div>
            <h2 style={{
                fontSize: '24px',
                fontWeight: 900,
                color: '#fff',
                marginBottom: '12px',
                fontFamily: 'var(--font-space-grotesk), system-ui'
            }}>
                {title}
            </h2>
            <p style={{
                fontSize: '14px',
                color: '#94a3b8',
                maxWidth: '480px',
                lineHeight: '1.6',
                marginBottom: '28px'
            }}>
                {description}
            </p>
            <button
                onClick={openLoginModal}
                style={{
                    background: 'linear-gradient(135deg, #00f0ff, #a855f7)',
                    border: 'none',
                    borderRadius: '24px',
                    color: '#000',
                    padding: '12px 32px',
                    fontSize: '13px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(0, 240, 255, 0.3)',
                    transition: 'all 0.3s ease',
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 25px rgba(168, 85, 247, 0.5)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 240, 255, 0.3)';
                }}
            >
                Crear Perfil Blockchain
            </button>
        </div>
    );
}
