/**
 * SKILL 1: analyze_gas_strategy
 * 
 * Queries Polygon network and decides:
 * - Execute now or delay (based on gas price vs transaction value)
 * - Who pays gas: User or Relayer (ToolBEZ IoT = always Relayer)
 * - Profitability analysis for BeZhas platform (fee burning priority)
 * 
 * @contract BEZ: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ethers } from 'ethers';
import { config } from '../config.js';

// Gas estimation per transaction type (in gas units)
const GAS_ESTIMATES: Record<string, number> = {
    iot_ingest: 65_000,
    marketplace_buy: 150_000,
    token_transfer: 55_000,
    nft_mint: 200_000,
    staking_deposit: 120_000,
};

export interface GasStrategyResult {
    action: 'EXECUTE' | 'DELAY' | 'BATCH';
    payer: 'USER_PAYS' | 'RELAYER_PAYS';
    currentGasGwei: string;
    maxPriorityFeeGwei: string;
    networkCostUSD: number;
    projectedPlatformProfit: number;
    isProfitable: boolean;
    estimatedGasUnits: number;
    feeBurnAmount: number;
    reasoning: string;
}

export function registerGasStrategy(server: McpServer): void {
    server.tool(
        'analyze_gas_strategy',
        'Analiza si es rentable ejecutar una transacción ahora o esperar, quién paga el gas, y calcula el profit para BeZhas con fee burning.',
        {
            transactionType: z.enum([
                'iot_ingest',
                'marketplace_buy',
                'token_transfer',
                'nft_mint',
                'staking_deposit',
            ]),
            estimatedValueUSD: z.number().positive(),
            urgency: z.enum(['low', 'medium', 'high']).optional(),
        },
        async ({ transactionType, estimatedValueUSD, urgency = 'medium' }) => {
            try {
                const provider = new ethers.JsonRpcProvider(config.network.activeRpc);
                const feeData = await provider.getFeeData();

                const gasPrice = feeData.gasPrice ?? BigInt(0);
                const maxPriorityFee = feeData.maxPriorityFeePerGas ?? BigInt(0);
                const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, 'gwei'));
                const maxPriorityGwei = parseFloat(ethers.formatUnits(maxPriorityFee, 'gwei'));

                // Estimate gas units for this tx type
                const estimatedGas = GAS_ESTIMATES[transactionType] ?? 100_000;

                // Calculate network cost in USD (MATIC price ~$0.40 estimated)
                const maticPriceUSD = 0.40;
                const gasCostMatic = parseFloat(ethers.formatUnits(gasPrice * BigInt(estimatedGas), 'ether'));
                const networkCostUSD = gasCostMatic * maticPriceUSD;

                // Platform profit calculation
                const platformFeeUSD = estimatedValueUSD * (config.fees.platformPercent / 100);
                const feeBurnAmount = platformFeeUSD * (config.fees.feeBurnPercent / 100);
                const isProfitable = platformFeeUSD > networkCostUSD;

                // ─── Decision Logic ────────────────────────────────
                let action: GasStrategyResult['action'] = 'EXECUTE';
                let payer: GasStrategyResult['payer'] = 'USER_PAYS';
                let reasoning = '';

                // IoT (ToolBEZ) → always Relayer pays
                if (transactionType === 'iot_ingest') {
                    payer = 'RELAYER_PAYS';
                    reasoning += 'IoT transaction: Relayer pays (gasless for device). ';
                }

                // High gas + low value → delay unless urgent
                if (gasPriceGwei > config.gas.highThresholdGwei && estimatedValueUSD < config.gas.lowValueThresholdUSD) {
                    if (urgency === 'high') {
                        reasoning += 'Gas is high but urgency overrides delay. ';
                    } else {
                        action = 'DELAY';
                        reasoning += `Gas (${gasPriceGwei.toFixed(1)} Gwei) exceeds threshold and value ($${estimatedValueUSD}) is low. Recommend waiting. `;
                    }
                }

                // Not profitable → delay if possible
                if (!isProfitable && urgency !== 'high') {
                    action = 'DELAY';
                    reasoning += `Transaction not profitable for platform (fee $${platformFeeUSD.toFixed(4)} < gas $${networkCostUSD.toFixed(4)}). `;
                }

                // Batch opportunity for small IoT txs
                if (transactionType === 'iot_ingest' && estimatedValueUSD < 5) {
                    action = 'BATCH';
                    reasoning += 'Small IoT value: recommend batching multiple transactions. ';
                }

                if (!reasoning) {
                    reasoning = `Gas is optimal (${gasPriceGwei.toFixed(1)} Gwei). Transaction is profitable. Execute now.`;
                }

                const result: GasStrategyResult = {
                    action,
                    payer,
                    currentGasGwei: gasPriceGwei.toFixed(2),
                    maxPriorityFeeGwei: maxPriorityGwei.toFixed(2),
                    networkCostUSD: parseFloat(networkCostUSD.toFixed(6)),
                    projectedPlatformProfit: parseFloat(platformFeeUSD.toFixed(6)),
                    isProfitable,
                    estimatedGasUnits: estimatedGas,
                    feeBurnAmount: parseFloat(feeBurnAmount.toFixed(6)),
                    reasoning: reasoning.trim(),
                };

                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            action: 'DELAY',
                            payer: 'USER_PAYS',
                            error: `RPC Error: ${error.message}`,
                            reasoning: 'Could not fetch gas data. Recommend delay until RPC is available.',
                        }, null, 2),
                    }],
                    isError: true,
                };
            }
        }
    );
}
