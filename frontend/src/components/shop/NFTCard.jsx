import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import { useWeb3 } from '../../context/Web3Context';
import { useNFTMetadata } from '../../hooks/useNFTMetadata';
import { Spinner } from '../ui/Spinner';

// Helper para formatear precio de forma segura
const safeFormatEther = (value) => {
  if (!value) return '0';
  if (typeof value === 'string' && value.includes('.')) return value; // Ya está formateado
  try {
    // Ethers v6 usa ethers.formatEther, v5 usa ethers.utils.formatEther
    return ethers.formatEther(value);
  } catch (e) {
    console.warn('Error formatting ether:', e);
    return value.toString();
  }
};

const BuyButton = ({ listing, isMock }) => {
  const { contracts, isConnected } = useWeb3();
  const [isLoading, setIsLoading] = useState(false);

  const handleBuy = async () => {
    // Si es mock, pedir conectar wallet
    if (isMock || !isConnected) {
      return toast('Conecta tu wallet para comprar NFTs', {
        icon: '🔗',
      });
    }

    if (!contracts?.marketplace || !listing || !listing.price) {
      return toast.error('Información del artículo o contrato no disponible.');
    }
    setIsLoading(true);
    try {
      const tx = await contracts.marketplace.buy(listing.tokenId, { value: listing.price });
      toast.loading('Procesando compra...', { id: 'buy-nft' });
      await tx.wait();
      toast.success('¡Compra exitosa!', { id: 'buy-nft' });
    } catch (error) {
      console.error('Error al comprar NFT:', error);
      toast.error(error?.shortMessage || 'La compra falló.', { id: 'buy-nft' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleBuy}
      disabled={isLoading}
      className="w-full bg-dark-primary dark:bg-light-primary text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center"
    >
      {isLoading ? <Spinner size="sm" /> : 'Comprar'}
    </button>
  );
};

export const NFTCard = ({ listing, metadata: propMetadata, isMock = false }) => {
  const { contracts, isConnected } = useWeb3();
  const [tokenURI, setTokenURI] = useState('');

  useEffect(() => {
    const fetchTokenURI = async () => {
      if (propMetadata || isMock) return; // Si ya tenemos metadatos o es mock, no buscamos URI

      if (contracts?.bezhasNFT && listing && listing.tokenId) {
        try {
          const uri = await contracts.bezhasNFT.tokenURI(listing.tokenId);
          setTokenURI(uri);
        } catch (error) {
          console.error('Error fetching tokenURI:', error);
        }
      }
    };
    fetchTokenURI();
  }, [contracts?.bezhasNFT, listing, propMetadata, isMock]);

  const { metadata: fetchedMetadata, isLoading, error } = useNFTMetadata(tokenURI);

  // Para mock NFTs, crear metadata por defecto
  const mockMetadata = isMock ? {
    name: listing.name || `BeZhas NFT #${listing.tokenId}`,
    description: listing.description || 'NFT único en la plataforma BeZhas',
    image: listing.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${listing.tokenId}`
  } : null;

  // Usar metadatos pasados por props, mock, o los obtenidos del hook
  const metadata = propMetadata || mockMetadata || fetchedMetadata;
  const loading = !propMetadata && !isMock && isLoading;

  if (loading) {
    return (
      <div className="bg-dark-surface dark:bg-light-surface rounded-2xl animate-pulse aspect-[3/4]"></div>
    );
  }

  if ((!propMetadata && error) || !metadata) {
    return (
      <div className="bg-dark-surface dark:bg-light-surface rounded-2xl aspect-[3/4] flex flex-col items-center justify-center p-4">
        <p className="text-red-500 text-center text-sm">No se pudieron cargar los metadatos del NFT.</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-surface dark:bg-light-surface rounded-2xl overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
      <div className="aspect-square overflow-hidden relative">
        <img src={metadata.image} alt={metadata.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {isMock && (
          <div className="absolute top-2 right-2 bg-blue-500/90 text-white text-xs px-2 py-1 rounded-full font-semibold">
            Demo
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold truncate text-dark-text dark:text-light-text">{metadata.name}</h3>
        <p className="text-sm text-dark-text-muted dark:text-light-text-muted mt-1">Token ID: {listing.tokenId?.toString() || '#'}</p>
        <div className="flex justify-between items-center mt-4">
          <div>
            <p className="text-xs text-dark-text-muted dark:text-light-text-muted">Precio</p>
            <p className="text-lg font-bold text-dark-primary dark:text-light-primary">{safeFormatEther(listing.price)} ETH</p>
          </div>
          <BuyButton listing={listing} isMock={isMock} />
        </div>
      </div>
    </div>
  );
};
