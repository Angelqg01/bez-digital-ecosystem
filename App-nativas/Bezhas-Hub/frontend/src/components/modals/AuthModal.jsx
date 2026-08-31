import React from 'react';
import { Link } from 'react-router-dom';
import { Wallet, UserPlus, LogIn, X, Sparkles, Shield, Gift, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAccount } from 'wagmi';

const AuthModal = ({ isOpen, onClose, onConnectWallet }) => {
    const { user, logout } = useAuth();
    const { isConnected } = useAccount();

    if (!isOpen) return null;

    // Si el usuario está logueado, mostramos opciones diferentes
    const isUserLoggedIn = !!user;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white dark:bg-[#192235] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#243247] transition-colors z-10"
                >
                    <X size={20} className="text-gray-500 dark:text-gray-400" />
                </button>

                {/* Header with Gradient */}
                <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 p-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full mb-4">
                        {isUserLoggedIn ? <User className="w-8 h-8 text-white" /> : <Sparkles className="w-8 h-8 text-white" />}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {isUserLoggedIn ? `¡Hola, ${user.name || 'Usuario'}! 👋` : '¡Bienvenido a BeZhas! 👋'}
                    </h2>
                    <p className="text-white/90 text-sm">
                        {isUserLoggedIn
                            ? (isConnected ? 'Todas las funciones están activas' : 'Conecta tu wallet para más funciones')
                            : 'Elige cómo quieres comenzar tu experiencia'
                        }
                    </p>
                </div>

                {/* Options */}
                <div className="p-6 space-y-3">
                    {isUserLoggedIn ? (
                        // Opciones cuando el usuario está logueado
                        <>
                            {/* Conectar Wallet si no está conectada */}
                            {!isConnected && (
                                <button
                                    onClick={() => {
                                        onConnectWallet();
                                        onClose();
                                    }}
                                    className="w-full group relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-100 group-hover:opacity-90 transition-opacity" />
                                    <div className="relative flex items-center gap-4 p-4 text-white">
                                        <div className="flex-shrink-0 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                            <Wallet className="w-6 h-6" />
                                        </div>
                                        <div className="text-left flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-base">Conectar Wallet</p>
                                                <span className="text-xs bg-yellow-400/30 text-yellow-100 px-2 py-0.5 rounded-full font-semibold">
                                                    ⭐ Recomendado
                                                </span>
                                            </div>
                                            <p className="text-xs text-white/80 mt-0.5">
                                                Web3 • Recompensas • NFTs • DAO
                                            </p>
                                        </div>
                                        <Shield className="w-5 h-5 text-white/60" />
                                    </div>
                                </button>
                            )}

                            {/* Estado de Wallet Conectada */}
                            {isConnected && (
                                <div className="w-full bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                            <Wallet className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm text-green-700 dark:text-green-300">
                                                ✅ Wallet Conectada
                                            </p>
                                            <p className="text-xs text-green-600 dark:text-green-400">
                                                Todas las funciones Web3 activas
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Ver Perfil */}
                            <Link
                                to="/profile"
                                onClick={onClose}
                                className="w-full block group"
                            >
                                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 rounded-lg transition-all border border-cyan-500/30">
                                    <div className="flex-shrink-0 w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                                        <User className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="font-bold text-base text-gray-800 dark:text-white">
                                            Mi Perfil
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                            Ver y editar tu perfil
                                        </p>
                                    </div>
                                </div>
                            </Link>

                            {/* Cerrar Sesión */}
                            <button
                                onClick={() => {
                                    logout();
                                    onClose();
                                }}
                                className="w-full group"
                            >
                                <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all border border-red-200 dark:border-red-800">
                                    <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center">
                                        <LogOut className="w-6 h-6 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="font-bold text-base text-red-600 dark:text-red-400">
                                            Cerrar Sesión
                                        </p>
                                        <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">
                                            Salir de tu cuenta
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </>
                    ) : (
                        // Opciones cuando el usuario NO está logueado
                        <>
                            {/* Opción 1: Conectar Wallet (Recomendado) */}
                            <button
                                onClick={() => {
                                    onConnectWallet();
                                    onClose();
                                }}
                                className="w-full group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-100 group-hover:opacity-90 transition-opacity" />
                                <div className="relative flex items-center gap-4 p-4 text-white">
                                    <div className="flex-shrink-0 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                        <Wallet className="w-6 h-6" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-base">Conectar Wallet</p>
                                            <span className="text-xs bg-yellow-400/30 text-yellow-100 px-2 py-0.5 rounded-full font-semibold">
                                                ⭐ Recomendado
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/80 mt-0.5">
                                            Web3 • Recompensas • NFTs • DAO
                                        </p>
                                    </div>
                                    <Shield className="w-5 h-5 text-white/60" />
                                </div>
                            </button>

                            {/* Opción 2: Registrarse */}
                            <Link
                                to="/register"
                                onClick={onClose}
                                className="w-full block group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-100 group-hover:opacity-90 transition-opacity" />
                                <div className="relative flex items-center gap-4 p-4 text-white">
                                    <div className="flex-shrink-0 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                        <UserPlus className="w-6 h-6" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="font-bold text-base">Crear Cuenta</p>
                                        <p className="text-xs text-white/80 mt-0.5">
                                            Email • Contraseña • Acceso rápido
                                        </p>
                                    </div>
                                    <Gift className="w-5 h-5 text-white/60" />
                                </div>
                            </Link>

                            {/* Opción 3: Iniciar Sesión */}
                            <Link
                                to="/login"
                                onClick={onClose}
                                className="w-full block group"
                            >
                                <div className="flex items-center gap-4 p-4 bg-gray-100 dark:bg-[#0A101F] hover:bg-gray-200 dark:hover:bg-[#243247] rounded-lg transition-all border border-gray-200 dark:border-gray-700">
                                    <div className="flex-shrink-0 w-12 h-12 bg-gray-200 dark:bg-[#192235] rounded-lg flex items-center justify-center">
                                        <LogIn className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="font-bold text-base text-gray-800 dark:text-white">
                                            Iniciar Sesión
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                            Ya tengo una cuenta
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        </>
                    )}
                </div>

                {/* Footer Info */}
                <div className="px-6 pb-6">
                    <div className="bg-gradient-to-r from-purple-50 to-cyan-50 dark:from-purple-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                        <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                            🔒 <span className="font-semibold">100% Seguro</span> • Tus datos están protegidos con encriptación de grado bancario
                        </p>
                    </div>
                </div>
            </div>

            <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
        </div>
    );
};

export default AuthModal;
