'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';

export default function HeaderAuthButton() {
    const { token, user, openLoginModal, logout } = useAuth() as any;

    if (token && user) {
        const usernameDisplay = user.username || user.email?.split('@')[0] || 'Inversor';
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    background: 'rgba(0, 240, 255, 0.08)',
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                    borderRadius: '20px',
                    color: '#00f0ff',
                    fontSize: '12px',
                    fontWeight: 700,
                    boxShadow: '0 0 10px rgba(0, 240, 255, 0.1)'
                }}>
                    <span style={{ fontSize: '14px' }}>👤</span>
                    <span>{usernameDisplay}</span>
                    <span style={{
                        fontSize: '10px',
                        background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        marginLeft: '4px',
                        fontWeight: 800,
                        textTransform: 'uppercase'
                    }}>
                        {user.role || 'Usuario'}
                    </span>
                </div>
                <button
                    onClick={logout}
                    style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '20px',
                        color: '#ef4444',
                        padding: '6px 16px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                        e.currentTarget.style.transform = 'scale(1.03)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={openLoginModal}
            style={{
                background: 'linear-gradient(135deg, #00f0ff, #a855f7)',
                border: 'none',
                borderRadius: '20px',
                color: '#000',
                padding: '8px 20px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0, 240, 255, 0.3)',
                transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.5)';
                e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 240, 255, 0.3)';
                e.currentTarget.style.transform = 'scale(1)';
            }}
        >
            🔑 Conectar / Registro
        </button>
    );
}
