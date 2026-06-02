/**
 * RWA Page - Real World Assets Dashboard
 * Complete interface for tokenizing and managing real-world assets
 */

import React, { useState, useEffect } from 'react';
import {
    Building2,
    Coins,
    TrendingUp,
    Users,
    FileCheck,
    Plus,
    Filter,
    Search,
    ExternalLink,
    Clock,
    DollarSign,
    Percent,
    ChevronRight,
    AlertCircle,
    CheckCircle,
    X,
    Loader2,
    Flame
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { toast } from 'react-hot-toast';
import RealEstateRWAForm from '../components/RealEstateRWAForm';
import { useRWAContracts, CATEGORY_NAMES } from '../hooks/useRWAContracts';
import GlobalStatsBar from '../components/GlobalStatsBar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Mock data for demonstration (will be replaced by real contract data)
const MOCK_ASSETS = [
    {
        assetId: 1,
        name: 'Penthouse Madrid Centro',
        category: 0,
        categoryName: 'Inmueble',
        valuationUSD: 1500000,
        totalSupply: 1500,
        pricePerFraction: '100',
        estimatedYield: 8.5,
        creator: '0xBeZhasRWA',
        location: 'Madrid, España',
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400',
        investors: 45,
        sold: 720,
    },
    {
        assetId: 2,
        name: 'Hotel Boutique Barcelona',
        category: 1,
        categoryName: 'Hotel',
        valuationUSD: 5000000,
        totalSupply: 5000,
        pricePerFraction: '200',
        estimatedYield: 12.0,
        creator: '0xHotelGroup',
        location: 'Barcelona, España',
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
        investors: 120,
        sold: 3200,
    },
    {
        assetId: 3,
        name: 'Yate Luxury Mediterranean',
        category: 5,
        categoryName: 'Barco/Yate',
        valuationUSD: 2000000,
        totalSupply: 2000,
        pricePerFraction: '150',
        estimatedYield: 6.0,
        creator: '0xMarineAssets',
        location: 'Mónaco',
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=400',
        investors: 28,
        sold: 560,
    },
];

// Stats Card Component
const StatCard = ({ icon: Icon, label, value, subtext, color = 'blue' }) => {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-green-500 to-emerald-600',
        purple: 'from-purple-500 to-purple-600',
        amber: 'from-amber-500 to-orange-500',
    };

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg bg-gradient-to-br ${colors[color]}`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                {subtext && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {subtext}
                    </span>
                )}
            </div>
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
        </div>
    );
};

// Asset Card Component
const AssetCard = ({ asset, onInvest, onDetails }) => {
    const progress = (asset.sold / asset.totalSupply) * 100;

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700/50 hover:border-amber-500/50 transition-all group">
            {/* Image */}
            <div className="relative h-48 overflow-hidden">
                <img
                    src={asset.imageUrl}
                    alt={asset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs text-white font-medium">
                    {asset.categoryName}
                </div>
                <div className="absolute top-3 right-3 px-3 py-1 bg-green-500/80 backdrop-blur-sm rounded-full text-xs text-white font-bold flex items-center gap-1">
                    <Percent className="w-3 h-3" /> {asset.estimatedYield}% APY
                </div>
            </div>

            {/* Content */}
            <div className="p-5">
                <h3 className="text-lg font-bold text-white mb-2">{asset.name}</h3>
                <p className="text-sm text-gray-400 mb-4 flex items-center gap-1">
                    <Building2 className="w-4 h-4" /> {asset.location}
                </p>

                {/* Price Info */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Valoración</div>
                        <div className="text-lg font-bold text-white">${asset.valuationUSD.toLocaleString()}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Precio/Fracción</div>
                        <div className="text-lg font-bold text-amber-400">{asset.pricePerFraction} BEZ</div>
                    </div>
                </div>

                {/* Progress */}
                <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">{asset.investors} inversores</span>
                        <span className="text-white font-medium">{progress.toFixed(1)}% vendido</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={() => onDetails(asset)}
                        className="flex-1 py-2.5 px-4 border border-gray-600 rounded-lg text-white hover:bg-gray-700 transition-colors text-sm font-medium"
                    >
                        Detalles
                    </button>
                    <button
                        onClick={() => onInvest(asset)}
                        className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg text-black font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <Coins className="w-4 h-4" /> Invertir
                    </button>
                </div>
            </div>
        </div>
    );
};

// Main RWA Page Component
const RWAPage = () => {
    const { address, isConnected } = useAccount();
    const rwaContracts = useRWAContracts();

    const [assets, setAssets] = useState(MOCK_ASSETS);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Stats
    const totalValue = assets.reduce((sum, a) => sum + a.valuationUSD, 0);
    const totalInvestors = assets.reduce((sum, a) => sum + a.investors, 0);
    const avgYield = assets.reduce((sum, a) => sum + a.estimatedYield, 0) / assets.length;

    // Filter assets
    const filteredAssets = assets.filter((asset) => {
        const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.location.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' || asset.category.toString() === filter;
        return matchesSearch && matchesFilter;
    });

    const handleInvest = (asset) => {
        if (!isConnected) {
            toast.error('Conecta tu wallet para invertir');
            return;
        }
        // Open investment modal (to be implemented)
        toast('Función de inversión próximamente', { icon: '🚀' });
    };

    const handleDetails = (asset) => {
        // Open details modal (to be implemented)
        toast(`Detalles: ${asset.name}`, { icon: 'ℹ️' });
    };

    const handleTokenizeSuccess = (result) => {
        toast.success(`¡Activo tokenizado! ID: ${result.assetId}`);
        setShowCreateModal(false);
        // Refresh assets list
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* GLOBAL STATS BAR */}
            <GlobalStatsBar />

            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
                                <Building2 className="w-8 h-8 text-white" />
                            </div>
                            RWA Marketplace
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Invierte en activos del mundo real tokenizados
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl text-black font-bold transition-all shadow-lg shadow-amber-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        Tokenizar Activo
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        icon={DollarSign}
                        label="Valor Total Tokenizado"
                        value={`$${(totalValue / 1000000).toFixed(1)}M`}
                        subtext="+15% este mes"
                        color="green"
                    />
                    <StatCard
                        icon={Building2}
                        label="Activos Disponibles"
                        value={assets.length}
                        color="blue"
                    />
                    <StatCard
                        icon={Users}
                        label="Inversores Totales"
                        value={totalInvestors.toLocaleString()}
                        subtext="+32 esta semana"
                        color="purple"
                    />
                    <StatCard
                        icon={Percent}
                        label="Rendimiento Promedio"
                        value={`${avgYield.toFixed(1)}%`}
                        subtext="APY"
                        color="amber"
                    />
                </div>

                {/* Filters */}
                <div className="bg-gray-800/30 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar activos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-400" />
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="all">Todas las Categorías</option>
                            {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                                <option key={key} value={key}>{name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Assets Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    </div>
                ) : filteredAssets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAssets.map((asset) => (
                            <AssetCard
                                key={asset.assetId}
                                asset={asset}
                                onInvest={handleInvest}
                                onDetails={handleDetails}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">No hay activos disponibles</h3>
                        <p className="text-gray-400 mb-6">Sé el primero en tokenizar un activo del mundo real</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg text-black font-bold"
                        >
                            Tokenizar Ahora
                        </button>
                    </div>
                )}

                {/* Info Banner */}
                <div className="mt-10 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-amber-500/20 rounded-lg">
                            <FileCheck className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">¿Cómo funciona el RWA en BeZhas?</h3>
                            <ul className="text-gray-300 text-sm space-y-2">
                                <li className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    Tokeniza activos reales (inmuebles, vehículos, arte) en fracciones ERC-1155
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    Invierte desde 100 BEZ y recibe dividendos proporcionales automáticamente
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    Documentación legal almacenada en IPFS con verificación on-chain
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    Gobernanza por holders: vota en decisiones sobre el activo
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
                    <div className="bg-gray-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Tokenizar Activo Real</h2>
                                <p className="text-gray-400 text-sm">Convierte tu propiedad en tokens negociables</p>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            <RealEstateRWAForm onSuccess={handleTokenizeSuccess} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RWAPage;
