import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import {
    Coins, CreditCard, Wallet, Gift, Shield, Zap,
    CheckCircle, ArrowRight, Star, TrendingUp, Sparkles,
    Lock, ExternalLink, Info, Crown, Flame, Award
} from 'lucide-react';
import GlobalStatsBar from '../components/GlobalStatsBar';
import { useBezPay } from '../context/BezPayContext';
// CryptoPaymentModal ELIMINADO – usar BezPayModal vía useBezPay()

/**
 * BuyTokensPage - Página completa para compra de paquetes de tokens BEZ-Coin
 * Incluye múltiples métodos de pago y beneficios integrados con el ecosistema
 */
export default function BuyTokensPage() {
    const { address, isConnected } = useAccount();
    const { openBuyBez } = useBezPay(); // Sistema BezPay v2
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('crypto'); // BezPay es siempre crypto/multi
    const [loading, setLoading] = useState(false);
    const [userSubscription, setUserSubscription] = useState(null);
    // showCryptoModal ELIMINADO – usar openBuyBez() de BezPayContext

    // Precio base por token
    const PRICE_PER_TOKEN = 0.10; // $0.10 USD

    // Paquetes de tokens con bonificaciones
    const tokenPackages = [
        {
            id: 'starter',
            name: 'Starter',
            tokens: 100,
            bonus: 0,
            price: 10,
            popular: false,
            color: 'from-gray-600 to-gray-700',
            benefits: [
                'Acceso a marketplace',
                'Transacciones básicas',
                'Participación en DAO',
                'Acceso a Real Yield stats'
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            tokens: 500,
            bonus: 50, // +10%
            price: 50,
            popular: false,
            color: 'from-blue-600 to-blue-700',
            benefits: [
                '+10% tokens extra',
                'Acceso a staking básico',
                'Descuento 5% en fees',
                '🔥 Real Yield +2% APY',
                '💧 Acceso LP Pool QuickSwap'
            ]
        },
        {
            id: 'business',
            name: 'Business',
            tokens: 1000,
            bonus: 150, // +15%
            price: 100,
            popular: true,
            color: 'from-purple-600 to-pink-600',
            benefits: [
                '+15% tokens extra',
                'Acceso DeFi Hub completo',
                'Multiplicador x1.1 en farming',
                'Badge verificado',
                '🔥 Real Yield +5% APY',
                '💧 LP Pool + x0.3 Treasury multiplier',
                '⚡ Quality Oracle validación express'
            ]
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            tokens: 5000,
            bonus: 1000, // +20%
            price: 500,
            popular: false,
            color: 'from-yellow-500 to-orange-600',
            benefits: [
                '+20% tokens extra',
                'Acceso VIP 1 mes gratis',
                'Multiplicador x1.25 en farming',
                'Soporte prioritario',
                'NFT exclusivo "Early Adopter"',
                '🔥 Real Yield +8% APY máximo',
                '💧 LP Pool Elite Benefits',
                '🏦 DeFi Hub Analytics Pro'
            ]
        },
        {
            id: 'whale',
            name: 'Whale',
            tokens: 25000,
            bonus: 7500, // +30%
            price: 2500,
            popular: false,
            color: 'from-cyan-500 to-blue-600',
            benefits: [
                '+30% tokens extra',
                'Suscripción Platinum 3 meses',
                'Multiplicador x1.5 en farming',
                'Acceso a preventas RWA',
                'NFT "Liquidity Titan"',
                'Llamada con el equipo',
                '🔥 Real Yield +10% APY',
                '💎 Participación Treasury DAO',
                '⚡ Quality Oracle VIP Priority'
            ]
        },
        {
            id: 'institution',
            name: 'Institution',
            tokens: 100000,
            bonus: 40000, // +40%
            price: 10000,
            popular: false,
            color: 'from-emerald-500 to-teal-600',
            benefits: [
                '+40% tokens extra',
                'Suscripción Platinum 1 año',
                'Multiplicador x2.0 en farming',
                'Acceso DAO con voz y voto',
                'Listing en panel de inversores',
                'Onboarding personalizado',
                '🔥 Real Yield +12% APY máximo',
                '💎 Voz en Treasury DAO Council',
                '🏦 Full DeFi Suite + API Access',
                '⚡ Quality Oracle Validator Access'
            ]
        }
    ];

    // Métodos de pago disponibles
    const paymentMethods = [
        {
            id: 'card',
            name: 'Tarjeta de Crédito',
            icon: <CreditCard size={24} />,
            description: 'Visa, Mastercard, Amex',
            processingTime: 'Instantáneo',
            fee: '2.9%'
        },
        {
            id: 'crypto',
            name: 'Criptomonedas',
            icon: <Wallet size={24} />,
            description: 'USDC, USDT, ETH, POL',
            processingTime: '1-5 minutos',
            fee: '0.5%'
        },
        {
            id: 'bank',
            name: 'Transferencia Bancaria',
            icon: <Shield size={24} />,
            description: 'SEPA, Wire Transfer',
            processingTime: '1-3 días',
            fee: '0%'
        }
    ];

    // Cargar datos del usuario
    useEffect(() => {
        if (isConnected && address) {
            loadUserData();
        }
    }, [isConnected, address]);

    const loadUserData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const response = await axios.get('/api/users/subscription', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUserSubscription(response.data);
            }
        } catch (error) {
            // Silenciar errores 403/401 - el usuario simplemente no tiene token válido
            if (error?.response?.status !== 403 && error?.response?.status !== 401) {
                console.error('Error loading user data:', error);
            }
        }
    };

    const handlePurchase = async () => {
        if (!selectedPackage) {
            toast.error('Selecciona un paquete primero');
            return;
        }

        // Todos los pagos pasan por BezPayModal v2
        openBuyBez(selectedPackage.price, {
            itemName: `Paquete ${selectedPackage.name}`,
            metadata: {
                packageId: selectedPackage.id,
                tokens: selectedPackage.tokens,
                bonus: selectedPackage.bonus,
                source: 'buy_tokens_page',
            },
            onSuccess: ({ txHash, bezAmount }) => {
                toast.success(`✅ ${(selectedPackage.tokens + selectedPackage.bonus).toLocaleString()} BEZ activados!`, { duration: 6000 });
                setSelectedPackage(null);
            },
        });
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">


            {/* BezPayModal se abre vía openBuyBez() — registrado globalmente en App.jsx */}

            {/* Global Stats Bar */}
            <GlobalStatsBar />

            {/* Header */}
            <div className="bg-black/30 backdrop-blur-sm border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="text-center">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-full mb-4"
                        >
                            <Flame className="text-orange-400" size={18} />
                            <span className="text-orange-300 font-medium">Real Yield Economy</span>
                        </motion.div>

                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                            Comprar <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">BEZ-Coin</span>
                        </h1>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                            Adquiere tokens BEZ y accede a todo el ecosistema BeZhas:
                            DeFi, Staking, DAO, NFTs, y rendimientos reales del comercio.
                        </p>
                    </div>
                </div>
            </div>

            {/* Beneficios Destacados */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-xl p-4 text-center"
                    >
                        <TrendingUp className="text-green-400 mx-auto mb-2" size={32} />
                        <p className="text-white font-semibold">Real Yield</p>
                        <p className="text-gray-400 text-sm">0.7% de las ventas reales</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-4 text-center"
                    >
                        <Crown className="text-purple-400 mx-auto mb-2" size={32} />
                        <p className="text-white font-semibold">VIP Benefits</p>
                        <p className="text-gray-400 text-sm">Multiplicadores exclusivos</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-xl p-4 text-center"
                    >
                        <Flame className="text-orange-400 mx-auto mb-2" size={32} />
                        <p className="text-white font-semibold">Deflación</p>
                        <p className="text-gray-400 text-sm">Modelo económico sostenible</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-4 text-center"
                    >
                        <Award className="text-blue-400 mx-auto mb-2" size={32} />
                        <p className="text-white font-semibold">Governance</p>
                        <p className="text-gray-400 text-sm">Vota en la DAO</p>
                    </motion.div>
                </div>

                {/* Grid de Paquetes */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {tokenPackages.map((pkg, index) => (
                        <motion.div
                            key={pkg.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            onClick={() => setSelectedPackage(pkg)}
                            className={`
                                relative cursor-pointer rounded-xl border-2 transition-all duration-300
                                ${selectedPackage?.id === pkg.id
                                    ? 'border-purple-500 shadow-lg shadow-purple-500/30 scale-105'
                                    : 'border-white/10 hover:border-white/30'
                                }
                            `}
                        >
                            {/* Popular Badge */}
                            {pkg.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white text-sm font-bold flex items-center gap-1">
                                    <Star size={14} /> Más Popular
                                </div>
                            )}

                            {/* Header */}
                            <div className={`bg-gradient-to-r ${pkg.color} p-6 rounded-t-xl`}>
                                <h3 className="text-2xl font-bold text-white">{pkg.name}</h3>
                                <div className="flex items-baseline gap-2 mt-2">
                                    <span className="text-4xl font-bold text-white">${pkg.price}</span>
                                    <span className="text-white/70">USD</span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="bg-gray-900/80 p-6 rounded-b-xl">
                                <div className="flex items-center justify-between mb-4 p-3 bg-white/5 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Coins className="text-yellow-400" size={24} />
                                        <span className="text-white font-semibold">{pkg.tokens.toLocaleString()}</span>
                                    </div>
                                    {pkg.bonus > 0 && (
                                        <div className="flex items-center gap-1 text-green-400">
                                            <Gift size={16} />
                                            <span className="font-bold">+{pkg.bonus.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>

                                <p className="text-gray-400 text-sm mb-4">
                                    Total: <span className="text-white font-bold">{(pkg.tokens + pkg.bonus).toLocaleString()} BEZ</span>
                                </p>

                                <ul className="space-y-2">
                                    {pkg.benefits.map((benefit, i) => (
                                        <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                                            <CheckCircle className="text-green-400 flex-shrink-0" size={16} />
                                            {benefit}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    className={`
                                        w-full mt-6 py-3 rounded-lg font-semibold transition-all
                                        ${selectedPackage?.id === pkg.id
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-white/10 text-white hover:bg-white/20'
                                        }
                                    `}
                                >
                                    {selectedPackage?.id === pkg.id ? '✓ Seleccionado' : 'Seleccionar'}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Métodos de Pago */}
                <AnimatePresence>
                    {selectedPackage && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-6 mb-8"
                        >
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <CreditCard className="text-purple-400" />
                                Método de Pago
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                {paymentMethods.map((method) => (
                                    <button
                                        key={method.id}
                                        onClick={() => setPaymentMethod(method.id)}
                                        className={`
                                            p-4 rounded-xl border-2 transition-all text-left
                                            ${paymentMethod === method.id
                                                ? 'border-purple-500 bg-purple-500/10'
                                                : 'border-white/10 hover:border-white/30'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`p-2 rounded-lg ${paymentMethod === method.id ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10 text-gray-400'}`}>
                                                {method.icon}
                                            </div>
                                            <div>
                                                <p className="text-white font-semibold">{method.name}</p>
                                                <p className="text-gray-400 text-sm">{method.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-sm mt-3 pt-3 border-t border-white/10">
                                            <span className="text-gray-400">Tiempo: {method.processingTime}</span>
                                            <span className="text-gray-400">Fee: {method.fee}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Resumen de Compra */}
                            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl p-6 border border-purple-500/30">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <p className="text-gray-400 mb-1">Resumen de tu compra</p>
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <p className="text-white font-bold text-2xl">{selectedPackage.name}</p>
                                                <p className="text-purple-300">
                                                    {(selectedPackage.tokens + selectedPackage.bonus).toLocaleString()} BEZ
                                                    {selectedPackage.bonus > 0 && (
                                                        <span className="text-green-400 ml-2">(+{selectedPackage.bonus.toLocaleString()} bonus)</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-gray-400 text-sm">Total a pagar</p>
                                        <p className="text-white font-bold text-3xl">${selectedPackage.price} USD</p>
                                    </div>
                                </div>

                                <button
                                    onClick={handlePurchase}
                                    disabled={loading || !isConnected}
                                    className={`
                                        w-full mt-6 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2
                                        ${loading || !isConnected
                                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-purple-500/30'
                                        }
                                    `}
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                            Procesando...
                                        </>
                                    ) : !isConnected ? (
                                        <>
                                            <Lock size={20} />
                                            Conecta tu wallet para comprar
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={20} />
                                            Comprar Ahora
                                            <ArrowRight size={20} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Info sobre Real Yield */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-xl border border-emerald-500/20 p-6"
                >
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-emerald-500/20 rounded-xl">
                            <Info className="text-emerald-400" size={24} />
                        </div>
                        <div>
                            <h4 className="text-white font-bold text-lg mb-2">¿Qué puedes hacer con BEZ-Coin?</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
                                <div>
                                    <p className="font-semibold text-emerald-300 mb-1">💰 DeFi & Staking</p>
                                    <p className="text-sm">Haz staking y gana hasta 24% APY con Real Yield del comercio real.</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-emerald-300 mb-1">🗳️ Gobernanza DAO</p>
                                    <p className="text-sm">Vota en propuestas y decide el futuro de la plataforma.</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-emerald-300 mb-1">🎨 NFT Marketplace</p>
                                    <p className="text-sm">Compra, vende y crea NFTs con fees reducidos.</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-emerald-300 mb-1">🏠 Real World Assets</p>
                                    <p className="text-sm">Invierte en propiedades tokenizadas con fracciones.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
