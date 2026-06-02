/**
 * SKILL 3: verify_regulatory_compliance
 * 
 * Checks if a transaction complies with international AML/KYC regulations:
 * - Wallet KYC status (simulated, connects to MongoDB in production)
 * - High-value transaction threshold ($10k USD)
 * - Sanctioned regions (OFAC list simulation)
 * - Risk scoring based on multiple factors
 * 
 * @contract BEZ: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from '../config.js';

export interface ComplianceResult {
    status: 'APPROVED' | 'PENDING_KYC' | 'REJECTED' | 'MANUAL_REVIEW';
    kycRequired: boolean;
    kycVerified: boolean;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    flags: string[];
    automaticAction: 'ALLOW_TX' | 'BLOCK_TX' | 'HOLD_FOR_REVIEW';
    totalValueUSD: number;
    reasoning: string;
}

// Simulated KYC database (in production this queries MongoDB)
const KYC_VERIFIED_WALLETS = new Set([
    '0x1234567890123456789012345678901234567890',
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
]);

export function registerCompliance(server: McpServer): void {
    server.tool(
        'verify_regulatory_compliance',
        'Verifica si una transacción cumple con normas internacionales AML/KYC antes de ejecutar. Bloquea transferencias >$10k sin KYC.',
        {
            walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
            amountBEZ: z.number().positive(),
            fiatRegion: z.string().length(2, 'ISO 3166-1 alpha-2 country code'),
            transactionType: z.enum(['transfer', 'swap', 'marketplace', 'staking']).optional(),
        },
        async ({ walletAddress, amountBEZ, fiatRegion, transactionType = 'transfer' }) => {
            const flags: string[] = [];
            let riskScore = 0;

            // ─── Calculate total value ─────────────────────────────
            const totalValueUSD = amountBEZ * config.token.priceUSD;

            // ─── Check 1: Sanctioned regions ───────────────────────
            const regionUpper = fiatRegion.toUpperCase();
            if ((config.compliance.sanctionedRegions as readonly string[]).includes(regionUpper)) {
                flags.push('SANCTIONED_REGION');
                riskScore += 100; // Instant reject
            }

            // ─── Check 2: High-value transaction ───────────────────
            const kycRequired = totalValueUSD > config.compliance.highValueThresholdUSD;
            if (kycRequired) {
                flags.push('HIGH_VALUE_TRANSACTION');
                riskScore += 30;
            }

            // ─── Check 3: KYC verification status ──────────────────
            // In production: query MongoDB for wallet KYC status
            const kycVerified = KYC_VERIFIED_WALLETS.has(walletAddress.toLowerCase());
            if (kycRequired && !kycVerified) {
                flags.push('KYC_NOT_VERIFIED');
                riskScore += 40;
            }

            // ─── Check 4: Unusual amount patterns ──────────────────
            if (totalValueUSD > 9000 && totalValueUSD <= 10000) {
                flags.push('POSSIBLE_STRUCTURING');
                riskScore += 20;
            }

            // ─── Check 5: New wallet heuristic ─────────────────────
            // In production: check wallet age and transaction history on-chain
            if (totalValueUSD > 5000 && !kycVerified) {
                flags.push('UNVERIFIED_HIGH_AMOUNT');
                riskScore += 15;
            }

            // ─── Determine risk level ──────────────────────────────
            let riskLevel: ComplianceResult['riskLevel'];
            if (riskScore >= 100) riskLevel = 'CRITICAL';
            else if (riskScore >= 50) riskLevel = 'HIGH';
            else if (riskScore >= 20) riskLevel = 'MEDIUM';
            else riskLevel = 'LOW';

            // ─── Determine status and action ───────────────────────
            let status: ComplianceResult['status'];
            let automaticAction: ComplianceResult['automaticAction'];
            let reasoning = '';

            if (riskScore >= 100) {
                status = 'REJECTED';
                automaticAction = 'BLOCK_TX';
                reasoning = `Transaction blocked: ${flags.join(', ')}. Risk score ${riskScore}/100.`;
            } else if (kycRequired && !kycVerified) {
                status = 'PENDING_KYC';
                automaticAction = 'HOLD_FOR_REVIEW';
                reasoning = `High-value transaction ($${totalValueUSD.toFixed(2)}) requires KYC verification. Wallet ${walletAddress.slice(0, 10)}... is not verified.`;
            } else if (riskScore >= 50) {
                status = 'MANUAL_REVIEW';
                automaticAction = 'HOLD_FOR_REVIEW';
                reasoning = `Multiple risk flags detected (${flags.join(', ')}). Requires manual compliance review.`;
            } else {
                status = 'APPROVED';
                automaticAction = 'ALLOW_TX';
                reasoning = `Transaction approved. Risk level: ${riskLevel}. Value: $${totalValueUSD.toFixed(2)} USD.`;
            }

            const result: ComplianceResult = {
                status,
                kycRequired,
                kycVerified,
                riskScore: Math.min(riskScore, 100),
                riskLevel,
                flags,
                automaticAction,
                totalValueUSD: parseFloat(totalValueUSD.toFixed(2)),
                reasoning,
            };

            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        }
    );
}
