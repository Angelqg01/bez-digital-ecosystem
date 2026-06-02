/**
 * ============================================================================
 * ORACLE SERVICE TESTS
 * ============================================================================
 * 
 * Tests para oracle.service.js - Servicio de conexión con Oracle API
 * 
 * Run: pnpm test frontend/src/tests/oracle.service.test.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import oracleService, {
    ORACLE_SECTORS,
    getValidationQueue,
    getUserPendingValidations,
    submitValidationVote,
    getValidatorStats,
    getPendingRewards,
    claimRewards,
    registerAsValidator,
    getOracleGlobalStats,
    getSectorStats,
    escalateValidation,
    getValidationHistory,
    isActiveValidator,
    getValidationDetails
} from '../services/oracle.service';

// Mock http service
vi.mock('../services/http', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

import http from '../services/http';

describe('Oracle Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                         CONSTANTS TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('Constants', () => {
        it('should have all 18 sectors defined', () => {
            expect(ORACLE_SECTORS).toHaveLength(18);
        });

        it('should include all required sectors', () => {
            const expectedSectors = [
                'marketplace',
                'logistics',
                'payments',
                'ai_moderation',
                'identity',
                'real_estate',
                'healthcare',
                'manufacturing',
                'automotive',
                'energy',
                'agriculture',
                'education',
                'insurance',
                'entertainment',
                'legal',
                'supply_chain',
                'government',
                'carbon_credits'
            ];

            expectedSectors.forEach(sector => {
                expect(ORACLE_SECTORS).toContain(sector);
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                      VALIDATION QUEUE TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('getValidationQueue', () => {
        it('should fetch validation queue for a sector', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    items: [
                        { id: '1', type: 'product_listing', aiScore: 85 }
                    ]
                }
            };
            http.get.mockResolvedValue(mockResponse);

            const result = await getValidationQueue('marketplace', 10);

            expect(http.get).toHaveBeenCalledWith('/oracle/queue/marketplace', {
                params: { limit: 10 }
            });
            expect(result).toEqual(mockResponse.data);
        });

        it('should use default sector and limit', async () => {
            http.get.mockResolvedValue({ data: {} });

            await getValidationQueue();

            expect(http.get).toHaveBeenCalledWith('/oracle/queue/marketplace', {
                params: { limit: 10 }
            });
        });

        it('should throw error on API failure', async () => {
            http.get.mockRejectedValue(new Error('API Error'));

            await expect(getValidationQueue('marketplace')).rejects.toThrow('API Error');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                     USER PENDING VALIDATIONS TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('getUserPendingValidations', () => {
        it('should fetch pending validations for user', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    pending: 5
                }
            };
            http.get.mockResolvedValue(mockResponse);

            const address = '0x1234567890123456789012345678901234567890';
            const result = await getUserPendingValidations(address);

            expect(http.get).toHaveBeenCalledWith(`/oracle/user/${address}/pending`);
            expect(result).toEqual(mockResponse.data);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                         VOTING TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('submitValidationVote', () => {
        it('should submit approve vote', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    txHash: '0xabc123'
                }
            };
            http.post.mockResolvedValue(mockResponse);

            const result = await submitValidationVote('val-123', 'approve', 'Quality content');

            expect(http.post).toHaveBeenCalledWith('/oracle/vote', {
                validationId: 'val-123',
                vote: 'approve',
                reason: 'Quality content'
            });
            expect(result).toEqual(mockResponse.data);
        });

        it('should submit reject vote', async () => {
            http.post.mockResolvedValue({ data: { success: true } });

            await submitValidationVote('val-456', 'reject', 'Spam content');

            expect(http.post).toHaveBeenCalledWith('/oracle/vote', {
                validationId: 'val-456',
                vote: 'reject',
                reason: 'Spam content'
            });
        });

        it('should submit escalate vote', async () => {
            http.post.mockResolvedValue({ data: { success: true } });

            await submitValidationVote('val-789', 'escalate', 'Needs review');

            expect(http.post).toHaveBeenCalledWith('/oracle/vote', {
                validationId: 'val-789',
                vote: 'escalate',
                reason: 'Needs review'
            });
        });

        it('should use empty reason by default', async () => {
            http.post.mockResolvedValue({ data: { success: true } });

            await submitValidationVote('val-000', 'approve');

            expect(http.post).toHaveBeenCalledWith('/oracle/vote', {
                validationId: 'val-000',
                vote: 'approve',
                reason: ''
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                       VALIDATOR STATS TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('getValidatorStats', () => {
        it('should fetch validator statistics', async () => {
            const mockStats = {
                data: {
                    totalValidations: 1500,
                    accuracy: 96.5,
                    reputation: 98,
                    level: 'Guardian'
                }
            };
            http.get.mockResolvedValue(mockStats);

            const address = '0x1234';
            const result = await getValidatorStats(address);

            expect(http.get).toHaveBeenCalledWith(`/oracle/validator/${address}/stats`);
            expect(result).toEqual(mockStats.data);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                         REWARDS TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('getPendingRewards', () => {
        it('should fetch pending rewards for validator', async () => {
            const mockRewards = {
                data: {
                    pending: 450,
                    currency: 'BEZ'
                }
            };
            http.get.mockResolvedValue(mockRewards);

            const address = '0x5678';
            const result = await getPendingRewards(address);

            expect(http.get).toHaveBeenCalledWith(`/oracle/validator/${address}/rewards`);
            expect(result).toEqual(mockRewards.data);
        });
    });

    describe('claimRewards', () => {
        it('should claim pending rewards', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    claimed: 450,
                    txHash: '0xdef456'
                }
            };
            http.post.mockResolvedValue(mockResponse);

            const result = await claimRewards();

            expect(http.post).toHaveBeenCalledWith('/oracle/rewards/claim');
            expect(result).toEqual(mockResponse.data);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                     VALIDATOR REGISTRATION TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('registerAsValidator', () => {
        it('should register as validator with stake and sectors', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    validatorId: 'validator-001'
                }
            };
            http.post.mockResolvedValue(mockResponse);

            const result = await registerAsValidator(5000, ['marketplace', 'logistics']);

            expect(http.post).toHaveBeenCalledWith('/oracle/validator/register', {
                stakeAmount: 5000,
                sectors: ['marketplace', 'logistics']
            });
            expect(result).toEqual(mockResponse.data);
        });

        it('should use default sector if not specified', async () => {
            http.post.mockResolvedValue({ data: { success: true } });

            await registerAsValidator(1000);

            expect(http.post).toHaveBeenCalledWith('/oracle/validator/register', {
                stakeAmount: 1000,
                sectors: ['marketplace']
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                        GLOBAL STATS TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('getOracleGlobalStats', () => {
        it('should fetch global oracle statistics', async () => {
            const mockStats = {
                data: {
                    totalValidators: 150,
                    totalValidations: 50000,
                    averageAccuracy: 94.2,
                    totalStaked: 750000
                }
            };
            http.get.mockResolvedValue(mockStats);

            const result = await getOracleGlobalStats();

            expect(http.get).toHaveBeenCalledWith('/oracle/stats/global');
            expect(result).toEqual(mockStats.data);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                        SECTOR STATS TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('getSectorStats', () => {
        it('should fetch statistics for a specific sector', async () => {
            const mockStats = {
                data: {
                    sector: 'real_estate',
                    pendingValidations: 25,
                    completedToday: 45,
                    averageAIScore: 72
                }
            };
            http.get.mockResolvedValue(mockStats);

            const result = await getSectorStats('real_estate');

            expect(http.get).toHaveBeenCalledWith('/oracle/stats/sector/real_estate');
            expect(result).toEqual(mockStats.data);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                         ESCALATION TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('escalateValidation', () => {
        it('should escalate a validation with reason', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    escalationId: 'esc-001'
                }
            };
            http.post.mockResolvedValue(mockResponse);

            const result = await escalateValidation('val-123', 'Complex case needs DAO review');

            expect(http.post).toHaveBeenCalledWith('/oracle/escalate', {
                validationId: 'val-123',
                reason: 'Complex case needs DAO review'
            });
            expect(result).toEqual(mockResponse.data);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                       VALIDATION HISTORY TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('getValidationHistory', () => {
        it('should fetch validation history with pagination', async () => {
            const mockHistory = {
                data: {
                    items: [],
                    page: 2,
                    totalPages: 10
                }
            };
            http.get.mockResolvedValue(mockHistory);

            const result = await getValidationHistory('0xabc', 2, 50);

            expect(http.get).toHaveBeenCalledWith('/oracle/validator/0xabc/history', {
                params: { page: 2, limit: 50 }
            });
            expect(result).toEqual(mockHistory.data);
        });

        it('should use default pagination', async () => {
            http.get.mockResolvedValue({ data: {} });

            await getValidationHistory('0xdef');

            expect(http.get).toHaveBeenCalledWith('/oracle/validator/0xdef/history', {
                params: { page: 1, limit: 20 }
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                      VALIDATOR STATUS TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('isActiveValidator', () => {
        it('should return true for active validator', async () => {
            http.get.mockResolvedValue({
                data: { isActive: true }
            });

            const result = await isActiveValidator('0x1234');

            expect(http.get).toHaveBeenCalledWith('/oracle/validator/0x1234/status');
            expect(result).toBe(true);
        });

        it('should return false for inactive validator', async () => {
            http.get.mockResolvedValue({
                data: { isActive: false }
            });

            const result = await isActiveValidator('0x5678');
            expect(result).toBe(false);
        });

        it('should return false on API error', async () => {
            http.get.mockRejectedValue(new Error('Network error'));

            const result = await isActiveValidator('0xabc');
            expect(result).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                     VALIDATION DETAILS TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('getValidationDetails', () => {
        it('should fetch details for a specific validation', async () => {
            const mockDetails = {
                data: {
                    id: 'val-123',
                    sector: 'marketplace',
                    type: 'product_listing',
                    aiScore: 85,
                    votes: { approve: 5, reject: 1, escalate: 0 }
                }
            };
            http.get.mockResolvedValue(mockDetails);

            const result = await getValidationDetails('val-123');

            expect(http.get).toHaveBeenCalledWith('/oracle/validation/val-123');
            expect(result).toEqual(mockDetails.data);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //                       DEFAULT EXPORT TESTS
    // ═══════════════════════════════════════════════════════════════════════

    describe('Default Export', () => {
        it('should export all functions', () => {
            expect(oracleService.ORACLE_SECTORS).toBeDefined();
            expect(oracleService.getValidationQueue).toBeInstanceOf(Function);
            expect(oracleService.getUserPendingValidations).toBeInstanceOf(Function);
            expect(oracleService.submitValidationVote).toBeInstanceOf(Function);
            expect(oracleService.getValidatorStats).toBeInstanceOf(Function);
            expect(oracleService.getPendingRewards).toBeInstanceOf(Function);
            expect(oracleService.claimRewards).toBeInstanceOf(Function);
            expect(oracleService.registerAsValidator).toBeInstanceOf(Function);
            expect(oracleService.getOracleGlobalStats).toBeInstanceOf(Function);
            expect(oracleService.getSectorStats).toBeInstanceOf(Function);
            expect(oracleService.escalateValidation).toBeInstanceOf(Function);
            expect(oracleService.getValidationHistory).toBeInstanceOf(Function);
            expect(oracleService.isActiveValidator).toBeInstanceOf(Function);
            expect(oracleService.getValidationDetails).toBeInstanceOf(Function);
        });
    });
});
