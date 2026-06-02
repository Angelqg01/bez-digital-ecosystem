/**
 * ============================================================================
 * BEZHAS SDK - RWA (REAL WORLD ASSETS) MODULE
 * ============================================================================
 * 
 * Módulo para tokenización de activos del mundo real
 * Soporta bienes raíces, vehículos, arte, y más
 */

const axios = require('axios');
const { ethers } = require('ethers');

class RWAManager {
    /**
     * @param {Object} config - Configuración del SDK
     * @param {string} config.apiUrl - URL del backend API
     * @param {string} config.rpcUrl - URL del RPC de Polygon
     * @param {string} config.rwaFactoryAddress - Dirección del contrato RWA Factory
     */
    constructor(config) {
        this.apiUrl = config.apiUrl || 'http://localhost:3001';
        this.rpcUrl = config.rpcUrl || 'https://polygon-bor.publicnode.com';
        this.rwaFactoryAddress = config.rwaFactoryAddress || process.env.RWA_FACTORY;

        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
        this.axios = axios.create({
            baseURL: this.apiUrl,
            headers: { 'Content-Type': 'application/json' }
        });

        // ABI mínimo para RWA Factory
        this.rwaFactoryABI = [
            'function createAsset(string memory assetType, string memory metadata, uint256 value) external returns (uint256)',
            'function getAsset(uint256 tokenId) view returns (string assetType, address owner, uint256 value, bool verified)',
            'function transferAsset(uint256 tokenId, address to) external',
            'function verifyAsset(uint256 tokenId) external',
            'function listAssetsByOwner(address owner) view returns (uint256[] memory)'
        ];
    }

    /**
     * Tokeniza un activo del mundo real
     * @param {Object} assetData - Datos del activo
     * @param {string} assetData.type - Tipo de activo (real_estate, vehicle, art, etc.)
     * @param {Object} assetData.metadata - Metadata del activo
     * @param {number} assetData.value - Valor del activo en USD
     * @param {Object} signer - Signer de ethers.js
     * @returns {Promise<Object>} Resultado de la tokenización
     */
    async tokenizeAsset(assetData, signer) {
        try {
            const contract = new ethers.Contract(
                this.rwaFactoryAddress,
                this.rwaFactoryABI,
                signer
            );

            const metadataString = JSON.stringify(assetData.metadata);
            const valueWei = ethers.parseEther(assetData.value.toString());

            const tx = await contract.createAsset(
                assetData.type,
                metadataString,
                valueWei
            );
            const receipt = await tx.wait();

            // Extract tokenId from event logs
            const tokenId = receipt.logs[0]?.topics[1]; // Assuming first event is Transfer

            return {
                success: true,
                tokenId: tokenId ? parseInt(tokenId, 16) : null,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                assetType: assetData.type
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtiene información de un activo tokenizado
     * @param {number} tokenId - ID del token
     * @returns {Promise<Object>} Información del activo
     */
    async getAssetInfo(tokenId) {
        try {
            const contract = new ethers.Contract(
                this.rwaFactoryAddress,
                this.rwaFactoryABI,
                this.provider
            );

            const [assetType, owner, value, verified] = await contract.getAsset(tokenId);

            return {
                success: true,
                tokenId,
                assetType,
                owner,
                value: ethers.formatEther(value),
                verified,
                valueUSD: parseFloat(ethers.formatEther(value))
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Transfiere ownership de un activo
     * @param {number} tokenId - ID del token
     * @param {string} toAddress - Dirección del nuevo propietario
     * @param {Object} signer - Signer de ethers.js
     * @returns {Promise<Object>} Resultado de la transferencia
     */
    async transferAsset(tokenId, toAddress, signer) {
        try {
            const contract = new ethers.Contract(
                this.rwaFactoryAddress,
                this.rwaFactoryABI,
                signer
            );

            const tx = await contract.transferAsset(tokenId, toAddress);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.hash,
                tokenId,
                newOwner: toAddress,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Lista activos de un propietario
     * @param {string} ownerAddress - Dirección del propietario
     * @returns {Promise<Object>} Lista de activos
     */
    async listAssets(ownerAddress) {
        try {
            const contract = new ethers.Contract(
                this.rwaFactoryAddress,
                this.rwaFactoryABI,
                this.provider
            );

            const tokenIds = await contract.listAssetsByOwner(ownerAddress);

            // Get details for each asset
            const assets = await Promise.all(
                tokenIds.map(async (tokenId) => {
                    const info = await this.getAssetInfo(Number(tokenId));
                    return info.success ? { tokenId: Number(tokenId), ...info } : null;
                })
            );

            return {
                success: true,
                assets: assets.filter(a => a !== null),
                count: assets.filter(a => a !== null).length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verifica un activo (solo admin)
     * @param {number} tokenId - ID del token
     * @param {Object} signer - Signer de ethers.js (debe ser admin)
     * @returns {Promise<Object>} Resultado de la verificación
     */
    async verifyAsset(tokenId, signer) {
        try {
            const contract = new ethers.Contract(
                this.rwaFactoryAddress,
                this.rwaFactoryABI,
                signer
            );

            const tx = await contract.verifyAsset(tokenId);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.hash,
                tokenId,
                verified: true,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtiene estadísticas de RWA desde el backend
     * @returns {Promise<Object>} Estadísticas
     */
    async getStatistics() {
        try {
            const response = await this.axios.get('/api/rwa/statistics');

            return {
                success: true,
                statistics: response.data.statistics
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}

module.exports = RWAManager;
