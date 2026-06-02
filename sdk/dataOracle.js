/**
 * @title DataOracleSDK
 * @dev SDK para interactuar con el contrato DataOracle.sol
 * Sistema de oráculo descentralizado para feeds de datos y precios
 */

import { ethers } from 'ethers';

// ABI del contrato DataOracle (métodos principales)
const DATA_ORACLE_ABI = [
    "function registerProvider(string name, uint256 minimumStake) external payable",
    "function createDataFeed(string name, string description, uint256 updateInterval, uint256 price) external returns (bytes32)",
    "function updateDataFeed(bytes32 feedId, bytes32 dataHash) external",
    "function updatePrice(string symbol, uint256 price, uint256 confidence) external",
    "function createRequest(string dataType, bytes32 parameters) external payable returns (uint256)",
    "function fulfillRequest(uint256 requestId, bytes response) external",
    "function subscribeToFeed(bytes32 feedId) external payable",
    "function getPrice(string symbol) external view returns (uint256, uint256, uint256, address)",
    "function getDataFeed(bytes32 feedId) external view returns (string, string, address, uint256, bytes32, bool, uint256, uint256)",
    "function getRequest(uint256 requestId) external view returns (uint256, address, string, bytes32, uint256, bool, bytes, address, uint256)",
    "function getProvider(address provider) external view returns (address, string, uint256, uint256, uint256, bool, uint256, uint256)",
    "function getActiveFeedIds() external view returns (bytes32[])",
    "function getAvailableSymbols() external view returns (string[])",
    "function requestCounter() external view returns (uint256)",
    "function defaultRequestFee() external view returns (uint256)",

    // Events
    "event DataFeedCreated(bytes32 indexed feedId, string name, address provider)",
    "event DataFeedUpdated(bytes32 indexed feedId, bytes32 dataHash, uint256 timestamp)",
    "event PriceUpdated(string indexed symbol, uint256 price, uint256 timestamp, address provider)",
    "event RequestCreated(uint256 indexed requestId, address indexed requester, string dataType)",
    "event RequestFulfilled(uint256 indexed requestId, address indexed fulfiller, bytes response)",
    "event ProviderRegistered(address indexed provider, string name)",
    "event SubscriptionCreated(bytes32 indexed feedId, address indexed subscriber)"
];

class DataOracleSDK {
    constructor(contractAddress, provider) {
        this.contractAddress = contractAddress;
        this.provider = provider;
        this.contract = new ethers.Contract(contractAddress, DATA_ORACLE_ABI, provider);
        this.eventListeners = {};
    }

    /**
     * Registrar como proveedor de oráculo
     */
    async registerProvider(name, minimumStake, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.registerProvider(name, minimumStake, {
                value: minimumStake
            });
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error registering provider:', error);
            throw new Error(`Failed to register provider: ${error.message}`);
        }
    }

    /**
     * Crear un nuevo data feed
     */
    async createDataFeed(name, description, updateInterval, price, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.createDataFeed(name, description, updateInterval, price);
            const receipt = await tx.wait();

            // Extraer feedId del evento
            const event = receipt.events?.find(e => e.event === 'DataFeedCreated');
            const feedId = event?.args?.feedId;

            return {
                success: true,
                feedId,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error creating data feed:', error);
            throw new Error(`Failed to create data feed: ${error.message}`);
        }
    }

    /**
     * Actualizar un data feed
     */
    async updateDataFeed(feedId, dataHash, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.updateDataFeed(feedId, dataHash);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error updating data feed:', error);
            throw new Error(`Failed to update data feed: ${error.message}`);
        }
    }

    /**
     * Actualizar precio de un símbolo
     */
    async updatePrice(symbol, price, confidence, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.updatePrice(symbol, price, confidence);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error updating price:', error);
            throw new Error(`Failed to update price: ${error.message}`);
        }
    }

    /**
     * Crear una solicitud de datos
     */
    async createRequest(dataType, parameters, paymentAmount, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.createRequest(dataType, parameters, {
                value: paymentAmount
            });
            const receipt = await tx.wait();

            // Extraer requestId del evento
            const event = receipt.events?.find(e => e.event === 'RequestCreated');
            const requestId = event?.args?.requestId?.toString();

            return {
                success: true,
                requestId,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error creating request:', error);
            throw new Error(`Failed to create request: ${error.message}`);
        }
    }

    /**
     * Cumplir una solicitud (solo providers)
     */
    async fulfillRequest(requestId, response, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.fulfillRequest(requestId, response);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error fulfilling request:', error);
            throw new Error(`Failed to fulfill request: ${error.message}`);
        }
    }

    /**
     * Suscribirse a un feed de datos
     */
    async subscribeToFeed(feedId, paymentAmount, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.subscribeToFeed(feedId, {
                value: paymentAmount
            });
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error subscribing to feed:', error);
            throw new Error(`Failed to subscribe to feed: ${error.message}`);
        }
    }

    /**
     * Obtener precio de un símbolo
     */
    async getPrice(symbol) {
        try {
            const [price, timestamp, confidence, provider] = await this.contract.getPrice(symbol);

            return {
                symbol,
                price: price.toString(),
                priceFormatted: ethers.utils.formatUnits(price, 8), // Assuming 8 decimals
                timestamp: parseInt(timestamp.toString()),
                confidence: parseInt(confidence.toString()),
                provider
            };
        } catch (error) {
            console.error('Error getting price:', error);
            return null;
        }
    }

    /**
     * Obtener información de un data feed
     */
    async getDataFeed(feedId) {
        try {
            const [name, description, provider, lastUpdate, dataHash, isActive, updateInterval, price] =
                await this.contract.getDataFeed(feedId);

            return {
                feedId,
                name,
                description,
                provider,
                lastUpdate: parseInt(lastUpdate.toString()),
                dataHash,
                isActive,
                updateInterval: parseInt(updateInterval.toString()),
                price: price.toString(),
                priceFormatted: ethers.utils.formatEther(price)
            };
        } catch (error) {
            console.error('Error getting data feed:', error);
            return null;
        }
    }

    /**
     * Obtener información de una solicitud
     */
    async getRequest(requestId) {
        try {
            const [id, requester, dataType, parameters, timestamp, fulfilled, response, fulfiller, payment] =
                await this.contract.getRequest(requestId);

            return {
                requestId: id.toString(),
                requester,
                dataType,
                parameters,
                timestamp: parseInt(timestamp.toString()),
                fulfilled,
                response,
                fulfiller,
                payment: payment.toString(),
                paymentFormatted: ethers.utils.formatEther(payment)
            };
        } catch (error) {
            console.error('Error getting request:', error);
            return null;
        }
    }

    /**
     * Obtener información de un proveedor
     */
    async getProvider(providerAddress) {
        try {
            const [address, name, reputation, totalRequests, successfulRequests, isActive, minimumStake, stakedAmount] =
                await this.contract.getProvider(providerAddress);

            return {
                providerAddress: address,
                name,
                reputation: parseInt(reputation.toString()),
                totalRequests: parseInt(totalRequests.toString()),
                successfulRequests: parseInt(successfulRequests.toString()),
                successRate: totalRequests > 0 ? (successfulRequests * 100 / totalRequests).toFixed(2) : 0,
                isActive,
                minimumStake: minimumStake.toString(),
                minimumStakeFormatted: ethers.utils.formatEther(minimumStake),
                stakedAmount: stakedAmount.toString(),
                stakedAmountFormatted: ethers.utils.formatEther(stakedAmount)
            };
        } catch (error) {
            console.error('Error getting provider:', error);
            return null;
        }
    }

    /**
     * Obtener todos los feed IDs activos
     */
    async getActiveFeedIds() {
        try {
            const feedIds = await this.contract.getActiveFeedIds();
            return feedIds;
        } catch (error) {
            console.error('Error getting active feed IDs:', error);
            return [];
        }
    }

    /**
     * Obtener todos los símbolos disponibles
     */
    async getAvailableSymbols() {
        try {
            const symbols = await this.contract.getAvailableSymbols();
            return symbols;
        } catch (error) {
            console.error('Error getting available symbols:', error);
            return [];
        }
    }

    /**
     * Obtener contador de solicitudes
     */
    async getRequestCounter() {
        try {
            const counter = await this.contract.requestCounter();
            return parseInt(counter.toString());
        } catch (error) {
            console.error('Error getting request counter:', error);
            return 0;
        }
    }

    /**
     * Obtener tarifa por defecto para solicitudes
     */
    async getDefaultRequestFee() {
        try {
            const fee = await this.contract.defaultRequestFee();
            return {
                fee: fee.toString(),
                feeFormatted: ethers.utils.formatEther(fee)
            };
        } catch (error) {
            console.error('Error getting default request fee:', error);
            return { fee: '0', feeFormatted: '0' };
        }
    }

    /**
     * Obtener todos los feeds activos con detalles
     */
    async getAllActiveFeeds() {
        try {
            const feedIds = await this.getActiveFeedIds();
            const feeds = [];

            for (const feedId of feedIds) {
                const feed = await this.getDataFeed(feedId);
                if (feed && feed.isActive) {
                    feeds.push(feed);
                }
            }

            return feeds;
        } catch (error) {
            console.error('Error getting all active feeds:', error);
            return [];
        }
    }

    /**
     * Obtener todos los precios disponibles
     */
    async getAllPrices() {
        try {
            const symbols = await this.getAvailableSymbols();
            const prices = [];

            for (const symbol of symbols) {
                const price = await this.getPrice(symbol);
                if (price) {
                    prices.push(price);
                }
            }

            return prices;
        } catch (error) {
            console.error('Error getting all prices:', error);
            return [];
        }
    }

    /**
     * Event listeners
     */
    onEvent(eventName, callback) {
        const filter = this.contract.filters[eventName]?.();
        if (!filter) {
            console.error(`Event ${eventName} not found`);
            return;
        }

        this.contract.on(filter, callback);

        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    }

    offEvent(eventName, callback) {
        const filter = this.contract.filters[eventName]?.();
        if (!filter) return;

        this.contract.off(filter, callback);

        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName] = this.eventListeners[eventName].filter(cb => cb !== callback);
        }
    }

    removeAllListeners() {
        this.contract.removeAllListeners();
        this.eventListeners = {};
    }
}

export default DataOracleSDK;
