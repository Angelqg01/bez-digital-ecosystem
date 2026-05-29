const {
    buildPackageMetadata,
    buildStripeMetadata,
    normalizePackageMetadata,
    resolvePackageCredit
} = require('../../services/bezCreditPackage.service');

describe('bezCreditPackage.service', () => {
    it('normalizes gateway package metadata for BEZ credit checkout', () => {
        const metadata = normalizePackageMetadata({
            packageId: ' Growth ',
            expectedBezCredits: '1575',
            bonusPct: '5'
        });

        expect(metadata).toEqual({
            packageId: 'growth',
            expectedBezCredits: 1575,
            bonusPct: 5,
            isPackagePurchase: true
        });
    });

    it('omits package metadata when checkout is a generic fiat top-up', () => {
        expect(buildPackageMetadata({ amount: 25 })).toEqual({});
    });

    it('serializes package metadata for Stripe metadata fields', () => {
        const metadata = buildStripeMetadata({
            packageId: 'pro',
            expectedBezCredits: 4577,
            bonusPct: 15
        });

        expect(metadata).toEqual({
            source: 'unified_bez_billing',
            packageId: 'pro',
            expectedBezCredits: '4577',
            bonusPct: '15'
        });
    });

    it('prefers stored transaction metadata over Stripe metadata', () => {
        const credit = resolvePackageCredit(
            { packageId: 'agency', expectedBezCredits: 12475, bonusPct: 25 },
            { packageId: 'starter', expectedBezCredits: '500', bonusPct: '0' }
        );

        expect(credit.packageId).toBe('agency');
        expect(credit.expectedBezCredits).toBe(12475);
        expect(credit.isPackagePurchase).toBe(true);
    });
});
