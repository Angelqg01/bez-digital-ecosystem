import React, { useState, useEffect } from 'react';
import {
    FaLock,
    FaUnlock,
    FaTrendingUp,
    FaClock,
    FaAward,
    FaDollarSign,
    FaSync,
    FaExclamationCircle,
    FaCheckCircle,
    FaFire
} from 'react-icons/fa';
import { toast } from 'react-hot-toast'; const NFTStakingPanel = () => {
    const [activeTab, setActiveTab] = useState('pools');
    const [stakingPools, setStakingPools] = useState([]);
    const [myNFTs, setMyNFTs] = useState([]);
    const [myStakes, setMyStakes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedPool, setSelectedPool] = useState(null);
    const [selectedNFT, setSelectedNFT] = useState(null);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            await loadStakingPools();
            await loadMyNFTs();
            await loadMyStakes();
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const loadStakingPools = async () => {
        // Mock data - reemplazar con llamadas al contrato
        setStakingPools([
            {
                id: 0,
                name: 'Flexible',
                apyRate: 500, // 5%
                apy: '5%',
                minLockPeriod: 0,
                maxLockPeriod: 0,
                lockDays: 0,
                totalStaked: 1250,
                totalRewards: '12,500 BEZ',
                isActive: true,
                icon: FaUnlock,
                color: 'from-blue-500 to-cyan-500'
            },
            {
                id: 1,
                name: '30 Días',
                apyRate: 1000, // 10%
                apy: '10%',
                minLockPeriod: 30 * 24 * 60 * 60,
                maxLockPeriod: 30 * 24 * 60 * 60,
                lockDays: 30,
                totalStaked: 890,
                totalRewards: '45,000 BEZ',
                isActive: true,
                icon: FaClock,
                color: 'from-green-500 to-emerald-500'
            },
            {
                id: 2,
                name: '90 Días',
                apyRate: 2000, // 20%
                apy: '20%',
                minLockPeriod: 90 * 24 * 60 * 60,
                maxLockPeriod: 90 * 24 * 60 * 60,
                lockDays: 90,
                totalStaked: 567,
                totalRewards: '95,000 BEZ',
                isActive: true,
                icon: FaAward,
                color: 'from-purple-500 to-pink-500'
            },
            {
                id: 3,
                name: '180 Días',
                apyRate: 3500, // 35%
                apy: '35%',
                minLockPeriod: 180 * 24 * 60 * 60,
                maxLockPeriod: 180 * 24 * 60 * 60,
                lockDays: 180,
                totalStaked: 342,
                totalRewards: '175,000 BEZ',
                isActive: true,
                icon: FaTrendingUp,
                color: 'from-orange-500 to-red-500'
            },
            {
                id: 4,
                name: '1 Año',
                apyRate: 5000, // 50%
                apy: '50%',
                minLockPeriod: 365 * 24 * 60 * 60,
                maxLockPeriod: 365 * 24 * 60 * 60,
                lockDays: 365,
                totalStaked: 189,
                totalRewards: '350,000 BEZ',
                isActive: true,
                icon: FaFire,
                color: 'from-red-500 to-pink-500'
            }
        ]);
    };

    const loadMyNFTs = async () => {
        // Mock data
        setMyNFTs([
            {
                id: 1,
                name: 'BeZhas Genesis #123',
                image: 'https://picsum.photos/seed/nft1/300',
                contract: '0x1234...5678',
                tokenId: '123',
                rarity: 'Rare',
                multiplier: 120 // 1.2x
            },
            {
                id: 2,
                name: 'Premium Patent #456',
                image: 'https://picsum.photos/seed/nft2/300',
                contract: '0x8765...4321',
                tokenId: '456',
                rarity: 'Epic',
                multiplier: 150 // 1.5x
            }
        ]);
    };

    const loadMyStakes = async () => {
        // Mock data
        const now = Date.now();
        setMyStakes([
            {
                stakeId: '0x123',
                nftName: 'BeZhas Genesis #123',
                image: 'https://picsum.photos/seed/nft1/300',
                poolId: 1,
                poolName: '30 Días',
                apy: '10%',
                stakedAt: now - 10 * 24 * 60 * 60 * 1000, // 10 días atrás
                unlockAt: now + 20 * 24 * 60 * 60 * 1000, // 20 días restantes
                pendingRewards: '125.50',
                totalClaimed: '50.25',
                isActive: true,
                canUnstake: false
            },
            {
                stakeId: '0x456',
                nftName: 'Premium Patent #456',
                image: 'https://picsum.photos/seed/nft2/300',
                poolId: 0,
                poolName: 'Flexible',
                apy: '5%',
                stakedAt: now - 45 * 24 * 60 * 60 * 1000,
                unlockAt: now, // Ya puede unstake
                pendingRewards: '89.75',
                totalClaimed: '180.00',
                isActive: true,
                canUnstake: true
            }
        ]);
    };

    const handleStake = async () => {
        if (!selectedPool || !selectedNFT) {
            toast.error('Selecciona un pool y un NFT');
            return;
        }

        setLoading(true);
        try {
            // TODO: Implementar llamada al contrato NFTStaking.stakeNFT()

            toast.success('NFT stakeado exitosamente!');
            setSelectedPool(null);
            setSelectedNFT(null);
            await loadData();
        } catch (error) {
            console.error('Error staking NFT:', error);
            toast.error('Error al stakear NFT');
        } finally {
            setLoading(false);
        }
    };

    const handleUnstake = async (stakeId) => {
        setLoading(true);
        try {
            // TODO: Implementar llamada al contrato NFTStaking.unstakeNFT()

            toast.success('NFT unstakeado exitosamente!');
            await loadData();
        } catch (error) {
            console.error('Error unstaking NFT:', error);
            toast.error('Error al unstakear NFT');
        } finally {
            setLoading(false);
        }
    };

    const handleClaimRewards = async (stakeId) => {
        setLoading(true);
        try {
            // TODO: Implementar llamada al contrato NFTStaking.claimRewards()

            toast.success('Rewards reclamados exitosamente!');
            await loadData();
        } catch (error) {
            console.error('Error claiming rewards:', error);
            toast.error('Error al reclamar rewards');
        } finally {
            setLoading(false);
        }
    };

    const calculateTimeRemaining = (unlockAt) => {
        const now = Date.now();
        const diff = unlockAt - now;

        if (diff <= 0) return 'Disponible';

        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

        return `${days}d ${hours}h restantes`;
    };

    const renderPoolsTab = () => (
        <div className="space-y-6">
            {/* Staking Form */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-6 border border-purple-500/20">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-purple-400" />
                    Stakear tu NFT
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Seleccionar Pool */}
                    <div>
                        <label className="block text-sm font-medium mb-3">Selecciona Pool</label>
                        <div className="space-y-2">
                            {stakingPools.map((pool) => {
                                const Icon = pool.icon;
                                return (
                                    <button
                                        key={pool.id}
                                        onClick={() => setSelectedPool(pool)}
                                        className={`w-full bg-gray-800/50 hover:bg-gray-700/50 rounded-lg p-4 border-2 transition-all duration-200 ${selectedPool?.id === pool.id
                                            ? 'border-purple-500'
                                            : 'border-gray-700'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg bg-gradient-to-r ${pool.color}`}>
                                                    <Icon className="w-5 h-5 text-white" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-bold">{pool.name}</div>
                                                    <div className="text-sm text-gray-400">
                                                        {pool.lockDays === 0 ? 'Sin lock' : `${pool.lockDays} días`}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-xl text-green-400">{pool.apy}</div>
                                                <div className="text-xs text-gray-400">APY</div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Seleccionar NFT */}
                    <div>
                        <label className="block text-sm font-medium mb-3">Selecciona NFT</label>
                        <div className="space-y-2">
                            {myNFTs.map((nft) => (
                                <button
                                    key={nft.id}
                                    onClick={() => setSelectedNFT(nft)}
                                    className={`w-full bg-gray-800/50 hover:bg-gray-700/50 rounded-lg p-4 border-2 transition-all duration-200 ${selectedNFT?.id === nft.id
                                        ? 'border-purple-500'
                                        : 'border-gray-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={nft.image}
                                            alt={nft.name}
                                            className="w-16 h-16 rounded-lg object-cover"
                                        />
                                        <div className="flex-1 text-left">
                                            <div className="font-bold">{nft.name}</div>
                                            <div className="text-sm text-gray-400">{nft.rarity}</div>
                                            <div className="text-xs text-purple-400">
                                                Multiplier: {nft.multiplier / 100}x
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Resumen y botón */}
                {selectedPool && selectedNFT && (
                    <div className="space-y-4">
                        <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Pool:</span>
                                <span className="font-bold">{selectedPool.name}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">APY Base:</span>
                                <span className="font-bold text-green-400">{selectedPool.apy}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Multiplier NFT:</span>
                                <span className="font-bold text-purple-400">{selectedNFT.multiplier / 100}x</span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                                <span className="text-gray-400">APY Efectivo:</span>
                                <span className="font-bold text-xl text-yellow-400">
                                    {((selectedPool.apyRate * selectedNFT.multiplier) / 10000).toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Período de Lock:</span>
                                <span className="font-bold">
                                    {selectedPool.lockDays === 0 ? 'Sin lock' : `${selectedPool.lockDays} días`}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleStake}
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <FaSync className="w-5 h-5 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <Lock className="w-5 h-5" />
                                    Stakear NFT
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Pools Info */}
            <div>
                <h3 className="text-lg font-bold mb-4">Información de Pools</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stakingPools.map((pool) => {
                        const Icon = pool.icon;
                        return (
                            <div key={pool.id} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-3 rounded-lg bg-gradient-to-r ${pool.color}`}>
                                        <Icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">{pool.name}</h4>
                                        <p className="text-sm text-gray-400">{pool.lockDays === 0 ? 'Sin lock' : `${pool.lockDays} días`}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">APY:</span>
                                        <span className="font-bold text-xl text-green-400">{pool.apy}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Total Staked:</span>
                                        <span className="font-bold">{pool.totalStaked} NFTs</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Total Rewards:</span>
                                        <span className="font-bold text-purple-400">{pool.totalRewards}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderMyStakesTab = () => (
        <div className="space-y-6">
            {myStakes.length === 0 ? (
                <div className="text-center py-12">
                    <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">No tienes NFTs stakeados</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {myStakes.map((stake) => (
                        <div key={stake.stakeId} className="bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700">
                            <img
                                src={stake.image}
                                alt={stake.nftName}
                                className="w-full h-48 object-cover"
                            />
                            <div className="p-6 space-y-4">
                                <div>
                                    <h4 className="font-bold text-lg mb-1">{stake.nftName}</h4>
                                    <p className="text-sm text-gray-400">{stake.poolName} Pool - {stake.apy} APY</p>
                                </div>

                                {/* Rewards pendientes */}
                                <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-4 border border-green-500/30">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-gray-400">Rewards Pendientes:</span>
                                        <span className="font-bold text-2xl text-green-400">
                                            {stake.pendingRewards} BEZ
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleClaimRewards(stake.stakeId)}
                                        disabled={loading || parseFloat(stake.pendingRewards) === 0}
                                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                                    >
                                        <DollarSign className="w-4 h-4" />
                                        Claim Rewards
                                    </button>
                                </div>

                                {/* Estado del lock */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Total Reclamado:</span>
                                        <span className="font-bold text-purple-400">{stake.totalClaimed} BEZ</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Estado:</span>
                                        <span className={`font-bold flex items-center gap-1 ${stake.canUnstake ? 'text-green-400' : 'text-yellow-400'
                                            }`}>
                                            {stake.canUnstake ? (
                                                <>
                                                    <CheckCircle className="w-4 h-4" />
                                                    Disponible
                                                </>
                                            ) : (
                                                <>
                                                    <FaClock className="w-4 h-4" />
                                                    {calculateTimeRemaining(stake.unlockAt)}
                                                </>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/* Botón de unstake */}
                                <button
                                    onClick={() => handleUnstake(stake.stakeId)}
                                    disabled={loading || !stake.canUnstake}
                                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                                >
                                    <Unlock className="w-5 h-5" />
                                    {stake.canUnstake ? 'Unstake NFT' : 'Locked'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        NFT Staking
                    </h1>
                    <p className="text-gray-400">
                        Stakea tus NFTs y gana rewards en BEZ tokens
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-gray-700">
                    {[
                        { id: 'pools', label: 'Pools de Staking', icon: FaTrendingUp },
                        { id: 'my-stakes', label: 'Mis Stakes', icon: FaAward }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all duration-200 border-b-2 ${activeTab === tab.id
                                ? 'border-purple-500 text-purple-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div>
                    {activeTab === 'pools' && renderPoolsTab()}
                    {activeTab === 'my-stakes' && renderMyStakesTab()}
                </div>
            </div>
        </div>
    );
};

export default NFTStakingPanel;
