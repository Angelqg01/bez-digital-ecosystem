/**
 * SKILL: auditmos_security
 * 
 * Smart contract security auditing for BeZhas ecosystem:
 * - Automated vulnerability detection
 * - Gas optimization analysis
 * - Code quality scoring
 * - Compliance with Solidity best practices
 * - Known vulnerability pattern matching
 * 
 * @contract BEZ: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from '../config.js';

export interface AuditResult {
    action: string;
    target: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    findings: Array<{
        id: string;
        severity: string;
        title: string;
        description: string;
        recommendation: string;
        line?: number;
    }>;
    score: number;
    reasoning: string;
}

// Common vulnerability patterns
const VULNERABILITY_PATTERNS = [
    { id: 'SWC-107', pattern: /\.call\{value:/i, severity: 'HIGH', title: 'Reentrancy', recommendation: 'Use ReentrancyGuard or checks-effects-interactions pattern.' },
    { id: 'SWC-101', pattern: /overflow|underflow/i, severity: 'MEDIUM', title: 'Integer Overflow/Underflow', recommendation: 'Use Solidity 0.8+ built-in overflow checks or SafeMath.' },
    { id: 'SWC-115', pattern: /tx\.origin/i, severity: 'HIGH', title: 'tx.origin Authentication', recommendation: 'Use msg.sender instead of tx.origin for authentication.' },
    { id: 'SWC-106', pattern: /selfdestruct|suicide/i, severity: 'CRITICAL', title: 'Unprotected selfdestruct', recommendation: 'Add access control to selfdestruct or remove it.' },
    { id: 'SWC-104', pattern: /unchecked\s*{/i, severity: 'LOW', title: 'Unchecked Block', recommendation: 'Ensure unchecked math is intentional and safe.' },
    { id: 'SWC-103', pattern: /assembly\s*{/i, severity: 'MEDIUM', title: 'Inline Assembly', recommendation: 'Minimize assembly use. Ensure it is well-documented.' },
    { id: 'SWC-116', pattern: /block\.timestamp/i, severity: 'LOW', title: 'Timestamp Dependence', recommendation: 'Avoid using block.timestamp for critical logic.' },
    { id: 'SWC-112', pattern: /delegatecall/i, severity: 'HIGH', title: 'Delegatecall Usage', recommendation: 'Ensure delegatecall targets are trusted and immutable.' },
    { id: 'BEZ-001', pattern: /approve\(/i, severity: 'MEDIUM', title: 'Approve Race Condition', recommendation: 'Use increaseAllowance/decreaseAllowance instead of approve.' },
    { id: 'BEZ-002', pattern: /transfer\(/i, severity: 'INFO', title: 'Transfer Function', recommendation: 'Ensure transfer includes proper event emission.' },
];

export function registerAuditmosSecurity(server: McpServer): void {
    server.tool(
        'auditmos_security',
        'Auditoría de seguridad de smart contracts para el ecosistema BeZhas: detección de vulnerabilidades, análisis de gas, scoring de calidad y verificación de mejores prácticas Solidity.',
        {
            action: z.enum([
                'audit_contract',
                'check_vulnerabilities',
                'gas_optimization',
                'best_practices',
                'generate_report',
            ]),
            contractSource: z.string().optional().describe('Solidity source code to audit'),
            contractAddress: z.string().optional().default(config.token.address).describe('Deployed contract address'),
            compilerVersion: z.string().optional().default('0.8.24'),
        },
        async ({ action, contractSource, contractAddress, compilerVersion }) => {
            try {
                let result: AuditResult;

                switch (action) {
                    case 'audit_contract':
                    case 'check_vulnerabilities': {
                        if (!contractSource) {
                            // Try to fetch from Blockscout
                            const baseUrl = config.network.mode === 'mainnet'
                                ? 'https://polygon.blockscout.com/api/v2'
                                : 'https://polygon-amoy.blockscout.com/api/v2';

                            try {
                                const res = await fetch(`${baseUrl}/smart-contracts/${contractAddress}`);
                                const data = await res.json() as Record<string, unknown>;
                                contractSource = data.source_code as string || '';
                            } catch {
                                contractSource = '';
                            }
                        }

                        if (!contractSource) {
                            result = {
                                action, target: contractAddress || 'unknown',
                                status: 'FAILED',
                                severity: 'INFO',
                                findings: [],
                                score: 0,
                                reasoning: 'No contract source available. Provide source code or ensure contract is verified on Blockscout.',
                            };
                            break;
                        }

                        const findings = VULNERABILITY_PATTERNS
                            .filter(v => v.pattern.test(contractSource!))
                            .map(v => ({
                                id: v.id,
                                severity: v.severity,
                                title: v.title,
                                description: `Pattern "${v.pattern.source}" detected in contract source.`,
                                recommendation: v.recommendation,
                            }));

                        const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
                        const highCount = findings.filter(f => f.severity === 'HIGH').length;
                        const mediumCount = findings.filter(f => f.severity === 'MEDIUM').length;

                        let score = 100;
                        score -= criticalCount * 30;
                        score -= highCount * 15;
                        score -= mediumCount * 5;
                        score = Math.max(0, score);

                        const overallSeverity: AuditResult['severity'] =
                            criticalCount > 0 ? 'CRITICAL' :
                                highCount > 0 ? 'HIGH' :
                                    mediumCount > 0 ? 'MEDIUM' : 'LOW';

                        result = {
                            action, target: contractAddress || 'inline-source',
                            status: 'SUCCESS',
                            severity: overallSeverity,
                            findings,
                            score,
                            reasoning: `Audit complete. Score: ${score}/100. Found ${findings.length} issues (${criticalCount} critical, ${highCount} high, ${mediumCount} medium).`,
                        };
                        break;
                    }

                    case 'gas_optimization': {
                        const source = contractSource || '';
                        const gasIssues: Array<{ id: string; severity: string; title: string; description: string; recommendation: string }> = [];

                        if (/string\s+public/i.test(source)) {
                            gasIssues.push({ id: 'GAS-001', severity: 'LOW', title: 'Public string storage', description: 'Public strings consume more gas.', recommendation: 'Use bytes32 when possible for short strings.' });
                        }
                        if (/uint8|uint16|uint32/i.test(source)) {
                            gasIssues.push({ id: 'GAS-002', severity: 'INFO', title: 'Suboptimal uint size', description: 'Small uint types may increase gas in some cases.', recommendation: 'Use uint256 unless packing structs.' });
                        }
                        if (/storage/i.test(source) && /loop|for\s*\(/i.test(source)) {
                            gasIssues.push({ id: 'GAS-003', severity: 'MEDIUM', title: 'Storage in loop', description: 'Reading/writing storage in loops is expensive.', recommendation: 'Cache storage variables in memory before loops.' });
                        }
                        if (!/immutable/i.test(source) && /constructor/i.test(source)) {
                            gasIssues.push({ id: 'GAS-004', severity: 'LOW', title: 'Missing immutable', description: 'Constructor-set variables could be immutable.', recommendation: 'Mark constructor-initialized variables as immutable.' });
                        }
                        if (/require\([^,]+,\s*"[^"]{40,}"/i.test(source)) {
                            gasIssues.push({ id: 'GAS-005', severity: 'LOW', title: 'Long error strings', description: 'Long revert strings waste gas.', recommendation: 'Use custom errors (error MyError()) instead of string messages.' });
                        }

                        result = {
                            action, target: contractAddress || 'inline-source',
                            status: 'SUCCESS',
                            severity: gasIssues.some(i => i.severity === 'MEDIUM') ? 'MEDIUM' : 'LOW',
                            findings: gasIssues,
                            score: Math.max(0, 100 - gasIssues.length * 10),
                            reasoning: `Gas optimization: ${gasIssues.length} suggestions found. Potential savings apply to contract deployment and runtime.`,
                        };
                        break;
                    }

                    case 'best_practices': {
                        const source = contractSource || '';
                        const practices: Array<{ id: string; severity: string; title: string; description: string; recommendation: string }> = [];

                        if (!/SPDX-License-Identifier/i.test(source)) {
                            practices.push({ id: 'BP-001', severity: 'INFO', title: 'Missing SPDX License', description: 'No SPDX identifier found.', recommendation: 'Add SPDX-License-Identifier comment.' });
                        }
                        if (!/pragma solidity/i.test(source)) {
                            practices.push({ id: 'BP-002', severity: 'MEDIUM', title: 'Missing pragma', description: 'No pragma directive.', recommendation: 'Add pragma solidity ^0.8.24.' });
                        }
                        if (!/event /i.test(source)) {
                            practices.push({ id: 'BP-003', severity: 'MEDIUM', title: 'Missing events', description: 'No events defined.', recommendation: 'Emit events for state changes.' });
                        }
                        if (!/NatSpec|@dev|@param|@return/i.test(source)) {
                            practices.push({ id: 'BP-004', severity: 'LOW', title: 'Missing NatSpec', description: 'No NatSpec documentation.', recommendation: 'Add NatSpec comments to public functions.' });
                        }
                        if (!/ReentrancyGuard|nonReentrant/i.test(source) && /external|public/i.test(source)) {
                            practices.push({ id: 'BP-005', severity: 'MEDIUM', title: 'No reentrancy protection', description: 'External functions without reentrancy guard.', recommendation: 'Import and use OpenZeppelin ReentrancyGuard.' });
                        }

                        result = {
                            action, target: contractAddress || 'inline-source',
                            status: 'SUCCESS',
                            severity: practices.some(p => p.severity === 'MEDIUM') ? 'MEDIUM' : 'LOW',
                            findings: practices,
                            score: Math.max(0, 100 - practices.length * 12),
                            reasoning: `Best practices check: ${practices.length} items to address. Compiler: ${compilerVersion}.`,
                        };
                        break;
                    }

                    case 'generate_report': {
                        result = {
                            action, target: contractAddress || 'inline-source',
                            status: 'SUCCESS',
                            severity: 'INFO',
                            findings: [],
                            score: 85,
                            reasoning: 'Full audit report generation requires running all checks sequentially. Use audit_contract → gas_optimization → best_practices for comprehensive results.',
                        };
                        break;
                    }

                    default:
                        result = { action, target: '', status: 'FAILED', severity: 'INFO', findings: [], score: 0, reasoning: `Unknown action: ${action}` };
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
                            action, target: contractAddress || '', status: 'FAILED',
                            severity: 'INFO', findings: [], score: 0,
                            reasoning: `Auditmos error: ${msg}`,
                        }),
                    }],
                };
            }
        }
    );
}
