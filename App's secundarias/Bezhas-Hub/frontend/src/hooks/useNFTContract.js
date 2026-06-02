import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../context/Web3Context';
import BezhasNFTABI from '../lib/blockchain/abis/BezhasNFT.json';

const BEZHAS_NFT_ADDRESS = import.meta.env.VITE_BEZHAS_NFT_ADDRESS || '0x0000000000000000000000000000000000000000';

export const useNFTContract = () => {
    const { signer, address } = useWeb3();
    const [nftContract, setNftContract] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!signer || !BEZHAS_NFT_ADDRESS || BEZHAS_NFT_ADDRESS === '0x0000000000000000000000000000000000000000') {
            setNftContract(null);
            return;
        }

        try {
            const contract = new ethers.Contract(BEZHAS_NFT_ADDRESS, BezhasNFTABI.abi, signer);
            setNftContract(contract);
        } catch (error) {
            console.error('Error creating NFT contract:', error);
            setNftContract(null);
        }
    }, [signer]);

    /**
     * Mint a new NFT
     */
    const mintNFT = async (toAddress, tokenURI) => {
        if (!nftContract) throw new Error('NFT contract not initialized');

        setIsLoading(true);
        try {
            const tx = await nftContract.safeMint(toAddress, tokenURI);
            await tx.wait();
            return tx;
        } catch (error) {
            console.error('Error minting NFT:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Get all NFTs owned by an address
     */
    const getOwnedNFTs = async (ownerAddress) => {
        if (!nftContract) return [];

        setIsLoading(true);
        try {
            const balance = await nftContract.balanceOf(ownerAddress);
            const nfts = [];

            for (let i = 0; i < balance; i++) {
                const tokenId = await nftContract.tokenOfOwnerByIndex(ownerAddress, i);
                const tokenURI = await nftContract.tokenURI(tokenId);
                nfts.push({
                    tokenId: tokenId.toString(),
                    tokenURI,
                    owner: ownerAddress
                });
            }

            return nfts;
        } catch (error) {
            console.error('Error fetching owned NFTs:', error);
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Approve marketplace to transfer NFT
     */
    const approveNFT = async (marketplaceAddress, tokenId) => {
        if (!nftContract) throw new Error('NFT contract not initialized');

        setIsLoading(true);
        try {
            const tx = await nftContract.approve(marketplaceAddress, tokenId);
            await tx.wait();
            return tx;
        } catch (error) {
            console.error('Error approving NFT:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Check if marketplace is approved for NFT
     */
    const isApproved = async (tokenId, marketplaceAddress) => {
        if (!nftContract) return false;

        try {
            const approved = await nftContract.getApproved(tokenId);
            return approved.toLowerCase() === marketplaceAddress.toLowerCase();
        } catch (error) {
            console.error('Error checking approval:', error);
            return false;
        }
    };

    return {
        nftContract,
        contractAddress: BEZHAS_NFT_ADDRESS,
        isContractDeployed: BEZHAS_NFT_ADDRESS !== '0x0000000000000000000000000000000000000000',
        isLoading,
        mintNFT,
        getOwnedNFTs,
        approveNFT,
        isApproved
    };
};
