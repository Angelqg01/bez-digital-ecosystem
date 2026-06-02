/**
 * ValidatorClient (SDK v2)
 *
 * Interactúa directamente con:
 * - ValidatorRegistry (register/addStake/heartbeat + getValidatorInfo)
 * - EdgeNodeRewards (registerNode + claimRewards + getNodeInfo)
 *
 * Requisitos:
 * - El contrato BEZCoinV2 debe estar aprobado para transferFrom() cuando se registra o agrega stake.
 * - El `signer` debe corresponder a la cuenta "operator" o node registrada en los contratos.
 */
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');

const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', 'smart-contracts', 'out');
const DEPLOYMENTS_DIR = path.resolve(__dirname, '..', '..', 'smart-contracts', 'deployments');

function loadArtifactJSON(contractName) {
    const artifactPath = path.join(ARTIFACTS_DIR, `${contractName}.sol`, `${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`ABI artifact not found: ${artifactPath}`);
    }
    return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

function loadABI(contractName) {
    const artifact = loadArtifactJSON(contractName);
    if (!artifact?.abi) throw new Error(`ABI missing in artifact for ${contractName}`);
    return artifact.abi;
}

function loadDeployments(chainId) {
    const deploymentsPath = path.join(DEPLOYMENTS_DIR, `${chainId}.json`);
    if (!fs.existsSync(deploymentsPath)) {
        throw new Error(`Deployments JSON not found: ${deploymentsPath}`);
    }
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    return deployments;
}

function asEth(amountWei) {
    // amountWei might already be a string or BigInt depending on ethers call path.
    const v = typeof amountWei === 'bigint' ? amountWei : BigInt(amountWei);
    return Number(ethers.formatEther(v));
}

function asNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'bigint') return Number(value);
    // eslint-disable-next-line no-restricted-globals
    return Number(String(value));
}

class ValidatorClient {
    /**
     * @param {object} params
     * @param {number|string} params.chainId
     * @param {ethers.Provider} params.provider
     * @param {ethers.Signer=} params.signer - required for write methods
     * @param {object=} params.addressesOverride - manual contract addresses
     * @param {string=} params.addressesOverride.bez
     * @param {string=} params.addressesOverride.validatorRegistry
     * @param {string=} params.addressesOverride.edgeNodeRewards
     */
    constructor({ chainId, provider, signer, addressesOverride } = {}) {
        if (!chainId) throw new Error('ValidatorClient: chainId is required');
        if (!provider) throw new Error('ValidatorClient: provider is required');

        this.chainId = Number(chainId);
        this.provider = provider;
        this.signer = signer;

        let deploymentsCore = null;
        try {
            const deployments = loadDeployments(this.chainId);
            deploymentsCore = deployments.core || {};
        } catch {
            // Allow addresses override without deployments file.
        }

        const core = deploymentsCore || {};

        const bez = (core.BEZCoinV2 && core.BEZCoinV2 !== '') ? core.BEZCoinV2 : addressesOverride?.bez;
        const validatorRegistry =
            (core.ValidatorRegistry && core.ValidatorRegistry !== '') ? core.ValidatorRegistry : addressesOverride?.validatorRegistry;
        const edgeNodeRewards =
            (core.EdgeNodeRewards && core.EdgeNodeRewards !== '') ? core.EdgeNodeRewards : addressesOverride?.edgeNodeRewards;

        if (!bez) throw new Error(`ValidatorClient: missing BEZCoinV2 address (deployments/core or addressesOverride.bez)`);
        if (!validatorRegistry) throw new Error(`ValidatorClient: missing ValidatorRegistry address (deployments/core or addressesOverride.validatorRegistry)`);
        if (!edgeNodeRewards) throw new Error(`ValidatorClient: missing EdgeNodeRewards address (deployments/core or addressesOverride.edgeNodeRewards)`);

        this.addresses = { bez, validatorRegistry, edgeNodeRewards };

        // Contracts: read/write depend on whether signer exists.
        const regAbi = loadABI('ValidatorRegistry');
        const bezAbi = loadABI('BEZCoinV2');
        const rewardsAbi = loadABI('EdgeNodeRewards');

        const regSigner = signer || provider;
        const rewardsSigner = signer || provider;

        this.bez = new ethers.Contract(this.addresses.bez, bezAbi, regSigner);
        this.validatorRegistry = new ethers.Contract(this.addresses.validatorRegistry, regAbi, regSigner);
        this.edgeNodeRewards = new ethers.Contract(this.addresses.edgeNodeRewards, rewardsAbi, rewardsSigner);
    }

    _assertSigner(method) {
        if (!this.signer) throw new Error(`ValidatorClient.${method}: signer required for write operations`);
    }

    /**
     * Approve BEZ tokens to be transferFrom() by ValidatorRegistry.
     */
    async approveStake(stakeAmountEth) {
        this._assertSigner('approveStake');
        const amountWei = ethers.parseEther(String(stakeAmountEth));
        const tx = await this.bez.approve(this.addresses.validatorRegistry, amountWei);
        return tx.wait();
    }

    /**
     * Register as a validator (registerValidator(companyName, stakeAmount)).
     */
    async registerValidator(companyName, stakeAmountEth) {
        this._assertSigner('registerValidator');
        const stakeWei = ethers.parseEther(String(stakeAmountEth));
        // registerValidator() requires BEZCoinV2 approval from msg.sender.
        const tx = await this.validatorRegistry.registerValidator(String(companyName), stakeWei);
        return tx.wait();
    }

    /**
     * Add stake to an active validator.
     */
    async addStake(amountEth) {
        this._assertSigner('addStake');
        const amountWei = ethers.parseEther(String(amountEth));
        const tx = await this.validatorRegistry.addStake(amountWei);
        return tx.wait();
    }

    /**
     * Heartbeat - marks validator uptime.
     */
    async heartbeat() {
        this._assertSigner('heartbeat');
        const tx = await this.validatorRegistry.heartbeat();
        return tx.wait();
    }

    /**
     * Register EdgeNodeRewards node. (Requires caller to be an active validator in ValidatorRegistry)
     */
    async registerNode() {
        this._assertSigner('registerNode');
        const tx = await this.edgeNodeRewards.registerNode();
        return tx.wait();
    }

    /**
     * Claim rewards from EdgeNodeRewards.
     */
    async claimRewards() {
        this._assertSigner('claimRewards');
        const tx = await this.edgeNodeRewards.claimRewards();
        return tx.wait();
    }

    /**
     * Read validator info from ValidatorRegistry.
     */
    async getInfo(operatorAddress) {
        const info = await this.validatorRegistry.getValidatorInfo(operatorAddress);
        // Solidity return tuple order:
        // companyName, stakedAmount, contributionPoints, tier, isActive, isSequencerEligible, uptimePercent
        return {
            operator: operatorAddress,
            companyName: String(info[0] ?? ''),
            stakedAmountEth: asEth(info[1] ?? 0n),
            contributionPoints: asNumber(info[2] ?? 0),
            tier: asNumber(info[3] ?? 0),
            isActive: Boolean(info[4]),
            isSequencerEligible: Boolean(info[5]),
            uptimePercent: asNumber(info[6] ?? 0),
        };
    }

    /**
     * Read node info from EdgeNodeRewards.
     */
    async getNodeInfo(nodeAddress) {
        const info = await this.edgeNodeRewards.getNodeInfo(nodeAddress);
        // return tuple:
        // totalValidations, claimablePoints, totalBEZEarned, pendingBEZ, boostBps, isActive
        return {
            node: nodeAddress,
            totalValidations: asNumber(info[0] ?? 0),
            claimablePoints: asNumber(info[1] ?? 0),
            totalBEZEarnedEth: asEth(info[2] ?? 0n),
            pendingBEZEth: asEth(info[3] ?? 0n),
            boostBps: asNumber(info[4] ?? 0),
            isActive: Boolean(info[5]),
        };
    }
}

module.exports = { ValidatorClient };

