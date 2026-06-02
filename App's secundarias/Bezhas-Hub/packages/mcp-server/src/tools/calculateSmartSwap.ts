/**
 * SKILL 2: calculate_smart_swap
 * 
 * Calculates the optimal route for BEZ <-> FIAT conversions considering:
 * - Stripe fees (2.9% + $0.30)
 * - Polygon gas costs
 * - Platform fee (1%) with fee burning
 * - Slippage protection
 * 
 * Prioritizes platform benefit (fee burning) in all calculations.
 * 
 * @contract BEZ: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ethers } from 'ethers';
import { config } from '../config.js';

export interface SwapResult {
    direction: 'BEZ_TO_FIAT' | 'FIAT_TO_BEZ';
    inputAmount: number;
    inputCurrency: string;
    outputAmount: number;
    outputCurrency: string;
    bezPriceUSD: number;
    fees: {
        stripeFeeUSD: number;
        gasCostUSD: number;
        platformFeeUSD: number;
        feeBurnedUSD: number;
        totalFeesUSD: number;
    };
    effectiveRate: number;
    recommendation: 'PROCEED' | 'WAIT_BETTER_RATE' | 'AMOUNT_TOO_LOW';
    reasoning: string;
}

export function registerSmartSwap(server: McpServer): void {
    server.tool(
        'calculate_smart_swap',
        'Calcula la mejor ruta BEZ <-> FIAT tomando en cuenta fees de Stripe, Gas de Polygon, y fee burning de la plataforma.',
        {
            direction: z.enum(['BEZ_TO_FIAT', 'FIAT_TO_BEZ']),
            amount: z.number().positive(),
            fiatCurrency: z.enum(['USD', 'EUR', 'GBP', 'MXN']).optional(),
        },
        async ({ direction, amount, fiatCurrency = 'USD' }) => {
            try {
                // Get current gas for cost estimation
                const provider = new ethers.JsonRpcProvider(config.network.activeRpc);
                const feeData = await provider.getFeeData();
                const gasPrice = feeData.gasPrice ?? BigInt(0);
                const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, 'gwei'));

                // Gas cost for an ERC20 transfer (~55k gas)
                const maticPriceUSD = 0.40;
                const gasCostMatic = parseFloat(ethers.formatUnits(gasPrice * BigInt(55_000), 'ether'));
                const gasCostUSD = gasCostMatic * maticPriceUSD;

                // BEZ price (would come from oracle in production)
                const bezPriceUSD = config.token.priceUSD;

                // Fiat conversion rates (simplified, production would use live rates)
                const fiatRates: Record<string, number> = {
                    USD: 1.0,
                    EUR: 0.92,
                    GBP: 0.79,
                    MXN: 17.15,
                };
                const fiatRate = fiatRates[fiatCurrency] ?? 1.0;

                let inputAmount: number;
                let inputCurrency: string;
                let outputAmount: number;
                let outputCurrency: string;
                let grossValueUSD: number;

                if (direction === 'BEZ_TO_FIAT') {
                    // User selling BEZ for FIAT
                    inputAmount = amount;
                    inputCurrency = 'BEZ';
                    grossValueUSD = amount * bezPriceUSD;
                    outputCurrency = fiatCurrency;
                } else {
                    // User buying BEZ with FIAT
                    inputAmount = amount;
                    inputCurrency = fiatCurrency;
                    grossValueUSD = amount / fiatRate; // Convert to USD first
                    outputCurrency = 'BEZ';
                }

                // ─── Fee Calculation ─────────────────────────────────
                // Stripe: 2.9% + $0.30 fixed
                const stripeFeeUSD = (grossValueUSD * config.stripe.feePercent / 100) + (config.stripe.feeFixedCents / 100);

                // Platform fee: 1%
                const platformFeeUSD = grossValueUSD * (config.fees.platformPercent / 100);

                // Fee burn: 50% of platform fee is burned
                const feeBurnedUSD = platformFeeUSD * (config.fees.feeBurnPercent / 100);

                // Total fees
                const totalFeesUSD = stripeFeeUSD + gasCostUSD + platformFeeUSD;
                const netValueUSD = grossValueUSD - totalFeesUSD;

                // Calculate output
                if (direction === 'BEZ_TO_FIAT') {
                    outputAmount = parseFloat((netValueUSD * fiatRate).toFixed(2));
                } else {
                    outputAmount = parseFloat((netValueUSD / bezPriceUSD).toFixed(4));
                }

                // Effective rate
                const effectiveRate = direction === 'BEZ_TO_FIAT'
                    ? outputAmount / inputAmount
                    : inputAmount / outputAmount;

                // ─── Recommendation ──────────────────────────────────
                let recommendation: SwapResult['recommendation'] = 'PROCEED';
                let reasoning = '';

                // Minimum viable swap (fees eat too much)
                if (totalFeesUSD > grossValueUSD * 0.15) {
                    recommendation = 'AMOUNT_TOO_LOW';
                    reasoning = `Total fees ($${totalFeesUSD.toFixed(2)}) exceed 15% of value ($${grossValueUSD.toFixed(2)}). Recommend larger amount.`;
                } else if (gasPriceGwei > config.gas.highThresholdGwei) {
                    recommendation = 'WAIT_BETTER_RATE';
                    reasoning = `Gas is elevated (${gasPriceGwei.toFixed(0)} Gwei). Waiting could save $${(gasCostUSD * 0.5).toFixed(4)} in fees.`;
                } else {
                    reasoning = `Swap is efficient. Platform earns $${platformFeeUSD.toFixed(4)} (burns $${feeBurnedUSD.toFixed(4)}). Gas is optimal.`;
                }

                const result: SwapResult = {
                    direction,
                    inputAmount,
                    inputCurrency,
                    outputAmount: Math.max(0, outputAmount),
                    outputCurrency,
                    bezPriceUSD,
                    fees: {
                        stripeFeeUSD: parseFloat(stripeFeeUSD.toFixed(4)),
                        gasCostUSD: parseFloat(gasCostUSD.toFixed(6)),
                        platformFeeUSD: parseFloat(platformFeeUSD.toFixed(4)),
                        feeBurnedUSD: parseFloat(feeBurnedUSD.toFixed(4)),
                        totalFeesUSD: parseFloat(totalFeesUSD.toFixed(4)),
                    },
                    effectiveRate: parseFloat(effectiveRate.toFixed(6)),
                    recommendation,
                    reasoning,
                };

                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            recommendation: 'WAIT_BETTER_RATE',
                            error: `Calculation error: ${error.message}`,
                            reasoning: 'Could not complete swap calculation. Try again.',
                        }, null, 2),
                    }],
                    isError: true,
                };
            }
        }
    );
}
