/**
 * @title BeZhas Marketplace SDK
 * @dev SDK para interactuar con el contrato BeZhasMarketplace
 * @author BeZhas Team
 */

const { ethers } = require('ethers');

// ABI del contrato BeZhasMarketplace
const MARKETPLACE_ABI = [
    'function bezhasToken() view returns (address)',
    'function vendorFee() view returns (uint256)',
    'function platformCommission() view returns (uint256)',
    'function isVendor(address) view returns (bool)',
    'function productPrices(uint256) view returns (uint256)',
    'function productSellers(uint256) view returns (address)',
    'function productCounter() view returns (uint256)',
    'function registerAsVendor()',
    'function createProduct(uint256 _price, string _metadataCID)',
    'function buyProduct(uint256 _id)',
    'event VendorStatusUpdated(address indexed user, bool status, uint256 timestamp)',
    'event ProductCreated(uint256 indexed id, address indexed seller, uint256 price, string metadataCID)',
    'event ProductSold(uint256 indexed id, address indexed buyer, uint256 price, uint256 timestamp)',
    'event PriceUpdated(uint256 indexed id, uint256 newPrice)'
];

class MarketplaceSDK {
    /**
     * @dev Constructor del SDK
     * @param {string} contractAddress - Dirección del contrato BeZhasMarketplace
     * @param {ethers.Provider} provider - Provider de ethers.js
     */
    constructor(contractAddress, provider) {
        if (!contractAddress || contractAddress === ethers.ZeroAddress) {
            console.warn('⚠️ Marketplace contract address not configured');
            this.contract = null;
            return;
        }

        this.contract = new ethers.Contract(
            contractAddress,
            MARKETPLACE_ABI,
            provider
        );
        this.provider = provider;
        this.contractAddress = contractAddress;
    }

    /**
     * @dev Registrarse como vendedor
     * @param {ethers.Signer} signer - Signer de la transacción
     * @returns {Promise<Object>} Resultado de la transacción
     */
    async registerAsVendor(signer) {
        try {
            if (!this.contract) throw new Error('Marketplace contract not initialized');

            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.registerAsVendor();
            const receipt = await tx.wait();

            return {
                success: true,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            };
        } catch (error) {
            console.error('Error registering as vendor:', error);
            throw error;
        }
    }

    /**
     * @dev Crear un producto/NFT
     * @param {string} price - Precio en tokens BEZ (en wei)
     * @param {string} metadataCID - CID de IPFS o identificador de metadata
     * @param {ethers.Signer} signer - Signer de la transacción
     * @returns {Promise<Object>} Resultado con ID del producto
     */
    async createProduct(price, metadataCID, signer) {
        try {
            if (!this.contract) throw new Error('Marketplace contract not initialized');

            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.createProduct(price, metadataCID);
            const receipt = await tx.wait();

            // Buscar evento ProductCreated
            const event = receipt.logs
                .map(log => {
                    try {
                        return this.contract.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find(e => e && e.name === 'ProductCreated');

            const productId = event ? event.args.id.toString() : null;

            return {
                success: true,
                productId,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            };
        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    }

    /**
     * @dev Comprar un producto
     * @param {string} productId - ID del producto
     * @param {ethers.Signer} signer - Signer de la transacción
     * @returns {Promise<Object>} Resultado de la compra
     */
    async buyProduct(productId, signer) {
        try {
            if (!this.contract) throw new Error('Marketplace contract not initialized');

            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.buyProduct(productId);
            const receipt = await tx.wait();

            return {
                success: true,
                productId,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            };
        } catch (error) {
            console.error('Error buying product:', error);
            throw error;
        }
    }

    /**
     * @dev Verificar si una dirección es vendedor
     * @param {string} address - Dirección a verificar
     * @returns {Promise<boolean>}
     */
    async isVendor(address) {
        try {
            if (!this.contract) return false;
            return await this.contract.isVendor(address);
        } catch (error) {
            console.error('Error checking vendor status:', error);
            return false;
        }
    }

    /**
     * @dev Obtener precio de un producto
     * @param {string} productId - ID del producto
     * @returns {Promise<string>} Precio en wei
     */
    async getProductPrice(productId) {
        try {
            if (!this.contract) return '0';
            const price = await this.contract.productPrices(productId);
            return price.toString();
        } catch (error) {
            console.error('Error getting product price:', error);
            return '0';
        }
    }

    /**
     * @dev Obtener vendedor de un producto
     * @param {string} productId - ID del producto
     * @returns {Promise<string>} Dirección del vendedor
     */
    async getProductSeller(productId) {
        try {
            if (!this.contract) return ethers.ZeroAddress;
            return await this.contract.productSellers(productId);
        } catch (error) {
            console.error('Error getting product seller:', error);
            return ethers.ZeroAddress;
        }
    }

    /**
     * @dev Obtener contador total de productos
     * @returns {Promise<number>} Número total de productos creados
     */
    async getProductCounter() {
        try {
            if (!this.contract) return 0;
            const counter = await this.contract.productCounter();
            return Number(counter);
        } catch (error) {
            console.error('Error getting product counter:', error);
            return 0;
        }
    }

    /**
     * @dev Obtener detalles de un producto
     * @param {string} productId - ID del producto
     * @returns {Promise<Object>} Detalles del producto
     */
    async getProductDetails(productId) {
        try {
            if (!this.contract) {
                return {
                    id: productId,
                    price: '0',
                    priceFormatted: '0',
                    seller: ethers.ZeroAddress,
                    exists: false
                };
            }

            const [price, seller] = await Promise.all([
                this.contract.productPrices(productId),
                this.contract.productSellers(productId)
            ]);

            return {
                id: productId,
                price: price.toString(),
                priceFormatted: ethers.formatEther(price),
                seller,
                exists: price > 0n
            };
        } catch (error) {
            console.error('Error getting product details:', error);
            return {
                id: productId,
                price: '0',
                priceFormatted: '0',
                seller: ethers.ZeroAddress,
                exists: false
            };
        }
    }

    /**
     * @dev Obtener fee de vendedor
     * @returns {Promise<string>} Fee en wei
     */
    async getVendorFee() {
        try {
            if (!this.contract) return '0';
            const fee = await this.contract.vendorFee();
            return fee.toString();
        } catch (error) {
            console.error('Error getting vendor fee:', error);
            return '0';
        }
    }

    /**
     * @dev Obtener comisión de plataforma
     * @returns {Promise<number>} Comisión en basis points (10000 = 100%)
     */
    async getPlatformCommission() {
        try {
            if (!this.contract) return 0;
            const commission = await this.contract.platformCommission();
            return Number(commission);
        } catch (error) {
            console.error('Error getting platform commission:', error);
            return 0;
        }
    }

    /**
     * @dev Obtener lista de todos los productos
     * @returns {Promise<Array>} Array de productos
     */
    async getAllProducts() {
        try {
            if (!this.contract) return [];

            const counter = await this.getProductCounter();
            const products = [];

            for (let i = 1; i <= counter; i++) {
                const details = await this.getProductDetails(i.toString());
                if (details.exists) {
                    products.push(details);
                }
            }

            return products;
        } catch (error) {
            console.error('Error getting all products:', error);
            return [];
        }
    }

    /**
     * @dev Obtener productos de un vendedor específico
     * @param {string} sellerAddress - Dirección del vendedor
     * @returns {Promise<Array>} Array de productos del vendedor
     */
    async getProductsBySeller(sellerAddress) {
        try {
            if (!this.contract) return [];

            const counter = await this.getProductCounter();
            const products = [];

            for (let i = 1; i <= counter; i++) {
                const details = await this.getProductDetails(i.toString());
                if (details.exists && details.seller.toLowerCase() === sellerAddress.toLowerCase()) {
                    products.push(details);
                }
            }

            return products;
        } catch (error) {
            console.error('Error getting products by seller:', error);
            return [];
        }
    }

    /**
     * @dev Obtener estadísticas del marketplace
     * @returns {Promise<Object>} Estadísticas generales
     */
    async getMarketplaceStats() {
        try {
            if (!this.contract) {
                return {
                    totalProducts: 0,
                    vendorFee: '0',
                    vendorFeeFormatted: '0',
                    platformCommission: 0,
                    platformCommissionPercent: '0'
                };
            }

            const [counter, vendorFee, commission] = await Promise.all([
                this.getProductCounter(),
                this.getVendorFee(),
                this.getPlatformCommission()
            ]);

            return {
                totalProducts: counter,
                vendorFee,
                vendorFeeFormatted: ethers.formatEther(vendorFee),
                platformCommission: commission,
                platformCommissionPercent: (commission / 100).toFixed(2)
            };
        } catch (error) {
            console.error('Error getting marketplace stats:', error);
            return {
                totalProducts: 0,
                vendorFee: '0',
                vendorFeeFormatted: '0',
                platformCommission: 0,
                platformCommissionPercent: '0'
            };
        }
    }

    // ============================================
    // Event Listeners
    // ============================================

    /**
     * @dev Escuchar eventos de nuevo vendedor
     * @param {Function} callback - Función a ejecutar cuando ocurra el evento
     */
    onVendorRegistered(callback) {
        if (!this.contract) return;

        this.contract.on('VendorStatusUpdated', (user, status, timestamp, event) => {
            if (status) {
                callback({
                    user,
                    timestamp: Number(timestamp),
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash
                });
            }
        });
    }

    /**
     * @dev Escuchar eventos de producto creado
     * @param {Function} callback - Función a ejecutar cuando ocurra el evento
     */
    onProductCreated(callback) {
        if (!this.contract) return;

        this.contract.on('ProductCreated', (id, seller, price, metadataCID, event) => {
            callback({
                id: id.toString(),
                seller,
                price: price.toString(),
                priceFormatted: ethers.formatEther(price),
                metadataCID,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });
    }

    /**
     * @dev Escuchar eventos de producto vendido
     * @param {Function} callback - Función a ejecutar cuando ocurra el evento
     */
    onProductSold(callback) {
        if (!this.contract) return;

        this.contract.on('ProductSold', (id, buyer, price, timestamp, event) => {
            callback({
                id: id.toString(),
                buyer,
                price: price.toString(),
                priceFormatted: ethers.formatEther(price),
                timestamp: Number(timestamp),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
        });
    }

    /**
     * @dev Remover todos los listeners
     */
    removeAllListeners() {
        if (!this.contract) return;
        this.contract.removeAllListeners();
    }
}

module.exports = MarketplaceSDK;
