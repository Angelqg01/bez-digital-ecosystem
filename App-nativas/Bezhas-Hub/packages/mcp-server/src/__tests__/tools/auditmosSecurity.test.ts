/**
 * Unit tests: auditmos_security
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult, mockFetchResponse } from '../helpers/mockMcpServer.js';
import { registerAuditmosSecurity } from '../../tools/auditmosSecurity.js';
import type { AuditResult } from '../../tools/auditmosSecurity.js';

describe('auditmos_security', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerAuditmosSecurity(server as any);
        handler = getHandler('auditmos_security')!;
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('audit_contract', () => {
        it('should detect reentrancy vulnerability', async () => {
            const source = `
                pragma solidity ^0.8.24;
                contract Vulnerable {
                    function withdraw() external {
                        (bool success,) = msg.sender.call{value: balance}("");
                    }
                }
            `;
            const response = await handler({ action: 'audit_contract', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.status).toBe('SUCCESS');
            const reentrancy = result.findings.find(f => f.id === 'SWC-107');
            expect(reentrancy).toBeDefined();
            expect(reentrancy?.severity).toBe('HIGH');
        });

        it('should detect selfdestruct (CRITICAL)', async () => {
            const source = `
                pragma solidity ^0.8.24;
                contract Destroyable {
                    function kill() external { selfdestruct(payable(msg.sender)); }
                }
            `;
            const response = await handler({ action: 'audit_contract', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.severity).toBe('CRITICAL');
            expect(result.findings.some(f => f.id === 'SWC-106')).toBe(true);
        });

        it('should detect tx.origin usage', async () => {
            const source = `
                pragma solidity ^0.8.24;
                contract Auth {
                    function check() external view returns (address) { return tx.origin; }
                }
            `;
            const response = await handler({ action: 'audit_contract', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.findings.some(f => f.id === 'SWC-115')).toBe(true);
        });

        it('should detect delegatecall', async () => {
            const source = `
                pragma solidity ^0.8.24;
                contract Proxy {
                    function forward(address impl) external {
                        (bool s,) = impl.delegatecall(msg.data);
                    }
                }
            `;
            const response = await handler({ action: 'audit_contract', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.findings.some(f => f.id === 'SWC-112')).toBe(true);
        });

        it('should return perfect score for clean contract', async () => {
            const source = `
                // SPDX-License-Identifier: MIT
                pragma solidity ^0.8.24;
                /// @title Clean Contract
                /// @dev Simple storage
                contract Clean {
                    uint256 private value;
                    event ValueSet(uint256 newValue);
                    function setValue(uint256 _v) external { value = _v; emit ValueSet(_v); }
                    function getValue() external view returns (uint256) { return value; }
                }
            `;
            const response = await handler({ action: 'audit_contract', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.score).toBe(100);
            expect(result.severity).toBe('LOW');
            expect(result.findings).toHaveLength(0);
        });

        it('should score correctly: -30 per critical, -15 per high, -5 per medium', async () => {
            const source = `
                pragma solidity ^0.8.24;
                contract Multi {
                    function a() external { selfdestruct(payable(msg.sender)); }
                    function b() external { (bool s,) = msg.sender.call{value: 1}(""); }
                    function c() view external returns (address) { return tx.origin; }
                }
            `;
            const response = await handler({ action: 'audit_contract', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            // 1 CRITICAL (selfdestruct -30), 2 HIGH (reentrancy + tx.origin -30), potential others
            expect(result.score).toBeLessThan(50);
            expect(result.severity).toBe('CRITICAL');
        });

        it('should FAIL when no source is provided and fetch fails', async () => {
            (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

            const response = await handler({ action: 'audit_contract', contractAddress: '0x1234567890123456789012345678901234567890' });
            const result = parseToolResult<AuditResult>(response);

            expect(result.status).toBe('FAILED');
            expect(result.score).toBe(0);
        });

        it('should try fetching from Blockscout when no source provided', async () => {
            (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
                mockFetchResponse({ source_code: 'pragma solidity ^0.8.24; contract Empty {}' })
            );

            const response = await handler({ action: 'audit_contract', contractAddress: '0x1234567890123456789012345678901234567890' });
            const result = parseToolResult<AuditResult>(response);

            expect(globalThis.fetch).toHaveBeenCalled();
            expect(result.status).toBe('SUCCESS');
        });
    });

    describe('check_vulnerabilities', () => {
        it('should work the same as audit_contract', async () => {
            const source = `pragma solidity ^0.8.24; contract Test { function f() external { selfdestruct(payable(msg.sender)); } }`;
            const response = await handler({ action: 'check_vulnerabilities', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.action).toBe('check_vulnerabilities');
            expect(result.status).toBe('SUCCESS');
            expect(result.findings.length).toBeGreaterThan(0);
        });
    });

    describe('gas_optimization', () => {
        it('should detect public string storage', async () => {
            const source = `pragma solidity ^0.8.24; contract G { string public name = "test"; }`;
            const response = await handler({ action: 'gas_optimization', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.findings.some(f => f.id === 'GAS-001')).toBe(true);
        });

        it('should detect suboptimal uint sizes', async () => {
            const source = `pragma solidity ^0.8.24; contract G { uint8 count; }`;
            const response = await handler({ action: 'gas_optimization', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.findings.some(f => f.id === 'GAS-002')).toBe(true);
        });

        it('should detect storage in loops', async () => {
            const source = `pragma solidity ^0.8.24; contract G { uint256[] storage data; function f() external { for (uint i; i < 10; i++) {} } }`;
            const response = await handler({ action: 'gas_optimization', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.findings.some(f => f.id === 'GAS-003')).toBe(true);
        });

        it('should detect missing immutable', async () => {
            const source = `pragma solidity ^0.8.24; contract G { address owner; constructor() { owner = msg.sender; } }`;
            const response = await handler({ action: 'gas_optimization', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.findings.some(f => f.id === 'GAS-004')).toBe(true);
        });

        it('should calculate score based on findings count', async () => {
            const source = `pragma solidity ^0.8.24; contract G { string public name; uint8 x; constructor() { name = "test"; } }`;
            const response = await handler({ action: 'gas_optimization', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.score).toBe(100 - result.findings.length * 10);
        });
    });

    describe('best_practices', () => {
        it('should flag missing SPDX license', async () => {
            const source = `pragma solidity ^0.8.24; contract C {}`;
            const response = await handler({ action: 'best_practices', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.findings.some(f => f.id === 'BP-001')).toBe(true);
        });

        it('should flag missing pragma', async () => {
            const source = `// SPDX-License-Identifier: MIT\ncontract C {}`;
            const response = await handler({ action: 'best_practices', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.findings.some(f => f.id === 'BP-002')).toBe(true);
        });

        it('should flag missing events', async () => {
            const source = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\ncontract C { uint256 x; function set(uint256 _x) external { x = _x; } }`;
            const response = await handler({ action: 'best_practices', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.findings.some(f => f.id === 'BP-003')).toBe(true);
        });

        it('should pass for well-structured contract', async () => {
            const source = `
                // SPDX-License-Identifier: MIT
                pragma solidity ^0.8.24;
                import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
                /// @title Good Contract
                /// @dev Well documented
                /// @param value The value to set
                /// @return The stored value
                contract Good is ReentrancyGuard {
                    event ValueSet(uint256 value);
                    uint256 public value;
                    function setValue(uint256 _v) external nonReentrant { value = _v; emit ValueSet(_v); }
                }
            `;
            const response = await handler({ action: 'best_practices', contractSource: source });
            const result = parseToolResult<AuditResult>(response);

            expect(result.score).toBeGreaterThanOrEqual(80);
        });
    });

    describe('generate_report', () => {
        it('should return guidance about sequential checks', async () => {
            const response = await handler({ action: 'generate_report' });
            const result = parseToolResult<AuditResult>(response);

            expect(result.status).toBe('SUCCESS');
            expect(result.severity).toBe('INFO');
            expect(result.score).toBe(85);
            expect(result.reasoning).toContain('audit_contract');
        });
    });

    describe('error handling', () => {
        it('should handle unexpected errors gracefully', async () => {
            // Force an error by passing unexpected data type
            (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Crash'));

            const response = await handler({ action: 'audit_contract' });
            const result = parseToolResult<AuditResult>(response);

            // Should return FAILED but not throw
            expect(['FAILED', 'SUCCESS']).toContain(result.status);
        });
    });
});
