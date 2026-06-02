const { ethers } = require('ethers');
const { provider, CONTRACTS, ABIS } = require('../../config/contracts');

class ContractService {
    constructor() {
        // Wallet con private key para transacciones automatizadas (si existe)
        const relayerKey = process.env.RELAYER_PRIVATE_KEY;
        if (relayerKey) {
            this.wallet = new ethers.Wallet(relayerKey, provider);
            console.log('🔑 Relayer wallet inicializada:', this.wallet.address);
        } else {
            console.warn('⚠️  RELAYER_PRIVATE_KEY no configurada - operaciones de escritura deshabilitadas');
        }

        // Inicializar contratos (read-only)
        this.initializeContracts();
    }

    initializeContracts() {
        try {
            // Core contract
            if (CONTRACTS.CORE && ABIS.CORE) {
                this.coreContract = new ethers.Contract(
                    CONTRACTS.CORE,
                    ABIS.CORE,
                    this.wallet || provider
                );
            }

            // Marketplace contract
            if (CONTRACTS.MARKETPLACE && ABIS.MARKETPLACE) {
                this.marketplaceContract = new ethers.Contract(
                    CONTRACTS.MARKETPLACE,
                    ABIS.MARKETPLACE,
                    this.wallet || provider
                );
            }

            // Admin Registry contract
            if (CONTRACTS.ADMIN_REGISTRY && ABIS.ADMIN_REGISTRY) {
                this.adminRegistryContract = new ethers.Contract(
                    CONTRACTS.ADMIN_REGISTRY,
                    ABIS.ADMIN_REGISTRY,
                    provider
                );
            }

            // BEZ Token contract
            if (CONTRACTS.BEZCOIN && ABIS.BEZCOIN) {
                this.bezTokenContract = new ethers.Contract(
                    CONTRACTS.BEZCOIN,
                    ABIS.BEZCOIN,
                    provider
                );
            }

            console.log('✅ Contratos inicializados correctamente');
        } catch (error) {
            console.error('❌ Error inicializando contratos:', error.message);
        }
    }

    /**
     * Distribuir rewards diarios a un usuario
     * Requiere RELAYER_PRIVATE_KEY configurada
     */
    async distributeRewards(userAddress, amount) {
        if (!this.wallet) {
            return {
                success: false,
                error: 'RELAYER_PRIVATE_KEY no configurada'
            };
        }

        if (!this.coreContract) {
            return {
                success: false,
                error: 'BeZhasCore contract no inicializado'
            };
        }

        try {
            const amountWei = ethers.utils.parseEther(amount.toString());

            const tx = await this.coreContract.distributeRewards(userAddress, amountWei, {
                maxPriorityFeePerGas: ethers.utils.parseUnits('50', 'gwei'),
                maxFeePerGas: ethers.utils.parseUnits('500', 'gwei')
            });

            const receipt = await tx.wait();

            return {
                success: true,
                txHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error('Error distribuyendo rewards:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verificar si un usuario es admin
     */
    async isUserAdmin(address) {
        if (!this.adminRegistryContract) {
            console.warn('AdminRegistry contract no inicializado');
            return false;
        }

        try {
            return await this.adminRegistryContract.isAdmin(address);
        } catch (error) {
            console.error('Error verificando admin:', error);
            return false;
        }
    }

    /**
     * Obtener balance de BEZ de un usuario
     */
    async getUserBezBalance(address) {
        if (!this.bezTokenContract) {
            throw new Error('BEZ Token contract no inicializado');
        }

        try {
            const balance = await this.bezTokenContract.balanceOf(address);
            return ethers.utils.formatEther(balance);
        } catch (error) {
            console.error('Error obteniendo balance:', error);
            throw error;
        }
    }

    /**
     * Verificar si un usuario es vendor en el marketplace
     */
    async isVendor(address) {
        if (!this.marketplaceContract) {
            return false;
        }

        try {
            return await this.marketplaceContract.isVendor(address);
        } catch (error) {
            console.error('Error verificando vendor:', error);
            return false;
        }
    }

    /**
     * Obtener contador de productos del marketplace
     */
    async getProductCounter() {
        if (!this.marketplaceContract) {
            return 0;
        }

        try {
            const counter = await this.marketplaceContract.productCounter();
            return counter.toNumber();
        } catch (error) {
            console.error('Error obteniendo product counter:', error);
            return 0;
        }
    }

    /**
     * Obtener precio de un producto
     */
    async getProductPrice(productId) {
        if (!this.marketplaceContract) {
            throw new Error('Marketplace contract no inicializado');
        }

        try {
            const price = await this.marketplaceContract.productPrices(productId);
            return ethers.utils.formatEther(price);
        } catch (error) {
            console.error('Error obteniendo precio:', error);
            throw error;
        }
    }

    /**
     * Obtener información del gas actual
     */
    async getCurrentGasPrice() {
        try {
            const gasPrice = await provider.getGasPrice();
            return {
                wei: gasPrice.toString(),
                gwei: ethers.utils.formatUnits(gasPrice, 'gwei')
            };
        } catch (error) {
            console.error('Error obteniendo gas price:', error);
            throw error;
        }
    }

    /**
     * Obtener balance de MATIC del relayer
     */
    async getRelayerBalance() {
        if (!this.wallet) {
            return '0';
        }

        try {
            const balance = await provider.getBalance(this.wallet.address);
            return ethers.utils.formatEther(balance);
        } catch (error) {
            console.error('Error obteniendo balance del relayer:', error);
            return '0';
        }
    }
}

// Exportar instancia singleton
module.exports = new ContractService();
