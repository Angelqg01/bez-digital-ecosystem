import React, { useState, useEffect } from 'react';
import {
    FaWallet,
    FaTrendingUp,
    FaUsers,
    FaLock,
    FaUnlock,
    FaChartPie,
    FaShoppingCart,
    FaExclamationCircle,
    FaCheckCircle,
    FaArrowRight,
    FaSync
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';

const FractionalizationPanel = () => {
    const [activeTab, setActiveTab] = useState('fractionalize');
    const [myNFTs, setMyNFTs] = useState([]);
    const [fractionedNFTs, setFractionedNFTs] = useState([]);
    const [myFractions, setMyFractions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Estado del formulario de fracionalización
    const [fractionalizeForm, setFractionalizeForm] = useState({
        nftContract: '',
        tokenId: '',
        totalFractions: 100,
        pricePerFraction: '',
    });

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            // TODO: Cargar datos reales desde el contrato
            await loadMyNFTs();
            await loadFractionedNFTs();
            await loadMyFractions();
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const loadMyNFTs = async () => {
        // Mock data - reemplazar con llamadas reales al contrato
        setMyNFTs([
            {
                id: 1,
                name: 'BeZhas Genesis #123',
                image: 'https://picsum.photos/seed/nft1/300',
                contract: '0x1234...5678',
                tokenId: '123',
                estimatedValue: '5.5 ETH'
            },
            {
                id: 2,
                name: 'Patent Certificate #456',
                image: 'https://picsum.photos/seed/nft2/300',
                contract: '0x8765...4321',
                tokenId: '456',
                estimatedValue: '12.3 ETH'
            }
        ]);
    };

    const loadFractionedNFTs = async () => {
        // Mock data
        setFractionedNFTs([
            {
                fractionId: 1,
                name: 'Rare Digital Art #789',
                image: 'https://picsum.photos/seed/frac1/300',
                totalFractions: 1000,
                pricePerFraction: '0.05',
                fractionsAvailable: 650,
                fractionsSold: 350,
                originalOwner: '0xabcd...efgh',
                isActive: true
            },
            {
                fractionId: 2,
                name: 'Premium Patent #234',
                image: 'https://picsum.photos/seed/frac2/300',
                totalFractions: 500,
                pricePerFraction: '0.15',
                fractionsAvailable: 120,
                fractionsSold: 380,
                originalOwner: '0x9876...5432',
                isActive: true
            }
        ]);
    };

    const loadMyFractions = async () => {
        // Mock data
        setMyFractions([
            {
                fractionId: 1,
                name: 'Rare Digital Art #789',
                image: 'https://picsum.photos/seed/frac1/300',
                fractionsOwned: 50,
                totalFractions: 1000,
                ownershipPercent: 5,
                currentValue: '2.5 ETH',
                canReassemble: false
            },
            {
                fractionId: 3,
                name: 'Vintage NFT Collection',
                image: 'https://picsum.photos/seed/frac3/300',
                fractionsOwned: 200,
                totalFractions: 200,
                ownershipPercent: 100,
                currentValue: '10 ETH',
                canReassemble: true
            }
        ]);
    };

    const handleFractionalize = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // TODO: Implementar llamada al contrato FractionalNFT.fractionalizeNFT()

            toast.success('NFT fracionalizado exitosamente!');
            setFractionalizeForm({
                nftContract: '',
                tokenId: '',
                totalFractions: 100,
                pricePerFraction: '',
            });
            await loadData();
        } catch (error) {
            console.error('Error fractionalizing NFT:', error);
            toast.error('Error al fraccionalizar NFT');
        } finally {
            setLoading(false);
        }
    };

    const handleBuyFractions = async (fractionId, amount) => {
        setLoading(true);

        try {
            // TODO: Implementar llamada al contrato FractionalNFT.buyFractions()

            toast.success(`${amount} fracciones compradas exitosamente!`);
            await loadData();
        } catch (error) {
            console.error('Error buying fractions:', error);
            toast.error('Error al comprar fracciones');
        } finally {
            setLoading(false);
        }
    };

    const handleReassemble = async (fractionId) => {
        setLoading(true);

        try {
            // TODO: Implementar llamada al contrato FractionalNFT.reassembleNFT()

            toast.success('NFT reensamblado exitosamente!');
            await loadData();
        } catch (error) {
            console.error('Error reassembling NFT:', error);
            toast.error('Error al reensamblar NFT');
        } finally {
            setLoading(false);
        }
    };

    const renderFractionalizeTab = () => (
        <div className="space-y-6">
            {/* Formulario de fracionalización */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-6 border border-purple-500/20">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaChartPie className="w-5 h-5 text-purple-400" />
                    Fraccionalizar tu NFT
                </h3>

                <form onSubmit={handleFractionalize} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Selecciona tu NFT
                        </label>
                        <select
                            className="w-full bg-gray-800 rounded-lg px-4 py-3 border border-gray-700 focus:border-purple-500 focus:outline-none"
                            value={`${fractionalizeForm.nftContract}-${fractionalizeForm.tokenId}`}
                            onChange={(e) => {
                                const [contract, tokenId] = e.target.value.split('-');
                                setFractionalizeForm({
                                    ...fractionalizeForm,
                                    nftContract: contract,
                                    tokenId: tokenId
                                });
                            }}
                        >
                            <option value="-">Seleccionar NFT...</option>
                            {myNFTs.map((nft) => (
                                <option key={nft.id} value={`${nft.contract}-${nft.tokenId}`}>
                                    {nft.name} - {nft.estimatedValue}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Total de Fracciones
                            </label>
                            <input
                                type="number"
                                min="2"
                                max="10000"
                                className="w-full bg-gray-800 rounded-lg px-4 py-3 border border-gray-700 focus:border-purple-500 focus:outline-none"
                                value={fractionalizeForm.totalFractions}
                                onChange={(e) => setFractionalizeForm({
                                    ...fractionalizeForm,
                                    totalFractions: parseInt(e.target.value)
                                })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Precio por Fracción (ETH)
                            </label>
                            <input
                                type="number"
                                step="0.001"
                                min="0"
                                className="w-full bg-gray-800 rounded-lg px-4 py-3 border border-gray-700 focus:border-purple-500 focus:outline-none"
                                value={fractionalizeForm.pricePerFraction}
                                onChange={(e) => setFractionalizeForm({
                                    ...fractionalizeForm,
                                    pricePerFraction: e.target.value
                                })}
                                placeholder="0.05"
                            />
                        </div>
                    </div>

                    {/* Resumen */}
                    {fractionalizeForm.pricePerFraction && (
                        <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Precio Total:</span>
                                <span className="font-bold text-purple-400">
                                    {(fractionalizeForm.totalFractions * parseFloat(fractionalizeForm.pricePerFraction)).toFixed(4)} ETH
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Ownership por Fracción:</span>
                                <span className="font-bold">
                                    {(100 / fractionalizeForm.totalFractions).toFixed(4)}%
                                </span>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !fractionalizeForm.nftContract || !fractionalizeForm.pricePerFraction}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <FaSync className="w-5 h-5 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <FaChartPie className="w-5 h-5" />
                                Fraccionalizar NFT
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Mis NFTs disponibles */}
            <div>
                <h3 className="text-lg font-bold mb-4">Mis NFTs Disponibles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myNFTs.map((nft) => (
                        <div key={nft.id} className="bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700 hover:border-purple-500 transition-all duration-200">
                            <img
                                src={nft.image}
                                alt={nft.name}
                                className="w-full h-48 object-cover"
                            />
                            <div className="p-4 space-y-2">
                                <h4 className="font-bold">{nft.name}</h4>
                                <div className="text-sm text-gray-400">
                                    <p>Token ID: {nft.tokenId}</p>
                                    <p>Valor Estimado: {nft.estimatedValue}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderMarketplaceTab = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fractionedNFTs.map((fraction) => (
                    <div key={fraction.fractionId} className="bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700 hover:border-blue-500 transition-all duration-200">
                        <img
                            src={fraction.image}
                            alt={fraction.name}
                            className="w-full h-48 object-cover"
                        />
                        <div className="p-4 space-y-3">
                            <h4 className="font-bold">{fraction.name}</h4>

                            {/* Progress bar */}
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-400">Progreso de Venta</span>
                                    <span className="font-bold text-blue-400">
                                        {((fraction.fractionsSold / fraction.totalFractions) * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(fraction.fractionsSold / fraction.totalFractions) * 100}%` }}
                                    />
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    {fraction.fractionsSold} / {fraction.totalFractions} vendidas
                                </div>
                            </div>

                            {/* Precio */}
                            <div className="flex justify-between items-center bg-gray-900/50 rounded-lg p-3">
                                <span className="text-sm text-gray-400">Precio/Fracción:</span>
                                <span className="font-bold text-lg">{fraction.pricePerFraction} ETH</span>
                            </div>

                            {/* Disponibilidad */}
                            <div className="flex items-center gap-2 text-sm">
                                <FaCheckCircle className="w-4 h-4 text-green-400" />
                                <span className="text-gray-400">
                                    {fraction.fractionsAvailable} fracciones disponibles
                                </span>
                            </div>

                            {/* Input para cantidad */}
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max={fraction.fractionsAvailable}
                                    defaultValue="1"
                                    className="flex-1 bg-gray-900 rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
                                    placeholder="Cantidad"
                                    id={`amount-${fraction.fractionId}`}
                                />
                                <button
                                    onClick={() => {
                                        const amount = document.getElementById(`amount-${fraction.fractionId}`).value;
                                        handleBuyFractions(fraction.fractionId, parseInt(amount));
                                    }}
                                    disabled={loading || !fraction.isActive}
                                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold px-6 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
                                >
                                    <ShoppingCart className="w-4 h-4" />
                                    Comprar
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderMyFractionsTab = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myFractions.map((fraction) => (
                    <div key={fraction.fractionId} className="bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700 hover:border-purple-500 transition-all duration-200">
                        <img
                            src={fraction.image}
                            alt={fraction.name}
                            className="w-full h-48 object-cover"
                        />
                        <div className="p-4 space-y-3">
                            <h4 className="font-bold">{fraction.name}</h4>

                            {/* Ownership */}
                            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-3 border border-purple-500/30">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-gray-400">Propiedad:</span>
                                    <span className="font-bold text-xl text-purple-400">
                                        {fraction.ownershipPercent}%
                                    </span>
                                </div>
                                <div className="text-xs text-gray-400">
                                    {fraction.fractionsOwned} / {fraction.totalFractions} fracciones
                                </div>
                            </div>

                            {/* Valor actual */}
                            <div className="flex justify-between items-center bg-gray-900/50 rounded-lg p-3">
                                <span className="text-sm text-gray-400">Valor Actual:</span>
                                <span className="font-bold text-green-400">{fraction.currentValue}</span>
                            </div>

                            {/* Botón de reensamblaje */}
                            {fraction.canReassemble && (
                                <button
                                    onClick={() => handleReassemble(fraction.fractionId)}
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                                >
                                    <FaLock className="w-5 h-5" />
                                    Reensamblar NFT Completo
                                </button>
                            )}

                            {!fraction.canReassemble && (
                                <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-900/50 rounded-lg p-3">
                                    <FaExclamationCircle className="w-4 h-4" />
                                    <span>Necesitas el 100% para reensamblar</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Fracionalización de NFTs
                    </h1>
                    <p className="text-gray-400">
                        Divide NFTs costosos en fracciones para inversión colectiva
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-gray-700">
                    {[
                        { id: 'fractionalize', label: 'Fraccionalizar', icon: FaChartPie },
                        { id: 'marketplace', label: 'Marketplace', icon: FaShoppingCart },
                        { id: 'my-fractions', label: 'Mis Fracciones', icon: FaWallet }
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
                    {activeTab === 'fractionalize' && renderFractionalizeTab()}
                    {activeTab === 'marketplace' && renderMarketplaceTab()}
                    {activeTab === 'my-fractions' && renderMyFractionsTab()}
                </div>
            </div>
        </div>
    );
};

export default FractionalizationPanel;
