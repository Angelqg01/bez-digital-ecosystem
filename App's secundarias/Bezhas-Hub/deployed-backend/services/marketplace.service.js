/**
 * @title Marketplace Service
 * @dev Servicio backend para el marketplace de NFTs
 */

const MarketplaceSDK = require('../../sdk/marketplace');
const web3Service = require('./web3.service');
const { ethers } = require('ethers');

class MarketplaceService {
    constructor() {
        this.sdk = null;
        this.initialize();
    }

    /**
     * @dev Inicializar el SDK del marketplace
     */
    async initialize() {
        try {
            const provider = web3Service.getProvider();
            const marketplaceAddress = process.env.MARKETPLACE_CONTRACT_ADDRESS;

            if (!marketplaceAddress || !provider) {
                console.warn('⚠️ Marketplace contract not configured - running in demo mode');
                return;
            }

            this.sdk = new MarketplaceSDK(marketplaceAddress, provider);
            console.log('✅ Marketplace SDK initialized');
        } catch (error) {
            console.error('Error initializing Marketplace SDK:', error);
        }
    }

    /**
     * @dev Obtener todos los productos del marketplace
     * @param {number} page - Número de página
     * @param {number} limit - Límite por página
     * @returns {Promise<Object>} Productos paginados
     */
    async getAllProducts(page = 1, limit = 20) {
        try {
            if (!this.sdk) {
                return {
                    products: [],
                    pagination: {
                        page,
                        limit,
                        total: 0,
                        totalPages: 0,
                        hasMore: false
                    }
                };
            }

            const allProducts = await this.sdk.getAllProducts();

            // Ordenar por ID descendente (más recientes primero)
            const sortedProducts = allProducts.sort((a, b) =>
                parseInt(b.id) - parseInt(a.id)
            );

            // Paginar
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedProducts = sortedProducts.slice(startIndex, endIndex);

            return {
                products: paginatedProducts,
                pagination: {
                    page,
                    limit,
                    total: allProducts.length,
                    totalPages: Math.ceil(allProducts.length / limit),
                    hasMore: endIndex < allProducts.length
                }
            };
        } catch (error) {
            console.error('Error getting all products:', error);
            throw error;
        }
    }

    /**
     * @dev Obtener detalles de un producto
     * @param {string} productId - ID del producto
     * @returns {Promise<Object>} Detalles del producto
     */
    async getProductDetails(productId) {
        try {
            if (!this.sdk) return null;
            return await this.sdk.getProductDetails(productId);
        } catch (error) {
            console.error('Error getting product details:', error);
            throw error;
        }
    }

    /**
     * @dev Obtener productos de un vendedor
     * @param {string} sellerAddress - Dirección del vendedor
     * @returns {Promise<Array>} Productos del vendedor
     */
    async getProductsBySeller(sellerAddress) {
        try {
            if (!this.sdk) return [];
            return await this.sdk.getProductsBySeller(sellerAddress);
        } catch (error) {
            console.error('Error getting products by seller:', error);
            throw error;
        }
    }

    /**
     * @dev Verificar si una dirección es vendedor
     * @param {string} address - Dirección a verificar
     * @returns {Promise<Object>} Estado de vendedor
     */
    async checkVendorStatus(address) {
        try {
            if (!this.sdk) {
                return {
                    isVendor: false,
                    address
                };
            }

            const isVendor = await this.sdk.isVendor(address);
            const stats = await this.getMarketplaceStats();

            return {
                isVendor,
                address,
                vendorFee: stats.vendorFee,
                vendorFeeFormatted: stats.vendorFeeFormatted
            };
        } catch (error) {
            console.error('Error checking vendor status:', error);
            throw error;
        }
    }

    /**
     * @dev Obtener estadísticas del marketplace
     * @returns {Promise<Object>} Estadísticas
     */
    async getMarketplaceStats() {
        try {
            if (!this.sdk) {
                return {
                    totalProducts: 0,
                    vendorFee: '0',
                    vendorFeeFormatted: '0',
                    platformCommission: 0,
                    platformCommissionPercent: '0',
                    activeProducts: 0
                };
            }

            const stats = await this.sdk.getMarketplaceStats();

            // Contar productos activos (con precio > 0)
            const allProducts = await this.sdk.getAllProducts();
            const activeProducts = allProducts.filter(p => p.exists).length;

            return {
                ...stats,
                activeProducts
            };
        } catch (error) {
            console.error('Error getting marketplace stats:', error);
            throw error;
        }
    }

    /**
     * @dev Validar que un usuario puede crear productos
     * @param {string} userAddress - Dirección del usuario
     * @returns {Promise<Object>} Resultado de validación
     */
    async canCreateProduct(userAddress) {
        try {
            if (!this.sdk) {
                return {
                    canCreate: false,
                    reason: 'Marketplace contract not deployed'
                };
            }

            const isVendor = await this.sdk.isVendor(userAddress);

            if (!isVendor) {
                const stats = await this.getMarketplaceStats();
                return {
                    canCreate: false,
                    reason: 'Not registered as vendor',
                    vendorFee: stats.vendorFee,
                    vendorFeeFormatted: stats.vendorFeeFormatted
                };
            }

            return {
                canCreate: true,
                reason: 'Authorized vendor'
            };
        } catch (error) {
            console.error('Error validating product creation:', error);
            throw error;
        }
    }

    /**
     * @dev Buscar productos por término
     * @param {string} query - Término de búsqueda
     * @returns {Promise<Array>} Productos encontrados
     */
    async searchProducts(query) {
        try {
            if (!this.sdk) return [];

            // Por ahora solo búsqueda por ID o seller
            // En producción, esto buscaría en metadata IPFS o DB
            const allProducts = await this.sdk.getAllProducts();

            const lowerQuery = query.toLowerCase();
            return allProducts.filter(product =>
                product.id.includes(query) ||
                product.seller.toLowerCase().includes(lowerQuery)
            );
        } catch (error) {
            console.error('Error searching products:', error);
            return [];
        }
    }

    /**
     * @dev Obtener productos destacados
     * @param {number} limit - Límite de productos
     * @returns {Promise<Array>} Productos destacados
     */
    async getFeaturedProducts(limit = 6) {
        try {
            if (!this.sdk) return [];

            const allProducts = await this.sdk.getAllProducts();

            // Ordenar por ID descendente y tomar los primeros N
            return allProducts
                .sort((a, b) => parseInt(b.id) - parseInt(a.id))
                .slice(0, limit);
        } catch (error) {
            console.error('Error getting featured products:', error);
            return [];
        }
    }

    /**
     * @dev Calcular precio con comisión
     * @param {string} basePrice - Precio base en wei
     * @returns {Promise<Object>} Breakdown de precios
     */
    async calculatePriceBreakdown(basePrice) {
        try {
            if (!this.sdk) {
                return {
                    basePrice: basePrice,
                    basePriceFormatted: ethers.formatEther(basePrice),
                    commission: '0',
                    commissionFormatted: '0',
                    sellerReceives: basePrice,
                    sellerReceivesFormatted: ethers.formatEther(basePrice),
                    commissionPercent: '0'
                };
            }

            const commissionBp = await this.sdk.getPlatformCommission();
            const basePriceBn = BigInt(basePrice);
            const commissionBn = (basePriceBn * BigInt(commissionBp)) / 10000n;
            const sellerReceivesBn = basePriceBn - commissionBn;

            return {
                basePrice: basePrice,
                basePriceFormatted: ethers.formatEther(basePrice),
                commission: commissionBn.toString(),
                commissionFormatted: ethers.formatEther(commissionBn),
                sellerReceives: sellerReceivesBn.toString(),
                sellerReceivesFormatted: ethers.formatEther(sellerReceivesBn),
                commissionPercent: (commissionBp / 100).toFixed(2)
            };
        } catch (error) {
            console.error('Error calculating price breakdown:', error);
            throw error;
        }
    }

    /**
     * @dev Obtener datos del usuario en el marketplace
     * @param {string} userAddress - Dirección del usuario
     * @returns {Promise<Object>} Datos del usuario
     */
    async getUserMarketplaceData(userAddress) {
        try {
            if (!this.sdk) {
                return {
                    address: userAddress,
                    isVendor: false,
                    productsListed: 0,
                    products: []
                };
            }

            const [isVendor, products] = await Promise.all([
                this.sdk.isVendor(userAddress),
                this.sdk.getProductsBySeller(userAddress)
            ]);

            return {
                address: userAddress,
                isVendor,
                productsListed: products.length,
                products: products.slice(0, 10) // Primeros 10
            };
        } catch (error) {
            console.error('Error getting user marketplace data:', error);
            throw error;
        }
    }
}

module.exports = new MarketplaceService();
