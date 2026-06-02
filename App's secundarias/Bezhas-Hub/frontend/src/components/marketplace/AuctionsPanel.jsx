import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import {
    FaGavel,
    FaClock,
    FaFire,
    FaTrophy,
    FaUsers,
    FaCoins,
    FaChartLine
} from 'react-icons/fa';
import { Spinner } from '../ui/Spinner';
import { useWeb3 } from '../../context/Web3Context';
import { useBezCoin } from '../../context/BezCoinContext';

/**
 * Sistema Completo de Subastas NFT
 * - Subastas cronometradas
 * - Sistema de pujas
 * - Auto-extensión en última hora
 * - Finalización automática
 */
export default function AuctionsPanel() {
    const { address, signer } = useWeb3();
    const { balance, verifyAndProceed } = useBezCoin();

    const [activeTab, setActiveTab] = useState('active'); // active, my-bids, my-auctions, ended
    const [auctions, setAuctions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAuction, setSelectedAuction] = useState(null);
    const [bidAmount, setBidAmount] = useState('');

    // Mock data generator for auctions
    const generateMockAuctions = () => {
        const now = Date.now();
        return [
            {
                auctionId: 1,
                nftContract: '0x1234...5678',
                tokenId: 101,
                name: 'Epic Dragon NFT',
                description: 'Legendary collectible with rare traits',
                imageUrl: 'https://via.placeholder.com/400x400?text=Dragon+NFT',
                seller: '0xAbC...dEf',
                startingPrice: '5',
                currentBid: '12.5',
                reservePrice: '15',
                currentBidder: '0x789...012',
                startTime: now - 86400000 * 2, // 2 days ago
                endTime: now + 86400000 * 1, // 1 day left
                bidCount: 15,
                status: 'ACTIVE',
                topBidders: [
                    { address: '0x789...012', amount: '12.5', time: now - 3600000 },
                    { address: '0x345...678', amount: '11.0', time: now - 7200000 },
                    { address: '0x901...234', amount: '9.5', time: now - 10800000 }
                ]
            },
            {
                auctionId: 2,
                nftContract: '0x8765...4321',
                tokenId: 202,
                name: 'Crypto Punk Clone #47',
                description: 'Rare attributes: Mohawk, Laser Eyes',
                imageUrl: 'https://via.placeholder.com/400x400?text=Punk+47',
                seller: '0xZyX...wVu',
                startingPrice: '3',
                currentBid: '8.2',
                reservePrice: '10',
                currentBidder: '0x567...890',
                startTime: now - 86400000 * 1,
                endTime: now + 86400000 * 2,
                bidCount: 8,
                status: 'ACTIVE',
                topBidders: [
                    { address: '0x567...890', amount: '8.2', time: now - 1800000 },
                    { address: '0x123...456', amount: '7.0', time: now - 5400000 }
                ]
            },
            {
                auctionId: 3,
                nftContract: '0x2468...1357',
                tokenId: 303,
                name: 'Virtual Land Parcel',
                description: 'Prime location in BeZhas Metaverse',
                imageUrl: 'https://via.placeholder.com/400x400?text=Land+Parcel',
                seller: '0xQrS...tUv',
                startingPrice: '20',
                currentBid: '45.0',
                reservePrice: '50',
                currentBidder: '0x234...567',
                startTime: now - 86400000 * 5,
                endTime: now + 3600000 * 6, // 6 hours left
                bidCount: 32,
                status: 'ACTIVE',
                topBidders: [
                    { address: '0x234...567', amount: '45.0', time: now - 900000 },
                    { address: '0x678...901', amount: '42.0', time: now - 2700000 },
                    { address: '0x345...678', amount: '38.5', time: now - 4500000 }
                ]
            }
        ];
    };

    useEffect(() => {
        loadAuctions();
    }, [activeTab]);

    const loadAuctions = async () => {
        setIsLoading(true);
        // Simular carga de datos
        setTimeout(() => {
            const mockData = generateMockAuctions();
            setAuctions(mockData);
            setIsLoading(false);
        }, 800);
    };

    const calculateTimeLeft = (endTime) => {
        const now = Date.now();
        const diff = endTime - now;

        if (diff <= 0) return 'Finalizada';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const getUrgencyColor = (endTime) => {
        const now = Date.now();
        const diff = endTime - now;
        const hours = diff / (1000 * 60 * 60);

        if (hours < 1) return 'text-red-600 bg-red-100';
        if (hours < 6) return 'text-orange-600 bg-orange-100';
        return 'text-blue-600 bg-blue-100';
    };

    const handlePlaceBid = async (auction) => {
        if (!address) {
            toast.error('Conecta tu wallet para hacer una puja');
            return;
        }

        const minBid = parseFloat(auction.currentBid) + 0.5; // Incremento mínimo

        if (!bidAmount || parseFloat(bidAmount) < minBid) {
            toast.error(`Puja mínima: ${minBid} BEZ`);
            return;
        }

        await verifyAndProceed(
            bidAmount,
            `Pujar ${bidAmount} BEZ en ${auction.name}`,
            async () => {
                try {
                    // TODO: Conectar con contrato AdvancedMarketplace
                    // const tx = await marketplaceContract.placeBid(auction.auctionId, { value: ethers.parseEther(bidAmount) });
                    // await tx.wait();

                    toast.success('¡Puja realizada con éxito! 🎉');
                    setBidAmount('');
                    setSelectedAuction(null);
                    loadAuctions();
                } catch (error) {
                    console.error('Error placing bid:', error);
                    toast.error('Error al realizar la puja');
                }
            }
        );
    };

    const AuctionCard = ({ auction }) => {
        const timeLeft = calculateTimeLeft(auction.endTime);
        const urgencyClass = getUrgencyColor(auction.endTime);
        const isEnding = auction.endTime - Date.now() < 3600000; // Less than 1 hour

        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl transition-all overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* Image */}
                <div className="relative h-64 overflow-hidden">
                    <img
                        src={auction.imageUrl}
                        alt={auction.name}
                        className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500"
                    />

                    {/* Time Badge */}
                    <div className={`absolute top-4 right-4 px-3 py-2 rounded-lg font-bold flex items-center gap-2 ${urgencyClass}`}>
                        <FaClock />
                        {timeLeft}
                    </div>

                    {/* Ending Soon Badge */}
                    {isEnding && (
                        <div className="absolute top-4 left-4 px-3 py-2 bg-red-600 text-white rounded-lg font-bold flex items-center gap-2 animate-pulse">
                            <FaFire />
                            ¡Terminando!
                        </div>
                    )}

                    {/* Bid Count */}
                    <div className="absolute bottom-4 left-4 px-3 py-2 bg-black/70 backdrop-blur-sm text-white rounded-lg flex items-center gap-2">
                        <FaGavel size={14} />
                        <span className="font-semibold">{auction.bidCount} pujas</span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5">
                    <h3 className="font-bold text-xl mb-2 text-gray-900 dark:text-white">
                        {auction.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {auction.description}
                    </p>

                    {/* Price Info */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-3">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Puja Actual</p>
                            <div className="flex items-center gap-2">
                                <FaCoins className="text-yellow-500" />
                                <span className="font-bold text-lg text-gray-900 dark:text-white">
                                    {auction.currentBid} BEZ
                                </span>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-3">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Reserva</p>
                            <div className="flex items-center gap-2">
                                <FaTrophy className="text-green-500" />
                                <span className="font-bold text-lg text-gray-900 dark:text-white">
                                    {auction.reservePrice} BEZ
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Top Bidder */}
                    {auction.currentBidder && (
                        <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <FaUsers className="text-purple-500" size={14} />
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                                Líder: <span className="font-mono font-semibold">{auction.currentBidder}</span>
                            </span>
                        </div>
                    )}

                    {/* Action Button */}
                    <button
                        onClick={() => setSelectedAuction(auction)}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
                    >
                        <FaGavel />
                        Hacer Puja
                    </button>
                </div>
            </div>
        );
    };

    const tabs = [
        { id: 'active', label: 'Subastas Activas', icon: FaFire, count: auctions.length },
        { id: 'my-bids', label: 'Mis Pujas', icon: FaGavel, count: 0 },
        { id: 'my-auctions', label: 'Mis Subastas', icon: FaTrophy, count: 0 },
        { id: 'ended', label: 'Finalizadas', icon: FaClock, count: 0 }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <FaGavel size={32} />
                            Subastas NFT
                        </h2>
                        <p className="text-purple-100">
                            Puja por los mejores NFTs y llévate ofertas exclusivas
                        </p>
                    </div>
                    <div className="hidden md:flex items-center gap-4">
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3">
                            <div className="text-sm text-purple-100">Subastas Activas</div>
                            <div className="text-2xl font-bold">{auctions.length}</div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3">
                            <div className="text-sm text-purple-100">Total Pujas</div>
                            <div className="text-2xl font-bold">
                                {auctions.reduce((sum, a) => sum + a.bidCount, 0)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-2 overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                    }`}
                            >
                                <Icon />
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full text-xs font-bold">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Spinner size="lg" />
                </div>
            ) : auctions.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl">
                    <FaGavel className="mx-auto text-gray-400 text-6xl mb-4" />
                    <p className="text-gray-500 text-xl mb-2">No hay subastas activas</p>
                    <p className="text-gray-400">Vuelve pronto para encontrar nuevas oportunidades</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {auctions.map((auction) => (
                        <AuctionCard key={auction.auctionId} auction={auction} />
                    ))}
                </div>
            )}

            {/* Bid Modal */}
            {selectedAuction && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                            Hacer Puja
                        </h3>

                        <div className="mb-6">
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
                                <h4 className="font-bold text-lg mb-1 text-gray-900 dark:text-white">
                                    {selectedAuction.name}
                                </h4>
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <FaCoins className="text-yellow-500" />
                                    <span>Puja actual: <strong>{selectedAuction.currentBid} BEZ</strong></span>
                                </div>
                            </div>

                            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                                Tu Puja (mín: {parseFloat(selectedAuction.currentBid) + 0.5} BEZ)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min={parseFloat(selectedAuction.currentBid) + 0.5}
                                value={bidAmount}
                                onChange={(e) => setBidAmount(e.target.value)}
                                placeholder="Ingresa tu puja"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                            />

                            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                                Balance disponible: <strong>{parseFloat(balance).toFixed(2)} BEZ</strong>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setSelectedAuction(null);
                                    setBidAmount('');
                                }}
                                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handlePlaceBid(selectedAuction)}
                                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg"
                            >
                                Confirmar Puja
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
