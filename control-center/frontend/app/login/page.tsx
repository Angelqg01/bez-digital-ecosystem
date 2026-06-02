
'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { BrowserProvider } from 'ethers';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();

type AuthTab = 'email' | 'wallet';

function LoginFormContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnUrl = searchParams.get('returnUrl') || '/dashboard';

    // ── Shared state ─────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<AuthTab>('email');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // ── Email state ──────────────────────────────────────────────────────
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // ── Wallet state ─────────────────────────────────────────────────────
    const [address, setAddress] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        if (address && address.toLowerCase() === ADMIN_WALLET) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
    }, [address]);

    useEffect(() => {
        const eth = (window as any).ethereum;
        if (!eth) return;
        const handleChange = (accounts: string[]) => {
            if (accounts.length > 0) {
                setAddress(accounts[0]);
                setIsConnected(true);
            } else {
                setAddress(null);
                setIsConnected(false);
            }
        };
        eth.on('accountsChanged', handleChange);
        eth.request({ method: 'eth_accounts' }).then(handleChange).catch(() => {});
        return () => { eth.removeListener('accountsChanged', handleChange); };
    }, []);

    // ── Wallet handlers ──────────────────────────────────────────────────
    const connectWallet = useCallback(async () => {
        const eth = (window as any).ethereum;
        if (!eth) { setError('No se detectó una wallet (MetaMask u otra).'); return; }
        try {
            setLoading(true);
            const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
            if (accounts.length > 0) {
                setAddress(accounts[0]);
                setIsConnected(true);
            }
        } catch {
            setError('Conexión de wallet cancelada.');
        } finally {
            setLoading(false);
        }
    }, []);

    const disconnectWallet = useCallback(() => {
        setAddress(null);
        setIsConnected(false);
        setIsAdmin(false);
    }, []);

    const handleWalletLogin = async () => {
        setError('');
        if (!address) return;
        try {
            setLoading(true);
            const nonceRes = await fetch('/api/auth/nonce');
            const { nonce } = await nonceRes.json();

            const message = `BeZhas Blockchain Control Center.\n\nFirma este mensaje para autenticar tu acceso.\n\nWallet: ${address}\nNonce: ${nonce}`;

            const provider = new BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const signature = await signer.signMessage(message);

            const authRes = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, signature, address }),
            });

            if (authRes.ok) {
                const data = await authRes.json();
                const { token, user } = data;

                localStorage.setItem('bezhas_token', token);
                localStorage.setItem('bezhas_user', JSON.stringify(user));
                document.cookie = `bezhas_token=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;

                router.push(returnUrl);
            } else {
                setError('Autenticación fallida.');
                disconnectWallet();
            }
        } catch (err) {
            setError('Error en login o firma.');
            console.error("Error en login:", err);
        } finally {
            setLoading(false);
        }
    };

    // ── Email handler ────────────────────────────────────────────────────
    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Introduce tu email y contraseña.');
            return;
        }

        try {
            setLoading(true);
            const res = await fetch('/api/auth/login-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Credenciales inválidas.');
                return;
            }

            localStorage.setItem('bezhas_token', data.token);
            localStorage.setItem('bezhas_user', JSON.stringify(data.user));
            document.cookie = `bezhas_token=${data.token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;

            router.push(returnUrl);
        } catch {
            setError('Error de conexión. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden text-white">
            {/* Background effects */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600 rounded-full blur-[200px] opacity-10" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-600 rounded-full blur-[200px] opacity-10" />

            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center text-white font-black text-2xl shadow-2xl shadow-blue-500/20 mb-4 hover:scale-105 transition-transform">
                            B
                        </div>
                    </Link>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">
                        BeZhas <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Control Center</span>
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm">
                        Enterprise Blockchain Management Platform
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 shadow-2xl">
                    {/* Tab Switcher */}
                    <div className="flex bg-white/5 rounded-xl p-1 mb-6">
                        <button
                            onClick={() => { setActiveTab('email'); setError(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                activeTab === 'email'
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span className="text-base">📧</span>
                            Email
                        </button>
                        <button
                            onClick={() => { setActiveTab('wallet'); setError(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                activeTab === 'wallet'
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span className="text-base">🔗</span>
                            Wallet
                        </button>
                    </div>

                    {error && (
                        <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5">
                            <span className="w-4 h-4 text-rose-400 shrink-0 mt-0.5">⚠️</span>
                            <p className="text-sm text-rose-300">{error}</p>
                        </div>
                    )}

                    {/* ── Email Tab ── */}
                    {activeTab === 'email' && (
                        <form onSubmit={handleEmailLogin} className="space-y-4">
                            <div>
                                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                    Email
                                </label>
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@email.com"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 placeholder:text-slate-600 transition-all"
                                    autoComplete="email"
                                />
                            </div>
                            <div>
                                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                    Contraseña
                                </label>
                                <input
                                    id="login-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Tu contraseña"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 placeholder:text-slate-600 transition-all"
                                    autoComplete="current-password"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl py-4 px-6 font-bold text-sm transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Verificando...
                                    </>
                                ) : (
                                    <>
                                        <span>🔐</span>
                                        Iniciar Sesión
                                    </>
                                )}
                            </button>

                            <p className="text-center text-slate-400 text-sm mt-3">
                                ¿No tienes cuenta?{' '}
                                <Link href="/register" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">
                                    Regístrate
                                </Link>
                            </p>

                            {/* Demo hint */}
                            <div className="flex items-center gap-2.5 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl mt-2">
                                <span className="text-cyan-400 shrink-0">💡</span>
                                <p className="text-[11px] text-cyan-300/80 leading-relaxed">
                                    <strong>Demo:</strong> <span className="font-mono">demo@bez.digital</span> / <span className="font-mono">demo1234</span>
                                </p>
                            </div>
                        </form>
                    )}

                    {/* ── Wallet Tab ── */}
                    {activeTab === 'wallet' && (
                        <div>
                            <div className="text-center mb-6">
                                <p className="text-sm text-slate-400">
                                    Usa MetaMask u otra wallet Web3 para autenticarte de forma segura.
                                </p>
                            </div>

                            {!isConnected ? (
                                <button
                                    onClick={connectWallet}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl py-4 px-6 font-bold text-sm transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Conectando...
                                        </>
                                    ) : (
                                        <>
                                            <span>🔗</span>
                                            Conectar Wallet
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    {isAdmin && (
                                        <div className="p-3 bg-red-900/30 border border-red-500/40 rounded-xl text-center">
                                            <p className="text-red-400 font-bold text-xs mb-1">⚠️ ADMIN PROTOCOL ENGAGED</p>
                                            <p className="text-[10px] text-gray-300">Se requiere firma de máxima seguridad para acceder al Control Center.</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleWalletLogin}
                                        disabled={loading}
                                        className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
                                            isAdmin
                                                ? 'bg-gradient-to-r from-red-600 to-red-500 hover:shadow-lg hover:shadow-red-500/20'
                                                : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20'
                                        }`}
                                    >
                                        {loading ? 'Verificando...' : (isAdmin ? 'Firmar Acceso Administrativo' : 'Firmar para Entrar')}
                                    </button>

                                    <button
                                        onClick={disconnectWallet}
                                        className="w-full text-gray-500 hover:text-white text-sm py-2 transition-colors"
                                    >
                                        Desconectar Wallet
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Security notice */}
                    <div className="mt-6 flex items-center gap-2.5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <span className="w-4 h-4 text-emerald-400 shrink-0">🛡️</span>
                        <p className="text-[11px] text-emerald-300/80">
                            {activeTab === 'email'
                                ? 'Tu contraseña se transmite de forma segura y se almacena encriptada.'
                                : 'La firma criptográfica verifica tu identidad sin exponer tu clave privada.'
                            }
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-600 text-xs mt-6 font-medium">
                    BeZhas Blockchain &copy; {new Date().getFullYear()} &mdash; Sovereign L2 Infrastructure
                </p>
            </div>
        </div>
    );
}

export default function BeZhasLogin() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#070913]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        }>
            <LoginFormContent />
        </Suspense>
    );
}
