import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Wallet, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import ConnectWalletButton from '../components/common/ConnectWalletButton';
import SocialAuthButtons from '../components/common/SocialAuthButtons';
import { useWalletConnect } from '../hooks/useWalletConnect';

export default function LoginPage() {
    const { login, loginWithWallet, verifyLogin2FA, loading, user } = useAuth();
    const { address, isConnected, connectWallet } = useWalletConnect();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loginMethod, setLoginMethod] = useState('email'); // 'email' or 'wallet'

    // 2FA states
    const [requires2FA, setRequires2FA] = useState(false);
    const [twoFactorToken, setTwoFactorToken] = useState('');
    const [tempUserId, setTempUserId] = useState(null);

    // Redirigir si ya está autenticado
    useEffect(() => {
        if (user) {
            navigate('/feed');
        }
    }, [user, navigate]);

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const result = await login(email, password);
            if (result && result.requires2FA) {
                setRequires2FA(true);
                setTempUserId(result.userId);
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || err.message || 'Credenciales inválidas. Por favor verifica tu correo y contraseña.');
        }
    };

    const handle2FASubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!twoFactorToken.trim()) {
            setError('Ingresa el código de 6 dígitos.');
            return;
        }
        try {
            await verifyLogin2FA(tempUserId, twoFactorToken);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || err.message || 'Código inválido.');
        }
    };

    const handleWalletLogin = async (connectedAddress) => {
        setError(null);
        // Usar la dirección pasada por el evento onConnect o la del hook
        const targetAddress = typeof connectedAddress === 'string' ? connectedAddress : address;

        try {
            if (!targetAddress && !isConnected) {
                await connectWallet();
                return;
            }

            if (!targetAddress) {
                throw new Error("No se detectó una dirección de wallet válida.");
            }

            await loginWithWallet(targetAddress);
        } catch (err) {
            console.error("Wallet login error:", err);
            // Mejorar mensaje de error para el usuario
            let msg = err.message;
            if (msg.includes('user rejected')) msg = 'Firma rechazada por el usuario.';
            setError(msg);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4 py-12">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl mb-4 shadow-lg shadow-cyan-500/20">
                        <LogIn size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Bienvenido de nuevo
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Accede a tu cuenta de BeZhas para continuar
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
                    {/* Login Method Tabs */}
                    <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                        <button
                            onClick={() => { setLoginMethod('email'); setError(null); }}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${loginMethod === 'email'
                                ? 'bg-white dark:bg-gray-600 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            <Mail size={18} />
                            Email
                        </button>
                        <button
                            onClick={() => { setLoginMethod('wallet'); setError(null); }}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${loginMethod === 'wallet'
                                ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            <Wallet size={18} />
                            Wallet
                        </button>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 animate-fade-in">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* 2FA Form */}
                    {requires2FA && (
                        <form onSubmit={handle2FASubmit} className="space-y-4 animate-fade-in">
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Autenticación de Dos Pasos
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Ingresa el código de 6 dígitos de tu aplicación autenticadora (ej. Google Authenticator) o un código de respaldo.
                                </p>
                            </div>
                            <div>
                                <input
                                    type="text"
                                    placeholder="000000"
                                    value={twoFactorToken}
                                    onChange={e => setTwoFactorToken(e.target.value)}
                                    maxLength={8}
                                    className="w-full text-center text-2xl tracking-widest pl-4 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all dark:text-white"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Verificando...
                                    </span>
                                ) : (
                                    'Verificar Código'
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setRequires2FA(false); setTempUserId(null); setTwoFactorToken(''); setError(null); }}
                                className="w-full py-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium transition-colors"
                            >
                                Volver al login
                            </button>
                        </form>
                    )}

                    {/* Email Login Form */}
                    {!requires2FA && loginMethod === 'email' && (
                        <form onSubmit={handleEmailLogin} className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Correo Electrónico
                                </label>
                                <div className="relative">
                                    <Mail size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="email"
                                        placeholder="tu@email.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all dark:text-white"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <Lock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all dark:text-white"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end mt-1">
                                    <Link to="/forgot-password" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">
                                        ¿Olvidaste tu contraseña?
                                    </Link>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Iniciando...
                                    </span>
                                ) : (
                                    'Iniciar Sesión'
                                )}
                            </button>
                        </form>
                    )}

                    {/* Wallet Login */}
                    {!requires2FA && loginMethod === 'wallet' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="text-center py-6">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-4 shadow-lg shadow-purple-500/20">
                                    <Wallet size={40} className="text-white" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Web3 Login
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {isConnected
                                        ? `Wallet conectada: ${address?.slice(0, 6)}...${address?.slice(-4)}`
                                        : 'Conecta tu wallet para firmar el inicio de sesión de forma segura.'
                                    }
                                </p>
                            </div>

                            {isConnected ? (
                                <button
                                    onClick={() => handleWalletLogin(address)}
                                    disabled={loading}
                                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Firmando...
                                        </>
                                    ) : (
                                        <>
                                            <LogIn size={20} />
                                            Firmar e Iniciar Sesión
                                        </>
                                    )}
                                </button>
                            ) : (
                                <ConnectWalletButton
                                    variant="primary"
                                    size="lg"
                                    className="w-full justify-center py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 border-none shadow-lg"
                                    onConnect={handleWalletLogin}
                                >
                                    <Wallet size={20} className="mr-2" />
                                    <span>Conectar Wallet</span>
                                </ConnectWalletButton>
                            )}

                            <p className="text-xs text-center text-gray-500 dark:text-gray-500 mt-4">
                                Al conectar tu wallet, se te pedirá firmar un mensaje para verificar que eres el propietario. Esto no tiene costo de gas.
                            </p>
                        </div>
                    )}

                    {/* Divider */}
                    {!requires2FA && (
                        <>
                            <div className="my-8 flex items-center gap-4">
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">o continúa con</span>
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                            </div>

                            <SocialAuthButtons onError={(msg) => setError(msg)} />

                            {/* Register Link */}
                            <div className="text-center mt-6">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    ¿Aún no tienes cuenta?{' '}
                                    <Link
                                        to="/register"
                                        className="font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors hover:underline"
                                    >
                                        Regístrate gratis
                                    </Link>
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
