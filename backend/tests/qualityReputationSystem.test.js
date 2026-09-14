/**
 * Quality Reputation System — pruebas unitarias
 *
 * Reescritas contra la API real del servicio. Las anteriores databan de una
 * implementación previa: esperaban `TIERS` como Map con `minScore`, campos
 * planos (`totalServices`, `averageQuality`, `totalDisputes`) y parámetros
 * `qualityScore`/`collateralAmount`. El servicio actual expone `tiers` como
 * objeto con `min`, agrupa las cifras bajo `stats` y recibe `finalQuality`,
 * `collateralReturned` y `penaltyApplied`.
 */

const QualityReputationSystem = require('../services/quality-reputation.service');

/** Servicio completado con los nombres de campo que espera el servicio. */
const service = (serviceId, finalQuality, extra = {}) => ({
    serviceId,
    finalQuality,
    collateralReturned: 100,
    penaltyApplied: 0,
    isDisputed: false,
    ...extra,
});

const PROVIDER = '0x1234567890123456789012345678901234567890';

describe('QualityReputationSystem', () => {
    let reputationSystem;

    beforeEach(() => {
        reputationSystem = new QualityReputationSystem();
    });

    describe('Constructor', () => {
        it('arranca sin ninguna reputación registrada', () => {
            expect(reputationSystem.reputations.size).toBe(0);
        });

        it('define los umbrales de cada nivel', () => {
            const { tiers } = reputationSystem;
            expect(tiers.LEGENDARY.min).toBe(950);
            expect(tiers.MASTER.min).toBe(900);
            expect(tiers.EXPERT.min).toBe(850);
            expect(tiers.PROFESSIONAL.min).toBe(800);
            expect(tiers.INTERMEDIATE.min).toBe(700);
            expect(tiers.BEGINNER.min).toBe(0);
        });

        it('los pesos del cálculo suman 1', () => {
            const total = Object.values(reputationSystem.weights).reduce((a, b) => a + b, 0);
            expect(total).toBeCloseTo(1, 5);
        });
    });

    describe('updateAfterService', () => {
        it('crea la reputación en el primer servicio', () => {
            reputationSystem.updateAfterService(PROVIDER, service(1, 90));

            const reputation = reputationSystem.reputations.get(PROVIDER);
            expect(reputation).toBeDefined();
            expect(reputation.stats.totalServices).toBe(1);
            expect(reputation.stats.completedServices).toBe(1);
        });

        it('sube la puntuación con calidad alta sostenida', () => {
            for (let i = 1; i <= 5; i++) {
                reputationSystem.updateAfterService(PROVIDER, service(i, 90));
            }

            const reputation = reputationSystem.reputations.get(PROVIDER);
            expect(reputation.score).toBeGreaterThan(800);
            expect(reputation.stats.avgQuality).toBe(90);
        });

        it('penaliza la calidad baja', () => {
            for (let i = 1; i <= 5; i++) {
                reputationSystem.updateAfterService(PROVIDER, service(i, 50, { penaltyApplied: 20 }));
            }

            const reputation = reputationSystem.reputations.get(PROVIDER);
            expect(reputation.stats.avgQuality).toBeLessThan(80);
            expect(reputation.score).toBeLessThan(800);
        });

        it('concede FIRST_SERVICE al primer servicio', () => {
            reputationSystem.updateAfterService(PROVIDER, service(1, 85));

            expect(reputationSystem.reputations.get(PROVIDER).achievements).toContain('FIRST_SERVICE');
        });

        it('concede VETERAN_10 al décimo servicio', () => {
            for (let i = 1; i <= 10; i++) {
                reputationSystem.updateAfterService(PROVIDER, service(i, 85));
            }

            expect(reputationSystem.reputations.get(PROVIDER).achievements).toContain('VETERAN_10');
        });

        it('concede PERFECTIONIST con un servicio perfecto', () => {
            // El servicio lo otorga por un 100 exacto, no por una media alta.
            reputationSystem.updateAfterService(PROVIDER, service(1, 98));
            expect(reputationSystem.reputations.get(PROVIDER).achievements).not.toContain('PERFECTIONIST');

            reputationSystem.updateAfterService(PROVIDER, service(2, 100));
            expect(reputationSystem.reputations.get(PROVIDER).achievements).toContain('PERFECTIONIST');
        });

        it('concede CONSISTENT_EXCELLENCE con diez servicios seguidos por encima de 90', () => {
            for (let i = 1; i <= 10; i++) {
                reputationSystem.updateAfterService(PROVIDER, service(i, 95));
            }

            expect(reputationSystem.reputations.get(PROVIDER).achievements).toContain('CONSISTENT_EXCELLENCE');
        });

        it('acumula el colateral devuelto y las penalizaciones', () => {
            reputationSystem.updateAfterService(PROVIDER, service(1, 90, { collateralReturned: 80, penaltyApplied: 20 }));
            reputationSystem.updateAfterService(PROVIDER, service(2, 90, { collateralReturned: 100, penaltyApplied: 0 }));

            const { stats } = reputationSystem.reputations.get(PROVIDER);
            expect(stats.totalCollateralEarned).toBe(180);
            expect(stats.totalPenalties).toBe(20);
        });

        it('registra cada servicio en el historial', () => {
            reputationSystem.updateAfterService(PROVIDER, service(7, 90));

            const [entry] = reputationSystem.reputations.get(PROVIDER).history;
            expect(entry).toMatchObject({ serviceId: 7, action: 'service_completed', finalQuality: 90 });
            expect(entry.oldScore).toBe(600);
        });
    });

    describe('updateAfterDispute', () => {
        beforeEach(() => {
            reputationSystem.updateAfterService(PROVIDER, service(1, 90));
        });

        it('penaliza con fuerza cuando la culpa es del proveedor', () => {
            const before = reputationSystem.reputations.get(PROVIDER).score;
            reputationSystem.updateAfterDispute(PROVIDER, { serviceId: 1, wasProviderFault: true, refundAmount: 50 });

            expect(reputationSystem.reputations.get(PROVIDER).score).toBe(before - 100);
        });

        it('penaliza menos cuando la culpa no es del proveedor', () => {
            const before = reputationSystem.reputations.get(PROVIDER).score;
            reputationSystem.updateAfterDispute(PROVIDER, { serviceId: 1, wasProviderFault: false, refundAmount: 0 });
            const after = reputationSystem.reputations.get(PROVIDER).score;

            expect(after).toBeLessThan(before);
            expect(before - after).toBeLessThan(100);
        });

        it('cuenta las disputas', () => {
            reputationSystem.updateAfterDispute(PROVIDER, { serviceId: 1, wasProviderFault: true, refundAmount: 50 });
            reputationSystem.updateAfterDispute(PROVIDER, { serviceId: 2, wasProviderFault: false, refundAmount: 0 });

            expect(reputationSystem.reputations.get(PROVIDER).stats.disputedServices).toBe(2);
        });

        it('la puntuación nunca baja de cero', () => {
            for (let i = 0; i < 20; i++) {
                reputationSystem.updateAfterDispute(PROVIDER, { serviceId: i, wasProviderFault: true, refundAmount: 10 });
            }

            expect(reputationSystem.reputations.get(PROVIDER).score).toBe(0);
        });
    });

    describe('Niveles', () => {
        it('empieza en BEGINNER con 600 puntos', () => {
            expect(reputationSystem.getReputation(PROVIDER)).toMatchObject({ score: 600, tier: 'BEGINNER' });
        });

        it('llega a LEGENDARY con rendimiento perfecto sostenido', () => {
            for (let i = 1; i <= 12; i++) {
                reputationSystem.updateAfterService(PROVIDER, service(i, 100));
            }

            const reputation = reputationSystem.reputations.get(PROVIDER);
            expect(reputation.tier).toBe('LEGENDARY');
            expect(reputation.score).toBeGreaterThanOrEqual(950);
        });

        it('la puntuación está acotada a 1000', () => {
            for (let i = 1; i <= 40; i++) {
                reputationSystem.updateAfterService(PROVIDER, service(i, 100));
            }

            expect(reputationSystem.reputations.get(PROVIDER).score).toBeLessThanOrEqual(1000);
        });
    });

    describe('getLeaderboard', () => {
        it('devuelve una lista vacía sin reputaciones', () => {
            expect(reputationSystem.getLeaderboard()).toEqual([]);
        });

        it('ordena por puntuación descendente', () => {
            const quality = { '0xaaa': 100, '0xbbb': 85, '0xccc': 60 };
            for (const [provider, q] of Object.entries(quality)) {
                for (let i = 1; i <= 5; i++) reputationSystem.updateAfterService(provider, service(i, q));
            }

            const leaderboard = reputationSystem.getLeaderboard();
            expect(leaderboard).toHaveLength(3);
            expect(leaderboard[0].score).toBeGreaterThanOrEqual(leaderboard[1].score);
            expect(leaderboard[1].score).toBeGreaterThanOrEqual(leaderboard[2].score);
            expect(leaderboard[0].rank).toBe(1);
        });

        it('respeta el límite pedido', () => {
            for (const provider of ['0xa', '0xb', '0xc', '0xd', '0xe']) {
                reputationSystem.updateAfterService(provider, service(1, 90));
            }

            expect(reputationSystem.getLeaderboard(3)).toHaveLength(3);
        });
    });

    describe('getSummary', () => {
        it('incluye la información del nivel', () => {
            reputationSystem.updateAfterService(PROVIDER, service(1, 90));
            const summary = reputationSystem.getSummary(PROVIDER);

            expect(summary.tier).toMatchObject({ name: expect.any(String), color: expect.any(String), badge: expect.any(String) });
            expect(summary.provider).toBe(PROVIDER);
        });

        it('recorta el historial reciente a las últimas 5 entradas', () => {
            for (let i = 1; i <= 15; i++) {
                reputationSystem.updateAfterService(PROVIDER, service(i, 90));
            }

            const { recentHistory } = reputationSystem.getSummary(PROVIDER);
            expect(recentHistory).toHaveLength(5);
            expect(recentHistory[recentHistory.length - 1].serviceId).toBe(15);
        });

        it('describe cada logro en vez de devolver solo su identificador', () => {
            reputationSystem.updateAfterService(PROVIDER, service(1, 90));

            const [achievement] = reputationSystem.getSummary(PROVIDER).achievements;
            expect(achievement).toMatchObject({ name: expect.any(String), description: expect.any(String) });
        });
    });

    describe('Casos límite', () => {
        it('admite calidad cero', () => {
            reputationSystem.updateAfterService(PROVIDER, service(1, 0, { collateralReturned: 0, penaltyApplied: 100 }));

            expect(reputationSystem.reputations.get(PROVIDER).stats.avgQuality).toBe(0);
        });

        it('admite calidad perfecta', () => {
            reputationSystem.updateAfterService(PROVIDER, service(1, 100));

            expect(reputationSystem.reputations.get(PROVIDER).stats.avgQuality).toBe(100);
        });

        it('mantiene reputaciones independientes por proveedor', () => {
            reputationSystem.updateAfterService('0xaaa', service(1, 100));
            reputationSystem.updateAfterService('0xbbb', service(1, 40, { penaltyApplied: 60 }));

            const a = reputationSystem.reputations.get('0xaaa').score;
            const b = reputationSystem.reputations.get('0xbbb').score;
            expect(a).toBeGreaterThan(b);
        });
    });
});
