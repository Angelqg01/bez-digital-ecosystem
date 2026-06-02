import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import {
    TrendingUp, Coins, Lock, Unlock, Clock,
    AlertCircle, Zap, DollarSign, BarChart3,
    Plus, Minus, Info, ExternalLink, Flame,
    Droplets, Award, ShieldCheck, Percent
} from 'lucide-react';
import axios from 'axios';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import GlobalStatsBar from '../components/GlobalStatsBar';

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN LP POOL QUICKSWAP
// ═══════════════════════════════════════════════════════════════════════
const QUICKSWAP_LP_CONFIG = {
    poolAddress: '0x4edc77de01f2a2c87611c2f8e9249be43df745a9',
    chainId: 137,
    pair: 'BEZ/USDC',
    dexUrl: 'https://dapp.quickswap.exchange/pool/positions/v2/0x4edc77de01f2a2c87611c2f8e9249be43df745a9?chainId=137',
    addLiquidityUrl: 'https://dapp.quickswap.exchange/add/v2/0x89c23890c742d710265dd61be789c71dc8999b12/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174?chainId=137'
};

// Wallet Treasury DAO Polygon
const TREASURY_DAO_ADDRESS = '0x89c23890c742d710265dd61be789c71dc8999b12';

const API_URL = '';

export default function DeFiHub() {
    const { address, isConnected } = useAccount();

    // ── LP Balance on-chain (QuickSwap BEZ/USDC pool) ────────────────────────────
    const LP_TOKEN_ABI = [
        {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }]
        },
        {
            name: 'totalSupply',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }]
        }
    ];

    const { data: userLpBalance } = useReadContract({
        address: QUICKSWAP_LP_CONFIG.poolAddress,
        abi: LP_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address],
        chainId: 137,
        enabled: !!address && isConnected,
    });

    const { data: totalLpSupply } = useReadContract({
        address: QUICKSWAP_LP_CONFIG.poolAddress,
        abi: LP_TOKEN_ABI,
        functionName: 'totalSupply',
        chainId: 137,
    });

    const userLpFormatted = userLpBalance ? parseFloat(formatUnits(userLpBalance, 18)).toFixed(6) : '0.000000';
    const poolSharePercent = (userLpBalance && totalLpSupply && totalLpSupply > 0n)
        ? ((Number(userLpBalance) / Number(totalLpSupply)) * 100).toFixed(4)
        : '0.0000';

    const [pools, setPools] = useState([]);
    const [userFarming, setUserFarming] = useState(null);
    const [farmingStats, setFarmingStats] = useState(null);
    const [lockMultipliers, setLockMultipliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPool, setSelectedPool] = useState(null);
    const [stakeAmount, setStakeAmount] = useState('');
    const [selectedLockPeriod, setSelectedLockPeriod] = useState(0);
    const [activeTab, setActiveTab] = useState('pools'); // 'pools' | 'my-stakes' | 'liquidity' | 'real-yield'

    // Real Yield Stats (from 1.4% commercial fees: 0.7% burn/treasury + 0.7% LP rewards)
    const [realYieldStats, setRealYieldStats] = useState({
        totalBurned24h: '12,450',
        totalBurnedAllTime: '2,345,678',
        realYieldAPY: '8.5',
        commercialVolume24h: '890,000',
        lpRewardsDistributed: '156,789',
        treasuryBalance: '1,250,000'
    });

    // Subscription multipliers
    const [subscriptionMultipliers] = useState({
        bronze: 1.02,    // +2%
        silver: 1.05,    // +5%
        gold: 1.08,      // +8%
        platinum: 1.12   // +12%
    });

    // Business Booster multiplier for active sellers
    const [businessBooster] = useState(1.15); // +15%

    useEffect(() => {
        loadData();
    }, [address]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Cargar pools
            const poolsRes = await axios.get(`${API_URL}/api/farming/pools`);
            setPools(poolsRes.data.data || []);

            // Cargar estadísticas
            const statsRes = await axios.get(`${API_URL}/api/farming/stats`);
            setFarmingStats(statsRes.data.data);

            // Cargar multiplicadores
            const multipliersRes = await axios.get(`${API_URL}/api/farming/multipliers`);
            setLockMultipliers(multipliersRes.data.data || []);

            // Si está conectado, cargar datos del usuario
            if (isConnected && address) {
                const token = localStorage.getItem('token');
                if (token) {
                    const userRes = await axios.get(`${API_URL}/api/farming/user/${address}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setUserFarming(userRes.data.data);
                }
            }
        } catch (error) {
            // Silently handle error - backend may not be available
            if (error.code !== 'ERR_NETWORK') {
                console.error('Error loading farming data:', error);
                toast.error('Error al cargar datos de farming');
            }
        } finally {
            setLoading(false);
        }
    };

    const openStakeModal = (pool) => {
        setSelectedPool(pool);
        setStakeAmount('');
        setSelectedLockPeriod(0);
    };

    const closeStakeModal = () => {
        setSelectedPool(null);
        setStakeAmount('');
        setSelectedLockPeriod(0);
    };

    const handleStake = async () => {
        if (!selectedPool || !stakeAmount || parseFloat(stakeAmount) <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error('Debes iniciar sesión');
                return;
            }

            // Validar stake en el backend
            const validation = await axios.post(
                `${API_URL}/api/farming/validate-stake`,
                {
                    poolId: selectedPool.id,
                    amount: ethers.parseEther(stakeAmount).toString(),
                    userAddress: address
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!validation.data.data.canStake) {
                toast.error(validation.data.data.reason);
                return;
            }

            // Aquí el usuario debe ejecutar la transacción desde su wallet
            toast.success('Ahora aprueba la transacción en tu wallet');

            // TODO: Implementar llamada al contrato desde el frontend con wagmi
            closeStakeModal();

        } catch (error) {
            console.error('Error staking:', error);
            toast.error('Error al hacer staking');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
                <div className="text-white text-xl flex items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    Cargando pools...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
            {/* Global Stats Bar */}
            <GlobalStatsBar />

            {/* Header */}
            <div className="bg-black/30 backdrop-blur-sm border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Zap className="text-yellow-400" size={32} />
                                DeFi Hub
                            </h1>
                            <p className="text-gray-400 mt-1">Real Yield Farming & Liquidity</p>
                        </div>

                        {isConnected && (
                            <div className="hidden md:flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setActiveTab('pools')}
                                    className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'pools'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                        }`}
                                >
                                    <Coins className="inline mr-2" size={16} />
                                    Pools
                                </button>
                                <button
                                    onClick={() => setActiveTab('liquidity')}
                                    className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'liquidity'
                                        ? 'bg-cyan-600 text-white'
                                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                        }`}
                                >
                                    <Droplets className="inline mr-2" size={16} />
                                    LP QuickSwap
                                </button>
                                <button
                                    onClick={() => setActiveTab('real-yield')}
                                    className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'real-yield'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                        }`}
                                >
                                    <TrendingUp className="inline mr-2" size={16} />
                                    Real Yield
                                </button>
                                <button
                                    onClick={() => setActiveTab('my-stakes')}
                                    className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'my-stakes'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                        }`}
                                >
                                    Mis Stakes
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Real Yield Banner */}
            <div className="max-w-7xl mx-auto px-4 py-4">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border border-emerald-500/30 rounded-xl p-4"
                >
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/20 rounded-lg">
                                <ShieldCheck className="text-emerald-400" size={24} />
                            </div>
                            <div>
                                <p className="text-emerald-300 font-semibold">Real Yield Engine</p>
                                <p className="text-gray-400 text-sm">Tu liquidez apoya el comercio de activos reales, y el comercio real premia tu liquidez</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-white">{realYieldStats.realYieldAPY}%</p>
                                <p className="text-xs text-gray-400">APY Real</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-orange-400 flex items-center gap-1">
                                    <Flame size={20} />
                                    {realYieldStats.totalBurned24h}
                                </p>
                                <p className="text-xs text-gray-400">Quemados 24h</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Stats Overview */}
            {farmingStats && (
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-6 shadow-lg"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-sm">Total Value Locked</p>
                                    <p className="text-white text-2xl font-bold mt-1">
                                        ${parseFloat(ethers.formatEther(farmingStats.totalValueLocked || '0')).toFixed(2)}
                                    </p>
                                </div>
                                <DollarSign className="text-white/30" size={48} />
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-6 shadow-lg"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-purple-100 text-sm">Active Pools</p>
                                    <p className="text-white text-2xl font-bold mt-1">
                                        {farmingStats.activePools} / {farmingStats.totalPools}
                                    </p>
                                </div>
                                <BarChart3 className="text-white/30" size={48} />
                            </div>
                        </motion.div>

                        {userFarming && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-6 shadow-lg"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-green-100 text-sm">Mis Recompensas</p>
                                        <p className="text-white text-2xl font-bold mt-1">
                                            {parseFloat(ethers.formatEther(userFarming.totalRewards || '0')).toFixed(4)} BEZ
                                        </p>
                                    </div>
                                    <TrendingUp className="text-white/30" size={48} />
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                {!isConnected ? (
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 text-center border border-white/20">
                        <Lock className="mx-auto text-gray-400 mb-4" size={64} />
                        <h3 className="text-white text-xl font-semibold mb-2">
                            Conecta tu Wallet
                        </h3>
                        <p className="text-gray-400 mb-6">
                            Conecta tu wallet para ver los pools y empezar a hacer staking
                        </p>
                    </div>
                ) : activeTab === 'pools' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pools.map((pool, index) => (
                            <motion.div
                                key={pool.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden hover:border-purple-500 transition"
                            >
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-white font-bold text-lg">{pool.name}</h3>
                                        <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">
                                            {pool.apy}% APY
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Total Staked</span>
                                            <span className="text-white font-semibold">
                                                {parseFloat(ethers.formatEther(pool.totalStaked)).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Min Stake</span>
                                            <span className="text-white font-semibold">
                                                {parseFloat(ethers.formatEther(pool.minStake)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => openStakeModal(pool)}
                                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition flex items-center justify-center gap-2"
                                    >
                                        <Plus size={20} />
                                        Stake
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {userFarming?.pools.length > 0 ? (
                            userFarming.pools.map((stake) => (
                                <motion.div
                                    key={stake.poolId}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-white font-bold text-lg">Pool {stake.poolId + 1}</h3>
                                        {stake.canWithdraw ? (
                                            <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold flex items-center gap-1">
                                                <Unlock size={14} />
                                                Desbloqueado
                                            </div>
                                        ) : (
                                            <div className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-xs font-semibold flex items-center gap-1">
                                                <Lock size={14} />
                                                Bloqueado
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <p className="text-gray-400 text-sm">Staked</p>
                                            <p className="text-white font-semibold">
                                                {parseFloat(ethers.formatEther(stake.staked)).toFixed(4)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400 text-sm">Recompensas</p>
                                            <p className="text-green-400 font-semibold">
                                                {parseFloat(ethers.formatEther(stake.pendingRewards)).toFixed(4)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400 text-sm">Multiplicador</p>
                                            <p className="text-purple-400 font-semibold">
                                                {stake.multiplier}x
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold">
                                                <Minus className="mx-auto" size={16} />
                                            </button>
                                            <button className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold">
                                                Claim
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 text-center border border-white/20">
                                <Coins className="mx-auto text-gray-400 mb-4" size={64} />
                                <h3 className="text-white text-xl font-semibold mb-2">
                                    No tienes stakes activos
                                </h3>
                                <p className="text-gray-400 mb-6">
                                    Empieza a hacer staking para ganar recompensas
                                </p>
                                <button
                                    onClick={() => setActiveTab('pools')}
                                    className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
                                >
                                    Ver Pools
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Stake Modal */}
            {
                selectedPool && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-white/20"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-white text-xl font-bold">Stake en {selectedPool.name}</h3>
                                <button
                                    onClick={closeStakeModal}
                                    className="text-gray-400 hover:text-white transition"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-gray-400 text-sm block mb-2">Cantidad</label>
                                    <input
                                        type="number"
                                        value={stakeAmount}
                                        onChange={(e) => setStakeAmount(e.target.value)}
                                        placeholder="0.0"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-gray-400 text-sm block mb-2">Período de Bloqueo</label>
                                    <select
                                        value={selectedLockPeriod}
                                        onChange={(e) => setSelectedLockPeriod(parseInt(e.target.value))}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                                    >
                                        {lockMultipliers.map((multiplier) => (
                                            <option key={multiplier.seconds} value={multiplier.seconds}>
                                                {multiplier.label} - {multiplier.boost} boost
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                    <div className="flex items-start gap-2">
                                        <Info className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                                        <div className="text-sm text-blue-300">
                                            <p className="font-semibold mb-1">Importante:</p>
                                            <p>Una vez que hagas stake, tus tokens estarán bloqueados durante el período seleccionado. Mayor bloqueo = mayores recompensas.</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleStake}
                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition"
                                >
                                    Confirmar Stake
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )
            }

            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {/* SECCIÓN: LP QUICKSWAP */}
            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {
                activeTab === 'liquidity' && (
                    <div className="max-w-7xl mx-auto px-4 py-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Panel Principal LP */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-br from-cyan-900/50 to-blue-900/50 rounded-xl border border-cyan-500/30 p-6"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-3 bg-cyan-500/20 rounded-xl">
                                        <Droplets className="text-cyan-400" size={32} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">Pool BEZ/USDC</h2>
                                        <p className="text-cyan-300">QuickSwap V2 - Polygon</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-black/30 rounded-lg p-4">
                                        <p className="text-gray-400 text-sm">TVL Total</p>
                                        <p className="text-white text-2xl font-bold">$125,450</p>
                                    </div>
                                    <div className="bg-black/30 rounded-lg p-4">
                                        <p className="text-gray-400 text-sm">APR Estimado</p>
                                        <p className="text-green-400 text-2xl font-bold">24.5%</p>
                                    </div>
                                    <div className="bg-black/30 rounded-lg p-4">
                                        <p className="text-gray-400 text-sm">Volumen 24h</p>
                                        <p className="text-white text-2xl font-bold">$45,230</p>
                                    </div>
                                    <div className="bg-black/30 rounded-lg p-4">
                                        <p className="text-gray-400 text-sm">Fees 24h</p>
                                        <p className="text-purple-400 text-2xl font-bold">$135.69</p>
                                    </div>
                                </div>

                                {/* Tu posición LP on-chain */}
                                {isConnected && (
                                    <div className="mb-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                                        <p className="text-cyan-300 font-semibold mb-2 flex items-center gap-2">
                                            <Droplets size={16} /> Tu Posición LP (on-chain)
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-gray-400 text-xs">LP Tokens</p>
                                                <p className="text-white font-bold">{userLpFormatted} <span className="text-gray-500 text-xs">BEZ/USDC LP</span></p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400 text-xs">Tu % del Pool</p>
                                                <p className="text-cyan-300 font-bold">{poolSharePercent}%</p>
                                            </div>
                                        </div>
                                        {parseFloat(userLpFormatted) === 0 && (
                                            <p className="text-xs text-gray-500 mt-2">No tienes liquidez en este pool todavía. ¡Añade para empezar a recibir Real Yield!</p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <a
                                        href={QUICKSWAP_LP_CONFIG.addLiquidityUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold rounded-lg hover:from-cyan-700 hover:to-blue-700 transition flex items-center justify-center gap-2"
                                    >
                                        <Plus size={20} />
                                        Añadir Liquidez
                                        <ExternalLink size={16} />
                                    </a>
                                    <a
                                        href={QUICKSWAP_LP_CONFIG.dexUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition flex items-center justify-center gap-2"
                                    >
                                        Ver en QuickSwap
                                        <ExternalLink size={16} />
                                    </a>
                                </div>
                            </motion.div>

                            {/* Panel de Beneficios LP */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-white/5 rounded-xl border border-white/10 p-6"
                            >
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Award className="text-yellow-400" />
                                    Beneficios de Proveer Liquidez
                                </h3>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                                        <Percent className="text-green-400 mt-1" size={20} />
                                        <div>
                                            <p className="text-white font-semibold">Real Yield del Comercio</p>
                                            <p className="text-gray-400 text-sm">Recibe el 0.7% de las ventas reales del marketplace</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                        <Award className="text-purple-400 mt-1" size={20} />
                                        <div>
                                            <p className="text-white font-semibold">NFT Pioneer Liquidity</p>
                                            <p className="text-gray-400 text-sm">+90 días: NFT con acceso a preventas exclusivas de RWA</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                                        <TrendingUp className="text-yellow-400 mt-1" size={20} />
                                        <div>
                                            <p className="text-white font-semibold">Boost por Suscripción VIP</p>
                                            <p className="text-gray-400 text-sm">Hasta +12% APY adicional con Platinum</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                                        <Flame className="text-orange-400 mt-1" size={20} />
                                        <div>
                                            <p className="text-white font-semibold">Deflación Activa</p>
                                            <p className="text-gray-400 text-sm">El 0.7% de las ventas se envía al Treasury DAO</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Calculadora de ROI */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="mt-6 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl border border-purple-500/30 p-6"
                        >
                            <h3 className="text-xl font-bold text-white mb-4">🧮 Calculadora de Retorno Real</h3>
                            <p className="text-gray-400 mb-4">
                                "Si aporto liquidez y el marketplace vende, ¿cuál es mi retorno real?"
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-black/30 rounded-lg p-4">
                                    <label className="text-gray-400 text-sm">Tu aporte LP ($)</label>
                                    <input
                                        type="number"
                                        placeholder="1000"
                                        className="w-full mt-2 bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                                    />
                                </div>
                                <div className="bg-black/30 rounded-lg p-4">
                                    <label className="text-gray-400 text-sm">Ventas mensuales del Marketplace</label>
                                    <input
                                        type="number"
                                        placeholder="100000"
                                        className="w-full mt-2 bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                                    />
                                </div>
                                <div className="bg-black/30 rounded-lg p-4">
                                    <label className="text-gray-400 text-sm">Tu nivel VIP</label>
                                    <select className="w-full mt-2 bg-white/5 border border-white/10 rounded px-3 py-2 text-white">
                                        <option value="none">Sin suscripción</option>
                                        <option value="bronze">Bronze (+2%)</option>
                                        <option value="silver">Silver (+5%)</option>
                                        <option value="gold">Gold (+8%)</option>
                                        <option value="platinum">Platinum (+12%)</option>
                                    </select>
                                </div>
                                <div className="bg-green-500/20 rounded-lg p-4 flex flex-col justify-center">
                                    <p className="text-gray-400 text-sm">Retorno estimado/mes</p>
                                    <p className="text-green-400 text-2xl font-bold">$85.50</p>
                                </div>
                            </div>
                        </motion.div>
                    </div >
                )
            }

            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {/* SECCIÓN: REAL YIELD */}
            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {
                activeTab === 'real-yield' && (
                    <div className="max-w-7xl mx-auto px-4 py-6">
                        {/* Explicación del Sistema */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-xl border border-emerald-500/30 p-6 mb-6"
                        >
                            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                <ShieldCheck className="text-emerald-400" size={28} />
                                El Motor de Economía Real
                            </h2>
                            <p className="text-gray-300 mb-4">
                                A diferencia de otros proyectos DeFi donde el rendimiento sale de la "impresión de tokens",
                                en BeZhas el <span className="text-emerald-400 font-semibold">Real Yield viene de la actividad comercial real</span>:
                                el 1.4% de cada venta en la plataforma.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                                <div className="bg-black/30 rounded-lg p-4 text-center">
                                    <p className="text-4xl font-bold text-orange-400 flex items-center justify-center gap-2">
                                        <Flame /> 0.7%
                                    </p>
                                    <p className="text-gray-400 mt-2">Treasury DAO (antes burn)</p>
                                    <p className="text-sm text-gray-500">+ Multiplicador x0.3 para LPs</p>
                                </div>
                                <div className="bg-black/30 rounded-lg p-4 text-center">
                                    <p className="text-4xl font-bold text-green-400 flex items-center justify-center gap-2">
                                        <Droplets /> 0.7%
                                    </p>
                                    <p className="text-gray-400 mt-2">Recompensas LP</p>
                                    <p className="text-sm text-gray-500">Distribuido a proveedores</p>
                                </div>
                                <div className="bg-black/30 rounded-lg p-4 text-center">
                                    <p className="text-4xl font-bold text-purple-400">1.4%</p>
                                    <p className="text-gray-400 mt-2">Total por Venta</p>
                                    <p className="text-sm text-gray-500">Productos, Servicios, RWA</p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Estadísticas en Vivo */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-5"
                            >
                                <div className="flex items-center gap-3">
                                    <Flame className="text-orange-400" size={32} />
                                    <div>
                                        <p className="text-gray-400 text-sm">Enviado a Treasury 24h</p>
                                        <p className="text-white text-xl font-bold">{realYieldStats.totalBurned24h} BEZ</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-green-500/10 border border-green-500/30 rounded-xl p-5"
                            >
                                <div className="flex items-center gap-3">
                                    <TrendingUp className="text-green-400" size={32} />
                                    <div>
                                        <p className="text-gray-400 text-sm">Volumen Comercial 24h</p>
                                        <p className="text-white text-xl font-bold">${realYieldStats.commercialVolume24h}</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5"
                            >
                                <div className="flex items-center gap-3">
                                    <Award className="text-purple-400" size={32} />
                                    <div>
                                        <p className="text-gray-400 text-sm">Recompensas LP Totales</p>
                                        <p className="text-white text-xl font-bold">{realYieldStats.lpRewardsDistributed} BEZ</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5"
                            >
                                <div className="flex items-center gap-3">
                                    <DollarSign className="text-blue-400" size={32} />
                                    <div>
                                        <p className="text-gray-400 text-sm">Treasury DAO</p>
                                        <p className="text-white text-xl font-bold">${realYieldStats.treasuryBalance}</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Tabla de Multiplicadores */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white/5 rounded-xl border border-white/10 p-6"
                        >
                            <h3 className="text-xl font-bold text-white mb-4">🎯 Multiplicadores de Rendimiento</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left text-gray-400 py-3 px-4">Incentivo</th>
                                            <th className="text-left text-gray-400 py-3 px-4">Requisito</th>
                                            <th className="text-left text-gray-400 py-3 px-4">Boost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-white/5">
                                            <td className="py-3 px-4 text-white">🏪 Business Booster</td>
                                            <td className="py-3 px-4 text-gray-400">Vendedor activo en marketplace</td>
                                            <td className="py-3 px-4 text-green-400 font-bold">+15%</td>
                                        </tr>
                                        <tr className="border-b border-white/5">
                                            <td className="py-3 px-4 text-white">🥉 Suscripción Bronze</td>
                                            <td className="py-3 px-4 text-gray-400">$4.99/mes</td>
                                            <td className="py-3 px-4 text-green-400 font-bold">+2%</td>
                                        </tr>
                                        <tr className="border-b border-white/5">
                                            <td className="py-3 px-4 text-white">🥈 Suscripción Silver</td>
                                            <td className="py-3 px-4 text-gray-400">$9.99/mes</td>
                                            <td className="py-3 px-4 text-green-400 font-bold">+5%</td>
                                        </tr>
                                        <tr className="border-b border-white/5">
                                            <td className="py-3 px-4 text-white">🥇 Suscripción Gold</td>
                                            <td className="py-3 px-4 text-gray-400">$19.99/mes</td>
                                            <td className="py-3 px-4 text-green-400 font-bold">+8%</td>
                                        </tr>
                                        <tr className="border-b border-white/5">
                                            <td className="py-3 px-4 text-white">💎 Suscripción Platinum</td>
                                            <td className="py-3 px-4 text-gray-400">$49.99/mes</td>
                                            <td className="py-3 px-4 text-green-400 font-bold">+12%</td>
                                        </tr>
                                        <tr className="border-b border-white/5">
                                            <td className="py-3 px-4 text-white">🎖️ NFT Liquidity Titan</td>
                                            <td className="py-3 px-4 text-gray-400">LP $5,000+ por 6 meses</td>
                                            <td className="py-3 px-4 text-purple-400 font-bold">Comisión 1.4% → 1.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 px-4 text-white">👥 Affiliate Farm</td>
                                            <td className="py-3 px-4 text-gray-400">Referir LPs</td>
                                            <td className="py-3 px-4 text-green-400 font-bold">+2% del yield referido</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </div>
                )
            }
        </div >
    );
}
