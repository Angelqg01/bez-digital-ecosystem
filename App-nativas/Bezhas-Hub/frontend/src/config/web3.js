import { createConfig, http } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { createWeb3Modal } from '@web3modal/wagmi';

// ========================================================================
// CONTRACT ADDRESSES - Polygon Mainnet
// ========================================================================
export const CONTRACTS = {
    BEZCOIN: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    QUALITY_ESCROW: '0x3088573c025F197A886b97440761990c9A9e83C9',
    RWA_FACTORY: '0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0',
    VAULT: '0xCDd23058bf8143680f0A320318604bB749f701ED',
    GOVERNANCE_SYSTEM: '0x304Fd77f64C03482edcec0923f0Cd4A066a305F3',
    CORE: '0x260A9fBcE1c6817c04e51c170b5BFd8d594c0d8A',
    LIQUIDITY_FARMING: '0x4C5330B45FEa670d5ffEAD418E74dB7EA5ECdD26',
    NFT_OFFERS: '0x0C9Bf667b838f6d466619ddb90a08d6c9A64d0A4',
    NFT_RENTAL: '0x96B1754BbfdC5a2f6013A8a04cB6AF2E4090C024',
    MARKETPLACE: '0x1c061A896E0ac9C046A93eaf475c45ED5Bd8A1fE',
    ADMIN_REGISTRY: '0xfCe2F7dcf1786d1606b9b858E9ba04dA499F1e3C'
};

// ========================================================================
// WAGMI CONFIGURATION
// ========================================================================

// WalletConnect Project ID (debe estar en tu .env)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// Metadata para Web3Modal
const metadata = {
    name: 'BeZhas',
    description: 'Web3 Social Network with AI & Blockchain',
    url: 'https://bezhas.com',
    icons: ['https://bezhas.com/logo.png']
};

// Configuración de Wagmi
export const config = createConfig({
    chains: [polygon],
    transports: {
        [polygon.id]: http('https://polygon-bor.publicnode.com')
    },
    ssr: false
});

// Crear Web3Modal
export const web3Modal = createWeb3Modal({
    wagmiConfig: config,
    projectId,
    metadata,
    themeMode: 'dark',
    themeVariables: {
        '--w3m-color-mix': '#00BB7F',
        '--w3m-accent': '#00BB7F'
    }
});

// ========================================================================
// CONTRACT ABIS (Importar según sea necesario)
// ========================================================================

// Importar ABIs compilados de Hardhat
// Ejemplo: import BeZCoinABI from '../../../artifacts/contracts/BEZ-Coin.sol/BEZCoin.json'

// Por ahora, funciones comunes de ERC20 para BEZ-Coin
export const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

// Funciones comunes del Marketplace
export const MARKETPLACE_ABI = [
    'function isVendor(address user) view returns (bool)',
    'function productCount() view returns (uint256)',
    'function getProductPrice(uint256 productId) view returns (uint256)',
    'function createProduct(uint256 price, string metadataCID) returns (uint256)',
    'function buyProduct(uint256 productId)',
    'event ProductCreated(uint256 indexed id, address indexed seller, uint256 price, string metadataCID)',
    'event ProductSold(uint256 indexed id, address indexed buyer, uint256 price, uint256 timestamp)',
    'event VendorStatusUpdated(address indexed user, bool status, uint256 timestamp)'
];

// Funciones comunes del Core (Rewards & Admin)
export const CORE_ABI = [
    'function hasRole(bytes32 role, address account) view returns (bool)',
    'function distributeRewards(address user, uint256 amount, string reason)',
    'event RewardDistributed(address indexed user, uint256 amount, string reason)'
];

// Funciones comunes de NFT Offers
export const NFT_OFFERS_ABI = [
    'function createOffer(address nftContract, uint256 tokenId, uint256 amount)',
    'function acceptOffer(uint256 offerId)',
    'function cancelOffer(uint256 offerId)',
    'event OfferCreated(uint256 indexed offerId, address indexed offerer, address indexed nftContract, uint256 tokenId, uint256 amount)',
    'event OfferAccepted(uint256 indexed offerId, address indexed seller)',
    'event OfferCancelled(uint256 indexed offerId)'
];

// Funciones comunes de NFT Rental
export const NFT_RENTAL_ABI = [
    'function listNFT(address nftContract, uint256 tokenId, uint256 pricePerDay, uint256 maxRentalDays)',
    'function rentNFT(uint256 listingId, uint256 rentalDays)',
    'event NFTListed(uint256 indexed listingId, address indexed owner, address indexed nftContract, uint256 tokenId, uint256 pricePerDay)',
    'event NFTRented(uint256 indexed rentalId, uint256 indexed listingId, address indexed renter, uint256 rentalDays, uint256 totalPrice)'
];

// Funciones comunes de Liquidity Farming
export const FARMING_ABI = [
    'function stake(uint256 amount)',
    'function unstake(uint256 amount)',
    'function claimRewards()',
    'function getUserStake(address user) view returns (uint256)',
    'function getPendingRewards(address user) view returns (uint256)',
    'event Staked(address indexed user, uint256 amount)',
    'event Unstaked(address indexed user, uint256 amount)',
    'event RewardsClaimed(address indexed user, uint256 amount)'
];

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

/**
 * Formatear balance de tokens (18 decimales)
 */
export function formatTokenBalance(balance, decimals = 18) {
    if (!balance) return '0';
    return (Number(balance) / 10 ** decimals).toFixed(4);
}

/**
 * Parsear cantidad a wei (18 decimales)
 */
export function parseTokenAmount(amount, decimals = 18) {
    return BigInt(Math.floor(Number(amount) * 10 ** decimals));
}

/**
 * Shortear dirección de wallet
 */
export function shortenAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Obtener explorador de blockchain
 */
export function getExplorerUrl(txHash) {
    return `https://polygonscan.com/tx/${txHash}`;
}

/**
 * Obtener URL de dirección en explorador
 */
export function getAddressExplorerUrl(address) {
    return `https://polygonscan.com/address/${address}`;
}
