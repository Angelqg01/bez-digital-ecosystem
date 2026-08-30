'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            isMetaMask?: boolean;
        };
    }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function AdminLogin() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [loginMethod, setLoginMethod] = useState<'credentials' | 'wallet'>('credentials');
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState(0);
    const [bootstrapToken, setBootstrapToken] = useState('');
    const [mustCompleteBootstrap, setMustCompleteBootstrap] = useState(false);
    const [mustVerify2FA, setMustVerify2FA] = useState(false);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [twoFactorQrCode, setTwoFactorQrCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[]>([]);

    // Credentials State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // Client-side lockout check
    const isLockedOut = lockoutUntil > Date.now();

    const handleCredentialsLogin = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLockedOut) return;
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/admin-auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setAttempts(0);
                if (data.forcePasswordChange && data.token) {
                    setBootstrapToken(data.token);
                    setMustCompleteBootstrap(true);
                    setError('');
                } else if ((data.requires2FA || data.requiresSetup2FA) && (data.token || data.tempToken)) {
                    setBootstrapToken(data.token || data.tempToken);
                    setMustVerify2FA(true);
                    setTwoFactorQrCode(data.qrCodeUrl || '');
                    setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : []);
                    setError('');
                } else {
                    // bezhas_admin_session es sólo la pista que lee proxy.ts
                    // para no redirigir al login; la credencial real es la
                    // cookie HttpOnly bezhas_admin_token que pone la API y que
                    // este código no puede (ni debe) leer.
                    document.cookie = `bezhas_admin_session=active; path=/; max-age=${data.expiresIn}; SameSite=Lax`;
                    localStorage.setItem('bezhas_user', JSON.stringify({
                        id: data.walletAddress || 0,
                        wallet_address: data.walletAddress || '',
                        username: data.username || username,
                        role: data.role || 'SUPER_ADMIN',
                        avatar_url: null,
                    }));
                    router.push('/admin/profile');
                }
            } else if (res.status === 429) {
                setLockoutUntil(Date.now() + (data.retryAfter || 900) * 1000);
                setError('Demasiados intentos. Espere 15 minutos.');
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                if (newAttempts >= 3) {
                    setError(`Credenciales inválidas. ${5 - newAttempts} intentos restantes.`);
                } else {
                    setError(data.error || 'Credenciales de administrador inválidas.');
                }
            }
        } catch (err) {
            setError('Error de conexión con el servidor.');
        } finally {
            setLoading(false);
        }
    }, [username, password, attempts, isLockedOut, router]);

    const handleBootstrapComplete = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/admin-auth/bootstrap-complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${bootstrapToken}`,
                },
                credentials: 'include',
                body: JSON.stringify({ newPassword }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setMustCompleteBootstrap(false);
                if (data.requiresSetup2FA) {
                    setBootstrapToken(data.token);
                    setMustVerify2FA(true);
                    setTwoFactorQrCode(data.qrCodeUrl || '');
                    setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : []);
                } else {
                    router.push('/admin/profile');
                }
            } else {
                setError(data.error || 'No se pudo completar el bootstrap admin.');
            }
        } catch {
            setError('Error de conexión con el servidor.');
        } finally {
            setLoading(false);
        }
    }, [bootstrapToken, newPassword, router]);

    const handleLocal2FAVerify = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/admin-auth/local-2fa/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${bootstrapToken}`,
                },
                credentials: 'include',
                body: JSON.stringify({ code: twoFactorCode }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                // La sesión ya viaja en la cookie HttpOnly que acaba de poner
                // la API. Aquí sólo se guarda el perfil para pintarlo: el JWT
                // no entra en localStorage, donde cualquier XSS lo leería.
                // (Antes esto hacía setItem con data.token sin comprobar que
                // existiera, y como el endpoint no lo devuelve, guardaba
                // literalmente la cadena "undefined".)
                localStorage.setItem('bezhas_user', JSON.stringify({
                    id: data.walletAddress || 0,
                    wallet_address: data.walletAddress || '',
                    username: data.username || username,
                    role: data.role || 'SUPER_ADMIN',
                    avatar_url: null,
                }));
                document.cookie = `bezhas_admin_session=active; path=/; max-age=${data.expiresIn}; SameSite=Lax`;
                setMustVerify2FA(false);
                router.push('/admin/profile');
            } else {
                setError(data.error || 'Código 2FA inválido.');
            }
        } catch {
            setError('Error de conexión con el servidor.');
        } finally {
            setLoading(false);
        }
    }, [bootstrapToken, twoFactorCode, router]);

    const handleWalletLogin = useCallback(async () => {
        if (isLockedOut) return;
        setError('');
        setLoading(true);

        try {
            // 1. Check for Web3 wallet
            if (typeof window.ethereum === 'undefined') {
                setError('MetaMask u otra Web3 Wallet no detectada.');
                setLoading(false);
                return;
            }

            // 2. Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
            const walletAddress = accounts[0];

            // 3. Get nonce from server (replay protection)
            const nonceRes = await fetch(`${API_BASE}/admin-auth/nonce`, {
                credentials: 'include',
            });
            const { nonceId, nonce } = await nonceRes.json();

            // 4. Create SIWE-style message
            const message = [
                'BeZhas Blockchain — Admin Authentication',
                '',
                `Wallet: ${walletAddress}`,
                `Nonce: ${nonce}`,
                `Issued At: ${new Date().toISOString()}`,
                '',
                'Firma este mensaje para autenticar tu acceso administrativo.',
                'Esta firma no autoriza ninguna transaccion blockchain.',
            ].join('\n');

            // 5. Request signature from wallet
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, walletAddress],
            }) as string;

            // 6. Send to backend for server-side verification
            const res = await fetch(`${API_BASE}/admin-auth/wallet-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ address: walletAddress, signature, message, nonceId }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                document.cookie = `bezhas_admin_session=active; path=/; max-age=${data.expiresIn}; SameSite=Lax`;
                router.push('/admin/profile');
            } else if (res.status === 429) {
                setLockoutUntil(Date.now() + 15 * 60 * 1000);
                setError('Demasiados intentos. Espere 15 minutos.');
            } else if (res.status === 403) {
                setError('Wallet no autorizada para acceso administrativo.');
            } else {
                setError(data.error || 'Error de autenticación con wallet.');
            }
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : '';
            if (errorMsg.includes('rejected') || errorMsg.includes('denied')) {
                setError('Firma rechazada por el usuario.');
            } else {
                setError('Error al conectar la wallet.');
            }
        } finally {
            setLoading(false);
        }
    }, [isLockedOut, router]);

    const lockoutRemaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));

    return (
        <div className="min-h-screen bg-[#080911] font-['Space_Grotesk'] text-[#f5f6f8] flex items-center justify-center relative overflow-hidden">
            {/* Background Kinetic Effects */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#0d33f2] rounded-full blur-[200px] opacity-20" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#a855f7] rounded-full blur-[200px] opacity-10" />

            <div className="relative z-10 w-full max-w-sm mx-4">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 mx-auto bg-[#0d33f2] rounded-none rotate-45 flex items-center justify-center shadow-[0_0_30px_rgba(13,51,242,0.4)] mb-8">
                        <span className="text-white font-black text-2xl -rotate-45 italic">B</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tighter italic uppercase border-b-2 border-white/10 pb-4">
                        KINETIC <span className="text-[#0d33f2]">HUB</span>
                    </h1>
                    <div className="mt-3 flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">OpenClaw Hybrid Console</span>
                    </div>
                </div>

                {/* Security Badge */}
                <div className="flex items-center justify-center gap-2 mb-4 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-sm">
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                        Verificación Server-Side + Firma Criptográfica
                    </span>
                </div>

                {/* Login Method Toggle */}
                <div className="flex bg-white/5 border border-white/10 mb-6 rounded-sm p-1">
                    <button
                        onClick={() => { setLoginMethod('credentials'); setError(''); }}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${loginMethod === 'credentials' ? 'bg-[#0d33f2] text-white shadow-[0_0_15px_rgba(13,51,242,0.3)]' : 'text-gray-500 hover:text-white'}`}
                    >
                        Credentials
                    </button>
                    <button
                        onClick={() => { setLoginMethod('wallet'); setError(''); }}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${loginMethod === 'wallet' ? 'bg-[#a855f7] text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'text-gray-500 hover:text-white'}`}
                    >
                        Web3 Wallet
                    </button>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-sm flex items-start gap-2">
                        <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <span className="text-xs text-red-300 font-medium">{error}</span>
                    </div>
                )}

                {/* Lockout Warning */}
                {isLockedOut && (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-sm text-center">
                        <span className="text-xs text-amber-300 font-bold">
                            Bloqueado por seguridad. Reintente en {Math.floor(lockoutRemaining / 60)}:{String(lockoutRemaining % 60).padStart(2, '0')}
                        </span>
                    </div>
                )}

                {/* Login Form */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-sm p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-[#0d33f2] to-cyan-400" />

                    {mustVerify2FA ? (
                        <form onSubmit={handleLocal2FAVerify} className="space-y-6">
                            {twoFactorQrCode && (
                                <div className="space-y-3">
                                    <div className="mx-auto w-44 h-44 bg-white p-3">
                                        <img src={twoFactorQrCode} alt="Codigo QR 2FA" className="w-full h-full" />
                                    </div>
                                    {backupCodes.length > 0 && (
                                        <div className="grid grid-cols-2 gap-2">
                                            {backupCodes.map((code) => (
                                                <span key={code} className="bg-[#05060a] border border-white/10 px-2 py-1 text-[10px] font-mono text-gray-300">
                                                    {code}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                                    Código 2FA
                                </label>
                                <input
                                    type="text"
                                    required
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    minLength={6}
                                    maxLength={12}
                                    value={twoFactorCode}
                                    onChange={(e) => setTwoFactorCode(e.target.value)}
                                    className="w-full bg-[#05060a] border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-[#0d33f2] focus:ring-1 focus:ring-[#0d33f2] transition-colors font-mono text-sm text-center tracking-[0.4em]"
                                    placeholder="000000"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#0d33f2] text-white font-bold tracking-widest py-4 uppercase italic text-xs hover:brightness-110 active:scale-95 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'VALIDANDO 2FA...' : 'ACTIVAR ADMIN CORE'}
                            </button>
                        </form>
                    ) : mustCompleteBootstrap ? (
                        <form onSubmit={handleBootstrapComplete} className="space-y-6">
                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                                    Nueva contraseña permanente
                                </label>
                                <input
                                    type="password"
                                    required
                                    autoComplete="new-password"
                                    minLength={14}
                                    maxLength={128}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-[#05060a] border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-[#0d33f2] focus:ring-1 focus:ring-[#0d33f2] transition-colors font-mono text-sm"
                                    placeholder="Minimo 14 caracteres"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#0d33f2] text-white font-bold tracking-widest py-4 uppercase italic text-xs hover:brightness-110 active:scale-95 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'GUARDANDO...' : 'CREAR ADMIN PERMANENTE'}
                            </button>
                        </form>
                    ) : loginMethod === 'credentials' ? (
                        <form onSubmit={handleCredentialsLogin} className="space-y-6">
                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                                    Operator ID (Usuario)
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoComplete="username"
                                    maxLength={50}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-[#05060a] border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-[#0d33f2] focus:ring-1 focus:ring-[#0d33f2] transition-colors font-mono text-sm"
                                    placeholder="Ingrese su Operator ID"
                                    disabled={isLockedOut}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                                    Master Key (Contraseña)
                                </label>
                                <input
                                    type="password"
                                    required
                                    autoComplete="current-password"
                                    maxLength={128}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#05060a] border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-[#0d33f2] focus:ring-1 focus:ring-[#0d33f2] transition-colors font-mono text-sm"
                                    placeholder="••••••••"
                                    disabled={isLockedOut}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || isLockedOut}
                                className="w-full bg-[#0d33f2] text-white font-bold tracking-widest py-4 uppercase italic text-xs hover:brightness-110 active:scale-95 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'VERIFICANDO EN SERVIDOR...' : 'ENGAGE PROTOCOL'}
                            </button>

                            {/* Security info */}
                            <p className="text-[9px] text-gray-600 text-center leading-relaxed">
                                Las credenciales se verifican server-side con bcrypt.
                                5 intentos max. por cada 15 min.
                            </p>
                        </form>
                    ) : (
                        <div className="space-y-6 text-center py-4">
                            <div className="p-4 bg-[#a855f7]/10 border border-[#a855f7]/20 rounded-sm">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                                    Autenticación SIWE
                                </p>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    Conecta tu wallet autorizada y firma un mensaje criptográfico.
                                    El servidor verifica la firma y el nonce anti-replay.
                                </p>
                            </div>
                            <button
                                onClick={handleWalletLogin}
                                disabled={loading || isLockedOut}
                                className="w-full bg-[#a855f7] text-white font-bold tracking-widest py-4 uppercase italic text-xs hover:brightness-110 active:scale-95 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'VERIFICANDO FIRMA...' : 'FIRMAR & CONECTAR'}
                            </button>

                            {/* Security info */}
                            <p className="text-[9px] text-gray-600 text-center leading-relaxed">
                                La firma criptográfica se verifica en el servidor.
                                No autoriza transacciones ni expone tu clave privada.
                            </p>
                        </div>
                    )}

                    <div className="mt-6 text-center">
                        <Link href="/admin/recover" className="text-[10px] text-gray-500 hover:text-[#0d33f2] uppercase tracking-widest transition-colors font-bold underline decoration-white/20 underline-offset-4">
                            Recuperación de Contraseña (Email)
                        </Link>
                        <p className="text-[8px] text-gray-600 uppercase tracking-widest mt-4">
                            Access restricted to Level 5 BeZhas Operatives
                        </p>
                    </div>
                </div>

                {/* Security footer */}
                <div className="mt-6 flex items-center justify-center gap-4 text-[9px] text-gray-600">
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> TLS 1.3
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> JWT HttpOnly
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Rate Limited
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Audit Trail
                    </span>
                </div>
            </div>
        </div>
    );
}
