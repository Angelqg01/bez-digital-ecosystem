import React from 'react';
import { TrendingUp, Calendar, Coins, Zap, Award, Target } from 'lucide-react';

export default function EarningsDisplay({ earnings, userData }) {
    const formatNumber = (num) => {
        return new Intl.NumberFormat('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    const getVIPName = (tier) => {
        const names = {
            0: 'Estándar',
            1: 'VIP Bronze',
            3: 'VIP Silver',
            6: 'VIP Gold',
            9: 'VIP Diamond'
        };
        return names[tier] || 'Estándar';
    };

    return (
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-700/50">
                <Coins className="w-6 h-6 text-green-400" />
                <div>
                    <h2 className="text-xl font-bold text-white">Tus Ganancias</h2>
                    <p className="text-sm text-gray-400">{getVIPName(userData.vipTier)}</p>
                </div>
            </div>

            {/* Earnings Cards */}
            <div className="space-y-4">
                {/* Daily */}
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-green-400" />
                            <span className="text-sm text-gray-300">Ganancias Diarias</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-green-400">
                        {formatNumber(earnings.daily || 0)} <span className="text-lg">BEZ</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">≈ ${formatNumber((earnings.daily || 0) * 0.5)}</p>
                </div>

                {/* Quarterly */}
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                            <span className="text-sm text-gray-300">Ganancias Trimestrales</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-blue-400">
                        {formatNumber(earnings.quarterly || 0)} <span className="text-lg">BEZ</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">90 días · ≈ ${formatNumber((earnings.quarterly || 0) * 0.5)}</p>
                </div>

                {/* Yearly */}
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-purple-400" />
                            <span className="text-sm text-gray-300">Ganancias Anuales</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-purple-400">
                        {formatNumber(earnings.yearly || 0)} <span className="text-lg">BEZ</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">365 días · ≈ ${formatNumber((earnings.yearly || 0) * 0.5)}</p>
                </div>
            </div>

            {/* Breakdown */}
            {earnings.breakdown && (
                <div className="mt-6 pt-6 border-t border-gray-700/50">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Desglose de Cálculo
                    </h3>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Recompensas Base</span>
                            <span className="text-white font-medium">{formatNumber(earnings.breakdown.base)} BEZ</span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Multiplicador de Nivel</span>
                            <span className="text-blue-400 font-medium">{earnings.breakdown.levelMultiplier}%</span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Bonus por Racha</span>
                            <span className="text-orange-400 font-medium">+{earnings.breakdown.streakBonus}%</span>
                        </div>

                        <div className="h-px bg-gray-700/50"></div>

                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-300 font-medium">Total sin VIP</span>
                            <span className="text-white font-bold">{formatNumber(earnings.breakdown.totalStandard)} BEZ</span>
                        </div>

                        {userData.vipTier > 0 && (
                            <>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-400">Multiplicador VIP</span>
                                    <span className="text-purple-400 font-medium">{earnings.breakdown.vipMultiplier}%</span>
                                </div>

                                <div className="h-px bg-gradient-to-r from-purple-500/50 to-pink-500/50"></div>

                                <div className="flex items-center justify-between">
                                    <span className="text-purple-300 font-semibold">Total con VIP</span>
                                    <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                                        {formatNumber(earnings.breakdown.totalVIP)} BEZ
                                    </span>
                                </div>

                                <div className="mt-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Zap className="w-4 h-4 text-yellow-400" />
                                        <span className="text-xs font-semibold text-yellow-300">Ganancia Extra VIP</span>
                                    </div>
                                    <p className="text-lg font-bold text-white">
                                        +{formatNumber(earnings.breakdown.totalVIP - earnings.breakdown.totalStandard)} BEZ/día
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        ≈ +{formatNumber((earnings.breakdown.totalVIP - earnings.breakdown.totalStandard) * 365)} BEZ/año
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* CTA */}
            {userData.vipTier === 0 && earnings.breakdown && (
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl">
                    <p className="text-sm text-purple-300 font-semibold mb-2">
                        🚀 ¡Aumenta tus ganancias hasta 3x!
                    </p>
                    <p className="text-xs text-gray-400">
                        Con VIP Diamond podrías ganar hasta {formatNumber(earnings.breakdown.totalStandard * 3)} BEZ/día
                    </p>
                </div>
            )}
        </div>
    );
}
