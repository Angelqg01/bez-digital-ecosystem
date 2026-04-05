import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useBezCoin } from '../../context/BezCoinContext';
import { Users, Coins, Megaphone, Cpu, TrendingUp } from 'lucide-react';
// UnifiedPaymentModal -> useBezPay().openBuyBez()
import BezCoinChartModal from '../BezCoinChartModal';

const BezhasIntro = () => {
    const { tokenPrice } = useBezCoin();
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showChartModal, setShowChartModal] = useState(false);

    const functions = [
        {
            icon: Users,
            title: "Social Web3",
            description: "Red social descentralizada donde eres dueño de tu contenido."
        },
        {
            icon: Coins,
            title: "DeFi & DAO",
            description: "Gobernanza participativa y economía tokenizada integrada."
        },
        {
            icon: Megaphone,
            title: "Ad Center",
            description: "Gestión publicitaria transparente basada en blockchain."
        },
        {
            icon: Cpu,
            title: "AI Engine",
            description: "Asistentes de IA para potenciar tu creatividad y negocios."
        }
    ];

    return (
        <div className="relative w-full bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-b border-gray-200 dark:border-gray-800">
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

                    {/* Main Info Section */}
                    <div className="md:col-span-2 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                                ¿Qué es <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">BeZhas</span>?
                            </h1>
                            <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed text-justify">
                                Impulsa tu empresa con la potencia de la Web3. <strong>BeZhas</strong> ofrece una suite integral para la gestión descentralizada: tokenización de activos reales, validación inmutable en blockchain y acceso a financiación global. Potencia tu capital con nuestro sistema de <strong>Staking</strong> de alto rendimiento, participa en la gobernanza a través de nuestra <strong>DAO</strong> y descubre cómo el token <strong>BEZ</strong> revoluciona la economía digital corporativa.
                            </p>
                        </motion.div>

                        {/* Key Functions Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                            {functions.map((func, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + (index * 0.1) }}
                                    className="flex items-start p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 shadow-sm"
                                >
                                    <div className="p-2 mr-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                        <func.icon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{func.title}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{func.description}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Floating Token Price Widget */}
                    <div className="md:col-span-1 flex justify-center md:justify-end">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ delay: 0.4, type: "spring" }}
                            className="relative w-full max-w-sm"
                        >
                            {/* Floating Effect Background */}
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-2xl blur opacity-30 animate-pulse"></div>

                            <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-xl">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold shadow-sm">
                                            ₿
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">BeZhas Coin</h3>
                                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">BEZ</span>
                                        </div>
                                    </div>
                                    <div className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold flex items-center gap-1">
                                        <TrendingUp size={12} />
                                        +2.4%
                                    </div>
                                </div>

                                <div className="space-y-1 mb-4">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Precio Actual</p>
                                    <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200">
                                        ${tokenPrice ? Number(tokenPrice).toFixed(4) : "0.0000"} USDC
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowPaymentModal(true)}
                                        className="flex-1 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition shadow-md shadow-blue-500/20"
                                    >
                                        Comprar
                                    </button>
                                    <button
                                        onClick={() => setShowChartModal(true)}
                                        className="flex-1 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                                    >
                                        Chart
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <UnifiedPaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                />
            )}

            {/* Chart Modal */}
            {showChartModal && (
                <BezCoinChartModal
                    isOpen={showChartModal}
                    onClose={() => setShowChartModal(false)}
                />
            )}
        </div>
    );
};

export default BezhasIntro;
