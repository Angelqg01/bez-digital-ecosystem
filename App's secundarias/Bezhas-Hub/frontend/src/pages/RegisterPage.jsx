import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Wallet, Mail, Lock, User, Phone, CheckCircle, AlertCircle, UserPlus } from 'lucide-react';
import SocialAuthButtons from '../components/common/SocialAuthButtons';

export default function RegisterPage() {
    const { register, registerWithWallet, sendVerificationCode, verifyCode, loading } = useAuth();
    const { address, isConnected } = useAccount();
    const { open } = useWeb3Modal();

    const [registerMethod, setRegisterMethod] = useState('email'); // 'email' or 'wallet'
    const [step, setStep] = useState(1); // 1: form, 2: verification
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Form fields
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });

    const [verificationCode, setVerificationCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(null);
    };

    const validateForm = () => {
        if (!formData.username || formData.username.length < 3) {
            setError('El nombre de usuario debe tener al menos 3 caracteres');
            return false;
        }
        if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
            setError('Por favor ingresa un email válido');
            return false;
        }
        if (!formData.phone || formData.phone.length < 10) {
            setError('Por favor ingresa un número de teléfono válido');
            return false;
        }
        if (!formData.password || formData.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return false;
        }
        return true;
    };

    const handleSendCode = async () => {
        setError(null);
        if (!formData.email) {
            setError('Por favor ingresa tu email');
            return;
        }

        try {
            await sendVerificationCode(formData.email);
            setCodeSent(true);
            setSuccess('Código enviado a tu correo');
        } catch (err) {
            setError('Error al enviar el código: ' + err.message);
        }
    };

    const handleEmailRegister = async (e) => {
        e.preventDefault();
        setError(null);

        if (!validateForm()) return;

        // Move to verification step
        setStep(2);
        await handleSendCode();
    };

    const handleVerifyAndRegister = async (e) => {
        e.preventDefault();
        setError(null);

        if (!verificationCode || verificationCode.length !== 6) {
            setError('Por favor ingresa el código de 6 dígitos');
            return;
        }

        try {
            // Verify code
            const verified = await verifyCode(formData.email, verificationCode);

            if (verified) {
                // Register user
                await register({
                    username: formData.username,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password
                });
            } else {
                setError('Código de verificación inválido');
            }
        } catch (err) {
            setError('Error en el registro: ' + err.message);
        }
    };

    const handleWalletRegister = async () => {
        setError(null);
        try {
            if (!isConnected) {
                await open();
                return;
            }

            // If we are in the wallet tab, we do a quick registration
            // If we were in email tab, we wouldn't be clicking this specific button (UI separation)

            // Quick wallet-only registration
            await registerWithWallet(address, {
                username: `User_${address.slice(0, 6)}`
            });

        } catch (err) {
            setError('Error al registrar con wallet: ' + err.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4 py-12">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl mb-4">
                        <UserPlus size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Crear Cuenta
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Únete a la comunidad de BeZhas
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
                    {/* Register Method Tabs */}
                    {step === 1 && (
                        <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                            <button
                                onClick={() => setRegisterMethod('email')}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${registerMethod === 'email'
                                    ? 'bg-white dark:bg-gray-600 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                    }`}
                            >
                                <Mail size={18} className="inline mr-2" />
                                Email
                            </button>
                            <button
                                onClick={() => setRegisterMethod('wallet')}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${registerMethod === 'wallet'
                                    ? 'bg-white dark:bg-gray-600 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                    }`}
                            >
                                <Wallet size={18} className="inline mr-2" />
                                Wallet
                            </button>
                        </div>
                    )}

                    {/* Messages */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                            <AlertCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
                            <CheckCircle size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
                        </div>
                    )}

                    {/* Step 1: Registration Form */}
                    {step === 1 && registerMethod === 'email' && (
                        <form onSubmit={handleEmailRegister} className="space-y-4">
                            {/* Username */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Nombre de Usuario *
                                </label>
                                <div className="relative">
                                    <User size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        name="username"
                                        placeholder="Tu nombre de usuario"
                                        value={formData.username}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Correo Electrónico *
                                </label>
                                <div className="relative">
                                    <Mail size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="tu@email.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Teléfono *
                                </label>
                                <div className="relative">
                                    <Phone size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="tel"
                                        name="phone"
                                        placeholder="+1234567890"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Contraseña *
                                </label>
                                <div className="relative">
                                    <Lock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="password"
                                        name="password"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Confirmar Contraseña *
                                </label>
                                <div className="relative">
                                    <Lock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        placeholder="••••••••"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Procesando...' : 'Continuar con Verificación'}
                            </button>
                        </form>
                    )}

                    {/* Step 2: Email Verification */}
                    {step === 2 && (
                        <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                            <div className="text-center py-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 dark:bg-cyan-900/30 rounded-full mb-4">
                                    <Mail size={32} className="text-cyan-600 dark:text-cyan-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Verifica tu Email
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                                    Hemos enviado un código de 6 dígitos a<br />
                                    <span className="font-semibold">{formData.email}</span>
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                                    Código de Verificación
                                </label>
                                <input
                                    type="text"
                                    placeholder="000000"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all text-center text-2xl tracking-widest font-mono"
                                    maxLength="6"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || verificationCode.length !== 6}
                                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Verificando...' : 'Verificar y Registrarse'}
                            </button>

                            <button
                                type="button"
                                onClick={handleSendCode}
                                disabled={loading}
                                className="w-full py-2 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium transition-colors"
                            >
                                Reenviar código
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setStep(1);
                                    setVerificationCode('');
                                    setCodeSent(false);
                                    setSuccess(null);
                                }}
                                className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium transition-colors"
                            >
                                ← Volver al formulario
                            </button>
                        </form>
                    )}

                    {/* Wallet Registration */}
                    {step === 1 && registerMethod === 'wallet' && (
                        <div className="space-y-4">
                            <div className="text-center py-8">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-4">
                                    <Wallet size={40} className="text-white" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Regístrate con tu Wallet
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                                    {isConnected
                                        ? `Conectado: ${address?.slice(0, 6)}...${address?.slice(-4)}`
                                        : 'Usa MetaMask, WalletConnect u otra wallet compatible'
                                    }
                                </p>
                            </div>

                            {isConnected ? (
                                <button
                                    onClick={handleWalletRegister}
                                    disabled={loading}
                                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Registrando...' : 'Registrarse con Wallet'}
                                </button>
                            ) : (
                                <button
                                    onClick={handleWalletRegister}
                                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
                                >
                                    Conectar Wallet
                                </button>
                            )}

                            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                                Al registrarte con wallet, se creará automáticamente un perfil básico que podrás completar después
                            </p>
                        </div>
                    )}

                    {/* Divider */}
                    {step === 1 && (
                        <>
                            <div className="my-6 flex items-center gap-4">
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                <span className="text-sm text-gray-500 dark:text-gray-400">o regístrate con</span>
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                            </div>

                            <SocialAuthButtons onError={(msg) => setError(msg)} />

                            <div className="my-6 flex items-center gap-4">
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                <span className="text-sm text-gray-500 dark:text-gray-400">o</span>
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                            </div>

                            {/* Login Link */}
                            <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    ¿Ya tienes cuenta?{' '}
                                    <Link
                                        to="/login"
                                        className="font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                                    >
                                        Inicia sesión aquí
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
