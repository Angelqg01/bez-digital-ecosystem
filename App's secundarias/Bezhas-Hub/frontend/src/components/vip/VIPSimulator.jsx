import React, { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { Sliders, TrendingUp, Users, Heart, Share2, Star, UserPlus } from 'lucide-react';
import { REWARDS_CONTRACT } from '../../contracts/config';
import RewardsCalculatorABI from '../../contracts/BeZhasRewardsCalculator.json';
import { calculateDailyRewards } from '../../utils/mockRewardsCalculator';

export default function VIPSimulator({ dailyActions, setDailyActions, userData, setUserData, onCalculate }) {
    const [isCalculating, setIsCalculating] = useState(false);

    // Verificar si el contrato está desplegado
    const isContractDeployed = REWARDS_CONTRACT.address &&
        REWARDS_CONTRACT.address !== '0x0000000000000000000000000000000000000000';

    // Límites diarios (hardcoded desde el contrato)
    const limits = {
        posts: 10,
        comments: 50,
        likes: 100,
        shares: 20,
        premiumInteractions: 5,
        referrals: 3
    };

    // Llamada al contrato para calcular recompensas
    const { data: contractData, isLoading, refetch } = useReadContract({
        address: REWARDS_CONTRACT.address,
        abi: RewardsCalculatorABI.abi,
        functionName: 'calculateDailyRewards',
        args: [
            {
                posts: BigInt(dailyActions.posts),
                comments: BigInt(dailyActions.comments),
                likes: BigInt(dailyActions.likes),
                shares: BigInt(dailyActions.shares),
                premiumInteractions: BigInt(dailyActions.premiumInteractions),
                referrals: BigInt(dailyActions.referrals)
            },
            {
                level: BigInt(userData.level),
                loginStreak: BigInt(userData.loginStreak),
                vipTier: BigInt(userData.vipTier)
            }
        ],
        enabled: false // Solo ejecutar cuando se llame manualmente
    });

    // Actualizar resultados cuando lleguen del contrato
    useEffect(() => {
        if (contractData && onCalculate) {
            const baseRewards = Number(contractData.baseRewards) / 1e18;
            const totalDaily = Number(contractData.totalDaily) / 1e18;
            const totalWithVIP = Number(contractData.totalWithVIP) / 1e18;

            onCalculate({
                daily: totalWithVIP,
                quarterly: totalWithVIP * 90,
                yearly: totalWithVIP * 365,
                breakdown: {
                    base: baseRewards,
                    levelMultiplier: Number(contractData.levelMultiplier) / 100,
                    streakBonus: Number(contractData.streakBonus) / 100,
                    vipMultiplier: Number(contractData.vipMultiplier) / 100,
                    totalStandard: totalDaily,
                    totalVIP: totalWithVIP
                }
            });
            setIsCalculating(false);
        }
    }, [contractData, onCalculate]);

    const handleCalculate = async () => {
        setIsCalculating(true);

        // Si el contrato no está desplegado (dirección 0x0000...), usar mock
        const isContractDeployed = REWARDS_CONTRACT.address &&
            REWARDS_CONTRACT.address !== '0x0000000000000000000000000000000000000000';

        if (!isContractDeployed) {
            // Usar calculador mock local
            try {
                const result = calculateDailyRewards(dailyActions, userData);

                onCalculate({
                    daily: result.totalWithVIP,
                    quarterly: result.totalWithVIP * 90,
                    yearly: result.totalWithVIP * 365,
                    breakdown: {
                        base: result.baseRewards,
                        levelMultiplier: result.levelMultiplier / 100,
                        streakBonus: result.streakBonus / 100,
                        vipMultiplier: result.vipMultiplier / 100,
                        totalStandard: result.totalDaily,
                        totalVIP: result.totalWithVIP
                    }
                });
                setIsCalculating(false);
            } catch (error) {
                console.error('Error en cálculo mock:', error);
                alert(error.message);
                setIsCalculating(false);
            }
        } else {
            // Usar contrato desplegado
            await refetch();
        }
    };

    const handleSliderChange = (field, value) => {
        setDailyActions({ ...dailyActions, [field]: Number(value) });
    };

    const handleUserDataChange = (field, value) => {
        setUserData({ ...userData, [field]: Number(value) });
    };

    const sliders = [
        {
            key: 'posts',
            label: 'Posts Publicados',
            icon: <TrendingUp className="w-5 h-5" />,
            max: limits.posts,
            color: 'purple',
            value: 10
        },
        {
            key: 'comments',
            label: 'Comentarios',
            icon: <Users className="w-5 h-5" />,
            max: limits.comments,
            color: 'blue',
            value: 3
        },
        {
            key: 'likes',
            label: 'Me Gusta',
            icon: <Heart className="w-5 h-5" />,
            max: limits.likes,
            color: 'pink',
            value: 1
        },
        {
            key: 'shares',
            label: 'Compartidos',
            icon: <Share2 className="w-5 h-5" />,
            max: limits.shares,
            color: 'green',
            value: 5
        },
        {
            key: 'premiumInteractions',
            label: 'Interacciones Premium',
            icon: <Star className="w-5 h-5" />,
            max: limits.premiumInteractions,
            color: 'yellow',
            value: 15
        },
        {
            key: 'referrals',
            label: 'Referidos',
            icon: <UserPlus className="w-5 h-5" />,
            max: limits.referrals,
            color: 'orange',
            value: 50
        }
    ];

    return (
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-700/50">
                <Sliders className="w-6 h-6 text-purple-400" />
                <div>
                    <h2 className="text-xl font-bold text-white">Simulador de Recompensas</h2>
                    <p className="text-sm text-gray-400">Ajusta tus acciones diarias para calcular ganancias</p>
                </div>
            </div>

            {/* Sliders de Acciones */}
            <div className="space-y-6 mb-6">
                {sliders.map((slider) => (
                    <div key={slider.key}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`text-${slider.color}-400`}>{slider.icon}</span>
                                <label className="text-sm font-medium text-gray-300">{slider.label}</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-white font-bold">{dailyActions[slider.key]}</span>
                                <span className="text-gray-500 text-sm">/ {slider.max}</span>
                                <span className="text-gray-400 text-xs">({slider.value} BEZ)</span>
                            </div>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max={slider.max}
                            value={dailyActions[slider.key]}
                            onChange={(e) => handleSliderChange(slider.key, e.target.value)}
                            className={`w-full h-2 rounded-lg appearance-none cursor-pointer slider-${slider.color}`}
                            style={{
                                background: `linear-gradient(to right, var(--${slider.color}-500) 0%, var(--${slider.color}-500) ${(dailyActions[slider.key] / slider.max) * 100}%, var(--gray-700) ${(dailyActions[slider.key] / slider.max) * 100}%, var(--gray-700) 100%)`
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Datos del Usuario */}
            <div className="bg-gray-900/50 border border-gray-700/30 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Datos del Usuario</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nivel */}
                    <div>
                        <label className="text-sm text-gray-400 mb-2 block">Nivel (1-10)</label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={userData.level}
                            onChange={(e) => handleUserDataChange('level', e.target.value)}
                            className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                        />
                    </div>

                    {/* Racha de Login */}
                    <div>
                        <label className="text-sm text-gray-400 mb-2 block">Racha de Login (días)</label>
                        <input
                            type="number"
                            min="0"
                            max="365"
                            value={userData.loginStreak}
                            onChange={(e) => handleUserDataChange('loginStreak', e.target.value)}
                            className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                        />
                    </div>
                </div>

                {/* Bonus por racha */}
                <div className="mt-4 text-xs text-gray-400">
                    {userData.loginStreak >= 90 && '🔥 +20% Bonus por racha de 90 días'}
                    {userData.loginStreak >= 30 && userData.loginStreak < 90 && '🔥 +10% Bonus por racha de 30 días'}
                    {userData.loginStreak >= 7 && userData.loginStreak < 30 && '🔥 +5% Bonus por racha de 7 días'}
                    {userData.loginStreak < 7 && 'Mantén una racha de login para obtener bonus'}
                </div>
            </div>

            {/* Botón Calcular */}
            <button
                onClick={handleCalculate}
                disabled={isCalculating || isLoading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-purple-500/50 disabled:cursor-not-allowed"
            >
                {isCalculating || isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Calculando...
                    </div>
                ) : (
                    isContractDeployed ? 'Calcular Recompensas On-Chain' : 'Calcular Recompensas (Modo Local)'
                )}
            </button>

            <p className="text-xs text-gray-500 text-center mt-3">
                {isContractDeployed
                    ? 'Los cálculos se realizan directamente en el smart contract de Polygon'
                    : '⚠️ Modo local: El smart contract aún no está desplegado. Los cálculos se realizan localmente con la misma lógica.'
                }
            </p>
        </div>
    );
}
