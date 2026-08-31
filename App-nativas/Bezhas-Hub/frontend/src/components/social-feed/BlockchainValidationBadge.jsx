import React, { useState } from 'react';
import { Shield, Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * BlockchainValidationBadge - Badge que muestra si el contenido está validado en blockchain
 * Permite validar contenido existente
 * 
 * @param {Object} post - Datos del post
 * @param {Function} onValidate - Callback después de validar
 */
const BlockchainValidationBadge = ({
    post,
    onValidate,
    variant = 'badge' // badge | button
}) => {
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('bez'); // bez | matic

    const validationCosts = {
        bez: { amount: 10, symbol: 'BEZ' },
        matic: { amount: 0.01, symbol: 'MATIC' }
    };

    /**
     * Procesa la validación blockchain
     */
    const handleValidate = async () => {
        setIsValidating(true);

        try {
            // Simular transacción blockchain
            await new Promise(resolve => setTimeout(resolve, 2000));

            // TODO: Integrar con smart contract de validación
            // const tx = await validatorContract.validate(postHash, paymentMethod);
            // await tx.wait();

            toast.success(
                <div className="flex items-center gap-2">
                    <Shield className="text-green-500" size={20} />
                    <span>¡Contenido validado en blockchain!</span>
                </div>,
                { duration: 3000 }
            );

            // Callback
            onValidate && onValidate({
                postId: post.id,
                validated: true,
                txHash: '0x' + Math.random().toString(16).slice(2),
                timestamp: Date.now()
            });

            setShowValidationModal(false);

        } catch (error) {
            console.error('Error validating:', error);
            toast.error('Error al validar el contenido');
        } finally {
            setIsValidating(false);
        }
    };

    // Si ya está validado, mostrar badge
    if (post?.blockchainValidated) {
        return (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
                <Shield size={14} className="text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-700 dark:text-green-300">
                    Validado en Blockchain
                </span>
            </div>
        );
    }

    // Si es variante button, mostrar botón para validar
    if (variant === 'button') {
        return (
            <>
                <button
                    onClick={() => setShowValidationModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-blue-700 dark:text-blue-300 text-sm font-medium"
                >
                    <Shield size={16} />
                    <span>Validar</span>
                </button>

                {/* Modal de Validación */}
                {showValidationModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowValidationModal(false)}>
                        <div
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Shield size={24} />
                                        Validación Blockchain
                                    </h3>
                                    <button
                                        onClick={() => setShowValidationModal(false)}
                                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                <p className="text-blue-100 text-sm">
                                    Certifica tu contenido en la blockchain y obtén autenticidad verificable
                                </p>
                            </div>

                            {/* Body */}
                            <div className="p-6">
                                {/* Beneficios */}
                                <div className="mb-6">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                                        ✨ Beneficios de la validación:
                                    </h4>
                                    <ul className="space-y-2">
                                        <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Certificado inmutable de autenticidad</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Mayor visibilidad en la plataforma</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Badge de verificación en tu post</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Protección contra plagio y uso no autorizado</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Métodos de pago */}
                                <div className="mb-6">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                                        Selecciona método de pago:
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setPaymentMethod('bez')}
                                            className={`p-4 rounded-xl border-2 transition-all ${paymentMethod === 'bez'
                                                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-yellow-300'
                                                }`}
                                        >
                                            <div className="text-2xl mb-2">🪙</div>
                                            <div className="font-semibold text-gray-900 dark:text-white">
                                                {validationCosts.bez.amount} BEZ
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Token nativo
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setPaymentMethod('matic')}
                                            className={`p-4 rounded-xl border-2 transition-all ${paymentMethod === 'matic'
                                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                                                }`}
                                        >
                                            <div className="text-2xl mb-2">💎</div>
                                            <div className="font-semibold text-gray-900 dark:text-white">
                                                {validationCosts.matic.amount} MATIC
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Polygon
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Info técnica */}
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-6">
                                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        📋 Detalles técnicos:
                                    </h5>
                                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                        <li>• Red: Polygon (PoS)</li>
                                        <li>• Hash SHA-256 del contenido</li>
                                        <li>• Registro inmutable y verificable</li>
                                        <li>• Timestamp automático</li>
                                    </ul>
                                </div>

                                {/* Botón de validación */}
                                <button
                                    onClick={handleValidate}
                                    disabled={isValidating}
                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-bold text-lg transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isValidating ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            Validando en Blockchain...
                                        </>
                                    ) : (
                                        <>
                                            <Shield size={20} />
                                            Validar por {validationCosts[paymentMethod].amount} {validationCosts[paymentMethod].symbol}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // Badge por defecto (no validado)
    return null;
};

export default BlockchainValidationBadge;
