/**
 * Quality Reputation System - Unit Tests
 * Tests for reputation calculation, tier assignment, and achievements
 */

const QualityReputationSystem = require('../services/qualityReputationSystem');

describe('QualityReputationSystem', () => {
    let reputationSystem;

    beforeEach(() => {
        reputationSystem = new QualityReputationSystem();
    });

    describe('Constructor', () => {
        it('should initialize with empty reputation map', () => {
            expect(reputationSystem.reputations.size).toBe(0);
        });

        it('should have correct tier definitions', () => {
            const tiers = reputationSystem.TIERS;
            expect(tiers.get('LEGENDARY').minScore).toBe(950);
            expect(tiers.get('MASTER').minScore).toBe(900);
            expect(tiers.get('EXPERT').minScore).toBe(850);
            expect(tiers.get('PROFESSIONAL').minScore).toBe(800);
            expect(tiers.get('INTERMEDIATE').minScore).toBe(700);
            expect(tiers.get('BEGINNER').minScore).toBe(0);
        });
    });

    describe('updateAfterService', () => {
        it('should create new reputation for first service', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 90,
                collateralAmount: 100
            });

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation).toBeDefined();
            expect(reputation.totalServices).toBe(1);
            expect(reputation.completedServices).toBe(1);
        });

        it('should calculate correct score for high quality service', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            // Complete 5 services with 90% quality
            for (let i = 1; i <= 5; i++) {
                await reputationSystem.updateAfterService(provider, {
                    serviceId: i,
                    qualityScore: 90,
                    collateralAmount: 100
                });
            }

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.score).toBeGreaterThan(800); // Should be PROFESSIONAL tier
            expect(reputation.tier).toBe('PROFESSIONAL');
        });

        it('should penalize low quality services', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            // Complete services with declining quality
            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 95,
                collateralAmount: 100
            });

            await reputationSystem.updateAfterService(provider, {
                serviceId: 2,
                qualityScore: 50,
                collateralAmount: 100
            });

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.averageQuality).toBeLessThan(80);
        });

        it('should award FIRST_SERVICE achievement', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 90,
                collateralAmount: 100
            });

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.achievements).toContainEqual(
                expect.objectContaining({ type: 'FIRST_SERVICE' })
            );
        });

        it('should award VETERAN_10 achievement after 10 services', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            // Complete 10 services
            for (let i = 1; i <= 10; i++) {
                await reputationSystem.updateAfterService(provider, {
                    serviceId: i,
                    qualityScore: 85,
                    collateralAmount: 100
                });
            }

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.achievements).toContainEqual(
                expect.objectContaining({ type: 'VETERAN_10' })
            );
        });

        it('should award PERFECTIONIST achievement for consistent 95%+', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            // Complete 5 perfect services
            for (let i = 1; i <= 5; i++) {
                await reputationSystem.updateAfterService(provider, {
                    serviceId: i,
                    qualityScore: 98,
                    collateralAmount: 100
                });
            }

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.achievements).toContainEqual(
                expect.objectContaining({ type: 'PERFECTIONIST' })
            );
        });
    });

    describe('updateAfterDispute', () => {
        it('should penalize provider when dispute is lost', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            // Create baseline reputation
            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 90,
                collateralAmount: 100
            });

            const scoreBefore = reputationSystem.reputations.get(provider).score;

            // Provider loses dispute
            await reputationSystem.updateAfterDispute(provider, {
                serviceId: 2,
                disputeResolution: 'PROVIDER_FAULT',
                qualityPenalty: 20
            });

            const scoreAfter = reputationSystem.reputations.get(provider).score;
            expect(scoreAfter).toBeLessThan(scoreBefore);
        });

        it('should slightly penalize provider when dispute is won', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            // Create baseline reputation
            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 90,
                collateralAmount: 100
            });

            const scoreBefore = reputationSystem.reputations.get(provider).score;

            // Provider wins dispute
            await reputationSystem.updateAfterDispute(provider, {
                serviceId: 2,
                disputeResolution: 'PROVIDER_WIN',
                qualityPenalty: 0
            });

            const scoreAfter = reputationSystem.reputations.get(provider).score;
            expect(scoreAfter).toBeLessThan(scoreBefore); // Still penalized but less
        });

        it('should increment dispute stats', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 90,
                collateralAmount: 100
            });

            await reputationSystem.updateAfterDispute(provider, {
                serviceId: 2,
                disputeResolution: 'PROVIDER_FAULT',
                qualityPenalty: 20
            });

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.totalDisputes).toBe(1);
            expect(reputation.disputesLost).toBe(1);
        });
    });

    describe('Score Calculation', () => {
        it('should weight quality score most heavily (40%)', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            // Service with perfect quality
            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 100,
                collateralAmount: 100
            });

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.score).toBeGreaterThan(700); // Quality heavily weighted
        });

        it('should calculate completion rate correctly', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            // 3 completed, 1 cancelled = 75% completion rate
            for (let i = 1; i <= 3; i++) {
                await reputationSystem.updateAfterService(provider, {
                    serviceId: i,
                    qualityScore: 85,
                    collateralAmount: 100
                });
            }

            // Simulate cancelled service
            const reputation = reputationSystem.reputations.get(provider);
            reputation.totalServices = 4;
            reputation.cancelledServices = 1;

            const score = reputationSystem._calculateScore(reputation);
            const completionRate = (reputation.completedServices / reputation.totalServices) * 100;
            expect(completionRate).toBe(75);
        });

        it('should apply longevity bonus for veteran providers', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 80,
                collateralAmount: 100
            });

            const reputation = reputationSystem.reputations.get(provider);

            // Simulate 200 days of activity
            reputation.firstServiceDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);

            const scoreWithBonus = reputationSystem._calculateScore(reputation);
            expect(scoreWithBonus).toBeGreaterThan(reputation.score);
        });
    });

    describe('Tier Assignment', () => {
        it('should start at BEGINNER tier', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 70,
                collateralAmount: 100
            });

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.tier).toBe('BEGINNER');
        });

        it('should promote to PROFESSIONAL tier with consistent quality', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            // 10 services with 85% quality
            for (let i = 1; i <= 10; i++) {
                await reputationSystem.updateAfterService(provider, {
                    serviceId: i,
                    qualityScore: 85,
                    collateralAmount: 100
                });
            }

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.tier).toBe('PROFESSIONAL');
            expect(reputation.score).toBeGreaterThanOrEqual(800);
        });

        it('should reach LEGENDARY tier with perfect performance', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            // 50 perfect services
            for (let i = 1; i <= 50; i++) {
                await reputationSystem.updateAfterService(provider, {
                    serviceId: i,
                    qualityScore: 98,
                    collateralAmount: 100
                });
            }

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.tier).toBe('LEGENDARY');
            expect(reputation.score).toBeGreaterThanOrEqual(950);
        });
    });

    describe('Leaderboard', () => {
        it('should return empty array when no reputations exist', () => {
            const leaderboard = reputationSystem.getLeaderboard(10);
            expect(leaderboard).toEqual([]);
        });

        it('should sort providers by score descending', async () => {
            // Create 3 providers with different scores
            const providers = [
                '0x1111111111111111111111111111111111111111',
                '0x2222222222222222222222222222222222222222',
                '0x3333333333333333333333333333333333333333'
            ];

            // Provider 1: 5 services @ 90%
            for (let i = 1; i <= 5; i++) {
                await reputationSystem.updateAfterService(providers[0], {
                    serviceId: i,
                    qualityScore: 90,
                    collateralAmount: 100
                });
            }

            // Provider 2: 10 services @ 85%
            for (let i = 1; i <= 10; i++) {
                await reputationSystem.updateAfterService(providers[1], {
                    serviceId: i,
                    qualityScore: 85,
                    collateralAmount: 100
                });
            }

            // Provider 3: 3 services @ 95%
            for (let i = 1; i <= 3; i++) {
                await reputationSystem.updateAfterService(providers[2], {
                    serviceId: i,
                    qualityScore: 95,
                    collateralAmount: 100
                });
            }

            const leaderboard = reputationSystem.getLeaderboard(10);

            expect(leaderboard.length).toBe(3);
            expect(leaderboard[0].score).toBeGreaterThanOrEqual(leaderboard[1].score);
            expect(leaderboard[1].score).toBeGreaterThanOrEqual(leaderboard[2].score);
        });

        it('should respect limit parameter', async () => {
            // Create 5 providers
            for (let p = 1; p <= 5; p++) {
                const provider = `0x${p.toString().repeat(40)}`;
                await reputationSystem.updateAfterService(provider, {
                    serviceId: 1,
                    qualityScore: 80,
                    collateralAmount: 100
                });
            }

            const leaderboard = readerboardSystem.getLeaderboard(3);
            expect(leaderboard.length).toBe(3);
        });
    });

    describe('getSummary', () => {
        it('should return null for non-existent provider', () => {
            const summary = reputationSystem.getSummary('0x0000000000000000000000000000000000000000');
            expect(summary).toBeNull();
        });

        it('should include tier information in summary', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 85,
                collateralAmount: 100
            });

            const summary = reputationSystem.getSummary(provider);

            expect(summary.tierInfo).toBeDefined();
            expect(summary.tierInfo.name).toBe('Beginner');
            expect(summary.tierInfo.color).toBeDefined();
            expect(summary.tierInfo.badge).toBeDefined();
        });

        it('should limit recent history to 10 entries', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            // Create 15 services
            for (let i = 1; i <= 15; i++) {
                await reputationSystem.updateAfterService(provider, {
                    serviceId: i,
                    qualityScore: 85,
                    collateralAmount: 100
                });
            }

            const summary = reputationSystem.getSummary(provider);
            expect(summary.recentHistory.length).toBe(10);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero quality score', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 0,
                collateralAmount: 100
            });

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.averageQuality).toBe(0);
        });

        it('should handle perfect 100% quality score', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 100,
                collateralAmount: 100
            });

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.averageQuality).toBe(100);
        });

        it('should handle multiple disputes in succession', async () => {
            const provider = '0x1234567890123456789012345678901234567890';

            await reputationSystem.updateAfterService(provider, {
                serviceId: 1,
                qualityScore: 90,
                collateralAmount: 100
            });

            // 3 lost disputes
            for (let i = 2; i <= 4; i++) {
                await reputationSystem.updateAfterDispute(provider, {
                    serviceId: i,
                    disputeResolution: 'PROVIDER_FAULT',
                    qualityPenalty: 20
                });
            }

            const reputation = reputationSystem.reputations.get(provider);
            expect(reputation.totalDisputes).toBe(3);
            expect(reputation.disputesLost).toBe(3);
        });
    });
});
