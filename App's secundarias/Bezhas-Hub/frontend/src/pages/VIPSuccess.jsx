import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, XCircle, Crown } from 'lucide-react';
import http from '../services/http';

export default function VIPSuccess() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading'); // loading, success, error
    const [subscriptionData, setSubscriptionData] = useState(null);

    useEffect(() => {
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
            setStatus('error');
            return;
        }

        // Verificar la sesión con el backend
        const verifySession = async () => {
            try {
                const response = await http.get(`/api/vip/verify-session/${sessionId}`);

                if (response.data.success) {
                    setSubscriptionData(response.data);
                    setStatus('success');
                } else {
                    setStatus('error');
                }
            } catch (error) {
                console.error('Error verifying session:', error);
                setStatus('error');
            }
        };

        verifySession();
    }, [searchParams]);

    const handleGoToVIP = () => {
        navigate('/vip');
    };

    const handleGoToDashboard = () => {
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="max-w-2xl w-full bg-gray-800/50 backdrop-blur-lg rounded-2xl border border-purple-500/30 p-8 text-center"
            >
                {status === 'loading' && (
                    <div className="space-y-6">
                        <Loader2 className="w-16 h-16 text-purple-400 animate-spin mx-auto" />
                        <h2 className="text-2xl font-bold text-white">
                            Verificando tu suscripción...
                        </h2>
                        <p className="text-gray-400">
                            Por favor espera mientras procesamos tu pago
                        </p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-6">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        >
                            <CheckCircle className="w-24 h-24 text-green-400 mx-auto" />
                        </motion.div>

                        <div>
                            <h1 className="text-4xl font-bold text-white mb-2">
                                ¡Bienvenido a BeZhas VIP! 🎉
                            </h1>
                            <p className="text-xl text-purple-300">
                                Tu suscripción ha sido activada con éxito
                            </p>
                        </div>

                        {subscriptionData && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30"
                            >
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    <Crown className="w-8 h-8 text-yellow-400" />
                                    <h3 className="text-2xl font-bold text-white">
                                        {subscriptionData.tierName || 'VIP Member'}
                                    </h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="bg-gray-900/50 rounded-lg p-3">
                                        <p className="text-gray-400 mb-1">Precio Mensual</p>
                                        <p className="text-white font-bold">
                                            ${subscriptionData.price || '0.00'} USD
                                        </p>
                                    </div>
                                    <div className="bg-gray-900/50 rounded-lg p-3">
                                        <p className="text-gray-400 mb-1">Próxima Renovación</p>
                                        <p className="text-white font-bold">
                                            {subscriptionData.nextBilling || 'En 30 días'}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        <div className="space-y-4 text-left bg-gray-900/30 rounded-xl p-6">
                            <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                                Beneficios Activados
                            </h4>
                            <ul className="space-y-2 text-gray-300">
                                <li>✨ Descuentos exclusivos en todas las compras</li>
                                <li>🎫 Acceso prioritario a eventos y lanzamientos</li>
                                <li>🏆 Badge NFT exclusivo de tu tier VIP</li>
                                <li>💎 Bonus adicionales en compras de BEZ-Coin</li>
                                <li>📞 Soporte prioritario 24/7</li>
                            </ul>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleGoToDashboard}
                                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
                            >
                                Ir al Dashboard
                            </button>
                            <button
                                onClick={handleGoToVIP}
                                className="flex-1 bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-all"
                            >
                                Gestionar Suscripción
                            </button>
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="space-y-6">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200 }}
                        >
                            <XCircle className="w-24 h-24 text-red-400 mx-auto" />
                        </motion.div>

                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                Error al Procesar el Pago
                            </h1>
                            <p className="text-gray-400">
                                No pudimos verificar tu suscripción. Si el cargo ya fue realizado,
                                por favor contacta a soporte.
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleGoToVIP}
                                className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-all"
                            >
                                Volver a Intentar
                            </button>
                            <button
                                onClick={handleGoToDashboard}
                                className="flex-1 bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-all"
                            >
                                Ir al Dashboard
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
