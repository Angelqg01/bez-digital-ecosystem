import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBuilding, FaHotel, FaStore, FaTshirt, FaCar,
    FaShip, FaHelicopter, FaGem, FaCoins, FaChartLine,
    FaUsers, FaTrophy, FaFire, FaArrowRight, FaCheckCircle,
    FaInfoCircle, FaGlobe, FaLock, FaUserFriends, FaCode
} from 'react-icons/fa';
import RealEstateRWAForm from '../components/RealEstateRWAForm';
import { ASSET_CATEGORIES, CATEGORY_NAMES } from '../hooks/useRWAContracts';

const RealEstateGame = () => {
    const navigate = useNavigate();
    const [mode, setMode] = useState('browse'); // browse | tokenize | marketplace
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Featured properties for the demo
    const featuredProperties = [
        {
            id: 1,
            category: ASSET_CATEGORIES.HOTEL,
            name: 'Hotel Playa Sol Cancún',
            image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
            valuation: 5000000,
            fractions: 10000,
            pricePerFraction: 500,
            apy: 12.5,
            location: 'Cancún, México',
            sold: 6500,
            investors: 245,
            trending: true
        },
        {
            id: 2,
            category: ASSET_CATEGORIES.INMUEBLE,
            name: 'Penthouse Manhattan',
            image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
            valuation: 3200000,
            fractions: 8000,
            pricePerFraction: 400,
            apy: 8.5,
            location: 'Nueva York, USA',
            sold: 7200,
            investors: 312,
            trending: true
        },
        {
            id: 3,
            category: ASSET_CATEGORIES.COCHE,
            name: 'Ferrari F8 Tributo 2023',
            image: 'https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=800',
            valuation: 280000,
            fractions: 1000,
            pricePerFraction: 280,
            apy: 6.0,
            location: 'Miami, Florida',
            sold: 850,
            investors: 98,
            trending: false
        },
        {
            id: 4,
            category: ASSET_CATEGORIES.BARCO,
            name: 'Yate Azimut S7',
            image: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800',
            valuation: 1500000,
            fractions: 5000,
            pricePerFraction: 300,
            apy: 10.0,
            location: 'Marina Puerto Banús',
            sold: 3200,
            investors: 156,
            trending: false
        },
        {
            id: 5,
            category: ASSET_CATEGORIES.LOCAL,
            name: 'Local Comercial 5ª Avenida',
            image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
            valuation: 2500000,
            fractions: 10000,
            pricePerFraction: 250,
            apy: 15.0,
            location: 'Nueva York, USA',
            sold: 8500,
            investors: 420,
            trending: true
        },
        {
            id: 6,
            category: ASSET_CATEGORIES.HELICOPTERO,
            name: 'Bell 429 Executive',
            image: 'https://images.unsplash.com/photo-1589308078059-be1415eab96c?w=800',
            valuation: 6500000,
            fractions: 13000,
            pricePerFraction: 500,
            apy: 7.5,
            location: 'Hangar Dubai',
            sold: 4500,
            investors: 189,
            trending: false
        }
    ];

    // Stats for the game
    const stats = {
        totalValue: featuredProperties.reduce((sum, p) => sum + p.valuation, 0),
        totalInvestors: featuredProperties.reduce((sum, p) => sum + p.investors, 0),
        avgAPY: (featuredProperties.reduce((sum, p) => sum + p.apy, 0) / featuredProperties.length).toFixed(1),
        totalAssets: featuredProperties.length
    };

    const handleTokenizeSuccess = (result) => {
        console.log('Tokenization successful:', result);
        setShowSuccessModal(true);
        setTimeout(() => {
            setMode('marketplace');
            setShowSuccessModal(false);
        }, 3000);
    };

    const getCategoryIcon = (category) => {
        const icons = {
            [ASSET_CATEGORIES.INMUEBLE]: FaBuilding,
            [ASSET_CATEGORIES.HOTEL]: FaHotel,
            [ASSET_CATEGORIES.LOCAL]: FaStore,
            [ASSET_CATEGORIES.ROPA]: FaTshirt,
            [ASSET_CATEGORIES.COCHE]: FaCar,
            [ASSET_CATEGORIES.BARCO]: FaShip,
            [ASSET_CATEGORIES.HELICOPTERO]: FaHelicopter,
            [ASSET_CATEGORIES.OBJETO]: FaGem
        };
        return icons[category] || FaBuilding;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-gradient-to-r from-gold-600 via-gold-500 to-yellow-500 text-black">
                <div className="max-w-7xl mx-auto px-4 py-12">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-4xl font-black mb-2 flex items-center gap-3">
                                <FaBuilding className="text-5xl" />
                                Real Estate Demo
                            </h1>
                            <p className="text-lg opacity-90">
                                Tokeniza y fracciona activos del mundo real en la blockchain
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 sm:flex-row">
                            {/* Tokenize Property Button */}
                            <button
                                onClick={() => navigate('/create?tab=standard')}
                                className="group relative inline-flex items-center justify-center px-6 py-3 font-bold text-white transition-all duration-300 bg-emerald-600 rounded-xl hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 shadow-xl hover:shadow-emerald-500/50 hover:scale-105 active:scale-95"
                            >
                                <span className="absolute inset-0 w-full h-full -mt-1 rounded-xl opacity-30 bg-gradient-to-b from-white/20 via-transparent to-black/20"></span>
                                <span className="relative flex items-center gap-2 uppercase tracking-wide text-sm">
                                    <FaBuilding className="w-5 h-5 transition-transform group-hover:-translate-y-1" />
                                    Tokenizar Propiedad
                                </span>
                            </button>

                            {/* Developer SDK Button */}
                            <button
                                onClick={() => navigate('/developer-console')}
                                className="group relative inline-flex items-center justify-center px-6 py-3 font-bold text-white transition-all duration-300 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600 shadow-xl hover:shadow-purple-500/50 hover:scale-105 active:scale-95"
                            >
                                <span className="absolute inset-0 w-full h-full -mt-1 rounded-xl opacity-30 bg-gradient-to-b from-white/20 via-transparent to-black/20"></span>
                                <span className="relative flex items-center gap-2 uppercase tracking-wide text-sm">
                                    <FaCode className="w-5 h-5 transition-transform group-hover:rotate-12" />
                                    SDK Inmobiliario
                                </span>
                            </button>
                        </div>
                    </div>
                    <div className="hidden md:flex gap-8 text-right">
                        <div>
                            <div className="text-3xl font-black">${(stats.totalValue / 1000000).toFixed(1)}M</div>
                            <div className="text-sm opacity-80">Valor Total</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black">{stats.totalInvestors}</div>
                            <div className="text-sm opacity-80">Inversores</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black">{stats.avgAPY}%</div>
                            <div className="text-sm opacity-80">APY Promedio</div>
                        </div>
                    </div>
                </div>

                {/* Mode Selector */}
                <div className="flex gap-3 mt-8">
                    <button
                        onClick={() => setMode('browse')}
                        className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all ${mode === 'browse'
                            ? 'bg-black text-gold-400 shadow-lg'
                            : 'bg-black/20 hover:bg-black/30'
                            }`}
                    >
                        <FaGlobe /> Explorar Marketplace
                    </button>
                    <button
                        onClick={() => setMode('tokenize')}
                        className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all ${mode === 'tokenize'
                            ? 'bg-black text-gold-400 shadow-lg'
                            : 'bg-black/20 hover:bg-black/30'
                            }`}
                    >
                        <FaCoins /> Tokenizar Activo
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Browse Mode - Marketplace */}
                {mode === 'browse' && (
                    <div className="space-y-8 animate-fade-in">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <FaBuilding className="text-3xl text-gold-500 mb-2" />
                                <div className="text-2xl font-black">{stats.totalAssets}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Activos Activos</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <FaUsers className="text-3xl text-blue-500 mb-2" />
                                <div className="text-2xl font-black">{stats.totalInvestors}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Inversores</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <FaChartLine className="text-3xl text-green-500 mb-2" />
                                <div className="text-2xl font-black">{stats.avgAPY}%</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">APY Medio</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <FaTrophy className="text-3xl text-purple-500 mb-2" />
                                <div className="text-2xl font-black">${(stats.totalValue / 1000000).toFixed(1)}M</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Capitalización</div>
                            </div>
                        </div>

                        {/* Info Banner */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-xl">
                            <div className="flex items-start gap-4">
                                <FaInfoCircle className="text-3xl text-blue-500 flex-shrink-0 mt-1" />
                                <div>
                                    <h3 className="font-bold text-lg mb-2 text-blue-900 dark:text-blue-100">
                                        ¿Cómo funciona la tokenización de activos reales?
                                    </h3>
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        Los activos del mundo real (RWA) se dividen en fracciones representadas por tokens en blockchain.
                                        Cada token representa propiedad parcial del activo y genera rentas pasivas proporcionales.
                                        Puedes comprar, vender y comerciar estas fracciones como cualquier criptomoneda.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Properties Grid */}
                        <div>
                            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                                <FaFire className="text-orange-500" />
                                Activos Destacados
                            </h2>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {featuredProperties.map((property) => {
                                    const Icon = getCategoryIcon(property.category);
                                    const soldPercentage = (property.sold / property.fractions) * 100;

                                    return (
                                        <div
                                            key={property.id}
                                            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer"
                                            onClick={() => setSelectedProperty(property)}
                                        >
                                            {/* Image */}
                                            <div className="relative h-48 overflow-hidden">
                                                <img
                                                    src={property.image}
                                                    alt={property.name}
                                                    className="w-full h-full object-cover"
                                                />
                                                {property.trending && (
                                                    <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                        <FaFire /> Trending
                                                    </div>
                                                )}
                                                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                                    <Icon /> {CATEGORY_NAMES[property.category]}
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="p-5">
                                                <h3 className="font-black text-lg mb-2">{property.name}</h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex items-center gap-1">
                                                    <FaGlobe className="text-xs" /> {property.location}
                                                </p>

                                                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                                                    <div>
                                                        <div className="text-gray-600 dark:text-gray-400 text-xs">Valoración</div>
                                                        <div className="font-bold">${(property.valuation / 1000000).toFixed(2)}M</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-600 dark:text-gray-400 text-xs">APY</div>
                                                        <div className="font-bold text-green-600 dark:text-green-400">{property.apy}%</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-600 dark:text-gray-400 text-xs">Precio/Fracción</div>
                                                        <div className="font-bold">{property.pricePerFraction} BEZ</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-600 dark:text-gray-400 text-xs">Inversores</div>
                                                        <div className="font-bold flex items-center gap-1">
                                                            <FaUsers className="text-xs" /> {property.investors}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="mb-3">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-gray-600 dark:text-gray-400">Fracciones Vendidas</span>
                                                        <span className="font-bold">{soldPercentage.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all"
                                                            style={{ width: `${soldPercentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                <button className="w-full bg-gold-500 hover:bg-gold-600 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                                    Invertir Ahora <FaArrowRight />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tokenize Mode */}
                {mode === 'tokenize' && (
                    <div className="max-w-4xl mx-auto animate-fade-in">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
                            <div className="mb-8">
                                <h2 className="text-3xl font-black mb-3 flex items-center gap-3">
                                    <FaCoins className="text-gold-500" />
                                    Tokenizar Nuevo Activo
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Convierte tu propiedad física en tokens digitales y comienza a recibir inversión fraccionada
                                </p>
                            </div>

                            <RealEstateRWAForm onSuccess={handleTokenizeSuccess} />
                        </div>
                    </div>
                )}
            </div>

            {/* Success Modal */}
            {
                showSuccessModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full animate-scale-in">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <FaCheckCircle className="text-5xl text-green-500" />
                                </div>
                                <h3 className="text-2xl font-black mb-3">¡Activo Tokenizado!</h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Tu activo ha sido tokenizado exitosamente y está listo para recibir inversiones en el marketplace.
                                </p>
                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        setMode('browse');
                                    }}
                                    className="w-full bg-gold-500 hover:bg-gold-600 text-black font-bold py-3 rounded-lg transition-colors"
                                >
                                    Ver en Marketplace
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Property Detail Modal */}
            {
                selectedProperty && (
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setSelectedProperty(null)}
                    >
                        <div
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative h-96">
                                <img
                                    src={selectedProperty.image}
                                    alt={selectedProperty.name}
                                    className="w-full h-full object-cover"
                                />
                                <button
                                    onClick={() => setSelectedProperty(null)}
                                    className="absolute top-4 right-4 w-12 h-12 bg-black/70 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-black transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-8">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h2 className="text-3xl font-black mb-2">{selectedProperty.name}</h2>
                                        <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                            <FaGlobe /> {selectedProperty.location}
                                        </p>
                                    </div>
                                    {selectedProperty.trending && (
                                        <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-4 py-2 rounded-full font-bold flex items-center gap-2">
                                            <FaFire /> Trending
                                        </div>
                                    )}
                                </div>

                                <div className="grid md:grid-cols-3 gap-6 mb-8">
                                    <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl">
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Valoración Total</div>
                                        <div className="text-2xl font-black">${(selectedProperty.valuation / 1000000).toFixed(2)}M</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl">
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">APY Anual</div>
                                        <div className="text-2xl font-black text-green-600 dark:text-green-400">{selectedProperty.apy}%</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl">
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Inversores</div>
                                        <div className="text-2xl font-black">{selectedProperty.investors}</div>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <h3 className="font-bold text-lg mb-4">Detalles de Tokenización</h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="flex justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                            <span className="text-gray-600 dark:text-gray-400">Fracciones Totales</span>
                                            <span className="font-bold">{selectedProperty.fractions.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                            <span className="text-gray-600 dark:text-gray-400">Precio por Fracción</span>
                                            <span className="font-bold">{selectedProperty.pricePerFraction} BEZ</span>
                                        </div>
                                        <div className="flex justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                            <span className="text-gray-600 dark:text-gray-400">Fracciones Vendidas</span>
                                            <span className="font-bold">{selectedProperty.sold.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                            <span className="text-gray-600 dark:text-gray-400">Disponibles</span>
                                            <span className="font-bold">{(selectedProperty.fractions - selectedProperty.sold).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <button className="w-full bg-gold-500 hover:bg-gold-600 text-black font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-3 transition-colors">
                                    <FaCoins className="text-xl" />
                                    Invertir en Este Activo
                                    <FaArrowRight />
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}

export default RealEstateGame;
