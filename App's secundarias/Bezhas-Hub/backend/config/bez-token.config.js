const BEZ_COIN_UTILITY_VALIDATOR_TOKEN = Object.freeze({
    name: 'BEZ-Coin',
    symbol: 'BEZ',
    chain: 'polygon',
    chainId: 137,
    address: process.env.BEZCOIN_CONTRACT_ADDRESS || process.env.BEZ_TOKEN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    role: 'utility-validator-token',
    status: 'active'
});

module.exports = {
    BEZ_COIN_UTILITY_VALIDATOR_TOKEN
};
