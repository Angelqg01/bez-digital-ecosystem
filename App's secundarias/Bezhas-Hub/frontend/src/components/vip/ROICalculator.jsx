/**
 * ============================================================================
 * ROI CALCULATOR COMPONENT
 * ============================================================================
 * 
 * Calculadora interactiva de ROI que compara:
 * - Ganancias de staking por tier
 * - Costos de suscripción
 * - Ahorro en gas
 * - Beneficio neto
 * 
 * @version 2.0.0
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calculator,
    TrendingUp,
    Zap,
    DollarSign,
    Info,
    Check,
    ArrowRight,
    Sparkles,
    ChevronDown,
    Wallet
} from 'lucide-react';

import {
    SUBSCRIPTION_TIERS,
    TIER_HIERARCHY,
    BASE_STAKING_APY,
    BEZ_TO_USD_RATE,
    calculatePotentialROI,
    compareROIAcrossTiers,
    getTierConfig
} from '../../config/tier.config';

/**
 * Formateador de números
 */
const formatNumber = (num, decimals = 2) => {
    if (num === Infinity) return '∞';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(decimals);
};

/**
 * Formateador de moneda
 */
const formatCurrency = (amount, currency = 'USD') => {
    if (currency === 'BEZ') {
        return `${formatNumber(amount)} BEZ`;
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
};

/**
 * Slider de cantidad de stake
 */
const StakeAmountSlider = ({ value, onChange, max = 100000 }) => {
    const presets = [1000, 5000, 10000, 25000, 50000, 100000];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cantidad a stakear
                </label>
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {formatNumber(value, 0)} BEZ
                </span>
            </div>

            <input
                type="range"
                min="100"
                max={max}
                step="100"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600
          dark:bg-gray-700"
            />

            <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                    <button
                        key={preset}
                        onClick={() => onChange(preset)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-all
              ${value === preset
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                    >
                        {formatNumber(preset, 0)}
                    </button>
                ))}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
                ≈ {formatCurrency(value * BEZ_TO_USD_RATE)}
            </p>
        </div>
    );
};

/**
 * Selector de duración
 */
const DurationSelector = ({ value, onChange }) => {
    const options = [
        { value: 3, label: '3 meses' },
        { value: 6, label: '6 meses' },
        { value: 12, label: '1 año' },
        { value: 24, label: '2 años' }
    ];

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Período de inversión
            </label>
            <div className="grid grid-cols-4 gap-2">
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all
              ${value === opt.value
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

/**
 * Tarjeta de resultado por tier
 */
const TierResultCard = ({ tierKey, roi, isRecommended, isSelected, onClick }) => {
    const config = getTierConfig(tierKey);

    return (
        <motion.div
            layout
            onClick={onClick}
            className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all
        ${isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 bg-white hover:border-purple-200 dark:border-gray-700 dark:bg-gray-800'
                }
        ${isRecommended ? 'ring-2 ring-purple-400 ring-offset-2' : ''}
      `}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
            {isRecommended && (
                <span className="absolute -top-2 left-4 px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">
                    Recomendado
                </span>
            )}

            <div className="flex items-center justify-between mb-3">
                <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">{config.displayName}</h4>
                    <p className="text-sm text-gray-500">{config.price.monthly > 0 ? formatCurrency(config.price.monthly) + '/mes' : 'Gratis'}</p>
                </div>
                <div className={`p-2 rounded-full bg-gradient-to-r ${config.ui.gradient}`}>
                    <TrendingUp className="w-5 h-5 text-white" />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">APY Efectivo</span>
                    <span className="font-bold text-green-600">{roi.effectiveAPY}%</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Ganancia Staking</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                        +{formatNumber(roi.periodStakingReward)} BEZ
                    </span>
                </div>

                {roi.totalSubscriptionCost > 0 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Costo Suscripción</span>
                        <span className="font-medium text-red-500">
                            -{formatCurrency(roi.totalSubscriptionCost)}
                        </span>
                    </div>
                )}

                {roi.gasSavingsUSD > 0 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Ahorro Gas</span>
                        <span className="font-medium text-blue-600">
                            +{formatCurrency(roi.gasSavingsUSD)}
                        </span>
                    </div>
                )}

                <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Beneficio Neto</span>
                        <span className={`text-lg font-bold ${roi.isProfitable ? 'text-green-600' : 'text-red-500'}`}>
                            {roi.isProfitable ? '+' : ''}{formatNumber(roi.netProfitBEZ)} BEZ
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 text-right">
                        ≈ {formatCurrency(roi.netProfitUSD)}
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

/**
 * Alternativa Token Lock
 */
const TokenLockAlternative = ({ tierKey }) => {
    const config = getTierConfig(tierKey);

    if (config.tokenLock.amount === 0) return null;

    return (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
                <Wallet className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Alternativa: Token Lock
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                        Bloquea {formatNumber(config.tokenLock.amount, 0)} BEZ por {config.tokenLock.durationDays} días
                        para acceder a este tier sin pagar suscripción mensual.
                    </p>
                </div>
            </div>
        </div>
    );
};

/**
 * Gráfico de comparación visual
 */
const ComparisonChart = ({ comparison }) => {
    const maxProfit = Math.max(
        ...Object.values(comparison).map(r => Math.max(r.periodStakingReward, 0))
    );

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Comparativa de Ganancias
            </h4>

            {TIER_HIERARCHY.map((tierKey) => {
                const roi = comparison[tierKey];
                const config = getTierConfig(tierKey);
                const barWidth = maxProfit > 0 ? (roi.periodStakingReward / maxProfit) * 100 : 0;

                return (
                    <div key={tierKey} className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="font-medium text-gray-600 dark:text-gray-400">
                                {config.displayName}
                            </span>
                            <span className="text-gray-900 dark:text-white">
                                +{formatNumber(roi.periodStakingReward)} BEZ
                            </span>
                        </div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <motion.div
                                className={`h-full bg-gradient-to-r ${config.ui.gradient}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${barWidth}%` }}
                                transition={{ duration: 0.5, delay: TIER_HIERARCHY.indexOf(tierKey) * 0.1 }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/**
 * Breakdown detallado
 */
const DetailedBreakdown = ({ roi, tierKey }) => {
    const [isOpen, setIsOpen] = useState(false);
    const config = getTierConfig(tierKey);

    return (
        <div className="mt-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400"
            >
                <Info className="w-4 h-4" />
                Ver desglose detallado
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">APY Base</span>
                                    <p className="font-medium">{BASE_STAKING_APY}%</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">Multiplicador</span>
                                    <p className="font-medium">{config.staking.multiplier}x</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">APY Efectivo</span>
                                    <p className="font-medium text-green-600">{roi.effectiveAPY}%</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">Subsidio Gas</span>
                                    <p className="font-medium">{config.gas.subsidyPercent * 100}%</p>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                                <h5 className="text-xs font-medium text-gray-500 mb-2">CÁLCULO</h5>
                                <div className="space-y-1 text-xs font-mono">
                                    <p>Staking: {roi.stakeAmount} × {roi.effectiveAPY}% × ({roi.durationMonths}/12) = <span className="text-green-600">+{formatNumber(roi.periodStakingReward)} BEZ</span></p>
                                    <p>Suscripción: {roi.monthlySubscriptionCost} × {roi.durationMonths} = <span className="text-red-500">-{formatCurrency(roi.totalSubscriptionCost)}</span></p>
                                    <p>Gas Ahorro: ≈ <span className="text-blue-600">+{formatCurrency(roi.gasSavingsUSD)}</span></p>
                                    <p className="pt-1 border-t font-bold">
                                        Neto: <span className={roi.isProfitable ? 'text-green-600' : 'text-red-500'}>
                                            {formatNumber(roi.netProfitBEZ)} BEZ ({formatCurrency(roi.netProfitUSD)})
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {roi.breakEvenStake > 0 && (
                                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                                    <p className="text-xs text-gray-500">
                                        <span className="font-medium">Break-even:</span> Para que este tier sea rentable,
                                        necesitas stakear al menos <span className="font-bold">{formatNumber(roi.breakEvenStake, 0)} BEZ</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * Main ROI Calculator Component
 */
const ROICalculator = ({
    initialStakeAmount = 10000,
    initialDuration = 12,
    onSelectTier,
    className = ''
}) => {
    const [stakeAmount, setStakeAmount] = useState(initialStakeAmount);
    const [duration, setDuration] = useState(initialDuration);
    const [selectedTier, setSelectedTier] = useState('STARTER');

    // Calcular comparativa
    const comparisonData = useMemo(() => {
        return compareROIAcrossTiers(stakeAmount, duration);
    }, [stakeAmount, duration]);

    // Manejar selección de tier
    const handleSelectTier = useCallback((tierKey) => {
        setSelectedTier(tierKey);
        if (onSelectTier) {
            onSelectTier(tierKey, comparisonData.comparison[tierKey]);
        }
    }, [onSelectTier, comparisonData]);

    return (
        <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                    <Calculator className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Calculadora de ROI
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Compara ganancias según tu tier de suscripción
                    </p>
                </div>
            </div>

            {/* Inputs */}
            <div className="space-y-6 mb-8">
                <StakeAmountSlider
                    value={stakeAmount}
                    onChange={setStakeAmount}
                />

                <DurationSelector
                    value={duration}
                    onChange={setDuration}
                />
            </div>

            {/* Comparison Chart */}
            <div className="mb-8">
                <ComparisonChart comparison={comparisonData.comparison} />
            </div>

            {/* Tier Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {TIER_HIERARCHY.map((tierKey) => (
                    <TierResultCard
                        key={tierKey}
                        tierKey={tierKey}
                        roi={comparisonData.comparison[tierKey]}
                        isRecommended={tierKey === comparisonData.recommendation.tier}
                        isSelected={tierKey === selectedTier}
                        onClick={() => handleSelectTier(tierKey)}
                    />
                ))}
            </div>

            {/* Token Lock Alternative */}
            <TokenLockAlternative tierKey={selectedTier} />

            {/* Detailed Breakdown */}
            <DetailedBreakdown
                roi={comparisonData.comparison[selectedTier]}
                tierKey={selectedTier}
            />

            {/* Recommendation */}
            <motion.div
                className="mt-6 p-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={comparisonData.recommendation.tier}
            >
                <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6" />
                    <div>
                        <h4 className="font-bold">Recomendación: {getTierConfig(comparisonData.recommendation.tier).displayName}</h4>
                        <p className="text-sm text-purple-100">{comparisonData.recommendation.reason}</p>
                    </div>
                </div>

                {onSelectTier && selectedTier !== comparisonData.recommendation.tier && (
                    <button
                        onClick={() => handleSelectTier(comparisonData.recommendation.tier)}
                        className="mt-3 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                    >
                        Seleccionar tier recomendado
                    </button>
                )}
            </motion.div>

            {/* CTA */}
            {onSelectTier && (
                <motion.button
                    onClick={() => onSelectTier(selectedTier, comparisonData.comparison[selectedTier])}
                    className="mt-6 w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl
            hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    Continuar con {getTierConfig(selectedTier).displayName}
                    <ArrowRight className="w-5 h-5" />
                </motion.button>
            )}
        </div>
    );
};

export default ROICalculator;
