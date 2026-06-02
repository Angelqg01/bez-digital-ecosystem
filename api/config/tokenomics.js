/**
 * tokenomics.js — BeZhas RWA Real Yield fee model.
 *
 * Default model from the RWA/FIAT-to-FIAT benchmark prompt:
 * 2.5% platform fee split into burn, staking rewards, DAO treasury and liquidity.
 */
const TOKENOMICS_FEE = Object.freeze({
    platformFeeBps: parseInt(process.env.PAYMENT_PLATFORM_FEE_BPS || '250', 10),
    allocationsBps: Object.freeze({
        burn: parseInt(process.env.PAYMENT_BURN_BPS || '100', 10),
        stakingRewards: parseInt(process.env.PAYMENT_STAKING_BPS || '70', 10),
        daoTreasury: parseInt(process.env.PAYMENT_DAO_TREASURY_BPS || '50', 10),
        autoLiquidity: parseInt(process.env.PAYMENT_LIQUIDITY_BPS || '30', 10),
    }),
});

function calculateFeeBreakdown(netAmountUSD, bezPriceUSD = 0.10) {
    const net = Number(netAmountUSD || 0);
    const bezPrice = Number(bezPriceUSD || 0);
    const feeUSD = Number(((net * TOKENOMICS_FEE.platformFeeBps) / 10000).toFixed(2));
    const grossUSD = Number((net + feeUSD).toFixed(2));
    const allocations = {};

    for (const [key, bps] of Object.entries(TOKENOMICS_FEE.allocationsBps)) {
        const usd = Number(((net * bps) / 10000).toFixed(2));
        const bezAmount = bezPrice > 0 ? usd / bezPrice : 0;
        allocations[key] = {
            bps,
            usd,
            bez: Number(bezAmount.toFixed(8)),
        };
    }

    return {
        netAmountUSD: net,
        platformFeeBps: TOKENOMICS_FEE.platformFeeBps,
        platformFeeUSD: feeUSD,
        grossAmountUSD: grossUSD,
        allocations,
    };
}

module.exports = {
    TOKENOMICS_FEE,
    calculateFeeBreakdown,
};
