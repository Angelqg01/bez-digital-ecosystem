import React, { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { Trophy, Gift, Star, TrendingUp, Award, Zap, Crown, Target, Play } from 'lucide-react';
import { FaCoins, FaHistory } from 'react-icons/fa';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useBezCoin } from '../context/BezCoinContext';
import { useBezPay } from '../context/BezPayContext';
import TransactionHistory from '../components/bezcoin/TransactionHistory';
import InsufficientFundsModal from '../components/modals/InsufficientFundsModal';
import WatchToEarnSection from '../components/WatchToEarnSection';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const RewardsPage = () => {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const [userStats, setUserStats] = useState(null);
    const [availableRewards, setAvailableRewards] = useState([]);
    const [claimedRewards, setClaimedRewards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchAttempted, setFetchAttempted] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [activeTab, setActiveTab] = useState('watch-to-earn'); // Nueva tab activa

    // Loyalty Integration
    const [loyaltyData, setLoyaltyData] = useState(null);
    const [loadingLoyalty, setLoadingLoyalty] = useState(false);

    // BezCoin Integration
    const {
        balance,
        insufficientFundsModal,
        setInsufficientFundsModal
    } = useBezCoin();
    const { openBuyBez } = useBezPay();

    // FIX: Prevent double fetch on React 18 StrictMode
    useEffect(() => {
        if (!fetchAttempted && isConnected && address) {
            setFetchAttempted(true);
            fetchRewardsData();
            fetchLoyaltyData();
        }
    }, [fetchAttempted, isConnected, address]);

    async function fetchLoyaltyData() {
        try {
            setLoadingLoyalty(true);
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await axios.get(`${API_URL}/vip/loyalty-stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLoyaltyData(response.data);
        } catch (error) {
            console.error('Error fetching loyalty data:', error);
            // Set default if fails
            setLoyaltyData({
                tier: { name: 'Bronze', gradient: 'from-orange-600 to-orange-800' },
                usage: { monthly: 0, total: 0, smartContracts: 0 },
                rewards: { balance: 0, earnedThisMonth: 0, cashbackRate: 0 },
                achievements: []
            });
        } finally {
            setLoadingLoyalty(false);
        }
    }

    async function fetchRewardsData() {
        if (!address) return;
        setLoading(true);
        try {
            // Fetch user stats
            const statsRes = await axios.get(`${API_URL}/rewards/${address}/stats`);
            setUserStats(statsRes.data);

            // Fetch available rewards
            const rewardsRes = await axios.get(`${API_URL}/rewards/available`);
            setAvailableRewards(rewardsRes.data || []);

            // Fetch claimed rewards
            const claimedRes = await axios.get(`${API_URL}/rewards/${address}/claimed`);
            setClaimedRewards(claimedRes.data || []);
        } catch (error) {
            console.error('Error fetching rewards:', error);

            // Fallback to mock data
            setUserStats({
                level: 5,
                experience: 2450,
                experienceToNextLevel: 3000,
                totalTokensEarned: 450,
                questsCompleted: 12,
                badgesEarned: 3,
                rank: 'Plata'
            });

            setAvailableRewards([
                {
                    id: 1,
                    type: 'daily',
                    title: 'Recompensa Diaria',
                    description: 'Reclama tu recompensa diaria',
                    reward: { tokens: 10, exp: 25 },
                    available: true,
                    icon: '🎁',
                    cooldown: null
                },
                {
                    id: 2,
                    type: 'streak',
                    title: 'Racha 7 Días',
                    description: 'Has mantenido actividad por 7 días',
                    reward: { tokens: 50, exp: 100 },
                    available: true,
                    icon: '🔥',
                    cooldown: null
                },
                {
                    id: 3,
                    type: 'achievement',
                    title: 'Primer Grupo',
                    description: 'Te uniste a tu primer grupo',
                    reward: { tokens: 25, exp: 50, badge: 'Social' },
                    available: true,
                    icon: '👥',
                    cooldown: null
                }
            ]);
        } finally {
            setLoading(false);
        }
    }

    async function claimReward(rewardId) {
        if (!address) {
            toast.error('Conecta tu wallet para reclamar recompensas');
            return;
        }
        try {
            const response = await axios.post(`${API_URL}/rewards/${rewardId}/claim`, {
                userId: address
            });

            toast.success(`¡Recompensa reclamada! +${response.data.tokens} BZH`);
            fetchRewardsData();
        } catch (error) {
            console.error('Error claiming reward:', error);
            toast.error(error.response?.data?.error || 'Error al reclamar recompensa');
        }
    }

    function getLevelProgress() {
        if (!userStats) return 0;
        return (userStats.experience / userStats.experienceToNextLevel) * 100;
    }

    function getRankColor(rank) {
        switch (rank?.toLowerCase()) {
            case 'bronce': return 'text-orange-600';
            case 'plata': return 'text-gray-300';
            case 'oro': return 'text-yellow-400';
            case 'platino': return 'text-cyan-400';
            case 'diamante': return 'text-blue-400';
            default: return 'text-gray-400';
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <Trophy className="w-16 h-16 mx-auto mb-4 animate-pulse text-primary" />
                    <p className="text-lg">Cargando recompensas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header with Balance and Actions */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                        <Trophy className="w-10 h-10" />
                        Recompensas y Gamificación
                    </h1>
                    <p className="text-gray-400">Gana tokens, sube de nivel y desbloquea logros</p>
                </div>

                {/* Balance Display & Actions */}
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl shadow-lg">
                        <FaCoins className="text-yellow-300" size={24} />
                        <div>
                            <p className="text-xs text-cyan-100">Balance BEZ</p>
                            <p className="text-xl font-bold">{parseFloat(balance).toFixed(2)}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => openBuyBez()}
                        className="px-5 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                    >
                        Comprar BEZ
                    </button>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                    >
                        <FaHistory size={18} />
                        Historial
                    </button>
                </div>
            </div>

            {/* Transaction History Section */}
            {showHistory && (
                <div className="mb-8 bg-dark-surface rounded-lg border border-dark-border p-6">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        <FaHistory className="w-6 h-6" />
                        Historial de Transacciones BEZ
                    </h2>
                    <TransactionHistory />
                </div>
            )}

            {/* Tabs Navigation */}
            <div className="mb-8 border-b border-dark-border">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('earnings')}
                        className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${activeTab === 'earnings'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <TrendingUp size={20} />
                        Mis Ganancias
                    </button>
                    <button
                        onClick={() => setActiveTab('watch-to-earn')}
                        className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${activeTab === 'watch-to-earn'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <Play size={20} />
                        Watch-to-Earn
                    </button>
                    <button
                        onClick={() => setActiveTab('rewards')}
                        className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${activeTab === 'rewards'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <Gift size={20} />
                        Recompensas
                    </button>
                </div>
            </div>

            {/* EARNINGS SECTION (NEW) */}
            {activeTab === 'earnings' && loyaltyData && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/20 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-green-500/20 rounded-lg">
                                    <TrendingUp className="w-6 h-6 text-green-400" />
                                </div>
                                <h3 className="text-lg font-semibold">Ganancias Totales</h3>
                            </div>
                            <div className="text-3xl font-bold text-green-400 mb-2">
                                {loyaltyData.rewards.earnedThisMonth} BEZ
                            </div>
                            <p className="text-sm text-gray-400">Este mes desde Be-VIP y Developer Console</p>
                        </div>

                        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-600/10 border border-blue-500/20 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-blue-500/20 rounded-lg">
                                    <Zap className="w-6 h-6 text-blue-400" />
                                </div>
                                <h3 className="text-lg font-semibold">Uso de SDK</h3>
                            </div>
                            <div className="text-3xl font-bold text-blue-400 mb-2">
                                {loyaltyData.usage.monthly.toLocaleString()}
                            </div>
                            <p className="text-sm text-gray-400">Llamadas API este mes</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/10 to-pink-600/10 border border-purple-500/20 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-purple-500/20 rounded-lg">
                                    <Award className="w-6 h-6 text-purple-400" />
                                </div>
                                <h3 className="text-lg font-semibold">Nivel VIP</h3>
                            </div>
                            <div className="text-2xl font-bold text-purple-400 mb-2">
                                {loyaltyData.tier.name}
                            </div>
                            <p className="text-sm text-gray-400">{loyaltyData.rewards.cashbackRate}% Cashback</p>
                        </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="bg-dark-surface border border-dark-border rounded-xl p-6">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Target className="w-6 h-6" />
                            Desglose de Ganancias
                        </h3>

                        <div className="space-y-4">
                            {/* VIP Subscription Earnings */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Crown className="w-8 h-8 text-orange-400" />
                                    <div>
                                        <h4 className="font-semibold">Suscripción VIP ({loyaltyData.tier.name})</h4>
                                        <p className="text-sm text-gray-400">Cashback de compras y transacciones</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-orange-400">
                                        {Math.floor(loyaltyData.rewards.earnedThisMonth * 0.6)} BEZ
                                    </div>
                                    <div className="text-xs text-gray-400">60% del total</div>
                                </div>
                            </div>

                            {/* SDK Usage Earnings */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Zap className="w-8 h-8 text-blue-400" />
                                    <div>
                                        <h4 className="font-semibold">Developer Console (SDK)</h4>
                                        <p className="text-sm text-gray-400">Rewards por uso intensivo de API</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-blue-400">
                                        {Math.floor(loyaltyData.rewards.earnedThisMonth * 0.4)} BEZ
                                    </div>
                                    <div className="text-xs text-gray-400">40% del total</div>
                                </div>
                            </div>

                            {/* Smart Contract Validations */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Award className="w-8 h-8 text-purple-400" />
                                    <div>
                                        <h4 className="font-semibold">Validaciones Smart Contract</h4>
                                        <p className="text-sm text-gray-400">Total de contratos validados</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-purple-400">
                                        {loyaltyData.usage.smartContracts || 0}
                                    </div>
                                    <div className="text-xs text-gray-400">Contratos</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Achievements Progress */}
                    {loyaltyData.achievements && loyaltyData.achievements.length > 0 && (
                        <div className="bg-dark-surface border border-dark-border rounded-xl p-6">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                🏆 Logros Desbloqueados
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {loyaltyData.achievements.map((achievement, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 bg-gradient-to-br from-yellow-500/10 to-amber-600/10 border border-yellow-500/20 rounded-lg"
                                    >
                                        <div className="text-2xl mb-2">🏆</div>
                                        <h4 className="font-semibold text-yellow-400 mb-1">{achievement.name}</h4>
                                        <p className="text-xs text-gray-400">
                                            Desbloqueado: {new Date(achievement.unlockedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Watch-to-Earn Section */}
            {activeTab === 'watch-to-earn' && (
                <WatchToEarnSection />
            )}

            {/* Rewards Section */}
            {activeTab === 'rewards' && (
                <>
                    {/* Player Stats */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-6 mb-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold mb-1">Nivel {userStats?.level}</h2>
                                <p className="text-white/80 flex items-center gap-2">
                                    <Crown className={`w-5 h-5 ${getRankColor(userStats?.rank)}`} />
                                    Rango: <span className={`font-bold ${getRankColor(userStats?.rank)}`}>
                                        {userStats?.rank}
                                    </span>
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-bold">{userStats?.totalTokensEarned}</div>
                                <div className="text-sm text-white/80">BZH Ganados</div>
                            </div>
                        </div>

                        {/* XP Progress Bar */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between text-sm mb-2">
                                <span>{userStats?.experience} XP</span>
                                <span>{userStats?.experienceToNextLevel} XP</span>
                            </div>
                            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-white h-full rounded-full transition-all duration-500"
                                    style={{ width: `${getLevelProgress()}%` }}
                                />
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-4 mt-6">
                            <div className="text-center">
                                <div className="text-2xl font-bold">{userStats?.questsCompleted}</div>
                                <div className="text-sm text-white/80">Misiones</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold">{userStats?.badgesEarned}</div>
                                <div className="text-sm text-white/80">Insignias</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold">{getLevelProgress().toFixed(0)}%</div>
                                <div className="text-sm text-white/80">Progreso</div>
                            </div>
                        </div>
                    </div>

                    {/* Available Rewards */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Gift className="w-6 h-6" />
                            Recompensas Disponibles
                        </h2>

                        {availableRewards.length === 0 ? (
                            <div className="text-center py-12 bg-dark-surface rounded-lg border border-dark-border">
                                <Gift className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                                <p className="text-gray-400">No hay recompensas disponibles en este momento</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {availableRewards.map(reward => (
                                    <div key={reward.id} className="bg-dark-surface rounded-lg border border-dark-border p-6 hover:border-primary transition-colors">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="text-4xl">{reward.icon}</div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${reward.type === 'daily' ? 'bg-blue-500/20 text-blue-400' :
                                                reward.type === 'streak' ? 'bg-orange-500/20 text-orange-400' :
                                                    'bg-purple-500/20 text-purple-400'
                                                }`}>
                                                {reward.type === 'daily' ? 'Diaria' :
                                                    reward.type === 'streak' ? 'Racha' : 'Logro'}
                                            </span>
                                        </div>

                                        <h3 className="text-xl font-bold mb-2">{reward.title}</h3>
                                        <p className="text-gray-400 text-sm mb-4">{reward.description}</p>

                                        <div className="flex items-center gap-3 mb-4 text-sm">
                                            {reward.reward.tokens && (
                                                <div className="flex items-center gap-1 text-yellow-400">
                                                    <Zap className="w-4 h-4" />
                                                    +{reward.reward.tokens} BZH
                                                </div>
                                            )}
                                            {reward.reward.exp && (
                                                <div className="flex items-center gap-1 text-blue-400">
                                                    <Star className="w-4 h-4" />
                                                    +{reward.reward.exp} XP
                                                </div>
                                            )}
                                            {reward.reward.badge && (
                                                <div className="flex items-center gap-1 text-purple-400">
                                                    <Award className="w-4 h-4" />
                                                    {reward.reward.badge}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => claimReward(reward.id)}
                                            disabled={!reward.available || reward.cooldown}
                                            className={`w-full py-2 rounded-lg transition-colors ${reward.available && !reward.cooldown
                                                ? 'bg-primary hover:bg-primary/80'
                                                : 'bg-dark-border cursor-not-allowed opacity-50'
                                                }`}
                                        >
                                            {reward.cooldown ? `Disponible en ${reward.cooldown}` : 'Reclamar'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Achievement Milestones */}
                    <div className="bg-dark-surface rounded-lg border border-dark-border p-6">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <Target className="w-6 h-6" />
                            Próximos Hitos
                        </h2>

                        <div className="space-y-4">
                            {[
                                { level: 10, reward: '100 BZH + Insignia Oro', progress: 50 },
                                { level: 15, reward: '200 BZH + NFT Especial', progress: 33 },
                                { level: 20, reward: '500 BZH + Título Legendario', progress: 25 }
                            ].map(milestone => (
                                <div key={milestone.level} className="border border-dark-border rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold">Nivel {milestone.level}</span>
                                        <span className="text-sm text-gray-400">{milestone.reward}</span>
                                    </div>
                                    <div className="w-full bg-dark-bg rounded-full h-2">
                                        <div
                                            className="bg-gradient-to-r from-purple-600 to-pink-600 h-full rounded-full transition-all"
                                            style={{ width: `${milestone.progress}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <InsufficientFundsModal
                isOpen={insufficientFundsModal.show}
                onClose={() => setInsufficientFundsModal({ show: false, requiredAmount: 0, actionName: '', onPurchaseComplete: null })}
                requiredAmount={insufficientFundsModal.requiredAmount}
                currentBalance={balance}
                actionName={insufficientFundsModal.actionName}
                onPurchaseComplete={insufficientFundsModal.onPurchaseComplete}
            />
        </div>
    );
};

export default RewardsPage;
