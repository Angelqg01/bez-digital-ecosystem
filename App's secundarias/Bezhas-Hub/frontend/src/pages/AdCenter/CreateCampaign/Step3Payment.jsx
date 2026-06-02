import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaEuroSign, FaCoins, FaCreditCard, FaWallet, FaRocket } from 'react-icons/fa';
import { campaignsService, billingService } from '../../../services/adCenter.service';
import toast from 'react-hot-toast';

const Step3Payment = ({ formData, onBack, onNext }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(null);

    // Cargar balance al montar
    useEffect(() => {
        loadBalance();
    }, []);

    const loadBalance = async () => {
        try {
            const response = await billingService.getBalance();
            if (response.success) {
                setBalance(response.data);
            }
        } catch (error) {
            console.error('Error loading balance:', error);
        }
    };

    // Calcular costo estimado
    const calculateEstimatedCost = () => {
        const { dailyBudget, totalBudget } = formData.budget;
        const { startDate, endDate } = formData.schedule;

        if (endDate) {
            const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
            return Math.min(dailyBudget * days, totalBudget);
        }

        return totalBudget;
    };

    const estimatedCost = calculateEstimatedCost();
    const hasAvailableFunds = balance && balance.totalAvailableEur >= estimatedCost;

    const handleSubmitCampaign = async () => {
        setLoading(true);
        try {
            // Preparar datos de la campaña
            const campaignData = {
                name: formData.name || formData.creative.title,
                objective: formData.objective,
                creative: formData.creative,
                targeting: formData.targeting || {},
                budget: formData.budget,
                schedule: formData.schedule
            };

            const response = await campaignsService.createCampaign(campaignData);

            if (response.success) {
                toast.success('¡Campaña enviada para aprobación!');

                // Limpiar formData del localStorage si existe
                localStorage.removeItem('adCampaignDraft');

                // Ir al paso de éxito
                onNext();
            }
        } catch (error) {
            console.error('Error creating campaign:', error);
            toast.error(error.response?.data?.message || 'Error al crear campaña');
        } finally {
            setLoading(false);
        }
    };

    const handleAddFunds = (method) => {
        setPaymentMethod(method);
        setShowPaymentModal(true);
    };

    const objectiveLabels = {
        clicks: 'Obtener Clics/Tráfico',
        impressions: 'Aumentar Visibilidad',
        conversions: 'Generar Conversiones'
    };

    return (
        <div className="max-w-4xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
            >
                <h2 className="text-3xl font-bold text-white mb-2">
                    Listo para Lanzar 🚀
                </h2>
                <p className="text-gray-400">
                    Revisa tu campaña y completa el pago para enviarla a aprobación
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Campaign Summary */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-6"
                >
                    <h3 className="text-xl font-bold text-white mb-4">
                        Resumen de Campaña
                    </h3>

                    {/* Preview Card */}
                    <div className="bg-gray-900 rounded-lg overflow-hidden mb-4">
                        {formData.creative?.imageUrl && (
                            <img
                                src={formData.creative.imageUrl}
                                alt="Ad preview"
                                className="w-full h-40 object-cover"
                            />
                        )}
                        <div className="p-3">
                            <h4 className="text-white font-bold text-sm mb-1">
                                {formData.creative?.title}
                            </h4>
                            <p className="text-gray-400 text-xs mb-2 line-clamp-2">
                                {formData.creative?.description}
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                    {formData.creative?.destinationUrl}
                                </span>
                                <span className="text-xs px-2 py-1 bg-purple-600 text-white rounded">
                                    {formData.creative?.callToAction?.replace('-', ' ').toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Campaign Details */}
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Objetivo:</span>
                            <span className="text-white font-medium">{objectiveLabels[formData.objective]}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Presupuesto Diario:</span>
                            <span className="text-white font-medium">€{formData.budget?.dailyBudget}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Presupuesto Total:</span>
                            <span className="text-white font-medium">€{formData.budget?.totalBudget}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Puja:</span>
                            <span className="text-white font-medium">€{formData.budget?.bidAmount}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Inicio:</span>
                            <span className="text-white font-medium">
                                {new Date(formData.schedule?.startDate).toLocaleDateString()}
                            </span>
                        </div>
                        {formData.schedule?.endDate && (
                            <div className="flex justify-between">
                                <span className="text-gray-400">Fin:</span>
                                <span className="text-white font-medium">
                                    {new Date(formData.schedule.endDate).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Payment Section */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-4"
                >
                    {/* Balance Card */}
                    <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-6 text-white">
                        <h3 className="text-lg font-bold mb-4">Tu Saldo Actual</h3>

                        {balance ? (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-purple-100">FIAT:</span>
                                    <span className="text-2xl font-bold">€{balance.fiatBalance?.toFixed(2) || '0.00'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-purple-100">BEZ:</span>
                                    <span className="text-lg">{balance.bezBalance?.toFixed(2) || '0'} BEZ (≈€{balance.bezBalanceInEur?.toFixed(2) || '0.00'})</span>
                                </div>
                                <div className="border-t border-purple-400 pt-2 mt-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-purple-100 font-medium">Total Disponible:</span>
                                        <span className="text-3xl font-bold">€{balance.totalAvailableEur?.toFixed(2) || '0.00'}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                            </div>
                        )}
                    </div>

                    {/* Cost Estimation */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Costo Estimado</h3>

                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Presupuesto Campaña:</span>
                                <span className="text-white">€{estimatedCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Fondos Requeridos (3 días mínimo):</span>
                                <span className="text-white">€{(formData.budget?.dailyBudget * 3).toFixed(2)}</span>
                            </div>

                            {hasAvailableFunds ? (
                                <div className="flex items-center space-x-2 text-green-400 text-sm bg-green-400 bg-opacity-10 p-3 rounded-lg">
                                    <FaCheckCircle />
                                    <span>Tienes fondos suficientes</span>
                                </div>
                            ) : (
                                <div className="text-yellow-400 text-sm bg-yellow-400 bg-opacity-10 p-3 rounded-lg">
                                    ⚠️ Necesitas añadir fondos para lanzar esta campaña
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add Funds Buttons */}
                    {!hasAvailableFunds && (
                        <div className="space-y-3">
                            <button
                                onClick={() => handleAddFunds('fiat')}
                                className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
                            >
                                <FaCreditCard />
                                <span>Añadir Fondos FIAT (€)</span>
                            </button>

                            <button
                                onClick={() => handleAddFunds('bez')}
                                className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
                            >
                                <FaCoins />
                                <span>Añadir Fondos BEZ-Coin</span>
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Important Notes */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-blue-600 bg-opacity-10 border border-blue-500 rounded-xl p-6 mb-8"
            >
                <h4 className="text-blue-400 font-bold mb-2 flex items-center space-x-2">
                    <FaCheckCircle />
                    <span>Proceso de Aprobación</span>
                </h4>
                <ul className="text-sm text-gray-300 space-y-1 ml-6 list-disc">
                    <li>Tu campaña será revisada por nuestro equipo en las próximas 24-48 horas</li>
                    <li>Los fondos se deducirán automáticamente cuando la campaña sea aprobada y activada</li>
                    <li>Recibirás una notificación cuando tu campaña sea aprobada o si requiere cambios</li>
                    <li>Puedes editar tu campaña antes de que sea aprobada desde el dashboard</li>
                </ul>
            </motion.div>

            {/* Navigation */}
            <div className="flex justify-between">
                <button
                    onClick={onBack}
                    disabled={loading}
                    className="px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    ← Atrás
                </button>

                <button
                    onClick={handleSubmitCampaign}
                    disabled={loading || !hasAvailableFunds}
                    className={`flex items-center space-x-2 px-8 py-3 rounded-lg font-medium transition-all ${loading || !hasAvailableFunds
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                        }`}
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>Enviando...</span>
                        </>
                    ) : (
                        <>
                            <FaRocket />
                            <span>Enviar para Aprobación</span>
                        </>
                    )}
                </button>
            </div>

            {/* Payment Modal (placeholder - integrate with Stripe/Web3) */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full"
                    >
                        <h3 className="text-xl font-bold text-white mb-4">
                            {paymentMethod === 'fiat' ? 'Añadir Fondos FIAT' : 'Añadir Fondos BEZ'}
                        </h3>

                        <p className="text-gray-400 mb-4">
                            Redirigir a la página de billing para añadir fondos...
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => navigate('/ad-center/billing')}
                                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all"
                            >
                                Ir a Billing
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default Step3Payment;
