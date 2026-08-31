const { ethers } = require('ethers');
const { provider, CONTRACTS, ABIS } = require('../../config/contracts');

class BlockchainEventListener {
    constructor() {
        this.isListening = false;
        this.contracts = {};
        this.initializeContracts();
    }

    initializeContracts() {
        try {
            // Marketplace contract
            if (CONTRACTS.MARKETPLACE && ABIS.MARKETPLACE) {
                this.contracts.marketplace = new ethers.Contract(
                    CONTRACTS.MARKETPLACE,
                    ABIS.MARKETPLACE,
                    provider
                );
            }

            // NFTOffers contract
            if (CONTRACTS.NFT_OFFERS && ABIS.NFT_OFFERS) {
                this.contracts.nftOffers = new ethers.Contract(
                    CONTRACTS.NFT_OFFERS,
                    ABIS.NFT_OFFERS,
                    provider
                );
            }

            // NFTRental contract
            if (CONTRACTS.NFT_RENTAL && ABIS.NFT_RENTAL) {
                this.contracts.nftRental = new ethers.Contract(
                    CONTRACTS.NFT_RENTAL,
                    ABIS.NFT_RENTAL,
                    provider
                );
            }

            // BeZhasCore contract
            if (CONTRACTS.CORE && ABIS.CORE) {
                this.contracts.core = new ethers.Contract(
                    CONTRACTS.CORE,
                    ABIS.CORE,
                    provider
                );
            }

            console.log('✅ Event listener contracts inicializados');
        } catch (error) {
            console.error('❌ Error inicializando event listener contracts:', error);
        }
    }

    async startListening() {
        if (this.isListening) {
            console.log('⚠️  Event listener ya está activo');
            return;
        }

        console.log('🔊 Iniciando blockchain event listener...');
        this.isListening = true;

        // Escuchar eventos del Marketplace
        if (this.contracts.marketplace) {
            this.listenMarketplaceEvents();
        }

        // Escuchar eventos de NFTOffers
        if (this.contracts.nftOffers) {
            this.listenNFTOffersEvents();
        }

        // Escuchar eventos de NFTRental
        if (this.contracts.nftRental) {
            this.listenNFTRentalEvents();
        }

        // Escuchar eventos de Core
        if (this.contracts.core) {
            this.listenCoreEvents();
        }

        console.log('✅ Event listener activo en Polygon Mainnet');
    }

    listenMarketplaceEvents() {
        const { marketplace } = this.contracts;

        // Evento: Vendor Registrado
        marketplace.on('VendorStatusUpdated', async (user, status, timestamp, event) => {
            console.log('👤 Vendor Status Updated:', {
                user,
                status,
                timestamp: timestamp.toString(),
                txHash: event.transactionHash,
                blockNumber: event.blockNumber
            });

            await this.syncVendorStatus(user, status, event.transactionHash);
        });

        // Evento: Producto Creado
        marketplace.on('ProductCreated', async (id, seller, price, metadataCID, event) => {
            console.log('📦 Producto Creado:', {
                id: id.toString(),
                seller,
                price: ethers.utils.formatEther(price),
                metadataCID,
                txHash: event.transactionHash
            });

            await this.syncProductToDatabase({
                contractId: id.toString(),
                seller,
                price: ethers.utils.formatEther(price),
                metadataCID,
                txHash: event.transactionHash,
                blockNumber: event.blockNumber
            });
        });

        // Evento: Producto Vendido
        marketplace.on('ProductSold', async (id, buyer, price, timestamp, event) => {
            console.log('💰 Producto Vendido:', {
                id: id.toString(),
                buyer,
                price: ethers.utils.formatEther(price),
                timestamp: timestamp.toString(),
                txHash: event.transactionHash
            });

            await this.updateProductSoldStatus(id.toString(), buyer, event.transactionHash);
        });

        // Evento: Precio Actualizado
        marketplace.on('PriceUpdated', async (id, newPrice, event) => {
            console.log('💲 Precio Actualizado:', {
                id: id.toString(),
                newPrice: ethers.utils.formatEther(newPrice),
                txHash: event.transactionHash
            });

            await this.updateProductPrice(id.toString(), ethers.utils.formatEther(newPrice));
        });

        console.log('📢 Marketplace events activos');
    }

    listenNFTOffersEvents() {
        const { nftOffers } = this.contracts;

        nftOffers.on('OfferCreated', async (offerId, offerer, nftContract, tokenId, amount, event) => {
            console.log('🎨 NFT Offer Created:', {
                offerId,
                offerer,
                nftContract,
                tokenId: tokenId.toString(),
                amount: ethers.utils.formatEther(amount),
                txHash: event.transactionHash
            });

            // Aquí sincronizarías con tu DB
            await this.syncNFTOffer({
                offerId,
                offerer,
                nftContract,
                tokenId: tokenId.toString(),
                amount: ethers.utils.formatEther(amount),
                txHash: event.transactionHash,
                status: 'active'
            });
        });

        nftOffers.on('OfferAccepted', async (offerId, seller, event) => {
            console.log('✅ NFT Offer Accepted:', {
                offerId,
                seller,
                txHash: event.transactionHash
            });

            await this.updateNFTOfferStatus(offerId, 'accepted', event.transactionHash);
        });

        nftOffers.on('OfferCancelled', async (offerId, event) => {
            console.log('❌ NFT Offer Cancelled:', {
                offerId,
                txHash: event.transactionHash
            });

            await this.updateNFTOfferStatus(offerId, 'cancelled', event.transactionHash);
        });

        console.log('📢 NFTOffers events activos');
    }

    listenNFTRentalEvents() {
        const { nftRental } = this.contracts;

        nftRental.on('NFTListed', async (listingId, owner, nftContract, tokenId, pricePerDay, event) => {
            console.log('🏠 NFT Listed for Rent:', {
                listingId,
                owner,
                nftContract,
                tokenId: tokenId.toString(),
                pricePerDay: ethers.utils.formatEther(pricePerDay),
                txHash: event.transactionHash
            });

            // Sincronizar con DB
            await this.syncNFTRentalListing({
                listingId,
                owner,
                nftContract,
                tokenId: tokenId.toString(),
                pricePerDay: ethers.utils.formatEther(pricePerDay),
                txHash: event.transactionHash
            });
        });

        nftRental.on('NFTRented', async (rentalId, listingId, renter, rentalDays, totalPrice, event) => {
            console.log('🔑 NFT Rented:', {
                rentalId,
                listingId,
                renter,
                rentalDays: rentalDays.toString(),
                totalPrice: ethers.utils.formatEther(totalPrice),
                txHash: event.transactionHash
            });

            await this.syncNFTRental({
                rentalId,
                listingId,
                renter,
                rentalDays: rentalDays.toString(),
                totalPrice: ethers.utils.formatEther(totalPrice),
                txHash: event.transactionHash
            });
        });

        console.log('📢 NFTRental events activos');
    }

    listenCoreEvents() {
        const { core } = this.contracts;

        core.on('RewardDistributed', async (user, amount, reason, event) => {
            console.log('🎁 Reward Distributed:', {
                user,
                amount: ethers.utils.formatEther(amount),
                reason,
                txHash: event.transactionHash
            });

            // Actualizar balance del usuario en DB
            await this.updateUserRewards(user, ethers.utils.formatEther(amount), reason);
        });

        console.log('📢 BeZhasCore events activos');
    }

    // ========================================================================
    // MÉTODOS DE SINCRONIZACIÓN CON BASE DE DATOS
    // Implementar según tu modelo de datos MongoDB
    // ========================================================================

    async syncVendorStatus(userAddress, isVendor, txHash) {
        try {
            // TODO: Implementar actualización en User model
            // Ejemplo:
            // const User = require('../../models/User');
            // await User.updateOne(
            //   { wallet: userAddress.toLowerCase() },
            //   { isVendor, vendorTxHash: txHash }
            // );
            console.log('   📝 Vendor status synced (placeholder)');
        } catch (error) {
            console.error('Error syncing vendor status:', error);
        }
    }

    async syncProductToDatabase(productData) {
        try {
            // TODO: Implementar guardado en Product model
            // Ejemplo:
            // const Product = require('../../models/Product');
            // await Product.create(productData);
            console.log('   📝 Product synced (placeholder)');
        } catch (error) {
            console.error('Error syncing product:', error);
        }
    }

    async updateProductSoldStatus(productId, buyer, txHash) {
        try {
            // TODO: Actualizar estado del producto en DB
            console.log('   📝 Product sold status updated (placeholder)');
        } catch (error) {
            console.error('Error updating product sold status:', error);
        }
    }

    async updateProductPrice(productId, newPrice) {
        try {
            // TODO: Actualizar precio en DB
            console.log('   📝 Product price updated (placeholder)');
        } catch (error) {
            console.error('Error updating product price:', error);
        }
    }

    async syncNFTOffer(offerData) {
        try {
            // TODO: Guardar oferta en DB
            console.log('   📝 NFT Offer synced (placeholder)');
        } catch (error) {
            console.error('Error syncing NFT offer:', error);
        }
    }

    async updateNFTOfferStatus(offerId, status, txHash) {
        try {
            // TODO: Actualizar estado de oferta
            console.log('   📝 NFT Offer status updated (placeholder)');
        } catch (error) {
            console.error('Error updating NFT offer status:', error);
        }
    }

    async syncNFTRentalListing(listingData) {
        try {
            // TODO: Guardar listing en DB
            console.log('   📝 NFT Rental listing synced (placeholder)');
        } catch (error) {
            console.error('Error syncing NFT rental listing:', error);
        }
    }

    async syncNFTRental(rentalData) {
        try {
            // TODO: Guardar rental en DB
            console.log('   📝 NFT Rental synced (placeholder)');
        } catch (error) {
            console.error('Error syncing NFT rental:', error);
        }
    }

    async updateUserRewards(userAddress, amount, reason) {
        try {
            // TODO: Actualizar rewards del usuario
            console.log('   📝 User rewards updated (placeholder)');
        } catch (error) {
            console.error('Error updating user rewards:', error);
        }
    }

    stopListening() {
        if (!this.isListening) {
            console.log('⚠️  Event listener no está activo');
            return;
        }

        // Remover todos los listeners
        Object.values(this.contracts).forEach(contract => {
            if (contract) {
                contract.removeAllListeners();
            }
        });

        this.isListening = false;
        console.log('🔇 Event listeners detenidos');
    }
}

// Exportar instancia singleton
module.exports = new BlockchainEventListener();
