function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function normalizePackageMetadata(metadata = {}) {
    const packageId = typeof metadata.packageId === 'string'
        ? metadata.packageId.trim().toLowerCase()
        : '';
    const expectedBezCredits = Math.max(0, toFiniteNumber(metadata.expectedBezCredits));
    const bonusPct = Math.max(0, toFiniteNumber(metadata.bonusPct));

    return {
        packageId,
        expectedBezCredits,
        bonusPct,
        isPackagePurchase: Boolean(packageId && expectedBezCredits > 0)
    };
}

function buildPackageMetadata(input = {}) {
    const normalized = normalizePackageMetadata(input);

    if (!normalized.isPackagePurchase) {
        return {};
    }

    return {
        source: 'unified_bez_billing',
        packageId: normalized.packageId,
        expectedBezCredits: normalized.expectedBezCredits,
        bonusPct: normalized.bonusPct
    };
}

function buildStripeMetadata(input = {}) {
    const metadata = buildPackageMetadata(input);

    return Object.entries(metadata).reduce((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
    }, {});
}

function resolvePackageCredit(transactionMetadata = {}, paymentIntentMetadata = {}) {
    const fromTransaction = normalizePackageMetadata(transactionMetadata);
    if (fromTransaction.isPackagePurchase) {
        return fromTransaction;
    }

    return normalizePackageMetadata(paymentIntentMetadata);
}

module.exports = {
    normalizePackageMetadata,
    buildPackageMetadata,
    buildStripeMetadata,
    resolvePackageCredit
};
