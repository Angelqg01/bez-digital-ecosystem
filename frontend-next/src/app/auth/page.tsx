"use client";

import React, { useEffect, useState } from 'react';
import { Wallet, ShieldCheck, Mail, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../../stores/userStore';
import { useWalletLogin } from '../../hooks/useWalletLogin';
import api from '../../lib/api';
import { apiError } from '../../lib/apiError';

export default function AuthPage() {
    const wallet = useWalletLogin();
    const { setUser, setToken } = useUserStore();

    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [loading, setLoading] = useState(false);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');

    useEffect(() => { if (wallet.error) toast.error(wallet.error); }, [wallet.error]);

    // === WALLET AUTH (SIWE → JWT real; el mismo token que email/contraseña) ===
    const handleWalletAuth = async () => {
        const session = await wallet.loginWithWallet();
        if (!session) return; // el error (si lo hay) se muestra vía el efecto de abajo
        toast.success('Wallet verificada correctamente');
        setUser(session.user);
        setToken(session.token);
        window.location.href = '/developer-console';
    };

    // === EMAIL + CONTRASEÑA (mismo JWT que SIWE) ===
    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        try {
            const res = authMode === 'login'
                ? await api.post('/api/auth/login-email', { email, password })
                : await api.post('/api/auth/register-email', { email, password, username: username || undefined, accountType: 'individual' });
            if (res.data?.requires2FA) {
                toast.error('Esta cuenta tiene 2FA activado. Completa la verificación desde la app.');
                return;
            }
            if (!res.data?.token || !res.data?.user) {
                toast.error('Respuesta inesperada del servidor');
                return;
            }
            setUser(res.data.user);
            setToken(res.data.token);
            toast.success(authMode === 'login' ? 'Sesión iniciada' : 'Cuenta creada');
            window.location.href = '/developer-console';
        } catch (err) {
            toast.error(apiError(err, authMode === 'login' ? 'Credenciales inválidas' : 'No se pudo crear la cuenta'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-12 bg-light-bg flex justify-center px-4">
            <div className="w-full max-w-md">
                
                {/* Header Graphic */}
                <div className="text-center mb-8">
                    <div className="mx-auto w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow mb-6">
                        <ShieldCheck size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">
                        Autenticación Web3
                    </h1>
                    <p className="text-gray-500">Accede al ecosistema unificado</p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-3xl shadow-soft-lg overflow-hidden border border-light-border">
                    <div className="flex border-b border-gray-100">
                        <button onClick={() => setAuthMode('login')} className={`flex-1 py-4 font-semibold text-sm transition-colors ${authMode === 'login' ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                            Iniciar Sesión
                        </button>
                        <button onClick={() => setAuthMode('register')} className={`flex-1 py-4 font-semibold text-sm transition-colors ${authMode === 'register' ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                            Crear Cuenta
                        </button>
                    </div>

                    <div className="p-8">
                        
                        {/* Web3 Button */}
                        <div className="mb-6">
                            <button
                                onClick={handleWalletAuth}
                                disabled={wallet.busy}
                                className="w-full relative group"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-indigo-500 rounded-xl blur-sm opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <div className="relative flex items-center justify-center gap-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-button group-hover:-translate-y-1 transition-all">
                                    <Wallet size={20} />
                                    {wallet.busy ? 'Firmando Mensaje...' : (wallet.isConnected ? 'Continuar como ' + wallet.short : 'Conectar Wallet (SIWE)')}
                                </div>
                            </button>
                            <p className="text-xs text-center text-gray-400 mt-3 flex items-center justify-center gap-1">
                                <ShieldCheck size={14} /> Inicio de sesión criptográficamente seguro
                            </p>
                        </div>

                        <div className="relative my-8 text-center text-sm">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                            <span className="relative px-4 bg-white text-gray-400 font-medium">O usa métodos clásicos</span>
                        </div>

                        {/* Email Form */}
                        <form onSubmit={handleEmailAuth} className="space-y-4">
                            {authMode === 'register' && (
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">Nombre de usuario</label>
                                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-700 outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-inner" placeholder="tu_usuario" />
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Correo Electrónico</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-gray-700 outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-inner" placeholder="tu@mail.com" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input type="password" minLength={authMode === 'register' ? 6 : undefined} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-gray-700 outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-inner" placeholder="••••••••" />
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-4 rounded-xl transition-all disabled:opacity-50 mt-6">
                                {loading ? 'Procesando...' : (authMode === 'login' ? 'Acceder con Email' : 'Registrar Email')}
                            </button>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    );
}
