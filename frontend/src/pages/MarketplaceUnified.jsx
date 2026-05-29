import React, { useState, useEffect, useCallback } from 'react';
import { useBezCoin } from '../context/BezCoinContext';
import { useBezPay } from '../context/BezPayContext';
import { LOGOS } from '../config/cryptoLogos';
import { useWeb3 } from '../context/Web3Context';
import { useAccount } from 'wagmi';
import { NFTGrid } from '../components/shop/NFTGrid';
import { fetchActiveListings, buyListing, createListing } from '../services/marketplaceService';
import { mintNFT } from '../services/nftService';
import { Spinner } from '../components/ui/Spinner';
import { toast } from 'react-hot-toast';
import {
    ShoppingBag,
    PlusCircle,
    Search,
    Wallet,
    Store,
    Image,
    Tag,
    Upload,
    Loader2
} from 'lucide-react';
import BeZhasMarketplace from '../components/marketplace/BeZhasMarketplace';
import CreateProductWizard from '../components/marketplace/CreateProductWizard';

const LISTINGS_PER_PAGE = 12;

// ==================== TAB BUTTON COMPONENT ====================
const TabButton = ({ active, onClick, icon, children, count }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all relative ${active
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
    >
        {icon}
        {children}
        {count !== undefined && count > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {count}
            </span>
        )}
    </button>
);

// ==================== TAB 1: EXPLORE/BROWSE ====================
const ExploreTab = ({ marketplace, isConnected }) => {
    const [listings, setListings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const loadListings = async () => {
            setIsLoading(true);
            try {
                if (isConnected && marketplace) {
                    // Use the service to fetch and format listings
                    const activeListings = await fetchActiveListings(marketplace);
                    setListings(activeListings);
                } else {
                    // Mock data for unconnected users
                    console.log('🔧 Using mock marketplace data (not connected)');
                    const mockListings = Array.from({ length: 12 }, (_, i) => i + 1);
                    setListings(mockListings);
                }
            } catch (error) {
                console.error("Error loading listings:", error);
                setListings([]);
            } finally {
                setIsLoading(false);
            }
        };
        loadListings();
    }, [isConnected, marketplace]);

    // Filter listings based on search query
    const filteredListings = listings.filter(item => {
        if (typeof item === 'number') return true; // Mock items
        if (!searchQuery) return true;

        const searchLower = searchQuery.toLowerCase();
        // Search by Token ID or Seller Address
        return (
            item.tokenId?.toString().includes(searchLower) ||
            item.seller?.toLowerCase().includes(searchLower)
        );
    });

    return (
        <div className="space-y-6">
            {/* Search Bar */}
            <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 w-full max-w-md shadow-sm">
                <Search size={20} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por ID o Vendedor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent focus:outline-none ml-3 text-gray-900 dark:text-white placeholder-gray-400 w-full"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <Store className="text-purple-600 dark:text-purple-400" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Listings</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {listings.length}
                            </p>
                        </div>
                    </div>
                </div>
                {/* ... other stats ... */}
            </div>

            {/* NFT Grid */}
            <div>
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Spinner size="lg" />
                    </div>
                ) : (
                    <NFTGrid listings={filteredListings} />
                )}
            </div>
        </div>
    );
};


// ==================== TAB 2: MY COLLECTION ====================
const MyCollectionTab = ({ address, contracts }) => {
    const [myNFTs, setMyNFTs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadMyNFTs = async () => {
            if (!address || !contracts.marketplace) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                // 1. Obtener items listados por el usuario en el marketplace
                const marketItems = await contracts.marketplace.fetchMarketItems();
                const myListings = marketItems.filter(item =>
                    item.seller.toLowerCase() === address.toLowerCase()
                );

                // 2. TODO: Obtener items en la wallet (requiere indexador o loop masivo)
                // Por ahora mostramos solo los listados activos

                setMyNFTs(myListings);
            } catch (error) {
                console.error('Error loading NFTs:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadMyNFTs();
    }, [address, contracts.marketplace]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <Spinner size="lg" />
                <p className="mt-4 text-gray-500 dark:text-gray-400">Cargando tu colección...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <Wallet className="text-purple-600 dark:text-purple-400" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Mis Listados</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{myNFTs.length}</p>
                        </div>
                    </div>
                </div>
                {/* ... other stats ... */}
            </div>

            {/* Collection Grid */}
            {myNFTs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <Image size={64} className="text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        No tienes NFTs listados
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Crea un NFT y ponlo a la venta para verlo aquí.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <NFTGrid listings={myNFTs} />
                </div>
            )}
        </div>
    );
};

// ==================== TAB 3: CREATE NFT ====================
const CreateNFTTab = ({ address, contracts }) => {
    const [showWizard, setShowWizard] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { balance, verifyAndProceed } = useBezCoin();
    const { openBuyBez } = useBezPay();

    const handleProductCreated = async (productData) => {
        if (!address || !contracts.marketplace || !contracts.bezhasNFT) {
            return toast.error('Por favor, conecta tu wallet y asegúrate de que los contratos estén cargados.');
        }

        // Verificar saldo BEZ antes de mintear/listar
        const hasFunds = await verifyAndProceed(productData.price, 'crear producto', async () => {
            /* BezPayModal auto-cierra */;
            handleProductCreated(productData);
        });
        if (!hasFunds) {
            return; // El modal de compra se mostrará automáticamente
        }

        setIsLoading(true);
        try {
            // Aquí irá la lógica de creación según tipo de producto
            const isNFT = productData.saleType?.startsWith('nft_');

            if (isNFT) {
                // Flujo NFT tradicional
                toast.info('Minteando tu NFT...');
                const newTokenId = await mintNFT(contracts.bezhasNFT, address, productData.metadata.tokenURI || '');

                if (newTokenId === null) {
                    throw new Error('El minteo falló, por lo que no se creó el listing.');
                }

                toast.info('Listando tu NFT en el marketplace...');
                await createListing(contracts.marketplace, contracts.bezhasNFT, newTokenId, productData.price);
                toast.success('¡NFT creado y listado con éxito!');
            } else {
                // Flujo producto físico/industrial
                toast.info('Creando producto en marketplace...');

                // TODO: Implementar lógica para productos físicos
                // - Subir imágenes a IPFS
                // - Crear metadata extendida con specs industriales
                // - Guardar en backend MongoDB
                // - Crear listing con metadata enriquecida

                console.log('📦 Producto físico creado:', productData);
                toast.success('¡Producto creado con éxito!');
            }

            setShowWizard(false);

        } catch (error) {
            console.error('Failed to create product:', error);
            toast.error(`Error: ${error.message || 'No se pudo crear el producto'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Info Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-xl">
                        <img src={LOGOS.bezcoin} alt="BEZ-Coin" className="w-8 h-8 rounded-full" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                            Crea y Lista tu Producto
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Vende NFTs digitales únicos o productos físicos al por mayor. Soportamos ventas por unidad, peso, volumen, área y más.
                        </p>
                        <button
                            onClick={() => setShowWizard(true)}
                            disabled={isLoading}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-8 rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-500/20"
                        >
                            <PlusCircle size={20} />
                            <span>Crear Nuevo Producto</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Saldo BEZ</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {parseFloat(balance).toFixed(2)}
                    </div>
                    <button
                        className="mt-2 text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-semibold"
                        onClick={() => openBuyBez()}
                    >
                        Comprar BEZ-Coin
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Tipos Disponibles</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">7</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        NFT, Unidad, Peso, Volumen...
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Categorías</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">11</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Industria, Electrónica, Agricultura...
                    </div>
                </div>
            </div>

            {/* Wizard Modal */}
            {showWizard && (
                <CreateProductWizard
                    onComplete={handleProductCreated}
                    onCancel={() => setShowWizard(false)}
                />
            )}

        </div>
    );
};

// ==================== MAIN COMPONENT ====================
const MarketplaceUnified = () => {
    const { address } = useAccount();
    const { marketplace, contracts, isConnected } = useWeb3();
    const [activeTab, setActiveTab] = useState('explore'); // 'explore' | 'collection' | 'create'

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
                <ShoppingBag size={64} className="text-purple-600 dark:text-purple-400 mb-4" />
                <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">NFT Marketplace</h1>
                <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                    Por favor, conecta tu billetera para explorar, comprar y crear NFTs.
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <header>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
                        NFT Marketplace
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Explora, colecciona y crea NFTs únicos en la comunidad BeZhas.
                    </p>
                </header>

                {/* Tabs Navigation */}
                <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800 pb-4 overflow-x-auto">
                    <TabButton
                        active={activeTab === 'explore'}
                        onClick={() => setActiveTab('explore')}
                        icon={<Store size={20} />}
                    >
                        Explorar
                    </TabButton>
                    <TabButton
                        active={activeTab === 'collection'}
                        onClick={() => setActiveTab('collection')}
                        icon={<Wallet size={20} />}
                    >
                        Mi Colección
                    </TabButton>
                    <TabButton
                        active={activeTab === 'create'}
                        onClick={() => setActiveTab('create')}
                        icon={<PlusCircle size={20} />}
                    >
                        Crear NFT
                    </TabButton>
                    <TabButton
                        active={activeTab === 'bezhas-market'}
                        onClick={() => setActiveTab('bezhas-market')}
                        icon={<ShoppingBag size={20} />}
                    >
                        BeZhas Market
                    </TabButton>
                </div>

                {/* Tab Content */}
                {activeTab === 'explore' && (
                    <ExploreTab marketplace={marketplace} isConnected={isConnected} />
                )}
                {activeTab === 'collection' && (
                    <MyCollectionTab address={address} contracts={contracts} />
                )}
                {activeTab === 'create' && (
                    <CreateNFTTab address={address} contracts={contracts} />
                )}
                {activeTab === 'bezhas-market' && (
                    <BeZhasMarketplace />
                )}
            </div>
        </div>
    );
};

export default MarketplaceUnified;
