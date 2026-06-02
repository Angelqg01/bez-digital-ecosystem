import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../context/AuthContext';
import { BEZ_COIN_ADDRESS } from '../config/contracts';

// Contract addresses (actualizar después del deploy)
const RWA_FACTORY_ADDRESS = import.meta.env.VITE_RWA_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000';
const RWA_VAULT_ADDRESS = import.meta.env.VITE_RWA_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000';

// Simplified ABIs
const RWA_FACTORY_ABI = [
    'function tokenizeAsset(string name, uint8 category, string legalCID, string imagesCID, uint256 supply, uint256 valuationUSD, uint256 pricePerFraction, uint256 estimatedYield, string location) returns (uint256)',
    'function getAsset(uint256 assetId) view returns (tuple(string name, uint8 category, string legalDocumentCID, string imagesCID, uint256 totalSupply, uint256 valuationUSD, uint256 pricePerFraction, uint256 estimatedYield, address creator, string location, uint256 createdAt, bool isActive))',
    'function assetCount() view returns (uint256)',
    'function tokenizationFee() view returns (uint256)',
    'function balanceOf(address account, uint256 id) view returns (uint256)',
    'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
    'function setApprovalForAll(address operator, bool approved)',
    'function isApprovedForAll(address account, address operator) view returns (bool)',
    'event AssetTokenized(uint256 indexed assetId, string name, uint8 category, address indexed creator, uint256 totalSupply, uint256 valuationUSD)'
];

const RWA_VAULT_ABI = [
    'function depositMonthlyRent(uint256 assetId, uint256 amount)',
    'function getPendingRewards(uint256 assetId, address user) view returns (uint256)',
    'function claimDividends(uint256 assetId)',
    'function assetDividends(uint256 assetId) view returns (tuple(uint256 totalDeposited, uint256 lastDistributionTime, uint256 distributionCount, bool isActive))',
    'event DividendsClaimed(uint256 indexed assetId, address indexed investor, uint256 amount)'
];

const BEZ_COIN_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)'
];

// Categorías de activos
export const ASSET_CATEGORIES = {
    INMUEBLE: 0,
    HOTEL: 1,
    LOCAL: 2,
    ROPA: 3,
    COCHE: 4,
    BARCO: 5,
    HELICOPTERO: 6,
    OBJETO: 7
};

export const CATEGORY_NAMES = {
    0: 'Inmueble',
    1: 'Hotel',
    2: 'Local Comercial',
    3: 'Ropa/Moda',
    4: 'Vehículo',
    5: 'Barco/Yate',
    6: 'Helicóptero',
    7: 'Objeto de Lujo'
};

export const useRWAContracts = () => {
    const { walletAddress, provider } = useAuth();
    const [factoryContract, setFactoryContract] = useState(null);
    const [vaultContract, setVaultContract] = useState(null);
    const [bezCoinContract, setBezCoinContract] = useState(null);
    const [loading, setLoading] = useState(false);
    const [tokenizationFee, setTokenizationFee] = useState('0');
    const [bezBalance, setBezBalance] = useState('0');
    const [myAssets, setMyAssets] = useState([]);

    // Initialize contracts
    useEffect(() => {
        const initContracts = async () => {
            if (!provider || !walletAddress) return;

            try {
                const signer = provider.getSigner();

                // RWA Factory Contract
                const factory = new ethers.Contract(
                    RWA_FACTORY_ADDRESS,
                    RWA_FACTORY_ABI,
                    signer
                );
                setFactoryContract(factory);

                // RWA Vault Contract
                const vault = new ethers.Contract(
                    RWA_VAULT_ADDRESS,
                    RWA_VAULT_ABI,
                    signer
                );
                setVaultContract(vault);

                // BEZ-Coin Contract
                const bezCoin = new ethers.Contract(
                    BEZ_COIN_ADDRESS,
                    BEZ_COIN_ABI,
                    signer
                );
                setBezCoinContract(bezCoin);

                // Get tokenization fee
                const fee = await factory.tokenizationFee();
                setTokenizationFee(ethers.formatEther(fee));

                // Get BEZ balance
                const balance = await bezCoin.balanceOf(walletAddress);
                setBezBalance(ethers.formatEther(balance));

            } catch (error) {
                console.error('Error initializing RWA contracts:', error);
            }
        };

        initContracts();
    }, [provider, walletAddress]);

    /**
     * Tokenize a new asset
     */
    const tokenizeAsset = useCallback(async (assetData) => {
        if (!factoryContract || !bezCoinContract) {
            throw new Error('Contracts not initialized');
        }

        setLoading(true);
        try {
            const {
                name,
                category,
                legalCID,
                imagesCID,
                totalSupply,
                valuationUSD,
                pricePerFraction,
                estimatedYield,
                location
            } = assetData;

            // 1. Approve BEZ-Coin for tokenization fee
            const fee = await factoryContract.tokenizationFee();
            const allowance = await bezCoinContract.allowance(walletAddress, RWA_FACTORY_ADDRESS);

            if (allowance.lt(fee)) {
                console.log('Approving BEZ-Coin...');
                const approveTx = await bezCoinContract.approve(
                    RWA_FACTORY_ADDRESS,
                    ethers.MaxUint256
                );
                await approveTx.wait();
            }

            // 2. Tokenize the asset
            console.log('Tokenizing asset...');
            const tx = await factoryContract.tokenizeAsset(
                name,
                category,
                legalCID,
                imagesCID || '',
                totalSupply,
                valuationUSD,
                ethers.parseEther(pricePerFraction.toString()),
                estimatedYield,
                location
            );

            const receipt = await tx.wait();

            // Extract assetId from event
            const event = receipt.events?.find(e => e.event === 'AssetTokenized');
            const assetId = event?.args?.assetId?.toNumber();

            setLoading(false);
            return {
                success: true,
                assetId,
                transactionHash: receipt.transactionHash
            };

        } catch (error) {
            console.error('Tokenization error:', error);
            setLoading(false);
            throw error;
        }
    }, [factoryContract, bezCoinContract, walletAddress]);

    /**
     * Get asset details
     */
    const getAsset = useCallback(async (assetId) => {
        if (!factoryContract) return null;

        try {
            const asset = await factoryContract.getAsset(assetId);
            return {
                assetId,
                name: asset.name,
                category: asset.category,
                categoryName: CATEGORY_NAMES[asset.category],
                legalDocumentCID: asset.legalDocumentCID,
                imagesCID: asset.imagesCID,
                totalSupply: asset.totalSupply.toNumber(),
                valuationUSD: asset.valuationUSD.toNumber(),
                pricePerFraction: ethers.formatEther(asset.pricePerFraction),
                estimatedYield: asset.estimatedYield.toNumber() / 100, // basis points to percentage
                creator: asset.creator,
                location: asset.location,
                createdAt: new Date(asset.createdAt.toNumber() * 1000),
                isActive: asset.isActive
            };
        } catch (error) {
            console.error('Error fetching asset:', error);
            return null;
        }
    }, [factoryContract]);

    /**
     * Get user's fraction balance for an asset
     */
    const getMyFractions = useCallback(async (assetId) => {
        if (!factoryContract || !walletAddress) return 0;

        try {
            const balance = await factoryContract.balanceOf(walletAddress, assetId);
            return balance.toNumber();
        } catch (error) {
            console.error('Error getting fractions:', error);
            return 0;
        }
    }, [factoryContract, walletAddress]);

    /**
     * Get pending dividends
     */
    const getPendingDividends = useCallback(async (assetId) => {
        if (!vaultContract || !walletAddress) return '0';

        try {
            const pending = await vaultContract.getPendingRewards(assetId, walletAddress);
            return ethers.formatEther(pending);
        } catch (error) {
            console.error('Error getting pending dividends:', error);
            return '0';
        }
    }, [vaultContract, walletAddress]);

    /**
     * Claim dividends
     */
    const claimDividends = useCallback(async (assetId) => {
        if (!vaultContract) {
            throw new Error('Vault contract not initialized');
        }

        setLoading(true);
        try {
            const tx = await vaultContract.claimDividends(assetId);
            const receipt = await tx.wait();

            setLoading(false);
            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Claim error:', error);
            setLoading(false);
            throw error;
        }
    }, [vaultContract]);

    /**
     * List fractions on marketplace
     */
    const listFractions = useCallback(async (assetId, amount, pricePerUnit) => {
        if (!factoryContract) {
            throw new Error('Factory contract not initialized');
        }

        setLoading(true);
        try {
            // Approve marketplace contract (if different from factory)
            // This would interact with the Marketplace.sol contract
            // For now, simplified version

            const isApproved = await factoryContract.isApprovedForAll(
                walletAddress,
                RWA_FACTORY_ADDRESS // Should be MARKETPLACE_ADDRESS
            );

            if (!isApproved) {
                const approveTx = await factoryContract.setApprovalForAll(
                    RWA_FACTORY_ADDRESS,
                    true
                );
                await approveTx.wait();
            }

            // Call marketplace listItem function here
            // This is a placeholder
            console.log('Listing on marketplace:', { assetId, amount, pricePerUnit });

            setLoading(false);
            return { success: true };

        } catch (error) {
            console.error('Listing error:', error);
            setLoading(false);
            throw error;
        }
    }, [factoryContract, walletAddress]);

    return {
        // Contracts
        factoryContract,
        vaultContract,
        bezCoinContract,

        // State
        loading,
        tokenizationFee,
        bezBalance,
        myAssets,

        // Functions
        tokenizeAsset,
        getAsset,
        getMyFractions,
        getPendingDividends,
        claimDividends,
        listFractions
    };
};

export default useRWAContracts;
