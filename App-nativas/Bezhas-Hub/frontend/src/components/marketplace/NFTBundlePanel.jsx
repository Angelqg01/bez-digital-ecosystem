import React, { useState } from 'react';
import { FaBox, FaTag, FaTrendingDown, FaShoppingBag, FaGift } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

const NFTBundlePanel = () => {
    const [bundles, setBundles] = useState([
        {
            id: 1,
            name: 'Starter Collection',
            description: 'Perfect bundle for beginners',
            items: 3,
            totalPrice: '1.5',
            originalPrice: '2.0',
            discount: 25,
            sold: 45,
            maxSupply: 100,
            creator: '0xabcd...efgh'
        }
    ]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900/20 to-gray-900 text-white p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                    NFT Bundles & Collections
                </h1>
                <p className="text-gray-400 mb-8">Compra múltiples NFTs con descuento</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bundles.map((bundle) => (
                        <div key={bundle.id} className="bg-gray-800/50 rounded-xl border border-gray-700 p-6 space-y-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500">
                                    <FaBox className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">{bundle.name}</h4>
                                    <p className="text-sm text-gray-400">{bundle.items} NFTs incluidos</p>
                                </div>
                            </div>

                            <p className="text-gray-400 text-sm">{bundle.description}</p>

                            <div className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                                <div>
                                    <p className="text-xs text-gray-400 line-through">{bundle.originalPrice} ETH</p>
                                    <p className="font-bold text-2xl text-green-400">{bundle.totalPrice} ETH</p>
                                </div>
                                <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                                    <FaTrendingDown className="w-4 h-4" />
                                    -{bundle.discount}%
                                </div>
                            </div>

                            <div className="text-sm text-gray-400">
                                {bundle.sold} / {bundle.maxSupply} vendidos
                                <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full" style={{ width: `${(bundle.sold / bundle.maxSupply) * 100}%` }} />
                                </div>
                            </div>

                            <button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2">
                                <FaShoppingBag className="w-5 h-5" />
                                Comprar Bundle
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NFTBundlePanel;
