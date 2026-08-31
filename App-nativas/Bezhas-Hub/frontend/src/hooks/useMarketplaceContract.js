import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../context/Web3Context';
import MarketplaceABI from '../lib/blockchain/abis/Marketplace.json';

const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || '0x0000000000000000000000000000000000000000';

export const useMarketplaceContract = () => {
    const { signer, address } = useWeb3();
    const [marketplaceContract, setMarketplaceContract] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!signer || !MARKETPLACE_ADDRESS || MARKETPLACE_ADDRESS === '0x0000000000000000000000000000000000000000') {
            setMarketplaceContract(null);
            return;
        }

        try {
            const contract = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, signer);
            setMarketplaceContract(contract);
        } catch (error) {
            console.error('Error creating Marketplace contract:', error);
            setMarketplaceContract(null);
        }
    }, [signer]);

    /**
     * List an NFT for sale
     */
    const listNFT = async (nftContractAddress, tokenId, priceInBEZ) => {
        if (!marketplaceContract) throw new Error('Marketplace contract not initialized');

        setIsLoading(true);
        try {
            const priceInWei = ethers.parseEther(priceInBEZ.toString());
            const tx = await marketplaceContract.listItem(nftContractAddress, tokenId, priceInWei);
            await tx.wait();
            return tx;
        } catch (error) {
            console.error('Error listing NFT:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Buy a listed NFT
     */
    const buyNFT = async (itemId) => {
        if (!marketplaceContract) throw new Error('Marketplace contract not initialized');

        setIsLoading(true);
        try {
            const tx = await marketplaceContract.buyItem(itemId);
            await tx.wait();
            return tx;
        } catch (error) {
            console.error('Error buying NFT:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Cancel a listing
     */
    const cancelListing = async (itemId) => {
        if (!marketplaceContract) throw new Error('Marketplace contract not initialized');

        setIsLoading(true);
        try {
            const tx = await marketplaceContract.cancelListing(itemId);
            await tx.wait();
            return tx;
        } catch (error) {
            console.error('Error cancelling listing:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Get all active listings
     */
    const getActiveListings = async () => {
        if (!marketplaceContract) return [];

        setIsLoading(true);
        try {
            const listings = await marketplaceContract.getListedItems();
            return listings.map(listing => ({
                itemId: listing.itemId.toString(),
                nftContract: listing.nftContract,
                tokenId: listing.tokenId.toString(),
                seller: listing.seller,
                price: ethers.formatEther(listing.price),
                isListed: listing.isListed
            }));
        } catch (error) {
            console.error('Error fetching listings:', error);
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Get marketplace details
     */
    const getMarketplaceInfo = async () => {
        if (!marketplaceContract) return null;

        try {
            const feeRecipient = await marketplaceContract.feeRecipient();
            const listingFeePercentage = await marketplaceContract.listingFeePercentage();

            return {
                feeRecipient,
                listingFeePercentage: listingFeePercentage.toString()
            };
        } catch (error) {
            console.error('Error fetching marketplace info:', error);
            return null;
        }
    };

    return {
        marketplaceContract,
        contractAddress: MARKETPLACE_ADDRESS,
        isContractDeployed: MARKETPLACE_ADDRESS !== '0x0000000000000000000000000000000000000000',
        isLoading,
        listNFT,
        buyNFT,
        cancelListing,
        getActiveListings,
        getMarketplaceInfo
    };
};
