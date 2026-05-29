/**
 * @deprecated — LEGACY SERVICE. Marketplace operations now live in BZ Sphere SubApp.
 * Replacement: BZ Sphere/src/services/blockchainService.js
 * DEX swaps → BZ Sphere → executeSwap()
 * Delivery escrow → BZ Sphere → createDeliveryEscrow()
 * The Hub should link to BZ Sphere instead of handling marketplace directly.
 */
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import axios from 'axios';

// API client for backend marketplace endpoints
const api = axios.create({
  baseURL: '/api/marketplace',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
});

// Add JWT token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * BEZ-Coin Contract Address (Official)
 */
export const BEZ_CONTRACT = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

/**
 * @dev Service module for interacting with the AdvancedMarketplace contract.
 */

/**
 * @dev Fetches all active listings from the marketplace.
 * @param {ethers.Contract} marketplaceContract The marketplace contract instance.
 * @returns {Promise<Array>} A list of active listings.
 */
export const fetchActiveListings = async (marketplaceContract) => {
  if (!marketplaceContract) throw new Error('Marketplace contract not provided.');

  try {
    // ABI: fetchMarketItems()
    const listings = await marketplaceContract.fetchMarketItems();

    // The contract returns a struct array. We need to format it for the UI.
    // Struct: { itemId, nftContract, tokenId, seller, owner, price, sold }
    return listings.map(listing => ({
      listingId: Number(listing.itemId),
      nftContract: listing.nftContract,
      tokenId: Number(listing.tokenId),
      seller: listing.seller,
      owner: listing.owner,
      price: ethers.formatEther(listing.price),
      sold: listing.sold,
      isActive: !listing.sold // Assuming unsold items are active
    }));
  } catch (error) {
    console.error('Error fetching active listings:', error);
    toast.error('Could not fetch marketplace listings.');
    return [];
  }
};

/**
 * @dev Handles the purchase of an NFT listing.
 * @param {ethers.Contract} marketplaceContract The marketplace contract instance.
 * @param {ethers.Contract} tokenContract The BEZ token contract instance (Unused if using native currency).
 * @param {number} listingId The ID of the listing to purchase.
 * @param {string} price The price of the listing in ether format.
 * @param {string} userAddress The buyer's address.
 */
export const buyListing = async (marketplaceContract, tokenContract, listingId, price, userAddress) => {
  const parsedPrice = ethers.parseEther(price);

  // ABI: createMarketSale(uint256 itemId) payable
  // Note: The ABI indicates this function is payable, implying it uses Native Currency (ETH/MATIC/POL)
  // If the intention was to use BEZ Token, the contract ABI would need to support it.
  // For now, we follow the ABI.

  try {
    const buyTx = await marketplaceContract.createMarketSale(listingId, { value: parsedPrice });
    toast.loading('Processing purchase...', { id: 'buy-listing' });
    await buyTx.wait();
    toast.success('Purchase successful!', { id: 'buy-listing' });
  } catch (error) {
    console.error("Purchase failed:", error);
    toast.error("Purchase failed: " + (error.reason || error.message));
    throw error;
  }
};

/**
 * @dev Handles the creation of a new NFT listing.
 * @param {ethers.Contract} marketplaceContract The marketplace contract instance.
 * @param {ethers.Contract} nftContract The NFT contract instance.
 * @param {number} tokenId The ID of the token to list.
 * @param {string} price The desired price in ether format.
 */
export const createListing = async (marketplaceContract, nftContract, tokenId, price) => {
  const parsedPrice = ethers.parseEther(price);

  // 1. Approve the marketplace to manage this specific NFT
  // ABI: approve(address to, uint256 tokenId)
  const approveTx = await nftContract.approve(marketplaceContract.target, tokenId);
  toast.loading('Approving NFT for sale...', { id: 'approve-list' });
  await approveTx.wait();
  toast.success('NFT approved!', { id: 'approve-list' });

  // 2. Create the listing
  // ABI: createMarketItem(address nftContract, uint256 tokenId, uint256 price)
  const listTx = await marketplaceContract.createMarketItem(nftContract.target, tokenId, parsedPrice);
  toast.loading('Creating your listing...', { id: 'create-listing' });
  await listTx.wait();
  toast.success('Listing created successfully!', { id: 'create-listing' });
};
// ============================================
// BACKEND API METHODS (BEZ-Coin Payments)
// ============================================

/**
 * Get all listings from backend API
 * @returns {Promise<Array>} List of active listings
 */
export const getListingsFromAPI = async () => {
  try {
    const response = await api.get('/listings');
    return response.data;
  } catch (error) {
    console.error('Error fetching listings from API:', error);
    return [];
  }
};

/**
 * Create a BEZ-Coin payment for a listing
 * @param {number} listingId - Listing ID to purchase
 * @param {string} buyerAddress - Buyer's wallet address
 * @param {number} bezAmount - Amount of BEZ tokens
 * @returns {Promise<Object>} Payment details
 */
export const createBEZPayment = async (listingId, buyerAddress, bezAmount) => {
  try {
    const response = await api.post(`/listings/${listingId}/pay-with-bez`, {
      buyer: buyerAddress,
      bezAmount
    });
    return response.data;
  } catch (error) {
    console.error('Error creating BEZ payment:', error);
    toast.error('Failed to create BEZ payment');
    throw error;
  }
};

/**
 * Confirm a BEZ-Coin payment after on-chain transaction
 * @param {number} paymentId - Payment ID
 * @param {string} txHash - Transaction hash
 * @param {number} blockNumber - Block number
 * @returns {Promise<Object>} Confirmation result
 */
export const confirmBEZPayment = async (paymentId, txHash, blockNumber) => {
  try {
    const response = await api.post(`/payments/${paymentId}/confirm`, {
      txHash,
      blockNumber
    });
    toast.success('Payment confirmed!');
    return response.data;
  } catch (error) {
    console.error('Error confirming payment:', error);
    toast.error('Failed to confirm payment');
    throw error;
  }
};

/**
 * Get payment history for a wallet address
 * @param {string} address - Wallet address
 * @returns {Promise<Object>} Payment history
 */
export const getPaymentHistory = async (address) => {
  try {
    const response = await api.get(`/payments/${address}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return { payments: [], count: 0 };
  }
};

/**
 * Submit a product for admin review
 * @param {Object} productData - Product data
 * @returns {Promise<Object>} Submission result
 */
export const submitProductForReview = async (productData) => {
  try {
    const response = await api.post('/products/submit-review', productData);
    toast.success('Product submitted for review!');
    return response.data;
  } catch (error) {
    console.error('Error submitting product:', error);
    toast.error('Failed to submit product');
    throw error;
  }
};

/**
 * Get pending products (Admin only)
 * @returns {Promise<Array>} List of pending products
 */
export const getPendingProducts = async () => {
  try {
    const response = await api.get('/products/pending');
    return response.data;
  } catch (error) {
    console.error('Error fetching pending products:', error);
    return [];
  }
};

/**
 * Approve a product (Admin only)
 * @param {number} productId - Product ID
 * @returns {Promise<Object>} Approval result
 */
export const approveProduct = async (productId) => {
  try {
    const response = await api.post(`/products/${productId}/approve`);
    toast.success('Product approved!');
    return response.data;
  } catch (error) {
    console.error('Error approving product:', error);
    toast.error('Failed to approve product');
    throw error;
  }
};

/**
 * Reject a product (Admin only)
 * @param {number} productId - Product ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Rejection result
 */
export const rejectProduct = async (productId, reason) => {
  try {
    const response = await api.post(`/products/${productId}/reject`, { reason });
    return response.data;
  } catch (error) {
    console.error('Error rejecting product:', error);
    toast.error('Failed to reject product');
    throw error;
  }
};

/**
 * Check marketplace API health
 * @returns {Promise<Object>} Health status
 */
export const checkMarketplaceHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Marketplace API health check failed:', error);
    return { success: false, error: error.message };
  }
};