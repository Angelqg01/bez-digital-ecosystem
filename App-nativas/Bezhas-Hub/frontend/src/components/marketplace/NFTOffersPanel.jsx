import React, { useState } from 'react';
import { FaCommentAlt, FaPaperPlane, FaThumbsUp, FaThumbsDown, FaTimes, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

const NFTOffersPanel = () => {
    const [activeTab, setActiveTab] = useState('make');
    const [offers, setOffers] = useState([
        {
            id: 1,
            nftName: 'Cool NFT #123',
            image: 'https://picsum.photos/seed/offer1/300',
            offerer: '0x1234...5678',
            amount: '0.5',
            expiresAt: Date.now() + 48 * 60 * 60 * 1000,
            message: 'Really interested in this piece!',
            status: 'pending'
        }
    ]);

    const [receivedOffers, setReceivedOffers] = useState([
        {
            id: 2,
            nftName: 'My NFT #456',
            image: 'https://picsum.photos/seed/offer2/300',
            offerer: '0xabcd...efgh',
            amount: '1.2',
            expiresAt: Date.now() + 72 * 60 * 60 * 1000,
            message: 'Would love to add this to my collection',
            status: 'pending',
            counterAmount: null
        }
    ]);

    const handleMakeOffer = async (e) => {
        e.preventDefault();
        toast.success('Oferta enviada exitosamente!');
    };

    const handleAcceptOffer = async (offerId) => {
        toast.success('Oferta aceptada!');
    };

    const handleRejectOffer = async (offerId) => {
        toast.success('Oferta rechazada');
    };

    const handleCounterOffer = async (offerId, amount) => {
        toast.success(`Contraoferta enviada: ${amount} ETH`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900/20 to-gray-900 text-white p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    NFT Offers & Negotiation
                </h1>
                <p className="text-gray-400 mb-8">Haz ofertas y negocia directamente con los owners</p>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-gray-700">
                    {[
                        { id: 'make', label: 'Hacer Oferta' },
                        { id: 'sent', label: 'Ofertas Enviadas' },
                        { id: 'received', label: 'Ofertas Recibidas' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-3 font-semibold transition-all border-b-2 ${activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Make Offer Tab */}
                {activeTab === 'make' && (
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-8">
                            <form onSubmit={handleMakeOffer} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Contrato NFT</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-900 rounded-lg px-4 py-3 border border-gray-700 focus:border-indigo-500 focus:outline-none"
                                        placeholder="0x..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Token ID</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-900 rounded-lg px-4 py-3 border border-gray-700 focus:border-indigo-500 focus:outline-none"
                                        placeholder="123"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Monto Ofertado (ETH)</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            className="w-full bg-gray-900 rounded-lg px-4 py-3 border border-gray-700 focus:border-indigo-500 focus:outline-none"
                                            placeholder="0.5"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2">Duración (días)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="30"
                                            defaultValue="7"
                                            className="w-full bg-gray-900 rounded-lg px-4 py-3 border border-gray-700 focus:border-indigo-500 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Mensaje (Opcional)</label>
                                    <textarea
                                        className="w-full bg-gray-900 rounded-lg px-4 py-3 border border-gray-700 focus:border-indigo-500 focus:outline-none"
                                        rows="3"
                                        placeholder="Añade un mensaje al owner..."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <FaPaperPlane className="w-5 h-5" />
                                    Enviar Oferta
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Sent Offers Tab */}
                {activeTab === 'sent' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {offers.map((offer) => (
                            <div key={offer.id} className="bg-gray-800/50 rounded-xl border border-gray-700 p-6 space-y-4">
                                <div className="flex items-center gap-4">
                                    <img src={offer.image} alt={offer.nftName} className="w-20 h-20 rounded-lg object-cover" />
                                    <div className="flex-1">
                                        <h4 className="font-bold">{offer.nftName}</h4>
                                        <p className="text-sm text-gray-400">Owner: {offer.offerer}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-2xl text-indigo-400">{offer.amount} ETH</p>
                                        <p className="text-xs text-gray-400">Oferta</p>
                                    </div>
                                </div>

                                {offer.message && (
                                    <div className="bg-gray-900/50 rounded-lg p-3 text-sm text-gray-300 flex items-start gap-2">
                                        <FaCommentAlt className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <p>{offer.message}</p>
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-400">Estado:</span>
                                    <span className={`font-bold ${offer.status === 'pending' ? 'text-yellow-400' :
                                        offer.status === 'accepted' ? 'text-green-400' :
                                            'text-red-400'
                                        }`}>
                                        {offer.status === 'pending' ? 'Pendiente' :
                                            offer.status === 'accepted' ? 'Aceptada' :
                                                'Rechazada'}
                                    </span>
                                </div>

                                <button className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2">
                                    <FaTimes className="w-4 h-4" />
                                    Cancelar Oferta
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Received Offers Tab */}
                {activeTab === 'received' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {receivedOffers.map((offer) => (
                            <div key={offer.id} className="bg-gray-800/50 rounded-xl border border-gray-700 p-6 space-y-4">
                                <div className="flex items-center gap-4">
                                    <img src={offer.image} alt={offer.nftName} className="w-20 h-20 rounded-lg object-cover" />
                                    <div className="flex-1">
                                        <h4 className="font-bold">{offer.nftName}</h4>
                                        <p className="text-sm text-gray-400">De: {offer.offerer}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-2xl text-green-400">{offer.amount} ETH</p>
                                        <p className="text-xs text-gray-400">Oferta</p>
                                    </div>
                                </div>

                                {offer.message && (
                                    <div className="bg-gray-900/50 rounded-lg p-3 text-sm text-gray-300 flex items-start gap-2">
                                        <FaCommentAlt className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <p>{offer.message}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleAcceptOffer(offer.id)}
                                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <FaCheckCircle className="w-4 h-4" />
                                        Aceptar
                                    </button>

                                    <button
                                        onClick={() => handleRejectOffer(offer.id)}
                                        className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <FaTimes className="w-4 h-4" />
                                        Rechazar
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        step="0.001"
                                        placeholder="Contraoferta..."
                                        className="flex-1 bg-gray-900 rounded-lg px-3 py-2 border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm"
                                    />
                                    <button
                                        onClick={() => handleCounterOffer(offer.id, 1.5)}
                                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold px-4 py-2 rounded-lg transition-all"
                                    >
                                        Contraofertar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NFTOffersPanel;
