/**
 * ============================================================================
 * CRYPTO PAYMENT SERVICE
 * ============================================================================
 * 
 * Servicio para procesar pagos con criptomonedas (USDT, USDC, MATIC)
 * y transferencias bancarias tokenizadas
 */

const { ethers } = require('ethers');
const logger = require('../utils/logger');

// Configuración de contratos
const BEZ_CONTRACT_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const USDT_POLYGON_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const USDC_POLYGON_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

// ABI mínimo para ERC20
const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)'
];

// ABI mínimo para BEZ Token
const BEZ_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)'
];

class CryptoPaymentService {
    constructor() {
        // Conectar a Polygon Mainnet
        this.provider = new ethers.JsonRpcProvider(
            process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com'
        );

        // Hot wallet para procesar pagos
        const hotWalletKey = process.env.HOT_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
        if (!hotWalletKey) {
            logger.warn('⚠️ HOT_WALLET_PRIVATE_KEY not configured. Crypto payments will not work.');
        }
        this.wallet = hotWalletKey ? new ethers.Wallet(hotWalletKey, this.provider) : null;

        // Contratos
        this.bezContract = new ethers.Contract(BEZ_CONTRACT_ADDRESS, BEZ_ABI, this.wallet || this.provider);
        this.usdtContract = new ethers.Contract(USDT_POLYGON_ADDRESS, ERC20_ABI, this.wallet || this.provider);
        this.usdcContract = new ethers.Contract(USDC_POLYGON_ADDRESS, ERC20_ABI, this.wallet || this.provider);

        // Precio de BEZ en USD
        this.BEZ_PRICE_USD = 0.10;
    }

    /**
     * Obtiene cotización para compra de BEZ con crypto
     */
    async getQuote(amount, currency) {
        try {
            let amountInUSD;

            switch (currency) {
                case 'USDT':
                case 'USDC':
                    amountInUSD = amount; // 1:1 con USD
                    break;
                case 'MATIC':
                    // En producción, usar oracle de precios (Chainlink, CoinGecko, etc.)
                    const maticPriceUSD = 0.80; // Placeholder
                    amountInUSD = amount * maticPriceUSD;
                    break;
                default:
                    throw new Error(`Unsupported currency: ${currency}`);
            }

            const bezAmount = amountInUSD / this.BEZ_PRICE_USD;

            return {
                success: true,
                quote: {
                    fromAmount: amount,
                    fromCurrency: currency,
                    toAmount: bezAmount,
                    toCurrency: 'BEZ',
                    exchangeRate: amountInUSD / this.BEZ_PRICE_USD,
                    pricePerBEZ: this.BEZ_PRICE_USD,
                    estimatedGasFee: 0.001 // MATIC
                }
            };
        } catch (error) {
            logger.error('Error getting crypto quote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Procesa pago con USDT/USDC
     */
    async processStablecoinPayment(userWalletAddress, amount, currency) {
        try {
            if (!this.wallet) {
                throw new Error('Hot wallet not configured');
            }

            logger.info(`Processing ${currency} payment: ${amount} from ${userWalletAddress}`);

            // Seleccionar contrato según moneda
            const stablecoinContract = currency === 'USDT' ? this.usdtContract : this.usdcContract;

            // 1. Verificar que el usuario tiene suficiente balance
            const userBalance = await stablecoinContract.balanceOf(userWalletAddress);
            const decimals = await stablecoinContract.decimals();
            const requiredAmount = ethers.parseUnits(amount.toString(), decimals);

            if (userBalance < requiredAmount) {
                throw new Error(`Insufficient ${currency} balance`);
            }

            // 2. Verificar allowance (el usuario debe haber aprobado previamente)
            const allowance = await stablecoinContract.allowance(userWalletAddress, this.wallet.address);
            if (allowance < requiredAmount) {
                return {
                    success: false,
                    requiresApproval: true,
                    message: `Please approve ${amount} ${currency} for the BeZhas contract`,
                    approvalData: {
                        contractAddress: currency === 'USDT' ? USDT_POLYGON_ADDRESS : USDC_POLYGON_ADDRESS,
                        spender: this.wallet.address,
                        amount: requiredAmount.toString()
                    }
                };
            }

            // 3. Calcular cantidad de BEZ a enviar
            const bezAmount = amount / this.BEZ_PRICE_USD;
            const bezDecimals = await this.bezContract.decimals();
            const bezToSend = ethers.parseUnits(bezAmount.toString(), bezDecimals);

            // 4. Verificar que tenemos suficiente BEZ en el hot wallet
            const hotWalletBezBalance = await this.bezContract.balanceOf(this.wallet.address);
            if (hotWalletBezBalance < bezToSend) {
                logger.error('Hot wallet has insufficient BEZ balance');
                throw new Error('Insufficient BEZ in treasury. Please contact support.');
            }

            // 5. Transferir BEZ al usuario
            const tx = await this.bezContract.transfer(userWalletAddress, bezToSend);
            const receipt = await tx.wait();

            logger.info(`BEZ transfer successful: ${receipt.hash}`);

            return {
                success: true,
                transactionHash: receipt.hash,
                bezAmount,
                stablecoinAmount: amount,
                currency,
                userWallet: userWalletAddress,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            logger.error('Error processing stablecoin payment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Procesa pago con MATIC
     */
    async processMaticPayment(userWalletAddress, amountMatic) {
        try {
            if (!this.wallet) {
                throw new Error('Hot wallet not configured');
            }

            logger.info(`Processing MATIC payment: ${amountMatic} from ${userWalletAddress}`);

            // 1. Calcular valor en USD (usar oracle en producción)
            const maticPriceUSD = 0.80; // Placeholder
            const amountUSD = amountMatic * maticPriceUSD;

            // 2. Calcular cantidad de BEZ
            const bezAmount = amountUSD / this.BEZ_PRICE_USD;
            const bezDecimals = await this.bezContract.decimals();
            const bezToSend = ethers.parseUnits(bezAmount.toString(), bezDecimals);

            // 3. Verificar balance de BEZ en hot wallet
            const hotWalletBezBalance = await this.bezContract.balanceOf(this.wallet.address);
            if (hotWalletBezBalance < bezToSend) {
                throw new Error('Insufficient BEZ in treasury');
            }

            // 4. Esperar recepción de MATIC (esto requiere un listener de eventos)
            // Por ahora, asumimos que el MATIC ya fue recibido

            // 5. Transferir BEZ
            const tx = await this.bezContract.transfer(userWalletAddress, bezToSend);
            const receipt = await tx.wait();

            logger.info(`BEZ transfer successful (MATIC payment): ${receipt.hash}`);

            return {
                success: true,
                transactionHash: receipt.hash,
                bezAmount,
                maticAmount: amountMatic,
                userWallet: userWalletAddress,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            logger.error('Error processing MATIC payment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verifica el estado de una transacción
     */
    async checkTransactionStatus(txHash) {
        try {
            const receipt = await this.provider.getTransactionReceipt(txHash);

            if (!receipt) {
                return {
                    status: 'pending',
                    message: 'Transaction not yet mined'
                };
            }

            return {
                status: receipt.status === 1 ? 'success' : 'failed',
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                transactionHash: receipt.hash
            };
        } catch (error) {
            logger.error('Error checking transaction status:', error);
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Obtiene balance de BEZ de una wallet
     */
    async getBezBalance(walletAddress) {
        try {
            const balance = await this.bezContract.balanceOf(walletAddress);
            const decimals = await this.bezContract.decimals();
            const formattedBalance = ethers.formatUnits(balance, decimals);

            return {
                success: true,
                balance: formattedBalance,
                balanceRaw: balance.toString(),
                decimals: Number(decimals),
                walletAddress
            };
        } catch (error) {
            logger.error('Error getting BEZ balance:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtiene balance de stablecoin
     */
    async getStablecoinBalance(walletAddress, currency) {
        try {
            const contract = currency === 'USDT' ? this.usdtContract : this.usdcContract;
            const balance = await contract.balanceOf(walletAddress);
            const decimals = await contract.decimals();
            const formattedBalance = ethers.formatUnits(balance, decimals);

            return {
                success: true,
                balance: formattedBalance,
                balanceRaw: balance.toString(),
                decimals: Number(decimals),
                currency,
                walletAddress
            };
        } catch (error) {
            logger.error(`Error getting ${currency} balance:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new CryptoPaymentService();
