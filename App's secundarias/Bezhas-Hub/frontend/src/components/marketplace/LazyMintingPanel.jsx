import React, { useState } from 'react';
import { FaBolt, FaFeather, FaStar, FaFileSignature } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

const LazyMintingPanel = () => {
    const [form, setForm] = useState({
        name: '',
        description: '',
        price: '',
        royalty: 5,
        expiresInDays: 30
    });

    const handleCreateVoucher = async (e) => {
        e.preventDefault();
        // TODO: Implementar creación de voucher con firma EIP-712
        toast.success('Voucher creado exitosamente!');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-yellow-900/20 to-gray-900 text-white p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                    Lazy Minting
                </h1>
                <p className="text-gray-400 mb-8">Crea NFTs sin gas, se mintean al venderse</p>

                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-8">
                    <form onSubmit={handleCreateVoucher} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">Nombre del NFT</label>
                            <input
                                type="text"
                                className="w-full bg-gray-900 rounded-lg px-4 py-3 border border-gray-700 focus:border-yellow-500 focus:outline-none"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Mi NFT Asombroso"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Descripción</label>
                            <textarea
                                className="w-full bg-gray-900 rounded-lg px-4 py-3 border border-gray-700 focus:border-yellow-500 focus:outline-none"
                                rows="4"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Describe tu NFT..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Precio (ETH)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    className="w-full bg-gray-900 rounded-lg px-4 py-3 border border-gray-700 focus:border-yellow-500 focus:outline-none"
                                    value={form.price}
                                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                                    placeholder="0.1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Royalty (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    className="w-full bg-gray-900 rounded-lg px-4 py-3 border border-gray-700 focus:border-yellow-500 focus:outline-none"
                                    value={form.royalty}
                                    onChange={(e) => setForm({ ...form, royalty: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg p-4 border border-yellow-500/30">
                            <div className="flex items-center gap-2 mb-2">
                                <FaBolt className="w-5 h-5 text-yellow-400" />
                                <h3 className="font-bold">Beneficios del Lazy Minting</h3>
                            </div>
                            <ul className="text-sm text-gray-300 space-y-1 ml-7">
                                <li>✓ Sin costos de gas para crear</li>
                                <li>✓ Se mintea solo al venderse</li>
                                <li>✓ Voucher firmado válido</li>
                                <li>✓ Ahorra dinero en creación</li>
                            </ul>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            <FaFileSignature className="w-5 h-5" />
                            Crear Voucher (Sin Gas)
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LazyMintingPanel;
