import React, { useState, useEffect } from 'react';
import { useMarketplace } from '../../context/MarketplaceContext';
import { ethers } from 'ethers';
import { ShoppingBag, Tag, User, Loader2, Euro, Coins, CheckCircle, AlertCircle, Wallet } from 'lucide-react';
import priceService from '../../services/PriceService';
import { useAccount, useConnect } from 'wagmi';

const BeZhasMarketplace = () => {
    const { isVendor, registerAsVendor, createProduct, buyProduct, fetchProducts, loading, vendorFee } = useMarketplace();
    const { isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const [price, setPrice] = useState('');
    const [metadataCID, setMetadataCID] = useState('');
    const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'sell' | 'vendor'
    const [bezPrice, setBezPrice] = useState(null); // Precio de BEZ en EUR
    const [bezEquivalent, setBezEquivalent] = useState(null); // Equivalente de 50€ en BEZ
    const [priceLoading, setPriceLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);

    const VENDOR_FEE_EUR = 50; // Precio fijo en euros    // Obtener precio de BEZ en EUR usando el servicio real

    // Fetch products when tab is catalog
    useEffect(() => {
        if (activeTab === 'catalog') {
            const loadProducts = async () => {
                setProductsLoading(true);
                try {
                    const items = await fetchProducts();
                    if (items && items.length > 0) {
                        setProducts(items);
                    } else {
                        // Fallback to mock if no items found (for demo purposes)
                        setProducts([
                            { id: 1, name: "Digital Art Pack (Demo)", price: "10", seller: "0x123...", image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cdefs%3E%3ClinearGradient id='g1' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23f59e0b;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23ef4444;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g1)' width='150' height='150'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='16' fill='white' text-anchor='middle' dy='.3em'%3E🎨%3C/text%3E%3C/svg%3E" },
                            { id: 2, name: "Premium Membership (Demo)", price: "50", seller: "0x456...", image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cdefs%3E%3ClinearGradient id='g2' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%238b5cf6;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%233b82f6;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g2)' width='150' height='150'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='16' fill='white' text-anchor='middle' dy='.3em'%3E👑%3C/text%3E%3C/svg%3E" }
                        ]);
                    }
                } catch (error) {
                    console.error("Error loading products:", error);
                } finally {
                    setProductsLoading(false);
                }
            };
            loadProducts();
        }
    }, [activeTab, fetchProducts]);

    useEffect(() => {
        const fetchBezPrice = async () => {
            try {
                setPriceLoading(true);
                const feeDetails = await priceService.getVendorFeeDetails();

                setBezPrice(feeDetails.bezPriceEur);
                setBezEquivalent(feeDetails.bezAmount);

                console.log('💰 Vendor Fee Details:', {
                    eurAmount: `${feeDetails.eurAmount}€`,
                    bezAmount: `${feeDetails.bezAmount.toFixed(2)} BEZ`,
                    bezPriceEur: `${feeDetails.bezPriceEur}€`,
                    bezPriceUsd: `$${feeDetails.bezPriceUsd}`
                });
            } catch (error) {
                console.error('Error fetching BEZ price:', error);
                // Fallback
                setBezPrice(0.10);
                setBezEquivalent(500);
            } finally {
                setPriceLoading(false);
            }
        };

        fetchBezPrice();
        // Actualizar precio cada 5 minutos
        const interval = setInterval(fetchBezPrice, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const handleRegister = async () => {
        // Si no está conectada, intentar conectar wallet primero
        if (!isConnected) {
            try {
                const injectedConnector = connectors.find(c => c.id === 'injected' || c.name === 'MetaMask');
                if (injectedConnector) {
                    await connect({ connector: injectedConnector });
                    // Esperar un momento para que la conexión se establezca
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error('Error connecting wallet:', error);
                alert('⚠️ Please connect your wallet first to register as a vendor.');
                return;
            }
        }

        // Proceder con el registro
        registerAsVendor();
    };

    const handleCreateProduct = (e) => {
        e.preventDefault();
        createProduct(price, metadataCID);
    };

    const handleBuy = (id, price) => {
        buyProduct(id, price);
    };

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === id
                ? 'bg-white text-purple-700 shadow dark:bg-gray-700 dark:text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-white/[0.12] hover:text-purple-600 dark:hover:text-white'
                }`}
        >
            <Icon className="h-5 w-5" />
            {label}
        </button>
    );

    return (
        <div className="w-full max-w-6xl mx-auto p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ShoppingBag className="h-8 w-8 text-purple-600" />
                        BeZhas Marketplace
                    </h2>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                        Buy and sell digital goods with instant settlement.
                    </p>
                </div>

                {/* Tabs Navigation */}
                <div className="flex space-x-1 rounded-xl bg-purple-900/20 p-1 m-6">
                    <TabButton id="catalog" label="Catalog" icon={ShoppingBag} />
                    <TabButton id="sell" label="Sell Product" icon={Tag} />
                    <TabButton id="vendor" label="Vendor Status" icon={User} />
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'catalog' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {productsLoading ? (
                                <div className="col-span-3 flex justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                                </div>
                            ) : products.length === 0 ? (
                                <div className="col-span-3 text-center py-12 text-gray-500">
                                    No products found. Be the first to list one!
                                </div>
                            ) : (
                                products.map((product) => (
                                    <div key={product.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 shadow hover:shadow-md transition-shadow">
                                        <img src={product.image} alt={product.name} className="w-full h-48 object-cover rounded-md mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-300 mb-2">Seller: {product.seller.substring(0, 6)}...{product.seller.substring(38)}</p>
                                        <div className="flex justify-between items-center mt-4">
                                            <span className="text-xl font-bold text-purple-600">{product.price} BEZ</span>
                                            <button
                                                onClick={() => handleBuy(product.id, product.price)}
                                                disabled={loading}
                                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                                {loading ? 'Processing...' : 'Buy Now'}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'sell' && (
                        <div>
                            {!isVendor ? (
                                <div className="text-center py-12">
                                    <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Vendor Access Required</h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-6">You need to register as a vendor to list products.</p>
                                    <button
                                        onClick={() => setActiveTab('vendor')}
                                        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                    >
                                        Go to Registration
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleCreateProduct} className="max-w-md mx-auto space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name / Metadata CID</label>
                                        <input
                                            type="text"
                                            value={metadataCID}
                                            onChange={(e) => setMetadataCID(e.target.value)}
                                            placeholder="Enter IPFS CID or Name"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (BEZ)</label>
                                        <input
                                            type="number"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium flex justify-center items-center gap-2"
                                    >
                                        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                                        {loading ? 'Creating...' : 'List Product'}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}

                    {activeTab === 'vendor' && (
                        <div className="max-w-lg mx-auto text-center">
                            {isVendor ? (
                                <div className="bg-green-100 dark:bg-green-900/30 p-8 rounded-2xl border border-green-200 dark:border-green-800">
                                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                                        <User className="h-8 w-8 text-green-600 dark:text-green-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-2">You are a Verified Vendor</h3>
                                    <p className="text-green-600 dark:text-green-400">
                                        You have full access to list products and manage your sales.
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-900 p-8 rounded-2xl border-2 border-purple-200 dark:border-purple-800 shadow-xl">
                                    <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 mb-6 shadow-lg">
                                        <User className="h-10 w-10 text-white" />
                                    </div>
                                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Become a Vendor</h3>
                                    <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
                                        Unlock the ability to sell products on the BeZhas Marketplace.
                                    </p>

                                    {/* Pricing Card - Simplificado */}
                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700 shadow-md">
                                        <div className="text-center mb-4">
                                            <div className="flex items-center gap-2 mb-2 justify-center">
                                                <Coins className="h-6 w-6 text-pink-600" />
                                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Registration Fee</span>
                                            </div>

                                            {priceLoading ? (
                                                <div className="flex items-center gap-2 justify-center py-4">
                                                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                                    <span className="text-sm text-gray-400">Loading price...</span>
                                                </div>
                                            ) : bezEquivalent ? (
                                                <>
                                                    {/* Precio principal en BEZ */}
                                                    <div className="mb-3">
                                                        <span className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                                                            {bezEquivalent.toFixed(2)}
                                                        </span>
                                                        <span className="text-2xl font-semibold text-gray-600 dark:text-gray-400 ml-2">BEZ</span>
                                                    </div>

                                                    {/* Tasas de cambio en texto pequeño */}
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                                                        <div>1 BEZ = {bezPrice?.toFixed(4)}€</div>
                                                        <div>1 BEZ = ${(bezPrice ? bezPrice * 1.11 : 0).toFixed(4)}</div>
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-xl text-gray-400">Error loading</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Benefits List */}
                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6 border border-gray-200 dark:border-gray-700">
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                            <CheckCircle className="h-5 w-5 text-green-600" />
                                            Vendor Benefits
                                        </h4>
                                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                            <li className="flex items-start gap-2">
                                                <span className="text-green-600 mt-0.5">✓</span>
                                                <span>List unlimited products on the marketplace</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-green-600 mt-0.5">✓</span>
                                                <span>Instant settlements with BEZ-Coin</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-green-600 mt-0.5">✓</span>
                                                <span>Access to vendor dashboard and analytics</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-green-600 mt-0.5">✓</span>
                                                <span>Verified vendor badge on your profile</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-green-600 mt-0.5">✓</span>
                                                <span>Priority customer support</span>
                                            </li>
                                        </ul>
                                    </div>

                                    {/* Warning if no BEZ */}
                                    {bezEquivalent && (
                                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                                            <div className="flex items-start gap-3">
                                                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                                <div className="text-sm text-blue-700 dark:text-blue-300">
                                                    <p className="font-medium mb-1">Payment Requirements</p>
                                                    <p>Make sure you have at least <strong>{bezEquivalent.toFixed(2)} BEZ</strong> in your wallet before proceeding. The payment will be processed instantly via smart contract.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Register Button */}
                                    <button
                                        onClick={handleRegister}
                                        disabled={loading || priceLoading || !bezEquivalent}
                                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-xl shadow-purple-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-3"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-6 w-6 animate-spin" />
                                                <span>Processing Payment...</span>
                                            </>
                                        ) : priceLoading ? (
                                            <>
                                                <Loader2 className="h-6 w-6 animate-spin" />
                                                <span>Loading Price...</span>
                                            </>
                                        ) : !isConnected ? (
                                            <>
                                                <Wallet className="h-6 w-6" />
                                                <span>Connect Wallet & Pay {bezEquivalent?.toFixed(2)} BEZ</span>
                                            </>
                                        ) : (
                                            <>
                                                <Coins className="h-6 w-6" />
                                                <span>Pay {bezEquivalent?.toFixed(2)} BEZ & Register</span>
                                            </>
                                        )}
                                    </button>

                                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                                        One-time registration fee • Lifetime vendor access • Secure blockchain payment
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BeZhasMarketplace;
