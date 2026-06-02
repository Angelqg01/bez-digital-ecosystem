'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

interface LoginRegisterModalProps {
    onClose: () => void;
}

export default function LoginRegisterModal({ onClose }: LoginRegisterModalProps) {
    const { loginWithEmailDemo, registerDemo } = useAuth() as any;
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('Inversor Especial');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username && !isLogin) {
            setError('Por favor introduce un nombre de usuario.');
            return;
        }

        if (isLogin && !email) {
            setError('Por favor introduce tu email o usuario.');
            return;
        }

        if (!password) {
            setError('Por favor introduce una contraseña.');
            return;
        }

        try {
            if (isLogin) {
                // Try logging in using the demo method
                await loginWithEmailDemo(email, password);
            } else {
                if (password !== confirmPassword) {
                    setError('Las contraseñas no coinciden.');
                    return;
                }
                const virtualEmail = email || `${username.toLowerCase().replace(/\s+/g, '')}@bezhas.net`;
                await registerDemo(username, virtualEmail, role, password);
            }
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error en la autenticación.');
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(4, 7, 15, 0.85)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            fontFamily: 'var(--font-space-grotesk), system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                background: '#090d16',
                border: '1px solid rgba(0, 240, 255, 0.15)',
                borderRadius: '24px',
                padding: '28px',
                boxShadow: '0 10px 40px rgba(0, 240, 255, 0.1)',
                position: 'relative',
            }}>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        background: 'none',
                        border: 'none',
                        color: '#475569',
                        fontSize: '18px',
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                >
                    ✕
                </button>

                {/* Brand/Icon */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #00f0ff, #a855f7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px',
                        fontSize: '24px',
                        boxShadow: '0 0 20px rgba(0, 240, 255, 0.2)'
                    }}>
                        🔑
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#fff', margin: 0 }}>BeZhas Blockchain L2</h3>
                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Demo & Investor Authentication Panel</p>
                </div>

                {/* Toggle Slide */}
                <div style={{
                    display: 'flex',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '30px',
                    padding: '4px',
                    marginBottom: '24px'
                }}>
                    <button
                        onClick={() => { setIsLogin(true); setError(''); }}
                        type="button"
                        style={{
                            flex: 1,
                            background: isLogin ? 'linear-gradient(135deg, #00f0ff, #6366f1)' : 'transparent',
                            color: isLogin ? '#000' : '#94a3b8',
                            border: 'none',
                            borderRadius: '25px',
                            padding: '8px',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Iniciar Sesión
                    </button>
                    <button
                        onClick={() => { setIsLogin(false); setError(''); }}
                        type="button"
                        style={{
                            flex: 1,
                            background: !isLogin ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'transparent',
                            color: !isLogin ? '#fff' : '#94a3b8',
                            border: 'none',
                            borderRadius: '25px',
                            padding: '8px',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Registrarse
                    </button>
                </div>

                {/* Error Alert */}
                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        marginBottom: '16px',
                        fontWeight: 600
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
                    {isLogin ? (
                        <div>
                            <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>
                                Usuario o Email
                            </label>
                            <input
                                type="text"
                                placeholder="demo@bez.digital"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '12px',
                                    padding: '10px 14px',
                                    color: '#fff',
                                    fontSize: '13px',
                                    outline: 'none',
                                    transition: 'border 0.2s',
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#00f0ff')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                            />
                        </div>
                    ) : (
                        <>
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>
                                    Nombre de Usuario
                                </label>
                                <input
                                    type="text"
                                    placeholder="InversorEspecial"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '12px',
                                        padding: '10px 14px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        outline: 'none',
                                        transition: 'border 0.2s',
                                    }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#a855f7')}
                                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>
                                    Email (Opcional)
                                </label>
                                <input
                                    type="email"
                                    placeholder="inversor@bezhas.net"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '12px',
                                        padding: '10px 14px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        outline: 'none',
                                        transition: 'border 0.2s',
                                    }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#a855f7')}
                                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>
                                    Perfil / Rol de Red
                                </label>
                                <select
                                    value={role}
                                    onChange={e => setRole(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: '#090d16',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '12px',
                                        padding: '10px 14px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        transition: 'border 0.2s',
                                    }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#a855f7')}
                                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                                >
                                    <option value="Inversor Demo">Inversor Demo</option>
                                    <option value="Validador L2">Validador L2</option>
                                    <option value="Operador de Nodo">Operador de Nodo</option>
                                    <option value="Gestor de Logística">Gestor de Logística</option>
                                    <option value="Auditor Externo">Auditor Externo</option>
                                </select>
                            </div>
                        </>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>
                            Contraseña
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '12px',
                                padding: '10px 14px',
                                color: '#fff',
                                fontSize: '13px',
                                outline: 'none',
                                transition: 'border 0.2s',
                            }}
                            onFocus={e => (e.currentTarget.style.borderColor = isLogin ? '#00f0ff' : '#a855f7')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                        />
                    </div>

                    {!isLogin && (
                        <div>
                            <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.5px' }}>
                                Confirmar Contraseña
                            </label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '12px',
                                    padding: '10px 14px',
                                    color: '#fff',
                                    fontSize: '13px',
                                    outline: 'none',
                                    transition: 'border 0.2s',
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#a855f7')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        style={{
                            width: '100%',
                            background: isLogin ? 'linear-gradient(135deg, #00f0ff, #6366f1)' : 'linear-gradient(135deg, #a855f7, #6366f1)',
                            border: 'none',
                            borderRadius: '12px',
                            color: isLogin ? '#000' : '#fff',
                            padding: '12px',
                            fontSize: '13px',
                            fontWeight: 900,
                            cursor: 'pointer',
                            marginTop: '10px',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            boxShadow: isLogin ? '0 4px 15px rgba(0, 240, 255, 0.2)' : '0 4px 15px rgba(168, 85, 247, 0.2)'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        {isLogin ? 'Acceder al Ecosistema' : 'Registrar e Iniciar Sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
}
