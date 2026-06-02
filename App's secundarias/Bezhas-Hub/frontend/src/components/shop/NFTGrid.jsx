import React from 'react';
import { NFTCard } from './NFTCard';
import { ethers } from 'ethers';

// Mock NFT Card para usuarios no conectados
const MockNFTCard = ({ id }) => {
  const mockNFT = {
    tokenId: BigInt(id),
    seller: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    price: ethers.parseEther((Math.random() * 5 + 1).toFixed(2)),
    name: `BeZhas NFT #${id}`,
    description: 'NFT único en la plataforma BeZhas',
    image: `https://api.dicebear.com/7.x/shapes/svg?seed=${id}`
  };

  return <NFTCard listing={mockNFT} isMock={true} />;
};

export const NFTGrid = ({ listings }) => {
  if (!listings || listings.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-center col-span-full py-10">No hay artículos en el mercado en este momento.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {listings.map((listing, index) => {
        // If listing is just an ID (legacy support or mock), render MockCard
        if (typeof listing === 'bigint' || typeof listing === 'number' || typeof listing === 'string') {
          return <MockNFTCard key={listing.toString()} id={listing.toString()} />;
        }

        // If it's a full listing object
        return <NFTCard key={listing.listingId || index} listing={listing} />;
      })}
    </div>
  );
};
