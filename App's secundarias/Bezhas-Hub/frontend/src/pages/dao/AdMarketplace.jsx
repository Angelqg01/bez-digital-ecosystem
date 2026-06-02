import React, { useState } from 'react';
import { ShoppingCart, BarChart2, ExternalLink, Globe, TrendingUp, DollarSign, Eye, MousePointer } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Datos simulados de "Ad Cards" (Inventario Tokenizado)
const adInventory = [
    {
        id: 101,
        name: "Header Banner Principal",
        location: "Home Page (Top)",
        dimensions: "728x90",
        traffic: "45k imp/mes",
        price: 50, // USDC por día
        status: "available",
        publisher: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        totalRevenue: 1250,
        impressions: 145000,
        ctr: 2.4, // Click-through rate %
        image: "https://via.placeholder.com/728x90?text=Header+Banner+Disponible"
    },
    {
        id: 102,
        name: "Sidebar Newsletter Box",
        location: "Blog Sidebar",
        dimensions: "300x250",
        traffic: "12k imp/mes",
        price: 15,
        status: "rented",
        renter: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
        expiry: "2 días",
        publisher: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
        totalRevenue: 450,
        impressions: 36000,
        ctr: 1.8,
        image: "https://via.placeholder.com/300x250?text=Rentado"
    },
    {
        id: 103,
        name: "Footer Sponsor Badge",
        location: "Footer (All Pages)",
        dimensions: "200x200",
        traffic: "8k imp/mes",
        price: 10,
        status: "available",
        publisher: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        totalRevenue: 0,
        impressions: 0,
        ctr: 0,
        image: "https://via.placeholder.com/200x200?text=Nuevo+Espacio"
    }
];

const AdMarketplace = () => {
    const [selectedCard, setSelectedCard] = useState(null);
    const [rentalDays, setRentalDays] = useState(30);

    const handleRent = (card) => {
        const totalCost = card.price * rentalDays;
        const daoFee = (totalCost * 0.20).toFixed(2); // 20% a DAO
        const publisherShare = (totalCost * 0.50).toFixed(2); // 50% a Publisher
        const userShare = (totalCost * 0.30).toFixed(2); // 30% a Usuarios

        toast.success(
            `💰 Transacción Iniciada:\n` +
            `Ad Card: ${card.name}\n` +
            `Costo: $${totalCost} USDC\n` +
            `Publisher: $${publisherShare} | DAO: $${daoFee}`,
            { duration: 6000 }
        );
    };

    const handleViewDetails = (card) => {
        setSelectedCard(card);
    };

    return (
        <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">

            {/* HEADER */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <ShoppingCart className="text-pink-600" size={32} />
                    DePub Marketplace
                </h1>
                <p className="text-gray-600 mt-2">
                    Inventario publicitario tokenizado como NFTs (ERC-721). Transparencia total on-chain.
                </p>
                <div className="flex gap-4 mt-4">
                    <span className="text-xs bg-pink-100 text-pink-800 px-3 py-1.5 rounded-full font-medium">
                        🏦 Protocol Fee: 20% → DAO Treasury
                    </span>
                    <span className="text-xs bg-green-100 text-green-800 px-3 py-1.5 rounded-full font-medium">
                        👤 Publisher Share: 50%
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full font-medium">
                        👥 User Rewards: 30%
                    </span>
                </div>
            </header>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-medium">Total TVL</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">$15.2k</p>
                        </div>
                        <DollarSign className="text-green-500" size={32} />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-medium">Ad Spaces</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{adInventory.length}</p>
                        </div>
                        <BarChart2 className="text-blue-500" size={32} />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-medium">Impresiones (mes)</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">65k</p>
                        </div>
                        <Eye className="text-purple-500" size={32} />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-medium">CTR Promedio</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">2.1%</p>
                        </div>
                        <TrendingUp className="text-orange-500" size={32} />
                    </div>
                </div>
            </div>

            {/* AD INVENTORY GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {adInventory.map((card) => (
                    <div
                        key={card.id}
                        className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-xl hover:border-pink-300 transition-all duration-300 transform hover:-translate-y-1"
                    >
                        {/* Visualización del Espacio (Thumbnail del NFT) */}
                        <div className="h-40 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center overflow-hidden relative">
                            <img src={card.image} alt={card.name} className="object-cover w-full opacity-90" />
                            <div className="absolute top-3 right-3">
                                <span
                                    className={`px-3 py-1 text-xs font-bold rounded-full shadow-lg ${card.status === 'available'
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-800 text-white'
                                        }`}
                                >
                                    {card.status === 'available' ? '✓ DISPONIBLE' : '🔒 RENTADO'}
                                </span>
                            </div>
                            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md">
                                <span className="text-white text-xs font-mono">NFT #{card.id}</span>
                            </div>
                        </div>

                        <div className="p-5">
                            <h3 className="font-bold text-lg text-gray-900 mb-1">{card.name}</h3>
                            <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                                <Globe size={12} /> {card.location}
                            </p>

                            {/* MÉTRICAS */}
                            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                                <div className="bg-blue-50 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-blue-700 mb-1">
                                        <Eye size={14} />
                                        <span className="text-xs font-medium">Tráfico</span>
                                    </div>
                                    <p className="font-bold text-blue-900">{card.traffic}</p>
                                </div>

                                <div className="bg-purple-50 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-purple-700 mb-1">
                                        <MousePointer size={14} />
                                        <span className="text-xs font-medium">CTR</span>
                                    </div>
                                    <p className="font-bold text-purple-900">{card.ctr}%</p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="text-xs text-gray-600 mb-1">Dimensiones</div>
                                    <p className="font-bold text-gray-900 text-sm">{card.dimensions}</p>
                                </div>

                                <div className="bg-green-50 rounded-lg p-3">
                                    <div className="text-xs text-gray-600 mb-1">Revenue Total</div>
                                    <p className="font-bold text-green-900 text-sm">${card.totalRevenue}</p>
                                </div>
                            </div>

                            {/* PRECIO Y ACCIÓN */}
                            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">Precio Diario</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        ${card.price}{' '}
                                        <span className="text-sm font-normal text-gray-500">USDC</span>
                                    </p>
                                </div>

                                {card.status === 'available' ? (
                                    <button
                                        onClick={() => handleViewDetails(card)}
                                        className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:from-pink-600 hover:to-purple-700 transition text-sm font-semibold shadow-md hover:shadow-lg"
                                    >
                                        <ShoppingCart size={18} /> Rentar
                                    </button>
                                ) : (
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">Expira en</p>
                                        <p className="text-sm font-bold text-red-500">{card.expiry}</p>
                                    </div>
                                )}
                            </div>

                            {/* PUBLISHER INFO */}
                            <div className="mt-4 pt-3 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">Publisher (NFT Owner)</p>
                                <p className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">
                                    {card.publisher.substring(0, 6)}...{card.publisher.substring(38)}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* RENTAL MODAL */}
            {selectedCard && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedCard.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">NFT #{selectedCard.id}</p>
                            </div>
                            <button
                                onClick={() => setSelectedCard(null)}
                                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg p-4 border border-pink-200">
                            <p className="text-sm text-gray-700 mb-3">
                                <strong>Período de Renta:</strong>
                            </p>
                            <input
                                type="range"
                                min="1"
                                max="365"
                                value={rentalDays}
                                onChange={(e) => setRentalDays(parseInt(e.target.value))}
                                className="w-full"
                            />
                            <div className="flex justify-between text-sm font-medium text-gray-800 mt-2">
                                <span>1 día</span>
                                <span className="text-pink-600 text-lg font-bold">{rentalDays} días</span>
                                <span>1 año</span>
                            </div>
                        </div>

                        {/* CÁLCULO DE COSTOS */}
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Precio por día:</span>
                                <span className="font-medium">${selectedCard.price} USDC</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                                <span>Costo Total:</span>
                                <span className="text-pink-600">${selectedCard.price * rentalDays} USDC</span>
                            </div>
                        </div>

                        {/* DISTRIBUCIÓN DE REVENUE */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-xs font-bold text-blue-900 mb-3 uppercase">
                                📊 Distribución Automática On-Chain:
                            </p>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-700">Publisher (50%):</span>
                                    <span className="font-bold text-green-700">
                                        ${(selectedCard.price * rentalDays * 0.5).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-700">Usuarios (30%):</span>
                                    <span className="font-bold text-blue-700">
                                        ${(selectedCard.price * rentalDays * 0.3).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-700">DAO Treasury (20%):</span>
                                    <span className="font-bold text-purple-700">
                                        ${(selectedCard.price * rentalDays * 0.2).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* BOTONES DE ACCIÓN */}
                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => setSelectedCard(null)}
                                className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-100 py-3 rounded-lg font-medium transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleRent(selectedCard)}
                                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-bold hover:from-pink-600 hover:to-purple-700 transition shadow-lg"
                            >
                                Confirmar Renta
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 text-center">
                            Esta transacción interactúa con{' '}
                            <code className="bg-gray-200 px-1 rounded">AdvertisingPlugin.sol</code>
                        </p>
                    </div>
                </div>
            )}

            {/* BANNER INFORMATIVO DE INTEGRACIÓN */}
            <div className="mt-8 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 text-blue-900 text-sm flex items-start gap-3 shadow-sm">
                <ExternalLink className="mt-0.5 flex-shrink-0 text-blue-600" size={20} />
                <div>
                    <p className="font-bold mb-2">🔗 Integración Smart Contract</p>
                    <p className="text-blue-800">
                        Este marketplace está conectado con{' '}
                        <code className="bg-blue-200/50 px-2 py-0.5 rounded font-mono text-xs">
                            AdvertisingPlugin.sol
                        </code>
                        . Cada transacción de renta dispara automáticamente:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-blue-700">
                        <li>Transferencia USDC del anunciante al contrato</li>
                        <li>Distribución automática según ratio 50/30/20</li>
                        <li>Actualización de métricas (impresiones, revenue) via oracles</li>
                        <li>Registro de transacción visible en /dao/treasury</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AdMarketplace;
