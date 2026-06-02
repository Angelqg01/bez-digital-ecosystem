/**
 * SKILL: blockscout_explorer
 * 
 * On-chain auditing and block exploration for BEZ token on Polygon:
 * - Token holder analysis
 * - Transaction history and patterns
 * - Contract verification status
 * - Supply metrics and distribution
 * 
 * @contract BEZ: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from '../config.js';

export interface BlockscoutResult {
    action: string;
    target: string;
    network: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    data: Record<string, unknown>;
    reasoning: string;
}

export function registerBlockscoutMcp(server: McpServer): void {
    server.tool(
        'blockscout_explorer',
        'Explorador de bloques y auditoría on-chain del token $BEZ en Polygon: análisis de holders, historial de transacciones, métricas de supply y verificación de contratos.',
        {
            action: z.enum([
                'token_info',
                'holder_analysis',
                'transaction_history',
                'contract_status',
                'address_balance',
                'supply_metrics',
            ]),
            address: z.string().optional().default(config.token.address).describe('Contract or wallet address'),
            limit: z.number().optional().default(10).describe('Max results to return'),
        },
        async ({ action, address, limit }) => {
            try {
                const baseUrl = config.network.mode === 'mainnet'
                    ? 'https://polygon.blockscout.com/api/v2'
                    : 'https://polygon-amoy.blockscout.com/api/v2';

                let result: BlockscoutResult;

                switch (action) {
                    case 'token_info': {
                        const res = await fetch(`${baseUrl}/tokens/${address}`);
                        const token = await res.json() as Record<string, unknown>;

                        result = {
                            action, target: address || config.token.address,
                            network: config.network.mode,
                            status: token.name ? 'SUCCESS' : 'FAILED',
                            data: {
                                name: token.name,
                                symbol: token.symbol,
                                decimals: token.decimals,
                                totalSupply: token.total_supply,
                                holders: token.holders,
                                type: token.type,
                                exchangeRate: token.exchange_rate,
                                circulatingMarketCap: token.circulating_market_cap,
                                iconUrl: token.icon_url,
                            },
                            reasoning: token.name
                                ? `Token ${token.symbol}: ${token.holders} holders, supply ${token.total_supply}.`
                                : 'Token info not available.',
                        };
                        break;
                    }

                    case 'holder_analysis': {
                        const res = await fetch(`${baseUrl}/tokens/${address}/holders?limit=${limit}`);
                        const data = await res.json() as { items: Array<Record<string, unknown>> };

                        const holders = (data.items || []).map((h: Record<string, unknown>) => ({
                            address: (h.address as Record<string, unknown>)?.hash,
                            value: h.value,
                            percentage: h.percentage || 'N/A',
                        }));

                        const topHolderPct = holders.length > 0 ? parseFloat(String(holders[0].percentage) || '0') : 0;

                        result = {
                            action, target: address || config.token.address,
                            network: config.network.mode,
                            status: 'SUCCESS',
                            data: {
                                totalHolders: holders.length,
                                topHolders: holders.slice(0, limit),
                                concentration: topHolderPct > 50 ? 'HIGH' : topHolderPct > 20 ? 'MODERATE' : 'HEALTHY',
                                distributionScore: Math.max(0, 100 - topHolderPct),
                            },
                            reasoning: `${holders.length} holders analyzed. Top holder: ${topHolderPct}%. Distribution: ${topHolderPct > 50 ? 'HIGH concentration' : 'HEALTHY'}.`,
                        };
                        break;
                    }

                    case 'transaction_history': {
                        const res = await fetch(`${baseUrl}/addresses/${address}/transactions?limit=${limit}`);
                        const data = await res.json() as { items: Array<Record<string, unknown>> };

                        const txs = (data.items || []).map((tx: Record<string, unknown>) => ({
                            hash: tx.hash,
                            from: (tx.from as Record<string, unknown>)?.hash,
                            to: (tx.to as Record<string, unknown>)?.hash,
                            value: tx.value,
                            gasUsed: tx.gas_used,
                            status: tx.status,
                            timestamp: tx.timestamp,
                            method: tx.method,
                        }));

                        result = {
                            action, target: address || config.token.address,
                            network: config.network.mode,
                            status: 'SUCCESS',
                            data: {
                                transactionCount: txs.length,
                                transactions: txs,
                                avgGasUsed: txs.length > 0
                                    ? Math.round(txs.reduce((sum, tx) => sum + (Number(tx.gasUsed) || 0), 0) / txs.length)
                                    : 0,
                            },
                            reasoning: `Found ${txs.length} transactions for address.`,
                        };
                        break;
                    }

                    case 'contract_status': {
                        const res = await fetch(`${baseUrl}/smart-contracts/${address}`);
                        const contract = await res.json() as Record<string, unknown>;

                        result = {
                            action, target: address || config.token.address,
                            network: config.network.mode,
                            status: 'SUCCESS',
                            data: {
                                isVerified: contract.is_verified,
                                compilerVersion: contract.compiler_version,
                                optimization: contract.optimization_enabled,
                                evmVersion: contract.evm_version,
                                sourceLang: contract.language,
                                abi: contract.abi ? 'Available' : 'Not available',
                                creationTx: contract.creation_tx_hash,
                            },
                            reasoning: `Contract ${contract.is_verified ? 'VERIFIED' : 'NOT VERIFIED'}. Compiler: ${contract.compiler_version || 'unknown'}.`,
                        };
                        break;
                    }

                    case 'address_balance': {
                        const res = await fetch(`${baseUrl}/addresses/${address}`);
                        const addr = await res.json() as Record<string, unknown>;

                        const tokenRes = await fetch(`${baseUrl}/addresses/${address}/token-balances`);
                        const tokenBalances = await tokenRes.json() as Array<Record<string, unknown>>;

                        const bezBalance = (tokenBalances || []).find(
                            (t: Record<string, unknown>) =>
                                String((t.token as Record<string, unknown>)?.address).toLowerCase() === config.token.address.toLowerCase()
                        );

                        result = {
                            action, target: address || config.token.address,
                            network: config.network.mode,
                            status: 'SUCCESS',
                            data: {
                                maticBalance: addr.coin_balance,
                                bezBalance: bezBalance ? (bezBalance as Record<string, unknown>).value : '0',
                                tokenCount: (tokenBalances || []).length,
                                transactionCount: addr.transactions_count,
                                isContract: addr.is_contract,
                            },
                            reasoning: `Address has ${(tokenBalances || []).length} token types. BEZ balance: ${bezBalance ? 'found' : '0'}.`,
                        };
                        break;
                    }

                    case 'supply_metrics': {
                        const tokenRes = await fetch(`${baseUrl}/tokens/${config.token.address}`);
                        const token = await tokenRes.json() as Record<string, unknown>;

                        const countersRes = await fetch(`${baseUrl}/tokens/${config.token.address}/counters`);
                        const counters = await countersRes.json() as Record<string, unknown>;

                        result = {
                            action, target: config.token.address,
                            network: config.network.mode,
                            status: 'SUCCESS',
                            data: {
                                totalSupply: token.total_supply,
                                holders: token.holders,
                                transferCount: counters.transfers_count || counters.token_transfers_count,
                                circulatingMarketCap: token.circulating_market_cap,
                                priceUSD: config.token.priceUSD,
                                decimals: token.decimals,
                            },
                            reasoning: `$BEZ supply: ${token.total_supply}, ${token.holders} holders, market cap: ${token.circulating_market_cap || 'N/A'}.`,
                        };
                        break;
                    }

                    default:
                        result = { action, target: address || '', network: config.network.mode, status: 'FAILED', data: {}, reasoning: `Unknown action: ${action}` };
                }

                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Unknown error';
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            action, target: address || '', network: config.network.mode,
                            status: 'FAILED', data: { error: msg },
                            reasoning: `Blockscout error: ${msg}`,
                        }),
                    }],
                };
            }
        }
    );
}
