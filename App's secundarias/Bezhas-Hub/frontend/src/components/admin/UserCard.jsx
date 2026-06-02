import React from 'react';
import { Mail, Calendar, Shield, Ban, CheckCircle } from 'lucide-react';

/**
 * Componente para mostrar información de un usuario
 * @param {object} user - Objeto con datos del usuario
 * @param {function} onAction - Callback para acciones (verificar, suspender)
 */
const UserCard = ({ user, onAction }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 p-4">
            {/* Header con avatar y nombre */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <img
                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`}
                        alt={user.username}
                        className="h-12 w-12 rounded-full object-cover ring-2 ring-blue-500"
                    />
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            {user.username}
                            {user.isVerified && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            {user.email}
                        </p>
                    </div>
                </div>

                {/* Badge de rol */}
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                    {user.role === 'admin' ? 'Admin' : 'Usuario'}
                </span>
            </div>

            {/* Información adicional */}
            <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4 mr-2" />
                    Registrado: {new Date(user.createdAt).toLocaleDateString('es-ES')}
                </div>

                {user.walletAddress && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Shield className="h-4 w-4 mr-2" />
                        Wallet: {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                    </div>
                )}
            </div>

            {/* Acciones */}
            <div className="flex space-x-2">
                {!user.isVerified && (
                    <button
                        onClick={() => onAction(user.id, 'verify')}
                        className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Verificar
                    </button>
                )}
                <button
                    onClick={() => onAction(user.id, 'suspend')}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                >
                    <Ban className="h-4 w-4 mr-1" />
                    Suspender
                </button>
            </div>
        </div>
    );
};

export default UserCard;
