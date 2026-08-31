import React, { useState } from 'react';
import { Mail, Lock, User, Wallet, Eye, EyeOff, Chrome } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useConnect } from 'wagmi';
import { useAuth } from '../context/AuthContext';

import SocialAuthButtons from '../components/common/SocialAuthButtons';

const AuthPage = ({ mode = 'login' }) => {
    const navigate = useNavigate();
    const { connectors, connectAsync } = useConnect();
    const { login } = useAuth();

    const [authMode, setAuthMode] = useState(mode); // 'login' | 'register'
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        username: '',
        referralCode: ''
    });

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const endpoint = authMode === 'login' ? '/api/auth/login-email' : '/api/auth/register-email';
            const response = await axios.post(endpoint, formData);

            toast.success(response.data.message);
            login(response.data.user, response.data.token);
            navigate('/');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Error en autenticación');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        try {
            // En producción: usar Google OAuth2
            // window.location.href = `/api/auth/google`;

            // Mock para desarrollo
            toast.info('Google Auth en desarrollo. Usa email o wallet por ahora.');
        } catch (error) {
            toast.error('Error en autenticación con Google');
        }
    };

    const handleFacebookAuth = async () => {
        try {
            // En producción: usar Facebook SDK
            toast.info('Facebook Auth en desarrollo. Usa email o wallet por ahora.');
        } catch (error) {
            toast.error('Error en autenticación con Facebook');
        }
    };

    const handleWalletAuth = async () => {
        try {
            setLoading(true);
            const connector = connectors[0]; // MetaMask por defecto
            const { account } = await connectAsync({ connector });

            // Aquí integrar con el backend /api/auth/login-or-register
            const response = await axios.post('/api/auth/login-or-register', {
                walletAddress: account,
                referralCode: formData.referralCode || undefined
            });

            toast.success(response.data.message);
            login(response.data.user, response.data.token);
            navigate('/');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Error conectando wallet');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Card Principal */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-8 text-center">
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {authMode === 'login' ? '¡Bienvenido de vuelta!' : '¡Únete a BeZhas!'}
                        </h1>
                        <p className="text-purple-100">
                            {authMode === 'login'
                                ? 'Inicia sesión para continuar'
                                : 'Crea tu cuenta en segundos'}
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setAuthMode('login')}
                            className={`flex-1 py-4 font-semibold transition-colors ${authMode === 'login'
                                ? 'text-purple-600 border-b-2 border-purple-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Iniciar Sesión
                        </button>
                        <button
                            onClick={() => setAuthMode('register')}
                            className={`flex-1 py-4 font-semibold transition-colors ${authMode === 'register'
                                ? 'text-purple-600 border-b-2 border-purple-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Registrarse
                        </button>
                    </div>

                    <div className="p-8 space-y-6">
                        {/* Social Login Buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={handleWalletAuth}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                            >
                                <Wallet className="w-5 h-5" />
                                {authMode === 'login' ? 'Conectar Wallet' : 'Registrar con Wallet'}
                            </button>

                            <SocialAuthButtons onError={(msg) => toast.error(msg)} />
                        </div>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                                    o con email
                                </span>
                            </div>
                        </div>

                        {/* Email/Password Form */}
                        <form onSubmit={handleEmailAuth} className="space-y-4">
                            {authMode === 'register' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Nombre de usuario
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                                            placeholder="Tu nombre"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                                        placeholder="tu@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {authMode === 'register' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Código de referido (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.referralCode}
                                        onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                                        placeholder="ABC123"
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Procesando...' : (authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta')}
                            </button>
                        </form>

                        {/* Footer Link */}
                        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                            {authMode === 'login' ? (
                                <>
                                    ¿No tienes cuenta?{' '}
                                    <button
                                        onClick={() => setAuthMode('register')}
                                        className="text-purple-600 hover:text-purple-700 font-semibold"
                                    >
                                        Regístrate aquí
                                    </button>
                                </>
                            ) : (
                                <>
                                    ¿Ya tienes cuenta?{' '}
                                    <button
                                        onClick={() => setAuthMode('login')}
                                        className="text-purple-600 hover:text-purple-700 font-semibold"
                                    >
                                        Inicia sesión
                                    </button>
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* Info Card */}
                <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center">
                    <p className="text-sm text-white/80">
                        🔒 Tus datos están protegidos con encriptación de grado bancario
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
