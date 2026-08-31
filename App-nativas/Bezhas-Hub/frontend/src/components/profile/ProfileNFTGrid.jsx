import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { Spinner } from '../ui/Spinner';
import { Image, ExternalLink, Tag, TrendingUp } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

const NFTCard = ({ nft, onList }) => {
    const [isListing, setIsListing] = useState(false);

    const handleList = async () => {
        setIsListing(true);
        try {
            await onList(nft);
        } finally {
            setIsListing(false);
        }
    };

    return (
        <div className="bg-white dark:bg-dark-surface rounded-xl overflow-hidden hover:shadow-xl transition-shadow border border-gray-200 dark:border-gray-700">
            <div className="relative aspect-square">
                <img
                    src={nft.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${nft.tokenId}`}
                    alt={nft.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        e.target.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${nft.tokenId}`;
                    }}
                />
                {nft.isListed && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        En Venta
                    </div>
                )}
            </div>
            <div className="p-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                    {nft.name || `NFT #${nft.tokenId}`}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                    {nft.description || 'BeZhas NFT único y verificado en blockchain'}
                </p>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                        <Tag size={16} />
                        <span className="font-semibold">#{nft.tokenId}</span>
                    </div>
                    {!nft.isListed ? (
                        <button
                            onClick={handleList}
                            disabled={isListing}
                            className="bg-primary-600 dark:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1"
                        >
                            {isListing ? (
                                <Spinner size="sm" />
                            ) : (
                                <>
                                    <TrendingUp size={14} />
                                    Listar
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="text-green-500 text-sm font-semibold flex items-center gap-1">
                            <TrendingUp size={14} />
                            {nft.price} BEZ
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ProfileNFTGrid = ({ activeView = 'owned', address: propAddress }) => {
    const { address: connectedAddress, isConnected, contracts, signer } = useWeb3();
    const address = propAddress || connectedAddress;
    const [nfts, setNfts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        listed: 0,
        totalValue: '0.00'
    });

    useEffect(() => {
        if (!isConnected || !address) {
            setIsLoading(false);
            return;
        }
        loadUserNFTs();
    }, [address, isConnected, activeView]);

    const loadUserNFTs = async () => {
        setIsLoading(true);
        try {
            // Intentar cargar NFTs reales si el contrato está disponible
            if (contracts?.bezhasNFT) {
                console.log('📦 Loading NFTs from contract...');
                const balance = await contracts.bezhasNFT.balanceOf(address);
                const nftCount = Number(balance);

                if (nftCount === 0) {
                    console.log('👛 User has no NFTs');
                    setNfts([]);
                    setStats({ total: 0, listed: 0, totalValue: '0.00' });
                    setIsLoading(false);
                    return;
                }

                const loadedNFTs = [];
                for (let i = 0; i < nftCount; i++) {
                    try {
                        const tokenId = await contracts.bezhasNFT.tokenOfOwnerByIndex(address, i);
                        const tokenURI = await contracts.bezhasNFT.tokenURI(tokenId);

                        // Parsear metadata
                        let metadata = {
                            name: `BeZhas NFT #${tokenId}`,
                            description: 'NFT verificado en blockchain',
                            image: null
                        };

                        try {
                            if (tokenURI.startsWith('data:application/json')) {
                                const json = JSON.parse(atob(tokenURI.split(',')[1]));
                                metadata = { ...metadata, ...json };
                            } else if (tokenURI.startsWith('ipfs://')) {
                                const ipfsHash = tokenURI.replace('ipfs://', '');
                                const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
                                metadata = { ...metadata, ...(await response.json()) };
                            } else if (tokenURI.startsWith('http')) {
                                const response = await fetch(tokenURI);
                                metadata = { ...metadata, ...(await response.json()) };
                            }
                        } catch (metadataError) {
                            console.warn('Could not parse metadata for token', tokenId);
                        }

                        loadedNFTs.push({
                            tokenId: tokenId.toString(),
                            ...metadata,
                            isListed: false
                        });
                    } catch (error) {
                        console.error(`Error loading NFT at index ${i}:`, error);
                    }
                }

                setNfts(loadedNFTs);
                setStats({
                    total: loadedNFTs.length,
                    listed: loadedNFTs.filter(n => n.isListed).length,
                    totalValue: '0.00' // Calcular valor real si están listados
                });
            } else {
                // Mock data para desarrollo
                console.log('🔧 Using mock NFT data (no contract available)');
                const mockNFTs = Array.from({ length: 6 }, (_, i) => ({
                    tokenId: `${i + 1}`,
                    name: `BeZhas NFT #${i + 1}`,
                    description: 'NFT único en la plataforma BeZhas',
                    image: null,
                    isListed: i % 3 === 0,
                    price: i % 3 === 0 ? `${(i + 1) * 10}` : null
                }));
                setNfts(mockNFTs);
                setStats({
                    total: mockNFTs.length,
                    listed: mockNFTs.filter(n => n.isListed).length,
                    totalValue: mockNFTs.reduce((sum, nft) =>
                        sum + (nft.isListed ? parseFloat(nft.price) : 0), 0
                    ).toFixed(2)
                });
            }
        } catch (error) {
            console.error('❌ Error loading NFTs:', error);
            toast.error('Error al cargar NFTs');
            setNfts([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleListNFT = async (nft) => {
        if (!contracts?.marketplace) {
            toast.error('Marketplace no disponible');
            return;
        }

        try {
            const price = prompt('Ingresa el precio en BEZ:');
            if (!price || isNaN(price) || parseFloat(price) <= 0) {
                toast.error('Precio inválido');
                return;
            }

            const priceInWei = ethers.parseEther(price);

            // Aprobar el marketplace para transferir el NFT
            toast.loading('Aprobando NFT...');
            const approveTx = await contracts.bezhasNFT.approve(
                await contracts.marketplace.getAddress(),
                nft.tokenId
            );
            await approveTx.wait();

            // Crear el listing
            toast.loading('Creando listado...');
            const listTx = await contracts.marketplace.createListing(
                await contracts.bezhasNFT.getAddress(),
                nft.tokenId,
                priceInWei
            );
            await listTx.wait();

            toast.success('¡NFT listado exitosamente!');
            loadUserNFTs(); // Recargar
        } catch (error) {
            console.error('Error listing NFT:', error);
            toast.error('Error al listar NFT');
        }
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-gray-700">
                <Image size={64} className="text-gray-400 dark:text-gray-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Conecta tu Wallet
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                    Conecta tu wallet para ver tus NFTs
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <Spinner size="lg" />
                <p className="mt-4 text-gray-500 dark:text-gray-400">
                    Cargando tu colección NFT...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <Image className="text-primary-600 dark:text-primary-400" size={24} />
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total NFTs</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <Tag className="text-primary-600 dark:text-primary-400" size={24} />
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">En Venta</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.listed}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="text-primary-600 dark:text-primary-400" size={24} />
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Valor Total</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalValue} BEZ</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* NFT Grid */}
            {nfts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-gray-700">
                    <Image size={64} className="text-gray-400 dark:text-gray-500 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        No tienes NFTs aún
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Explora el marketplace para comprar tu primer NFT o crea uno nuevo
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {nfts.map((nft) => (
                        <NFTCard
                            key={nft.tokenId}
                            nft={nft}
                            onList={handleListNFT}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProfileNFTGrid;
