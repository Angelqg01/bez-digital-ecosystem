/**
 * GovernanceClient (SDK v2)
 *
 * Interactúa con:
 * - GovernanceSystem (OpenZeppelin Governor: propose/vote/queue/execute)
 * - BEZCoinV2 (ERC20Votes: delegate/getVotes)
 * - TimelockController (queue/execute)
 *
 * Requisitos:
 * - BEZCoinV2 tokens deben estar delegados (delegate()) para habilitar votos.
 * - El `signer` debe tener suficiente voting power para propose (threshold: 10K BEZ).
 */
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');

const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', 'smart-contracts', 'out');
const DEPLOYMENTS_DIR = path.resolve(__dirname, '..', '..', 'smart-contracts', 'deployments');

function loadABI(contractName) {
    const artifactPath = path.join(ARTIFACTS_DIR, `${contractName}.sol`, `${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`ABI artifact not found: ${artifactPath}`);
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    if (!artifact?.abi) throw new Error(`ABI missing in artifact for ${contractName}`);
    return artifact.abi;
}

function loadDeployments(chainId) {
    const deploymentsPath = path.join(DEPLOYMENTS_DIR, `${chainId}.json`);
    if (!fs.existsSync(deploymentsPath)) {
        throw new Error(`Deployments JSON not found: ${deploymentsPath}`);
    }
    return JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
}

// Proposal states from OpenZeppelin Governor
const PROPOSAL_STATES = [
    'Pending', 'Active', 'Canceled', 'Defeated',
    'Succeeded', 'Queued', 'Expired', 'Executed',
];

// Vote types
const VOTE_AGAINST = 0;
const VOTE_FOR = 1;
const VOTE_ABSTAIN = 2;

class GovernanceClient {
    /**
     * @param {object} params
     * @param {number|string} params.chainId
     * @param {ethers.Provider} params.provider
     * @param {ethers.Signer=} params.signer - required for write methods
     * @param {object=} params.addressesOverride
     * @param {string=} params.addressesOverride.governanceSystem
     * @param {string=} params.addressesOverride.bez
     * @param {string=} params.addressesOverride.timelock
     */
    constructor({ chainId, provider, signer, addressesOverride } = {}) {
        if (!chainId) throw new Error('GovernanceClient: chainId is required');
        if (!provider) throw new Error('GovernanceClient: provider is required');

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

        const govAddr = core.GovernanceSystem || addressesOverride?.governanceSystem;
        const bezAddr = core.BEZCoinV2 || addressesOverride?.bez;
        const timelockAddr = core.TimelockController || addressesOverride?.timelock;

        if (!govAddr) throw new Error('GovernanceClient: missing GovernanceSystem address');
        if (!bezAddr) throw new Error('GovernanceClient: missing BEZCoinV2 address');

        this.addresses = { governanceSystem: govAddr, bez: bezAddr, timelock: timelockAddr };

        const connectedTo = signer || provider;
        this.governance = new ethers.Contract(govAddr, loadABI('GovernanceSystem'), connectedTo);
        this.bez = new ethers.Contract(bezAddr, loadABI('BEZCoinV2'), connectedTo);

        if (timelockAddr) {
            this.timelock = new ethers.Contract(timelockAddr, loadABI('TimelockController'), connectedTo);
        }
    }

    _assertSigner(method) {
        if (!this.signer) throw new Error(`GovernanceClient.${method}: signer required for write operations`);
    }

    // ═══════════════════════════════════════
    //  DELEGATION (required before voting)
    // ═══════════════════════════════════════

    /** Delegate voting power to self or another address. */
    async delegate(delegatee) {
        this._assertSigner('delegate');
        const addr = delegatee || await this.signer.getAddress();
        const tx = await this.bez.delegate(addr);
        return tx.wait();
    }

    /** Get current voting power of an address. */
    async getVotes(address) {
        const votes = await this.bez.getVotes(address);
        return Number(ethers.formatEther(votes));
    }

    /** Get past voting power at a specific timestamp. */
    async getPastVotes(address, timestamp) {
        const votes = await this.bez.getPastVotes(address, timestamp);
        return Number(ethers.formatEther(votes));
    }

    // ═══════════════════════════════════════
    //  GOVERNANCE PARAMETERS (read-only)
    // ═══════════════════════════════════════

    /** Get DAO configuration parameters. */
    async getParameters() {
        const [votingDelay, votingPeriod, proposalThreshold, quorum] = await Promise.all([
            this.governance.votingDelay(),
            this.governance.votingPeriod(),
            this.governance.proposalThreshold(),
            this.governance.quorum(Math.floor(Date.now() / 1000) - 86400),
        ]);

        return {
            votingDelaySec: Number(votingDelay),
            votingPeriodSec: Number(votingPeriod),
            proposalThresholdBEZ: Number(ethers.formatEther(proposalThreshold)),
            lastQuorumBEZ: Number(ethers.formatEther(quorum)),
        };
    }

    // ═══════════════════════════════════════
    //  PROPOSALS
    // ═══════════════════════════════════════

    /**
     * Create a new governance proposal.
     * @param {object} params
     * @param {string[]} params.targets - Contract addresses to call
     * @param {bigint[]|number[]} params.values - ETH values for each call
     * @param {string[]} params.calldatas - Encoded function calls
     * @param {string} params.description - Human-readable proposal description
     * @returns {Promise<{proposalId: string, txHash: string}>}
     */
    async propose({ targets, values, calldatas, description }) {
        this._assertSigner('propose');

        if (!targets?.length || targets.length !== values?.length || targets.length !== calldatas?.length) {
            throw new Error('GovernanceClient.propose: targets, values, and calldatas must be arrays of equal length');
        }

        const tx = await this.governance.propose(targets, values, calldatas, description);
        const receipt = await tx.wait();

        // Parse ProposalCreated event
        const event = receipt.logs.find(l => {
            try { return this.governance.interface.parseLog(l)?.name === 'ProposalCreated'; }
            catch { return false; }
        });

        let proposalId = null;
        if (event) {
            const parsed = this.governance.interface.parseLog(event);
            proposalId = parsed.args.proposalId.toString();
        }

        return { proposalId, txHash: tx.hash };
    }

    /**
     * Helper: create a proposal to call a single contract function.
     * @param {string} targetAddress
     * @param {string} abi - ABI of the target contract
     * @param {string} functionName
     * @param {any[]} args
     * @param {string} description
     */
    async proposeSingle(targetAddress, abi, functionName, args, description) {
        const iface = new ethers.Interface(abi);
        const calldata = iface.encodeFunctionData(functionName, args);
        return this.propose({
            targets: [targetAddress],
            values: [0n],
            calldatas: [calldata],
            description,
        });
    }

    /** Get the state of a proposal. */
    async getProposalState(proposalId) {
        const stateIndex = await this.governance.state(proposalId);
        return {
            stateIndex: Number(stateIndex),
            stateName: PROPOSAL_STATES[Number(stateIndex)] || 'Unknown',
        };
    }

    /** Get vote counts for a proposal. */
    async getProposalVotes(proposalId) {
        const [against, forVotes, abstain] = await this.governance.proposalVotes(proposalId);
        return {
            against: Number(ethers.formatEther(against)),
            for: Number(ethers.formatEther(forVotes)),
            abstain: Number(ethers.formatEther(abstain)),
        };
    }

    /** Check if an account has voted on a proposal. */
    async hasVoted(proposalId, address) {
        return this.governance.hasVoted(proposalId, address);
    }

    // ═══════════════════════════════════════
    //  VOTING
    // ═══════════════════════════════════════

    /** Cast a vote on a proposal. support: 0=Against, 1=For, 2=Abstain */
    async castVote(proposalId, support) {
        this._assertSigner('castVote');
        if (![VOTE_AGAINST, VOTE_FOR, VOTE_ABSTAIN].includes(support)) {
            throw new Error('GovernanceClient.castVote: support must be 0 (Against), 1 (For), or 2 (Abstain)');
        }
        const tx = await this.governance.castVote(proposalId, support);
        return tx.wait();
    }

    /** Cast vote with reason string. */
    async castVoteWithReason(proposalId, support, reason) {
        this._assertSigner('castVoteWithReason');
        const tx = await this.governance.castVoteWithReason(proposalId, support, String(reason));
        return tx.wait();
    }

    /** Shorthand: Vote FOR */
    async voteFor(proposalId) { return this.castVote(proposalId, VOTE_FOR); }
    /** Shorthand: Vote AGAINST */
    async voteAgainst(proposalId) { return this.castVote(proposalId, VOTE_AGAINST); }
    /** Shorthand: Vote ABSTAIN */
    async voteAbstain(proposalId) { return this.castVote(proposalId, VOTE_ABSTAIN); }

    // ═══════════════════════════════════════
    //  QUEUE & EXECUTE (Post-vote lifecycle)
    // ═══════════════════════════════════════

    /** Queue a succeeded proposal for timelock execution. */
    async queue(targets, values, calldatas, descriptionHash) {
        this._assertSigner('queue');
        const tx = await this.governance.queue(targets, values, calldatas, descriptionHash);
        return tx.wait();
    }

    /** Execute a queued proposal after timelock delay. */
    async execute(targets, values, calldatas, descriptionHash) {
        this._assertSigner('execute');
        const tx = await this.governance.execute(targets, values, calldatas, descriptionHash);
        return tx.wait();
    }

    /** Cancel a pending/active proposal (only proposer or guardian). */
    async cancel(targets, values, calldatas, descriptionHash) {
        this._assertSigner('cancel');
        const tx = await this.governance.cancel(targets, values, calldatas, descriptionHash);
        return tx.wait();
    }

    /** Compute the keccak256 of a description string (needed for queue/execute/cancel). */
    hashDescription(description) {
        return ethers.keccak256(ethers.toUtf8Bytes(description));
    }

    /** Compute proposalId from its parameters (matches on-chain hashProposal). */
    async hashProposal(targets, values, calldatas, descriptionHash) {
        return (await this.governance.hashProposal(targets, values, calldatas, descriptionHash)).toString();
    }
}

module.exports = { GovernanceClient, PROPOSAL_STATES, VOTE_AGAINST, VOTE_FOR, VOTE_ABSTAIN };
