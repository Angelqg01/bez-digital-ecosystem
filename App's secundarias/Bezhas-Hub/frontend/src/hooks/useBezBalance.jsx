/**
 * @fileoverview BEZ Balance Checker - Utility Hook
 * @description Hook para verificar saldo de BEZ-Coin y gestionar acceso a funciones premium
 */

import { useState, useEffect } from 'react';
import { useBezCoin } from '../context/BezCoinContext';
import { toast } from 'react-hot-toast';

/**
 * Configuración de costos de funciones premium
 */
export const PREMIUM_FEATURES_COSTS = {
    CREATE_DAO: 1000,           // 1000 BEZ para crear DAO
    FEATURED_POST: 50,          // 50 BEZ para post destacado
    PREMIUM_DM: 10,             // 10 BEZ por mensaje directo premium
    CREATE_PRIVATE_GROUP: 200,  // 200 BEZ para grupo privado
    GOVERNANCE_VOTE: 100,       // 100 BEZ mínimo para votar
    NFT_MINT: 500,              // 500 BEZ para mintear NFT
    EXCLUSIVE_CONTENT: 25,      // 25 BEZ para contenido exclusivo
    BOOST_POST: 75,             // 75 BEZ para boost de post
    CUSTOM_BADGE: 150,          // 150 BEZ para badge personalizado
    AD_FREE_MONTH: 300          // 300 BEZ para un mes sin anuncios
};

/**
 * Hook para verificar y gestionar saldo de BEZ
 * @param {string} featureName - Nombre de la función (clave de PREMIUM_FEATURES_COSTS)
 * @returns {object} - { hasEnough, checkAndProceed, loading, requiredAmount }
 */
export function useBezBalance(featureName) {
    const { balance, setInsufficientFundsModal } = useBezCoin();
    const [loading, setLoading] = useState(false);
    const requiredAmount = PREMIUM_FEATURES_COSTS[featureName] || 0;

    const hasEnough = parseFloat(balance) >= requiredAmount;

    /**
     * Verifica saldo y procede con la acción o muestra modal de fondos insuficientes
     * @param {function} onSuccess - Callback a ejecutar si hay fondos suficientes
     * @param {function} onPurchaseComplete - Callback después de comprar BEZ
     */
    const checkAndProceed = (onSuccess, onPurchaseComplete = null) => {
        setLoading(true);

        if (hasEnough) {
            // Tiene fondos suficientes, proceder
            setLoading(false);
            onSuccess();
        } else {
            // Fondos insuficientes, mostrar modal
            setLoading(false);
            setInsufficientFundsModal({
                show: true,
                requiredAmount,
                actionName: getActionName(featureName),
                onPurchaseComplete: () => {
                    // Después de comprar, verificar nuevamente
                    if (onPurchaseComplete) {
                        onPurchaseComplete();
                    } else {
                        onSuccess();
                    }
                }
            });
        }
    };

    return {
        hasEnough,
        checkAndProceed,
        loading,
        requiredAmount,
        currentBalance: parseFloat(balance)
    };
}

/**
 * Obtiene el nombre legible de la acción
 */
function getActionName(featureName) {
    const names = {
        CREATE_DAO: 'Crear DAO',
        FEATURED_POST: 'Publicar Post Destacado',
        PREMIUM_DM: 'Enviar Mensaje Premium',
        CREATE_PRIVATE_GROUP: 'Crear Grupo Privado',
        GOVERNANCE_VOTE: 'Participar en Gobernanza',
        NFT_MINT: 'Mintear NFT',
        EXCLUSIVE_CONTENT: 'Acceder a Contenido Exclusivo',
        BOOST_POST: 'Impulsar Publicación',
        CUSTOM_BADGE: 'Crear Badge Personalizado',
        AD_FREE_MONTH: 'Activar Mes sin Anuncios'
    };
    return names[featureName] || 'Acción Premium';
}

/**
 * Componente de ejemplo: Botón de Función Premium
 */
export function PremiumFeatureButton({
    featureName,
    onClick,
    children,
    className = '',
    disabled = false
}) {
    const { hasEnough, checkAndProceed, loading, requiredAmount } = useBezBalance(featureName);

    const handleClick = () => {
        if (disabled || loading) return;

        checkAndProceed(
            // onSuccess
            () => {
                onClick();
            },
            // onPurchaseComplete
            () => {
                toast.success('¡Compra completada! Ahora puedes continuar.');
                onClick();
            }
        );
    };

    return (
        <button
            onClick={handleClick}
            disabled={disabled || loading}
            className={`
                ${className}
                ${!hasEnough ? 'border-2 border-yellow-500' : ''}
                ${loading ? 'opacity-50 cursor-wait' : ''}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            {loading ? (
                'Verificando...'
            ) : !hasEnough ? (
                <>
                    {children}
                    <span className="ml-2 text-xs text-yellow-400">
                        (Requiere {requiredAmount} BEZ)
                    </span>
                </>
            ) : (
                children
            )}
        </button>
    );
}

/**
 * Componente de ejemplo: Badge de Función Premium
 */
export function PremiumFeatureBadge({ featureName }) {
    const requiredAmount = PREMIUM_FEATURES_COSTS[featureName] || 0;

    return (
        <div className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full">
            <span>⭐</span>
            <span>{requiredAmount} BEZ</span>
        </div>
    );
}

/**
 * Componente de ejemplo: Card de Función Premium Bloqueada
 */
export function LockedFeatureCard({ featureName, description, icon }) {
    const { hasEnough, requiredAmount, currentBalance } = useBezBalance(featureName);
    const actionName = getActionName(featureName);
    const deficit = requiredAmount - currentBalance;

    if (hasEnough) return null; // No mostrar si ya tiene acceso

    return (
        <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-6 relative overflow-hidden">
            {/* Overlay de bloqueado */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-sm" />

            <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl opacity-50">{icon}</div>
                    <PremiumFeatureBadge featureName={featureName} />
                </div>

                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    🔒 {actionName}
                </h3>
                <p className="text-gray-400 text-sm mb-4">{description}</p>

                <div className="bg-gray-900 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-400">Tu balance:</span>
                        <span className="text-white font-bold">{currentBalance.toFixed(2)} BEZ</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-400">Requerido:</span>
                        <span className="text-purple-400 font-bold">{requiredAmount} BEZ</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Te faltan:</span>
                        <span className="text-red-400 font-bold">{deficit.toFixed(2)} BEZ</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <button className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition-all">
                        Comprar BEZ
                    </button>
                    <button className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all">
                        Ver Anuncios para Ganar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default useBezBalance;
