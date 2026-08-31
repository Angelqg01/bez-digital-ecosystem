/**
 * Contract Addresses Configuration
 * Centralized configuration for all smart contract addresses
 */

// BEZ-Coin Token Contract Address (Polygon Mainnet)
export const BEZ_COIN_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

// Cargo Manifest NFT Contract (Deploy after implementation)
export const CARGO_MANIFEST_ADDRESS = import.meta.env.VITE_CARGO_MANIFEST_ADDRESS || '';

// Marketplace Contract
export const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || '';

// DAO Contract
export const DAO_ADDRESS = import.meta.env.VITE_DAO_ADDRESS || '';

// Network Configuration
export const POLYGON_MAINNET_CHAIN_ID = 137;
export const POLYGON_AMOY_CHAIN_ID = 80002;

// Current Network (for development/production switching)
export const CURRENT_CHAIN_ID = import.meta.env.VITE_CHAIN_ID
    ? parseInt(import.meta.env.VITE_CHAIN_ID)
    : POLYGON_MAINNET_CHAIN_ID;

// Block Explorer URLs
export const BLOCK_EXPLORER_URLS = {
    [POLYGON_MAINNET_CHAIN_ID]: 'https://polygonscan.com',
    [POLYGON_AMOY_CHAIN_ID]: 'https://amoy.polygonscan.com'
};

// Get block explorer for current network
export const getBlockExplorer = () => BLOCK_EXPLORER_URLS[CURRENT_CHAIN_ID] || BLOCK_EXPLORER_URLS[POLYGON_MAINNET_CHAIN_ID];

// Format contract address for display (0x1234...5678)
export const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
