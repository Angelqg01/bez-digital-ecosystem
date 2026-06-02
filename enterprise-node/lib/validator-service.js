'use strict';

const { ethers } = require('ethers');
const tokenomics = require('./tokenomics-service');

const VALIDATOR_ABI = [
  'function registerValidator(string companyName, uint256 stakeAmount) external',
  'function addStake(uint256 amount) external',
  'function heartbeat() external',
  'function getValidatorInfo(address operator) view returns (string companyName, uint256 stakedAmount, uint256 contributionPoints, uint8 tier, bool isActive, bool isSequencerEligible, uint256 uptimePercent)',
];

const BEZ_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
];

function getConfig() {
  const addresses = tokenomics.getConfiguredAddresses();
  return {
    chain_id: parseInt(process.env.CHAIN_ID || '2708', 10),
    rpc_url: process.env.BEZHAS_L2_RPC_URL || 'http://bezhas-geth:8545',
    validator_address: process.env.VALIDATOR_ADDRESS || '',
    has_private_key: Boolean(process.env.VALIDATOR_PRIVATE_KEY),
    company_name: process.env.VALIDATOR_COMPANY_NAME || 'BeZhas Enterprise Node',
    stake_amount_bez: process.env.VALIDATOR_STAKE_AMOUNT_BEZ || '0',
    contracts: {
      bez: addresses.BEZCoinV2,
      validator_registry: addresses.ValidatorRegistry,
    },
  };
}

function getProvider() {
  return new ethers.JsonRpcProvider(process.env.BEZHAS_L2_RPC_URL || 'http://bezhas-geth:8545');
}

function getSigner(provider) {
  if (!process.env.VALIDATOR_PRIVATE_KEY) return null;
  return new ethers.Wallet(process.env.VALIDATOR_PRIVATE_KEY, provider);
}

async function getStatus() {
  const config = getConfig();
  const provider = getProvider();
  const signer = getSigner(provider);
  const operator = config.validator_address || (signer ? await signer.getAddress() : null);

  const status = {
    configured: Boolean(config.contracts.validator_registry && operator),
    writable: Boolean(config.contracts.validator_registry && signer),
    operator,
    ...config,
  };

  if (!config.contracts.validator_registry || !operator) return status;

  try {
    const registry = new ethers.Contract(config.contracts.validator_registry, VALIDATOR_ABI, provider);
    const info = await registry.getValidatorInfo(operator);
    status.on_chain = {
      company_name: String(info[0] || ''),
      staked_amount_bez: ethers.formatEther(info[1] || 0n),
      contribution_points: Number(info[2] || 0),
      tier: Number(info[3] || 0),
      is_active: Boolean(info[4]),
      is_sequencer_eligible: Boolean(info[5]),
      uptime_percent: Number(info[6] || 0),
    };
  } catch (err) {
    status.on_chain_error = err.message;
  }

  return status;
}

async function approveStake(amountBez) {
  const config = getConfig();
  const provider = getProvider();
  const signer = getSigner(provider);
  if (!signer) throw new Error('VALIDATOR_PRIVATE_KEY is required for approveStake.');
  if (!config.contracts.bez || !config.contracts.validator_registry) {
    throw new Error('BEZCoinV2 and ValidatorRegistry addresses are required.');
  }

  const bez = new ethers.Contract(config.contracts.bez, BEZ_ABI, signer);
  const tx = await bez.approve(config.contracts.validator_registry, ethers.parseEther(String(amountBez)));
  const receipt = await tx.wait();
  return { tx_hash: receipt.hash, block_number: receipt.blockNumber };
}

async function registerValidator(companyName, stakeAmountBez) {
  const config = getConfig();
  const provider = getProvider();
  const signer = getSigner(provider);
  if (!signer) throw new Error('VALIDATOR_PRIVATE_KEY is required for registerValidator.');
  if (!config.contracts.validator_registry) throw new Error('ValidatorRegistry address is required.');

  const registry = new ethers.Contract(config.contracts.validator_registry, VALIDATOR_ABI, signer);
  const tx = await registry.registerValidator(
    String(companyName || config.company_name),
    ethers.parseEther(String(stakeAmountBez || config.stake_amount_bez))
  );
  const receipt = await tx.wait();
  return { tx_hash: receipt.hash, block_number: receipt.blockNumber };
}

async function heartbeat() {
  const config = getConfig();
  const provider = getProvider();
  const signer = getSigner(provider);
  if (!signer) throw new Error('VALIDATOR_PRIVATE_KEY is required for heartbeat.');
  if (!config.contracts.validator_registry) throw new Error('ValidatorRegistry address is required.');

  const registry = new ethers.Contract(config.contracts.validator_registry, VALIDATOR_ABI, signer);
  const tx = await registry.heartbeat();
  const receipt = await tx.wait();
  return { tx_hash: receipt.hash, block_number: receipt.blockNumber };
}

module.exports = {
  getConfig,
  getStatus,
  approveStake,
  registerValidator,
  heartbeat,
};
