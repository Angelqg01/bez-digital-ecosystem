/**
 * @deprecated — LEGACY SERVICE. DO NOT USE FOR NEW CODE.
 * Replaced by: hubBlockchainService.js + _shared/bezhas-blockchain-client.js
 * Token ops → BeZhasClient.getBEZBalance() / transferBEZ()
 * Fiat purchase → bezhas-pay-manager SubApp
 * VIP/billing → hubBlockchainService.js → getVIPStatus()
 *
 * bezCoinService.js (LEGACY)
 * 
 * Servicio para gestionar todas las operaciones de Bez-Coin:
 * - Comunicación con smart contracts
 * - Integración con pasarelas de pago FIAT
 * - Gestión de transacciones
 * - Comunicación con backend para historial
 * 
 * Ubicación: frontend/src/services/bezCoinService.js
 */

import axios from 'axios';
import { ethers } from 'ethers';

class BezCoinService {
    constructor() {
        this.api = axios.create({
            baseURL: '/api', // Usar ruta relativa - el proxy de Vite redirige al backend
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000 // 5 segundos de timeout
        });

        // Interceptor para añadir token JWT si existe
        this.api.interceptors.request.use((config) => {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });
    }

    /**
     * Obtener balance de BEZ desde el contrato
     * @param {string} address - Dirección del wallet
     * @param {object} tokenContract - Instancia del contrato BezhasToken
     * @returns {string} - Balance formateado
     */
    async getBalance(address, tokenContract) {
        try {
            const balanceWei = await tokenContract.balanceOf(address);
            return ethers.formatEther(balanceWei);
        } catch (error) {
            console.error('Error getting balance:', error);
            throw error;
        }
    }

    /**
     * Obtener precio del token desde TokenSale
     * @param {object} saleContract - Instancia del contrato TokenSale
     * @returns {string} - Precio formateado
     */
    async getTokenPrice(saleContract) {
        try {
            const priceWei = await saleContract.price();
            return ethers.formatEther(priceWei);
        } catch (error) {
            console.error('Error getting token price:', error);
            throw error;
        }
    }

    /**
     * Comprar tokens con FIAT
     * Integración con Stripe/Wert/MoonPay
     * @param {object} purchaseData - Datos de la compra
     * @returns {object} - Resultado de la transacción
     */
    async purchaseWithFiat(purchaseData) {
        try {
            // Opción 1: Integración con Stripe
            if (purchaseData.paymentMethod.type === 'stripe') {
                return await this.purchaseWithStripe(purchaseData);
            }

            // Opción 2: Integración con Wert (recomendado para crypto)
            if (purchaseData.paymentMethod.type === 'wert') {
                return await this.purchaseWithWert(purchaseData);
            }

            // Opción 3: Integración con MoonPay
            if (purchaseData.paymentMethod.type === 'moonpay') {
                return await this.purchaseWithMoonPay(purchaseData);
            }

            // Opción 4: Mock Provider (Development)
            if (purchaseData.paymentMethod.type === 'mock') {
                return await this.purchaseWithMock(purchaseData);
            }

            throw new Error('Unsupported payment method');
        } catch (error) {
            console.error('Error purchasing with FIAT:', error);
            throw error;
        }
    }

    /**
     * Comprar tokens con Stripe
     * @param {object} purchaseData - Datos de la compra
     */
    async purchaseWithStripe(purchaseData) {
        try {
            const response = await this.api.post('/payment/stripe/create-payment-intent', {
                amount: purchaseData.amount,
                currency: purchaseData.currency,
                walletAddress: purchaseData.walletAddress,
                metadata: {
                    type: 'bez_token_purchase',
                    tokenAmount: this.calculateTokenAmount(purchaseData.amount, purchaseData.tokenPrice)
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error with Stripe purchase:', error);
            throw error;
        }
    }

    /**
     * Comprar tokens con Wert
     * Wert es especializado en on-ramp crypto
     * @param {object} purchaseData - Datos de la compra
     */
    async purchaseWithWert(purchaseData) {
        try {
            // Wert requiere configuración de widget
            const wertConfig = {
                partner_id: import.meta.env.VITE_WERT_PARTNER_ID,
                origin: window.location.origin,
                commodity: 'BEZ',
                commodity_amount: this.calculateTokenAmount(purchaseData.amount, purchaseData.tokenPrice),
                sc_address: purchaseData.contractAddress,
                sc_input_data: this.generateWertInputData(purchaseData.walletAddress),
                address: purchaseData.walletAddress,
            };

            // Abrir widget de Wert
            const wertWidget = new window.WertWidget(wertConfig);
            wertWidget.open();

            return new Promise((resolve, reject) => {
                wertWidget.on('payment-status', (data) => {
                    if (data.status === 'success') {
                        resolve({
                            success: true,
                            transactionId: data.tx_id,
                            tokenAmount: wertConfig.commodity_amount
                        });
                    } else if (data.status === 'failed') {
                        reject(new Error('Payment failed'));
                    }
                });
            });
        } catch (error) {
            console.error('Error with Wert purchase:', error);
            throw error;
        }
    }

    /**
     * Comprar tokens con MoonPay
     * @param {object} purchaseData - Datos de la compra
     */
    async purchaseWithMoonPay(purchaseData) {
        try {
            const response = await this.api.post('/payment/moonpay/create-transaction', {
                baseCurrencyAmount: purchaseData.amount,
                baseCurrencyCode: purchaseData.currency,
                walletAddress: purchaseData.walletAddress,
                cryptoCurrencyCode: 'BEZ'
            });

            // MoonPay redirige a su interfaz
            window.location.href = response.data.url;

            return response.data;
        } catch (error) {
            console.error('Error with MoonPay purchase:', error);
            throw error;
        }
    }

    /**
     * Simular compra de tokens (Development)
     * @param {object} purchaseData - Datos de la compra
     */
    async purchaseWithMock(purchaseData) {
        console.log('🛒 Mock Purchase Initiated:', purchaseData);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

        return {
            success: true,
            transactionId: 'mock_tx_' + Date.now(),
            tokenAmount: purchaseData.amount, // Assuming 1:1 for simplicity in mock, or use logic
            status: 'completed'
        };
    }

    /**
     * Swap tokens desde un DEX (Uniswap/PancakeSwap)
     * @param {string} fromToken - Token origen (ej: 'USDC', 'ETH')
     * @param {string} toToken - Token destino ('BEZ')
     * @param {string} amount - Cantidad a intercambiar
     * @param {string} walletAddress - Dirección del usuario
     */
    async swapTokens(fromToken, toToken, amount, walletAddress) {
        try {
            // Integración con router de Uniswap V3 o similar
            const response = await this.api.post('/swap/quote', {
                fromToken,
                toToken,
                amount,
                walletAddress
            });

            return response.data;
        } catch (error) {
            console.error('Error swapping tokens:', error);
            throw error;
        }
    }

    /**
     * Guardar transacción en backend
     * @param {string} walletAddress - Dirección del usuario
     * @param {object} transaction - Datos de la transacción
     */
    async saveTransaction(walletAddress, transaction) {
        try {
            const response = await this.api.post('/bezcoin/transactions', {
                walletAddress,
                ...transaction
            });
            return response.data;
        } catch (error) {
            console.error('Error saving transaction:', error);
            // No lanzar error, solo logear (la transacción on-chain ya se completó)
        }
    }

    /**
     * Obtener historial de transacciones
     * @param {string} walletAddress - Dirección del usuario
     * @returns {array} - Array de transacciones
     */
    async getTransactionHistory(walletAddress) {
        try {
            const response = await this.api.get(`/bezcoin/transactions/${walletAddress}`);
            return response.data.transactions || [];
        } catch (error) {
            // Silently handle backend errors - return empty array
            return [];
        }
    }

    /**
     * Obtener estadísticas del usuario
     * @param {string} walletAddress - Dirección del usuario
     */
    async getUserStats(walletAddress) {
        try {
            const response = await this.api.get(`/bezcoin/stats/${walletAddress}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching user stats:', error);
            return {
                totalPurchased: '0',
                totalDonated: '0',
                totalTransferred: '0',
                rewardsEarned: '0'
            };
        }
    }

    /**
     * Verificar elegibilidad para recompensas
     * @param {string} walletAddress - Dirección del usuario
     * @param {string} action - Tipo de acción (ej: 'post', 'comment', 'dao_vote')
     */
    async checkRewardEligibility(walletAddress, action) {
        try {
            const response = await this.api.post('/bezcoin/rewards/check', {
                walletAddress,
                action
            });
            return response.data;
        } catch (error) {
            console.error('Error checking reward eligibility:', error);
            return { eligible: false, reason: 'Error checking eligibility' };
        }
    }

    /**
     * Reclamar recompensas acumuladas
     * @param {string} walletAddress - Dirección del usuario
     */
    async claimRewards(walletAddress) {
        try {
            const response = await this.api.post('/bezcoin/rewards/claim', {
                walletAddress
            });
            return response.data;
        } catch (error) {
            console.error('Error claiming rewards:', error);
            throw error;
        }
    }

    /**
     * Calcular cantidad de tokens por cantidad FIAT
     * @param {string} fiatAmount - Cantidad en FIAT
     * @param {string} tokenPrice - Precio del token
     * @returns {string} - Cantidad de tokens
     */
    calculateTokenAmount(fiatAmount, tokenPrice) {
        if (!fiatAmount || !tokenPrice || parseFloat(tokenPrice) === 0) {
            return '0';
        }
        const tokens = parseFloat(fiatAmount) / parseFloat(tokenPrice);
        return tokens.toFixed(2);
    }

    /**
     * Generar input data para Wert
     * @param {string} recipientAddress - Dirección del destinatario
     */
    generateWertInputData(recipientAddress) {
        // Encode la función transfer del contrato ERC20
        const iface = new ethers.Interface([
            'function transfer(address to, uint256 amount)'
        ]);
        return iface.encodeFunctionData('transfer', [recipientAddress, 0]);
    }

    /**
     * Obtener precio del token en USD
     * Para mostrar equivalencias
     */
    async getTokenPriceUSD() {
        try {
            const response = await this.api.get('/bezcoin/price/usd');
            return response.data.price || '0.10'; // Precio fallback
        } catch (error) {
            console.error('Error fetching USD price:', error);
            return '0.10';
        }
    }

    /**
     * Estimar gas para transacción
     * @param {object} transaction - Datos de la transacción
     */
    async estimateGas(transaction) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const gasEstimate = await provider.estimateGas(transaction);
            const gasPrice = await provider.getFeeData();

            return {
                gasLimit: gasEstimate.toString(),
                gasPrice: gasPrice.gasPrice.toString(),
                maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString()
            };
        } catch (error) {
            console.error('Error estimating gas:', error);
            throw error;
        }
    }

    // ==================== VIP & SUBSCRIPTION METHODS ====================

    /**
     * Crear pago crypto para suscripción VIP
     * @param {string} tier - Tier VIP (creator, business, enterprise)
     * @param {number} bezAmount - Cantidad de BEZ
     * @param {string} walletAddress - Dirección del wallet
     */
    async createVIPCryptoPayment(tier, bezAmount, walletAddress) {
        try {
            const response = await this.api.post('/payment/crypto/vip-subscription', {
                tier,
                bezAmount,
                walletAddress
            });
            return response.data;
        } catch (error) {
            console.error('Error creating VIP crypto payment:', error);
            throw error;
        }
    }

    /**
     * Confirmar pago crypto después de la transacción on-chain
     * @param {string} paymentId - ID del pago
     * @param {string} txHash - Hash de la transacción
     * @param {number} blockNumber - Número de bloque
     */
    async confirmCryptoPayment(paymentId, txHash, blockNumber) {
        try {
            const response = await this.api.post('/payment/crypto/confirm', {
                paymentId,
                txHash,
                blockNumber
            });
            return response.data;
        } catch (error) {
            console.error('Error confirming crypto payment:', error);
            throw error;
        }
    }

    /**
     * Obtener estado VIP del usuario
     * @param {string} walletAddress - Dirección del wallet
     */
    async getVIPStatus(walletAddress) {
        try {
            const response = await this.api.get('/vip/status');
            return response.data;
        } catch (error) {
            console.error('Error getting VIP status:', error);
            return { isVIP: false, tier: 'STARTER' };
        }
    }

    /**
     * Obtener historial de pagos del wallet
     * @param {string} walletAddress - Dirección del wallet
     */
    async getPaymentHistory(walletAddress) {
        try {
            const response = await this.api.get(`/payment/history/${walletAddress}`);
            return response.data;
        } catch (error) {
            console.error('Error getting payment history:', error);
            return { payments: [], pagination: { total: 0 } };
        }
    }

    /**
     * Obtener información del tier VIP
     */
    async getVIPTiers() {
        try {
            const response = await this.api.get('/vip/tiers');
            return response.data;
        } catch (error) {
            console.error('Error getting VIP tiers:', error);
            return {
                success: true,
                tiers: {
                    STARTER: { price: 0, features: [] },
                    CREATOR: { price: 19.99, bezPrice: 400 },
                    BUSINESS: { price: 99.99, bezPrice: 2000 },
                    ENTERPRISE: { price: 299.99, bezPrice: 6000 }
                }
            };
        }
    }

    /**
     * Crear orden de transferencia bancaria para tokens
     * @param {number} bezAmount - Cantidad de tokens
     * @param {string} walletAddress - Dirección del wallet
     * @param {string} email - Email del usuario
     */
    async createBankTransferOrder(bezAmount, walletAddress, email) {
        try {
            const response = await this.api.post('/payment/bank-transfer/create-order', {
                amountBez: bezAmount,
                userWallet: walletAddress,
                userEmail: email
            });
            return response.data;
        } catch (error) {
            console.error('Error creating bank transfer order:', error);
            throw error;
        }
    }
}

// Exportar instancia singleton
const bezCoinService = new BezCoinService();
export default bezCoinService;
