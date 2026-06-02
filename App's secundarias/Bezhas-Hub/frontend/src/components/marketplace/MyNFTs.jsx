import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FaStore, FaTag, FaTimes } from 'react-icons/fa';
import { useNFTContract } from '../../hooks/useNFTContract';
import { useMarketplaceContract } from '../../hooks/useMarketplaceContract';
import { useWeb3 } from '../../context/Web3Context';
import { Spinner } from '../ui/Spinner';

const MyNFTs = () => {
    const { address } = useWeb3();
    const { getOwnedNFTs, approveNFT, isApproved, isContractDeployed: nftDeployed } = useNFTContract();
    const { listNFT, contractAddress: marketplaceAddress, isContractDeployed: marketplaceDeployed } = useMarketplaceContract();

    const [myNFTs, setMyNFTs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedNFT, setSelectedNFT] = useState(null);
    const [listPrice, setListPrice] = useState('');
    const [showListModal, setShowListModal] = useState(false);

    const loadMyNFTs = async () => {
        if (!address || !nftDeployed) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const nfts = await getOwnedNFTs(address);
            setMyNFTs(nfts);
        } catch (error) {
            console.error('Error loading NFTs:', error);
            toast.error('Error al cargar tus NFTs');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadMyNFTs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, nftDeployed]);

    const handleListClick = (nft) => {
        setSelectedNFT(nft);
        setListPrice('');
        setShowListModal(true);
    };

    const handleListSubmit = async () => {
        if (!selectedNFT || !listPrice || parseFloat(listPrice) <= 0) {
            toast.error('Ingresa un precio válido');
            return;
        }

        if (!marketplaceDeployed) {
            toast.error('El marketplace no está desplegado');
            return;
        }

        try {
            // Check if already approved
            const approved = await isApproved(selectedNFT.tokenId, marketplaceAddress);

            if (!approved) {
                toast.loading('Aprobando NFT...', { id: 'approve-nft' });
                await approveNFT(marketplaceAddress, selectedNFT.tokenId);
                toast.success('NFT aprobado!', { id: 'approve-nft' });
            }

            toast.loading('Listando NFT en el marketplace...', { id: 'list-nft' });
            await listNFT(nftDeployed, selectedNFT.tokenId, listPrice);

            toast.success('¡NFT listado exitosamente! 🎉', { id: 'list-nft' });

            setShowListModal(false);
            setSelectedNFT(null);
            setListPrice('');

            // Reload NFTs
            await loadMyNFTs();
        } catch (error) {
            console.error('Error listing NFT:', error);
            toast.error('Error al listar el NFT: ' + (error.reason || error.message));
        }
    };

    if (!nftDeployed || !marketplaceDeployed) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
                    <FaStore className="mx-auto text-yellow-500 text-5xl mb-4" />
                    <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-300 mb-2">
                        Contratos No Desplegados
                    </h3>
                    <p className="text-yellow-700 dark:text-yellow-400">
                        Los contratos de NFT y Marketplace aún no están desplegados. Despliega los contratos primero.
                    </p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-6">
                <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <FaStore className="text-blue-500" />
                    Mis NFTs
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                    Gestiona y lista tus NFTs en el marketplace
                </p>
            </div>

            {myNFTs.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                    <FaStore className="mx-auto text-gray-400 text-6xl mb-4" />
                    <p className="text-gray-500 text-lg mb-4">No tienes NFTs aún</p>
                    <p className="text-gray-400 text-sm">
                        Crea tu primer NFT en la pestaña "Crear NFT"
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {myNFTs.map((nft) => (
                        <div key={nft.tokenId} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                            <div className="relative h-48 bg-gray-200 dark:bg-gray-700">
                                <img
                                    src={nft.tokenURI}
                                    alt={`NFT #${nft.tokenId}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.src = 'https://via.placeholder.com/300x300?text=NFT+' + nft.tokenId;
                                    }}
                                />
                            </div>

                            <div className="p-4">
                                <h3 className="font-bold text-lg mb-2">NFT #{nft.tokenId}</h3>
                                <p className="text-xs text-gray-500 truncate mb-4">
                                    Owner: {nft.owner.slice(0, 6)}...{nft.owner.slice(-4)}
                                </p>

                                <button
                                    onClick={() => handleListClick(nft)}
                                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <FaTag />
                                    Listar en Marketplace
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* List Modal */}
            {showListModal && selectedNFT && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold">Listar NFT #{selectedNFT.tokenId}</h3>
                            <button
                                onClick={() => setShowListModal(false)}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <div className="mb-6">
                            <img
                                src={selectedNFT.tokenURI}
                                alt={`NFT #${selectedNFT.tokenId}`}
                                className="w-full h-48 object-cover rounded-lg"
                                onError={(e) => {
                                    e.target.src = 'https://via.placeholder.com/300x300?text=NFT+' + selectedNFT.tokenId;
                                }}
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">
                                Precio en BEZ
                            </label>
                            <input
                                type="number"
                                value={listPrice}
                                onChange={(e) => setListPrice(e.target.value)}
                                placeholder="100"
                                step="0.01"
                                min="0"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowListModal(false)}
                                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleListSubmit}
                                disabled={!listPrice || parseFloat(listPrice) <= 0}
                                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Listar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyNFTs;
