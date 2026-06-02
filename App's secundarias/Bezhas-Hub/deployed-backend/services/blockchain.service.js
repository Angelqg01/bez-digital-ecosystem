// backend/services/blockchainService.js
// Integración con CampaignContract y SettlementContract usando ethers.js
const { ethers } = require('ethers');
const CAMPAIGN_ABI = require('../abis/CampaignContract.json');
const SETTLEMENT_ABI = require('../abis/SettlementContract.json');

// Lazy initialization - solo crear cuando se use
let provider, campaignContract, settlementContract;

function getProvider() {
    if (!provider && process.env.RPC_URL) {
        provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    }
    return provider;
}

function getCampaignContract() {
    if (!campaignContract && process.env.CAMPAIGN_CONTRACT) {
        const prov = getProvider();
        if (prov) {
            campaignContract = new ethers.Contract(process.env.CAMPAIGN_CONTRACT, CAMPAIGN_ABI, prov);
        }
    }
    return campaignContract;
}

function getSettlementContract() {
    if (!settlementContract && process.env.SETTLEMENT_CONTRACT) {
        const prov = getProvider();
        if (prov) {
            settlementContract = new ethers.Contract(process.env.SETTLEMENT_CONTRACT, SETTLEMENT_ABI, prov);
        }
    }
    return settlementContract;
}

// Bloquear presupuesto en el contrato al crear campaña
async function lockBudgetOnChain(advertiser, budget) {
    const contract = getCampaignContract();
    if (!contract) throw new Error('Campaign contract not available');

    // El anunciante debe aprobar el contrato para transferir Bez-Coin antes
    const tx = await contract.createCampaign(budget, 1, 1, { from: advertiser });
    await tx.wait();
    return tx;
}

// Liquidar recompensas desde SettlementContract
async function distributeRewards(campaignIds, creators, amounts) {
    const contract = getSettlementContract();
    if (!contract) throw new Error('Settlement contract not available');

    const tx = await contract.distributeRewards(campaignIds, creators, amounts);
    await tx.wait();
    return tx;
}

module.exports = { lockBudgetOnChain, distributeRewards };
