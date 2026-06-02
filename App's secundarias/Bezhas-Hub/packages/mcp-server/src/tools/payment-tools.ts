/**
 * ============================================================================
 * MCP SERVER - PAYMENT TOOLS
 * ============================================================================
 * 
 * Herramientas para el servidor MCP que permiten a las IAs interactuar
 * con el sistema de pagos de BeZhas
 */

import { z } from 'zod';
import axios from 'axios';
import { ethers } from 'ethers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
// BEZ price — kept in sync with bezpay.service.js fallback ($1.24)
// Override via BEZ_PRICE_USD env var if needed
const BEZ_COIN_PRICE_USD = parseFloat(process.env.BEZ_PRICE_USD || '1.24');

/**
 * Tool: get_payment_quote
 * Calcula la cotización para comprar BEZ-Coins
 */
export const getPaymentQuoteTool = {
    name: 'get_payment_quote',
    description: 'Calcula la tasa de cambio entre Fiat/Crypto y BEZ-Coin. Retorna cuántos BEZ-Coins se obtienen por una cantidad dada.',
    inputSchema: z.object({
        amount: z.number().positive().describe('Cantidad a convertir'),
        fromCurrency: z.enum(['USD', 'EUR', 'ETH', 'USDT', 'BTC', 'MATIC']).describe('Moneda de origen'),
        toCurrency: z.literal('BEZ').describe('Moneda de destino (siempre BEZ)')
    }),
    handler: async (args: { amount: number; fromCurrency: string; toCurrency: string }) => {
        try {
            const { amount, fromCurrency } = args;

            // Conversión simple (en producción, usar API de precios real)
            const conversionRates: Record<string, number> = {
                'USD': 1,
                'EUR': 1.08,
                'ETH': 2400,
                'USDT': 1,
                'BTC': 45000,
                'MATIC': 0.80
            };

            const amountInUSD = amount * conversionRates[fromCurrency];
            const bezCoins = amountInUSD / BEZ_COIN_PRICE_USD;

            return {
                success: true,
                quote: {
                    fromAmount: amount,
                    fromCurrency,
                    toAmount: bezCoins,
                    toCurrency: 'BEZ',
                    exchangeRate: conversionRates[fromCurrency] / BEZ_COIN_PRICE_USD,
                    pricePerBEZ: BEZ_COIN_PRICE_USD,
                    estimatedGasFee: fromCurrency === 'ETH' || fromCurrency === 'MATIC' ? 0.001 : 0
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }
};

/**
 * Tool: process_stripe_payment
 * Crea una sesión de pago de Stripe para comprar BEZ-Coins
 */
export const processStripePaymentTool = {
    name: 'process_stripe_payment',
    description: 'Genera un Checkout Session de Stripe para comprar BEZ-Coin con tarjeta de crédito',
    inputSchema: z.object({
        userId: z.string().describe('ID del usuario'),
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe('Dirección de wallet del usuario'),
        amountFiat: z.number().positive().describe('Cantidad en USD a pagar'),
        email: z.string().email().optional().describe('Email del usuario (opcional)')
    }),
    handler: async (args: { userId: string; walletAddress: string; amountFiat: number; email?: string }) => {
        try {
            const { userId, walletAddress, amountFiat, email } = args;

            // Calcular cantidad de BEZ tokens
            const tokenAmount = amountFiat / BEZ_COIN_PRICE_USD;

            // Llamar al backend para crear sesión de Stripe
            const response = await axios.post(
                `${BACKEND_URL}/api/stripe/create-token-purchase-session`,
                {
                    tokenAmount,
                    email: email || `${userId}@bez.digital`
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        // En producción, incluir token JWT del usuario
                    }
                }
            );

            if (response.data.success) {
                return {
                    success: true,
                    checkoutUrl: response.data.url,
                    sessionId: response.data.sessionId,
                    tokenAmount,
                    amountFiat,
                    walletAddress
                };
            } else {
                throw new Error(response.data.error || 'Failed to create checkout session');
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }
};

/**
 * Tool: check_payment_status
 * Verifica el estado de un pago de Stripe
 */
export const checkPaymentStatusTool = {
    name: 'check_payment_status',
    description: 'Verifica el estado de un pago de Stripe usando el Session ID',
    inputSchema: z.object({
        sessionId: z.string().describe('ID de la sesión de Stripe')
    }),
    handler: async (args: { sessionId: string }) => {
        try {
            const { sessionId } = args;

            const response = await axios.get(
                `${BACKEND_URL}/api/stripe/session/${sessionId}`,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.success) {
                return {
                    success: true,
                    status: response.data.session.status,
                    amount: response.data.session.amountTotal,
                    currency: response.data.session.currency,
                    metadata: response.data.session.metadata
                };
            } else {
                throw new Error(response.data.error || 'Failed to get session status');
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }
};

/**
 * Tool: get_wallet_balance
 * Consulta el balance de BEZ-Coins de una wallet
 */
export const getWalletBalanceTool = {
    name: 'get_wallet_balance',
    description: 'Consulta el balance de BEZ-Coins de una dirección de wallet en la blockchain',
    inputSchema: z.object({
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe('Dirección de wallet')
    }),
    handler: async (args: { walletAddress: string }) => {
        try {
            const { walletAddress } = args;

            // Conectar a Polygon Mainnet
            const provider = new ethers.JsonRpcProvider(
                process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com'
            );

            // Dirección del contrato BEZ-Coin
            const BEZ_CONTRACT_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

            // ABI mínimo para balanceOf
            const minimalABI = [
                'function balanceOf(address owner) view returns (uint256)',
                'function decimals() view returns (uint8)'
            ];

            const contract = new ethers.Contract(BEZ_CONTRACT_ADDRESS, minimalABI, provider);

            const [balance, decimals] = await Promise.all([
                contract.balanceOf(walletAddress),
                contract.decimals()
            ]);

            const formattedBalance = ethers.formatUnits(balance, decimals);

            return {
                success: true,
                walletAddress,
                balance: formattedBalance,
                balanceRaw: balance.toString(),
                decimals: Number(decimals),
                contractAddress: BEZ_CONTRACT_ADDRESS,
                network: 'Polygon Mainnet'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }
};

/**
 * Tool: initiate_crypto_payment
 * Inicia un pago con criptomonedas (USDT, USDC, MATIC)
 */
export const initiateCryptoPaymentTool = {
    name: 'initiate_crypto_payment',
    description: 'Inicia un pago con criptomonedas (USDT, USDC, MATIC) para comprar BEZ-Coins',
    inputSchema: z.object({
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe('Dirección de wallet del usuario'),
        amount: z.number().positive().describe('Cantidad de crypto a pagar'),
        currency: z.enum(['USDT', 'USDC', 'MATIC']).describe('Criptomoneda a usar')
    }),
    handler: async (args: { walletAddress: string; amount: number; currency: string }) => {
        try {
            const { walletAddress, amount, currency } = args;

            // Calcular cantidad de BEZ tokens (asumiendo 1:1 para stablecoins)
            const tokenAmount = amount / BEZ_COIN_PRICE_USD;

            // En producción, esto llamaría a un smart contract o API de crypto payments
            return {
                success: true,
                paymentType: 'crypto',
                currency,
                amount,
                tokenAmount,
                walletAddress,
                instructions: {
                    step1: `Aprobar ${amount} ${currency} para el contrato de BeZhas`,
                    step2: `Ejecutar transacción de compra`,
                    step3: `Esperar confirmación en blockchain`,
                    estimatedGas: '0.001 MATIC'
                },
                // En producción, retornar dirección del contrato y datos de transacción
                contractAddress: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
                network: 'Polygon Mainnet'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }
};

// Exportar todas las herramientas
export const paymentTools = [
    getPaymentQuoteTool,
    processStripePaymentTool,
    checkPaymentStatusTool,
    getWalletBalanceTool,
    initiateCryptoPaymentTool
];

/**
 * Registra todas las herramientas de pago en el servidor MCP
 */
export function registerPaymentTools(server: any): void {
    paymentTools.forEach(tool => {
        server.tool(
            tool.name,
            tool.description,
            tool.inputSchema.shape,
            async (args: any) => {
                const result = await tool.handler(args);
                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
                };
            }
        );
    });
}
