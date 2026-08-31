import React, { useState } from 'react';
import { Coins, Heart, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * DonationButton - Componente de donación con BEZ tokens
 * Permite a los usuarios donar tokens a los creadores de contenido
 * 
 * @param {Object} author - Autor del contenido
 * @param {string} contentId - ID del contenido
 * @param {string} contentType - Tipo de contenido (post, behistory, etc)
 * @param {Function} onDonationComplete - Callback después de donar
 */
const DonationButton = ({
    author,
    contentId,
    contentType = 'post',
    onDonationComplete,
    variant = 'default' // default | compact | icon-only
}) => {
    const [showDonationModal, setShowDonationModal] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Cantidades predefinidas de donación
    const donationAmounts = [
        { value: 5, label: '5 BEZ', emoji: '☕' },
        { value: 10, label: '10 BEZ', emoji: '🍕' },
        { value: 25, label: '25 BEZ', emoji: '🎁' },
        { value: 50, label: '50 BEZ', emoji: '🎉' },
        { value: 100, label: '100 BEZ', emoji: '🚀' }
    ];

    /**
     * Procesa la donación
     */
    const handleDonate = async () => {
        const amount = selectedAmount || parseFloat(customAmount);

        if (!amount || amount <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }

        setIsProcessing(true);

        try {
            // Simular transacción blockchain (aquí iría la integración real)
            await new Promise(resolve => setTimeout(resolve, 1500));

            // TODO: Integrar con smart contract de donaciones
            // const tx = await donationContract.donate(author.address, amount);
            // await tx.wait();

            setShowSuccess(true);

            toast.success(
                <div className="flex items-center gap-2">
                    <Heart className="text-red-500" size={20} fill="currentColor" />
                    <span>¡Donación de {amount} BEZ enviada!</span>
                </div>,
                { duration: 3000 }
            );

            // Callback
            onDonationComplete && onDonationComplete({ amount, author, contentId });

            // Reset después de 2 segundos
            setTimeout(() => {
                setShowDonationModal(false);
                setShowSuccess(false);
                setSelectedAmount(null);
                setCustomAmount('');
            }, 2000);

        } catch (error) {
            console.error('Error donating:', error);
            toast.error('Error al procesar la donación');
        } finally {
            setIsProcessing(false);
        }
    };

    // Render según variante
    const renderButton = () => {
        if (variant === 'icon-only') {
            return (
                <button
                    onClick={() => setShowDonationModal(true)}
                    className="p-2 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-full transition-colors group"
                    title="Donar BEZ"
                >
                    <Coins size={20} className="text-yellow-600 dark:text-yellow-400 group-hover:scale-110 transition-transform" />
                </button>
            );
        }

        if (variant === 'compact') {
            return (
                <button
                    onClick={() => setShowDonationModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-full text-sm font-medium transition-all hover:scale-105"
                >
                    <Coins size={16} />
                    <span>Donar</span>
                </button>
            );
        }

        // default variant
        return (
            <button
                onClick={() => setShowDonationModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg font-semibold transition-all hover:scale-105 shadow-md hover:shadow-lg"
            >
                <Coins size={20} />
                <span>Donar BEZ</span>
            </button>
        );
    };

    return (
        <>
            {renderButton()}

            {/* Modal de Donación */}
            {showDonationModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDonationModal(false)}>
                    <div
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Coins size={24} />
                                    Apoyar a {author?.name || author?.username}
                                </h3>
                                <button
                                    onClick={() => setShowDonationModal(false)}
                                    className="p-1 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <p className="text-yellow-100 text-sm">
                                Tu apoyo ayuda a los creadores a seguir compartiendo contenido increíble
                            </p>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            {!showSuccess ? (
                                <>
                                    {/* Cantidades predefinidas */}
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        {donationAmounts.map((amount) => (
                                            <button
                                                key={amount.value}
                                                onClick={() => {
                                                    setSelectedAmount(amount.value);
                                                    setCustomAmount('');
                                                }}
                                                className={`p-4 rounded-xl border-2 transition-all ${selectedAmount === amount.value
                                                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-600'
                                                    }`}
                                            >
                                                <div className="text-3xl mb-2">{amount.emoji}</div>
                                                <div className="font-semibold text-gray-900 dark:text-white">{amount.label}</div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Cantidad personalizada */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            O ingresa una cantidad personalizada:
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={customAmount}
                                                onChange={(e) => {
                                                    setCustomAmount(e.target.value);
                                                    setSelectedAmount(null);
                                                }}
                                                placeholder="0"
                                                className="w-full px-4 py-3 pr-16 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-yellow-500 dark:bg-gray-900 dark:text-white text-lg"
                                                min="1"
                                                step="1"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
                                                BEZ
                                            </span>
                                        </div>
                                    </div>

                                    {/* Información */}
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
                                        <p className="text-sm text-blue-900 dark:text-blue-200">
                                            <strong>💡 Sabías que:</strong> El 95% de tu donación va directamente al creador, el 5% apoya el mantenimiento de la plataforma.
                                        </p>
                                    </div>

                                    {/* Botón de donación */}
                                    <button
                                        onClick={handleDonate}
                                        disabled={isProcessing || (!selectedAmount && !customAmount)}
                                        className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-bold text-lg transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Procesando...
                                            </>
                                        ) : (
                                            <>
                                                <Heart size={20} />
                                                Donar {selectedAmount || customAmount || '...'} BEZ
                                            </>
                                        )}
                                    </button>
                                </>
                            ) : (
                                /* Mensaje de éxito */
                                <div className="text-center py-8">
                                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Check size={40} className="text-green-600 dark:text-green-400" />
                                    </div>
                                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                        ¡Gracias por tu apoyo!
                                    </h4>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Tu donación de <strong>{selectedAmount || customAmount} BEZ</strong> ha sido enviada
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default DonationButton;
