import React, { useState, useEffect } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Crown,
    Star,
    Zap,
    Shield,
    Gift,
    TrendingUp,
    Check,
    Sparkles,
    Lock,
    Unlock,
    Calculator,
    Percent,
    Coins,
    Rocket,
    Building2,
    Users,
    Bot,
    Fuel,
    Clock,
    ChevronRight,
    ChevronDown,
    Info,
    Award,
    Gem,
    CreditCard,
    Wallet,
    Banknote,
    Copy,
    ExternalLink,
    Flame,
    Droplets
} from 'lucide-react';
import ROICalculator from '../components/vip/ROICalculator';
import GlobalStatsBar from '../components/GlobalStatsBar';
import toast from 'react-hot-toast';
import vipService from '../services/vipService';

// ============================================
// CONFIGURACIÓN UNIFICADA DE TIERS VIP
// ============================================
const UNIFIED_VIP_TIERS = {
    STARTER: {
        id: 'starter',
        name: 'Starter',
        subtitle: 'Comienza tu viaje en BeZhas',
        icon: Star,
        color: 'from-slate-500 to-slate-600',
        borderColor: 'border-slate-500/30',
        bgGlow: 'hover:shadow-slate-500/20',
        price: {
            monthly: 0,
            yearly: 0,
            bez: 0
        },
        tokenLock: null,
        staking: {
            baseAPY: 12.5,
            multiplier: 1.0,
            effectiveAPY: 12.5
        },
        gasSubsidy: 0,
        aiCredits: {
            daily: 5,
            premium: false
        },
        benefits: [
            { text: 'Acceso básico a la plataforma', included: true },
            { text: '5 consultas AI por día', included: true },
            { text: 'Staking básico 12.5% APY', included: true },
            { text: 'Participación en DAO', included: true },
            { text: 'Acceso al Marketplace NFT y RWA', included: true },
            { text: 'Descuentos en compras', included: false },
            { text: 'Badge NFT verificado', included: false },
            { text: 'Soporte prioritario', included: false },
            { text: 'Subsidio de gas', included: false },
            { text: 'Real Yield LP Rewards (+2% APY)', included: false },
            { text: 'Quality Oracle validación prioritaria', included: false }
        ],
        badge: null,
        popular: false,
        premium: false
    },

    CREATOR: {
        id: 'creator',
        name: 'Creator Pro',
        subtitle: 'Para creadores que quieren destacar',
        icon: Zap,
        color: 'from-blue-500 to-cyan-500',
        borderColor: 'border-blue-500/50',
        bgGlow: 'hover:shadow-blue-500/30',
        price: {
            monthly: 19.99,
            yearly: 199.99,
            bez: 400
        },
        tokenLock: {
            amount: 5000,
            days: 90,
            description: 'Bloquea 5,000 BEZ por 90 días'
        },
        staking: {
            baseAPY: 12.5,
            multiplier: 1.5,
            effectiveAPY: 18.75
        },
        gasSubsidy: 25,
        aiCredits: {
            daily: 50,
            premium: true
        },
        benefits: [
            { text: 'Todo lo del plan Starter', included: true },
            { text: '50 consultas AI por día', included: true },
            { text: '1.5x multiplicador staking (18.75% APY)', included: true },
            { text: '25% subsidio en gas fees', included: true },
            { text: '5% descuento en compras', included: true },
            { text: '10% descuento en envíos', included: true },
            { text: 'Badge NFT Creator verificado', included: true },
            { text: 'Soporte prioritario', included: true },
            { text: 'Acceso a eventos exclusivos', included: true },
            { text: '🔥 Real Yield LP Rewards (+4% APY extra)', included: true },
            { text: '⚡ Quality Oracle validación express 24h', included: true },
            { text: '💧 Acceso a Liquidity Pool QuickSwap', included: true }
        ],
        badge: 'creator',
        popular: true,
        premium: false
    },

    BUSINESS: {
        id: 'business',
        name: 'Business',
        subtitle: 'Potencia tu negocio en Web3',
        icon: Building2,
        color: 'from-purple-500 to-pink-500',
        borderColor: 'border-purple-500/50',
        bgGlow: 'hover:shadow-purple-500/30',
        price: {
            monthly: 99.99,
            yearly: 999.99,
            bez: 2000
        },
        tokenLock: {
            amount: 25000,
            days: 120,
            description: 'Bloquea 25,000 BEZ por 120 días'
        },
        staking: {
            baseAPY: 12.5,
            multiplier: 2.0,
            effectiveAPY: 25.0
        },
        gasSubsidy: 50,
        aiCredits: {
            daily: 200,
            premium: true
        },
        benefits: [
            { text: 'Todo lo del plan Creator', included: true },
            { text: '200 consultas AI por día', included: true },
            { text: '2x multiplicador staking (25% APY)', included: true },
            { text: '50% subsidio en gas fees', included: true },
            { text: '15% descuento en compras', included: true },
            { text: '25% descuento en envíos', included: true },
            { text: 'Badge NFT Business', included: true },
            { text: 'Soporte 24/7 dedicado', included: true },
            { text: '10% bonus en BEZ-Coin rewards', included: true },
            { text: 'Acceso a eventos Business', included: true },
            { text: 'Analytics avanzados', included: true },
            { text: '🔥 Real Yield LP Rewards (+8% APY extra)', included: true },
            { text: '⚡ Quality Oracle validación inmediata 12h', included: true },
            { text: '💧 LP Pool Premium + x0.3 multiplicador Treasury', included: true },
            { text: '🏦 Acceso DeFi Hub Business Features', included: true }
        ],
        badge: 'business',
        popular: false,
        premium: false
    },

    ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise VIP',
        subtitle: 'Máximo poder y exclusividad',
        icon: Crown,
        color: 'from-amber-400 to-yellow-500',
        borderColor: 'border-amber-400/50',
        bgGlow: 'hover:shadow-amber-400/40',
        price: {
            monthly: 299.99,
            yearly: 2999.99,
            bez: 6000
        },
        tokenLock: {
            amount: 100000,
            days: 180,
            description: 'Bloquea 100,000 BEZ por 180 días'
        },
        staking: {
            baseAPY: 12.5,
            multiplier: 2.5,
            effectiveAPY: 31.25
        },
        gasSubsidy: 100,
        aiCredits: {
            daily: Infinity,
            premium: true
        },
        benefits: [
            { text: 'Todo lo del plan Business', included: true },
            { text: 'Consultas AI ilimitadas', included: true },
            { text: '2.5x multiplicador staking (31.25% APY)', included: true },
            { text: '100% subsidio en gas (GRATIS)', included: true },
            { text: '25% descuento en compras', included: true },
            { text: '50% descuento en envíos', included: true },
            { text: 'Badge NFT Enterprise exclusivo', included: true },
            { text: 'Concierge Web3 personal 24/7', included: true },
            { text: '20% bonus en BEZ-Coin rewards', included: true },
            { text: 'Acceso a DAO Council', included: true },
            { text: 'Fee cero en transacciones', included: true },
            { text: 'Early access a nuevos features', included: true },
            { text: 'Personal shopper dedicado', included: true },
            { text: 'Eventos VIP exclusivos', included: true },
            { text: '🔥 Real Yield LP Rewards (+12% APY máximo)', included: true },
            { text: '⚡ Quality Oracle validación VIP instantánea', included: true },
            { text: '💧 LP Pool Elite + x0.5 multiplicador Treasury', included: true },
            { text: '🏦 DeFi Hub acceso completo + Analytics Pro', included: true },
            { text: '🎯 Participación directa en Treasury DAO', included: true },
            { text: '💎 Acceso prioritario a RWA tokenization', included: true }
        ],
        badge: 'enterprise',
        popular: false,
        premium: true
    }
};

// ============================================
// COMPONENTE: TIER CARD UNIFICADA
// ============================================
const UnifiedTierCard = ({ tier, currentTier, onSubscribe, onTokenLock, isConnected }) => {
    const [paymentMethod, setPaymentMethod] = useState('fiat');
    const Icon = tier.icon;
    const isCurrentTier = currentTier === tier.id;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5, scale: 1.02 }}
            className={`relative rounded-2xl border-2 ${tier.borderColor} bg-gray-900/80 backdrop-blur-sm overflow-hidden transition-all duration-300 ${tier.bgGlow} hover:shadow-2xl ${tier.premium ? 'ring-2 ring-amber-400/50' : ''}`}
        >
            {tier.popular && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                    Más Popular
                </div>
            )}
            {tier.premium && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-xs font-bold px-4 py-1 rounded-bl-lg flex items-center gap-1">
                    <Gem className="w-3 h-3" /> Premium
                </div>
            )}

            <div className={`bg-gradient-to-r ${tier.color} p-6`}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                        <p className="text-white/80 text-sm">{tier.subtitle}</p>
                    </div>
                </div>
            </div>

            <div className="p-6 border-b border-gray-700/50">
                {tier.price.monthly > 0 && (
                    <div className="flex gap-1 p-1 bg-gray-800 rounded-lg mb-4">
                        <button
                            onClick={() => setPaymentMethod('fiat')}
                            className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${paymentMethod === 'fiat'
                                ? 'bg-white text-gray-900'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <CreditCard className="w-3 h-3 inline mr-1" />
                            USD
                        </button>
                        <button
                            onClick={() => setPaymentMethod('bez')}
                            className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${paymentMethod === 'bez'
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Coins className="w-3 h-3 inline mr-1" />
                            BEZ
                        </button>
                        <button
                            onClick={() => setPaymentMethod('bank')}
                            className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${paymentMethod === 'bank'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Banknote className="w-3 h-3 inline mr-1" />
                            Banco
                        </button>
                        {tier.tokenLock && (
                            <button
                                onClick={() => setPaymentMethod('lock')}
                                className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${paymentMethod === 'lock'
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                <Lock className="w-3 h-3 inline mr-1" />
                                Lock
                            </button>
                        )}
                    </div>
                )}

                <div className="text-center">
                    {paymentMethod === 'fiat' && (
                        <>
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-4xl font-bold text-white">
                                    {tier.price.monthly === 0 ? 'Gratis' : `$${tier.price.monthly}`}
                                </span>
                                {tier.price.monthly > 0 && (
                                    <span className="text-gray-400">/mes</span>
                                )}
                            </div>
                            {tier.price.yearly > 0 && (
                                <p className="text-sm text-gray-500 mt-1">
                                    ${tier.price.yearly}/año (ahorra 17%)
                                </p>
                            )}
                        </>
                    )}

                    {paymentMethod === 'bez' && (
                        <div className="flex items-baseline justify-center gap-1">
                            <Coins className="w-6 h-6 text-purple-400" />
                            <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                                {tier.price.bez.toLocaleString()}
                            </span>
                            <span className="text-gray-400">BEZ/mes</span>
                        </div>
                    )}

                    {paymentMethod === 'lock' && tier.tokenLock && (
                        <>
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Lock className="w-5 h-5 text-green-400" />
                                <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                                    {tier.tokenLock.amount.toLocaleString()} BEZ
                                </span>
                            </div>
                            <p className="text-sm text-green-400/80">
                                Bloquear por {tier.tokenLock.days} días = Acceso GRATIS
                            </p>
                        </>
                    )}

                    {paymentMethod === 'bank' && (
                        <>
                            <div className="flex items-baseline justify-center gap-1">
                                <Banknote className="w-6 h-6 text-amber-400" />
                                <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                                    €{(tier.price.monthly * 0.92).toFixed(2)}
                                </span>
                                <span className="text-gray-400">/mes</span>
                            </div>
                            <p className="text-sm text-amber-400/80 mt-1">
                                Transferencia bancaria SEPA
                            </p>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-800/30">
                <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-lg font-bold text-green-400">{tier.staking.effectiveAPY}%</span>
                    </div>
                    <p className="text-xs text-gray-500">APY Efectivo</p>
                </div>
                <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="text-lg font-bold text-yellow-400">{tier.staking.multiplier}x</span>
                    </div>
                    <p className="text-xs text-gray-500">Multiplicador</p>
                </div>
                <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Fuel className="w-4 h-4 text-blue-400" />
                        <span className="text-lg font-bold text-blue-400">
                            {tier.gasSubsidy === 100 ? 'GRATIS' : `${tier.gasSubsidy}%`}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500">Subsidio Gas</p>
                </div>
                <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Bot className="w-4 h-4 text-purple-400" />
                        <span className="text-lg font-bold text-purple-400">
                            {tier.aiCredits.daily === Infinity ? '∞' : tier.aiCredits.daily}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500">AI/día</p>
                </div>
            </div>

            <div className="p-6 space-y-3 max-h-64 overflow-y-auto">
                {tier.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                        {benefit.included ? (
                            <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-600 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${benefit.included ? 'text-gray-300' : 'text-gray-600'}`}>
                            {benefit.text}
                        </span>
                    </div>
                ))}
            </div>

            <div className="p-6 pt-0">
                {isCurrentTier ? (
                    <button
                        disabled
                        className="w-full py-3 px-4 rounded-xl bg-gray-700 text-gray-400 font-medium flex items-center justify-center gap-2"
                    >
                        <Check className="w-5 h-5" />
                        Plan Actual
                    </button>
                ) : tier.price.monthly === 0 ? (
                    <button
                        disabled
                        className="w-full py-3 px-4 rounded-xl bg-gray-700 text-gray-400 font-medium"
                    >
                        Plan Base
                    </button>
                ) : (
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                            if (!isConnected) {
                                toast.error('Conecta tu wallet primero');
                                return;
                            }
                            if (paymentMethod === 'lock' && tier.tokenLock) {
                                onTokenLock(tier.id, tier.tokenLock);
                            } else {
                                onSubscribe(tier.id, paymentMethod);
                            }
                        }}
                        className={`w-full py-3 px-4 rounded-xl bg-gradient-to-r ${tier.color} text-white font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all`}
                    >
                        {paymentMethod === 'lock' ? (
                            <>
                                <Lock className="w-5 h-5" />
                                Bloquear Tokens
                            </>
                        ) : (
                            <>
                                <Rocket className="w-5 h-5" />
                                {paymentMethod === 'bez' ? 'Pagar con BEZ' : 'Suscribirse'}
                            </>
                        )}
                    </motion.button>
                )}
            </div>
        </motion.div>
    );
};

// ============================================
// COMPONENTE: COMPARATIVA RÁPIDA
// ============================================
const QuickComparisonTable = () => {
    const tiers = Object.values(UNIFIED_VIP_TIERS);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-700">
                        <th className="text-left py-4 px-4 text-gray-400 font-medium">Característica</th>
                        {tiers.map(tier => (
                            <th key={tier.id} className="text-center py-4 px-4">
                                <span className={`font-bold bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>
                                    {tier.name}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    <tr>
                        <td className="py-3 px-4 text-gray-300">Precio Mensual</td>
                        {tiers.map(tier => (
                            <td key={tier.id} className="text-center py-3 px-4 text-white font-medium">
                                {tier.price.monthly === 0 ? 'Gratis' : `$${tier.price.monthly}`}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td className="py-3 px-4 text-gray-300">APY Staking</td>
                        {tiers.map(tier => (
                            <td key={tier.id} className="text-center py-3 px-4 text-green-400 font-medium">
                                {tier.staking.effectiveAPY}%
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td className="py-3 px-4 text-gray-300">Multiplicador</td>
                        {tiers.map(tier => (
                            <td key={tier.id} className="text-center py-3 px-4 text-yellow-400 font-medium">
                                {tier.staking.multiplier}x
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td className="py-3 px-4 text-gray-300">Subsidio Gas</td>
                        {tiers.map(tier => (
                            <td key={tier.id} className="text-center py-3 px-4 text-blue-400 font-medium">
                                {tier.gasSubsidy}%
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td className="py-3 px-4 text-gray-300">Consultas AI/día</td>
                        {tiers.map(tier => (
                            <td key={tier.id} className="text-center py-3 px-4 text-purple-400 font-medium">
                                {tier.aiCredits.daily === Infinity ? '∞' : tier.aiCredits.daily}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td className="py-3 px-4 text-gray-300">Token Lock Alternativo</td>
                        {tiers.map(tier => (
                            <td key={tier.id} className="text-center py-3 px-4 text-gray-400 text-xs">
                                {tier.tokenLock ? `${tier.tokenLock.amount.toLocaleString()} BEZ / ${tier.tokenLock.days}d` : '-'}
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

// ============================================
// COMPONENTE: RECOMENDACIÓN INTELIGENTE
// ============================================
const SmartRecommendation = ({ bezBalance, monthlyActivity }) => {
    const getRecommendation = () => {
        if (bezBalance >= 100000) {
            return {
                tier: 'ENTERPRISE',
                reason: 'Con tu balance de BEZ, puedes bloquear tokens y acceder al tier Enterprise GRATIS, obteniendo 31.25% APY y gas subsidiado al 100%.',
                savings: '$299.99/mes'
            };
        } else if (bezBalance >= 25000) {
            return {
                tier: 'BUSINESS',
                reason: 'Tu balance te permite bloquear tokens para el tier Business, con 25% APY y 50% de subsidio en gas.',
                savings: '$99.99/mes'
            };
        } else if (bezBalance >= 5000) {
            return {
                tier: 'CREATOR',
                reason: 'Puedes bloquear 5,000 BEZ por 90 días y acceder a Creator Pro gratis, con 18.75% APY.',
                savings: '$19.99/mes'
            };
        } else if (monthlyActivity > 50) {
            return {
                tier: 'CREATOR',
                reason: 'Tu nivel de actividad sugiere que Creator Pro te daría el mejor ROI con 50 consultas AI/día y mejor APY.',
                savings: null
            };
        }
        return {
            tier: 'STARTER',
            reason: 'El plan Starter es perfecto para comenzar. Acumula BEZ para desbloquear beneficios premium.',
            savings: null
        };
    };

    const rec = getRecommendation();
    const tier = UNIFIED_VIP_TIERS[rec.tier];
    const Icon = tier.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-2xl border-2 ${tier.borderColor} bg-gradient-to-r ${tier.color}/10 backdrop-blur-sm`}
        >
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-r ${tier.color}`}>
                    <Icon className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-yellow-400" />
                        <h3 className="text-lg font-bold text-white">Recomendado para ti: {tier.name}</h3>
                    </div>
                    <p className="text-gray-300 mb-3">{rec.reason}</p>
                    {rec.savings && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 rounded-full">
                            <Gift className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 text-sm font-medium">Ahorra {rec.savings}</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// ============================================
// PÁGINA PRINCIPAL: BeVIP UNIFICADA
// ============================================
const BeVIP = () => {
    const { address, isConnected } = useAccount();
    const { data: balance } = useBalance({ address });
    const [currentTier, setCurrentTier] = useState('STARTER');
    const [showCalculator, setShowCalculator] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [selectedTierForBank, setSelectedTierForBank] = useState(null);
    const [bankDetails, setBankDetails] = useState(null);
    const [bezBalance, setBezBalance] = useState(15000);
    const [processingTier, setProcessingTier] = useState(null);

    // ── On-chain Token Lock via Wagmi ─────────────────────────────────────────
    const BEZ_TOKEN = '0x89c23890c742d710265dd61be789c71dc8999b12';
    // Staking/Lock contract — For now we use Treasury DAO. Replace with
    // dedicated VIP Lock contract address once deployed.
    const LOCK_CONTRACT = '0x89c23890c742d710265dd61be789c71dc8999b12';
    const ERC20_ABI = [
        {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }],
            outputs: [{ name: '', type: 'bool' }]
        }
    ];

    const { writeContract: sendLockTx, data: lockTxHash, isPending: isLockPending } = useWriteContract();
    const { isLoading: isLockConfirming, isSuccess: isLockSuccess } = useWaitForTransactionReceipt({
        hash: lockTxHash,
        chainId: 137,
        onSuccess: () => {
            toast.success('🔐 Tokens bloqueados on-chain! Tu acceso VIP se activará en breve.', { duration: 6000 });
            setProcessingTier(null);
        }
    });

    // Cargar estado VIP al inicio
    useEffect(() => {
        const loadVIPStatus = async () => {
            try {
                const status = await vipService.getVIPStatus();
                if (status.tier) {
                    setCurrentTier(status.tier.toUpperCase());
                }
            } catch (error) {
                console.log('User not logged in or no VIP status');
            }
        };
        if (isConnected) {
            loadVIPStatus();
        }
    }, [isConnected]);

    const handleSubscribe = async (tierId, paymentMethod) => {
        if (!isConnected) {
            toast.error('Conecta tu wallet primero');
            return;
        }

        setProcessingTier(tierId);
        try {
            if (paymentMethod === 'fiat') {
                // Pago con Stripe (tarjeta de crédito)
                toast.loading('Redirigiendo a Stripe...', { id: 'subscribe' });
                await vipService.createVIPSubscriptionSession(
                    tierId,
                    'monthly',
                    '', // email opcional
                    address
                );
                // La redirección a Stripe ocurre en el servicio
            } else if (paymentMethod === 'bez') {
                // Pago con tokens BEZ
                toast.loading('Procesando pago con BEZ...', { id: 'subscribe' });
                const tier = UNIFIED_VIP_TIERS[tierId.toUpperCase()];
                await vipService.createCryptoPayment(tier.price.bez, address, tierId);
                toast.success(`¡Suscripción ${tierId} activada con BEZ!`, { id: 'subscribe' });
            } else if (paymentMethod === 'bank') {
                // Mostrar modal de transferencia bancaria
                setSelectedTierForBank(tierId);
                try {
                    const details = await vipService.getBankDetails();
                    setBankDetails(details.bankDetails);
                } catch (e) {
                    // Usar fallback
                    setBankDetails({
                        accountHolder: 'BeZhas Technology SL',
                        iban: 'ES77 1465 0100 91 1766376210',
                        bic: 'INGDESMMXXX',
                        bank: 'ING Direct'
                    });
                }
                setShowBankModal(true);
                toast.dismiss('subscribe');
            }
        } catch (error) {
            console.error('Subscription error:', error);
            toast.error(error.response?.data?.message || 'Error al procesar la suscripción', { id: 'subscribe' });
        } finally {
            setProcessingTier(null);
        }
    };

    const handleTokenLock = async (tierId, lockConfig) => {
        if (!isConnected || !address) {
            toast.error('Conecta tu wallet primero');
            return;
        }

        const lockAmount = lockConfig?.amount || 0;
        if (!lockAmount || lockAmount <= 0) {
            toast.error('Cantidad de tokens inválida');
            return;
        }

        setProcessingTier(tierId);
        try {
            toast.loading(`Iniciando bloqueo de ${lockAmount.toLocaleString()} BEZ...`, { id: 'lock' });
            sendLockTx({
                address: BEZ_TOKEN,
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [LOCK_CONTRACT, parseUnits(lockAmount.toString(), 18)],
                chainId: 137,
            });
            toast.dismiss('lock');
        } catch (error) {
            console.error('Token lock error:', error);
            toast.error('Error al bloquear tokens. Verifica tu saldo y conexión.', { id: 'lock' });
            setProcessingTier(null);
        }
    };


    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Copiado al portapapeles');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* GLOBAL STATS BAR */}
            <GlobalStatsBar />

            <main className="container mx-auto px-4 py-8">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-full border border-amber-500/30 mb-6">
                        <Crown className="w-5 h-5 text-amber-400" />
                        <span className="text-amber-400 font-medium">BeZhas VIP Experience</span>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        <span className="text-white">Potencia tu </span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400">
                            Experiencia Web3
                        </span>
                    </h1>

                    <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
                        Elige tu plan VIP y desbloquea multiplicadores de staking, subsidios de gas,
                        acceso premium a IA y beneficios exclusivos. Paga con USD, BEZ, o bloquea tokens
                        para acceso gratuito.
                    </p>

                    {/* Quick Stats */}
                    <div className="flex flex-wrap justify-center gap-6 mb-8">
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-green-400" />
                            <span className="text-white">Hasta <strong className="text-green-400">31.25% APY</strong></span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg">
                            <Fuel className="w-5 h-5 text-blue-400" />
                            <span className="text-white">Hasta <strong className="text-blue-400">100% Gas Gratis</strong></span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg">
                            <Bot className="w-5 h-5 text-purple-400" />
                            <span className="text-white">Hasta <strong className="text-purple-400">∞ AI Queries</strong></span>
                        </div>
                    </div>
                </motion.div>

                {/* Smart Recommendation */}
                <div className="mb-12 max-w-4xl mx-auto">
                    <SmartRecommendation bezBalance={bezBalance} monthlyActivity={30} />
                </div>

                {/* Tier Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
                    {Object.values(UNIFIED_VIP_TIERS).map((tier, index) => (
                        <motion.div
                            key={tier.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <UnifiedTierCard
                                tier={tier}
                                currentTier={currentTier}
                                onSubscribe={handleSubscribe}
                                onTokenLock={handleTokenLock}
                                isConnected={isConnected}
                            />
                        </motion.div>
                    ))}
                </div>

                {/* Comparison Table Toggle */}
                <div className="mb-12 max-w-4xl mx-auto">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCalculator(!showCalculator)}
                        className="w-full py-4 px-6 rounded-xl bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-all flex items-center justify-center gap-3"
                    >
                        <Calculator className="w-5 h-5 text-purple-400" />
                        <span className="text-white font-medium">
                            {showCalculator ? 'Ocultar' : 'Mostrar'} Calculadora de ROI y Comparativa
                        </span>
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showCalculator ? 'rotate-180' : ''}`} />
                    </motion.button>
                </div>

                {/* Expandable Section: Calculator + Comparison */}
                <AnimatePresence>
                    {showCalculator && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-8 mb-12 max-w-5xl mx-auto"
                        >
                            {/* Comparison Table */}
                            <div className="bg-gray-800/30 rounded-2xl border border-gray-700 p-6">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <Info className="w-5 h-5 text-blue-400" />
                                    Comparativa de Planes
                                </h3>
                                <QuickComparisonTable />
                            </div>

                            {/* ROI Calculator */}
                            <div className="bg-gray-800/30 rounded-2xl border border-gray-700 p-6">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <Calculator className="w-5 h-5 text-purple-400" />
                                    Calculadora de ROI
                                </h3>
                                <ROICalculator />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* FAQ / Additional Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-gray-800/30 rounded-xl border border-gray-700"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <Lock className="w-5 h-5 text-green-400" />
                            </div>
                            <h4 className="text-lg font-bold text-white">Token Lock</h4>
                        </div>
                        <p className="text-gray-400 text-sm">
                            Bloquea BEZ tokens por un período definido y accede a tu tier preferido
                            sin pagar mensualidades. Tus tokens generan staking rewards mientras están bloqueados.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="p-6 bg-gray-800/30 rounded-xl border border-gray-700"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Bot className="w-5 h-5 text-purple-400" />
                            </div>
                            <h4 className="text-lg font-bold text-white">AI Premium</h4>
                        </div>
                        <p className="text-gray-400 text-sm">
                            Accede a modelos avanzados de IA (GPT-4, Gemini Pro) para análisis de contenido,
                            moderación automática y asistencia personalizada según tu nivel.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="p-6 bg-gray-800/30 rounded-xl border border-gray-700"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Fuel className="w-5 h-5 text-blue-400" />
                            </div>
                            <h4 className="text-lg font-bold text-white">Gas Subsidies</h4>
                        </div>
                        <p className="text-gray-400 text-sm">
                            BeZhas cubre parte o la totalidad de tus costos de gas en Polygon.
                            Los usuarios Enterprise nunca pagan gas en transacciones de la plataforma.
                        </p>
                    </motion.div>
                </div>

                {/* CTA Final */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center p-8 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 rounded-2xl border border-amber-500/20 max-w-4xl mx-auto"
                >
                    <Crown className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white mb-2">¿Listo para potenciar tu experiencia?</h3>
                    <p className="text-gray-400 mb-6">
                        Únete a miles de usuarios que ya disfrutan de beneficios VIP en BeZhas
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                const creatorCard = document.getElementById('creator');
                                creatorCard?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-8 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-bold rounded-xl shadow-lg hover:shadow-amber-500/30 transition-all"
                        >
                            Comenzar Ahora
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowCalculator(true)}
                            className="px-8 py-3 bg-gray-800 text-white font-medium rounded-xl border border-gray-600 hover:border-gray-500 transition-all"
                        >
                            Calcular mi ROI
                        </motion.button>
                    </div>
                </motion.div>

                {/* Inversión Privada Section */}
                <div className="mt-24 mb-12">
                    <div className="flex items-center justify-center gap-4 mb-12 opacity-50">
                        <div className="h-[1px] w-24 bg-gradient-to-r from-transparent to-gray-500"></div>
                        <span className="text-gray-500 text-sm uppercase tracking-widest font-semibold">Oportunidades Exclusivas</span>
                        <div className="h-[1px] w-24 bg-gradient-to-l from-transparent to-gray-500"></div>
                    </div>

                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-tr from-blue-400 via-indigo-500 to-purple-500 mb-6">
                            Inversión Privada & Institucional
                        </h2>
                        <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                            ¿Buscas realizar una inversión estratégica de alto volumen o participar como socio institucional?
                            Completa nuestro formulario de acceso prioritario.
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto">
                        <div className="relative group rounded-3xl p-1 bg-gradient-to-b from-gray-700 to-gray-900 shadow-2xl">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                            <div className="relative bg-gray-900 rounded-2xl overflow-hidden min-h-[800px] border border-gray-800">
                                <iframe
                                    src="https://docs.google.com/forms/d/e/1FAIpQLSfcTqm0Y5keLIDozvuTaI9sXQJAG3HUyZPzl08ld9nze16v3g/viewform?embedded=true"
                                    width="100%"
                                    height="100%"
                                    className="w-full h-full absolute inset-0 border-0"
                                    title="Formulario de Inversión Privada BeZhas"
                                >
                                    Cargando formulario...
                                </iframe>
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                            <Shield className="w-4 h-4 text-green-500" />
                            <span>Sus datos están protegidos bajo normas Web3.</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal de Transferencia Bancaria */}
            <AnimatePresence>
                {showBankModal && bankDetails && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowBankModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full p-6"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/20 rounded-lg">
                                        <Banknote className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Transferencia Bancaria</h3>
                                        <p className="text-gray-400 text-sm">Plan {selectedTierForBank}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowBankModal(false)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div className="p-4 bg-gray-800/50 rounded-xl space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">Titular</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-medium">{bankDetails.accountHolder}</span>
                                            <button onClick={() => copyToClipboard(bankDetails.accountHolder)} className="text-gray-400 hover:text-white">
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">IBAN</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-mono font-medium">{bankDetails.iban}</span>
                                            <button onClick={() => copyToClipboard(bankDetails.iban.replace(/\s/g, ''))} className="text-gray-400 hover:text-white">
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">BIC/SWIFT</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-mono font-medium">{bankDetails.bic}</span>
                                            <button onClick={() => copyToClipboard(bankDetails.bic)} className="text-gray-400 hover:text-white">
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">Banco</span>
                                        <span className="text-white font-medium">{bankDetails.bank}</span>
                                    </div>
                                </div>

                                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-amber-400 text-sm font-medium">Concepto (IMPORTANTE)</span>
                                        <button onClick={() => copyToClipboard(`VIP-${selectedTierForBank}-${address?.slice(0, 8)}`)} className="text-amber-400 hover:text-amber-300">
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-white font-mono text-lg">
                                        VIP-{selectedTierForBank}-{address?.slice(0, 8)}
                                    </p>
                                    <p className="text-amber-400/70 text-xs mt-2">
                                        Incluye este concepto exacto para identificar tu pago
                                    </p>
                                </div>

                                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                                    <div className="flex justify-between items-center">
                                        <span className="text-green-400 text-sm font-medium">Importe a transferir</span>
                                        <span className="text-2xl font-bold text-green-400">
                                            €{selectedTierForBank && UNIFIED_VIP_TIERS[selectedTierForBank.toUpperCase()]
                                                ? (UNIFIED_VIP_TIERS[selectedTierForBank.toUpperCase()].price.monthly * 0.92).toFixed(2)
                                                : '0.00'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center">
                                <p className="text-gray-400 text-sm mb-4">
                                    Una vez realizada la transferencia, tu suscripción se activará en 24-48h hábiles.
                                </p>
                                <button
                                    onClick={() => setShowBankModal(false)}
                                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all"
                                >
                                    Entendido
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BeVIP;
