import { BrowserProvider, Contract, id, parseEther, type InterfaceAbi } from 'ethers';
import { apiFetch } from './api';

type EthereumProvider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export type ContractName =
    | 'BEZCoinV2'
    | 'StakingPool'
    | 'LiquidityFarming'
    | 'GovernanceSystem'
    | 'BeZhasPayment'
    | 'BeZhasDEX';

export type ContractInfo = {
    name: string;
    address: string;
    chain_id: number;
    abi?: InterfaceAbi;
};

const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
];

const FALLBACK_ABIS: Record<string, string[]> = {
    BEZCoinV2: ERC20_ABI,
    StakingPool: [
        'function stake(uint256 amount)',
        'function withdraw(uint256 amount)',
        'function getReward()',
        'function getStakerInfo(address account) view returns (uint256 stakedAmount,uint256 baseEarned,uint256 boostedEarned,uint256 boostBps,uint8 validatorTier,bool isValidator)',
    ],
    LiquidityFarming: [
        'function deposit(uint256 pid,uint256 amount,uint256 lockDays)',
        'function withdraw(uint256 pid,uint256 amount)',
        'function claim(uint256 pid)',
        'function userInfo(uint256 pid,address user) view returns (uint128 amount,uint128 rewardDebt,uint64 lockEndTimestamp,uint64 multiplier)',
        'function pendingBez(uint256 pid,address user) view returns (uint256)',
        'function poolInfo(uint256 pid) view returns (address lpToken,uint128 allocPoint,uint64 lastRewardBlock,uint64 isLP,uint256 accBezPerShare)',
    ],
    BeZhasPayment: [
        'function processPayment(address recipient,uint256 amount,bytes32 orderId,string memo)',
        'function calculateFee(uint256 amount) view returns (uint256 fee,uint256 netAmount)',
    ],
    GovernanceSystem: [
        'function castVote(uint256 proposalId,uint8 support) returns (uint256)',
        'function propose(address[] targets,uint256[] values,bytes[] calldatas,string description) returns (uint256)',
        'function queue(address[] targets,uint256[] values,bytes[] calldatas,bytes32 descriptionHash) returns (uint256)',
        'function execute(address[] targets,uint256[] values,bytes[] calldatas,bytes32 descriptionHash) payable returns (uint256)',
        'function hashProposal(address[] targets,uint256[] values,bytes[] calldatas,bytes32 descriptionHash) view returns (uint256)',
        'function state(uint256 proposalId) view returns (uint8)',
    ],
    BeZhasDEX: [
        'function createPool(address tokenA,address tokenB) returns (bytes32)',
        'function addLiquidity(address tokenA,address tokenB,uint256 amountA,uint256 amountB,uint256 minLiquidity) returns (uint256)',
        'function swap(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut) returns (uint256)',
        'function quoteSwap(address tokenIn,address tokenOut,uint256 amountIn) view returns (uint256)',
        'function getPool(address tokenA,address tokenB) view returns (tuple(address token0,address token1,uint112 reserve0,uint112 reserve1,uint32 lastBlockTimestamp,uint256 totalLiquidity,bool exists))',
    ],
};

function ethereum(): EthereumProvider {
    const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!eth) throw new Error('Wallet provider not found');
    return eth;
}

export async function getBrowserSigner() {
    const provider = new BrowserProvider(ethereum());
    await provider.send('eth_requestAccounts', []);
    return provider.getSigner();
}

export async function getContractInfo(name: ContractName, includeAbi = true): Promise<ContractInfo> {
    const chainId = process.env.NEXT_PUBLIC_BEZHAS_CHAIN_ID || '31337';
    const qs = includeAbi ? `?chainId=${chainId}&includeAbi=true` : `?chainId=${chainId}`;
    const data = await apiFetch<{ contract: ContractInfo }>(`/api/contracts/${name}${qs}`);
    return data.contract;
}

export async function getWriteContract(name: ContractName) {
    const [info, signer] = await Promise.all([getContractInfo(name), getBrowserSigner()]);
    const abi = Array.isArray(info.abi) && info.abi.length > 0 ? info.abi : FALLBACK_ABIS[name];
    return new Contract(info.address, abi, signer);
}

export async function approveIfNeeded(tokenName: ContractName, spender: string, owner: string, amount: string) {
    const tokenInfo = await getContractInfo(tokenName);
    const signer = await getBrowserSigner();
    const abi = Array.isArray(tokenInfo.abi) && tokenInfo.abi.length > 0 ? tokenInfo.abi : ERC20_ABI;
    const token = new Contract(tokenInfo.address, abi, signer);
    const value = parseEther(amount);
    const allowance = await token.allowance(owner, spender);
    if (allowance >= value) return null;
    const tx = await token.approve(spender, value);
    return tx.wait();
}

export async function stakeBEZOnChain(amount: string) {
    const signer = await getBrowserSigner();
    const owner = await signer.getAddress();
    const stakingInfo = await getContractInfo('StakingPool', false);
    await approveIfNeeded('BEZCoinV2', stakingInfo.address, owner, amount);
    const staking = await getWriteContract('StakingPool');
    const tx = await staking.stake(parseEther(amount));
    return tx.wait();
}

export async function unstakeBEZOnChain(amount: string) {
    const staking = await getWriteContract('StakingPool');
    const tx = await staking.withdraw(parseEther(amount));
    return tx.wait();
}

export async function farmDepositOnChain(poolId: string, amount: string, lockDays = 0) {
    const signer = await getBrowserSigner();
    const owner = await signer.getAddress();
    const farmingInfo = await getContractInfo('LiquidityFarming', false);
    const farming = await getWriteContract('LiquidityFarming');
    const lpToken = (await farming.poolInfo(BigInt(poolId)))[0] as string;
    const token = new Contract(lpToken, ERC20_ABI, signer);
    const value = parseEther(amount);
    const allowance = await token.allowance(owner, farmingInfo.address);
    if (allowance < value) await (await token.approve(farmingInfo.address, value)).wait();
    const tx = await farming.deposit(BigInt(poolId), parseEther(amount), lockDays);
    return tx.wait();
}

export async function swapOnChain(tokenIn: string, tokenOut: string, amountIn: string, minAmountOut: string) {
    const signer = await getBrowserSigner();
    const owner = await signer.getAddress();
    const dexInfo = await getContractInfo('BeZhasDEX', false);
    const token = new Contract(tokenIn, ERC20_ABI, signer);
    const value = parseEther(amountIn);
    const allowance = await token.allowance(owner, dexInfo.address);
    if (allowance < value) await (await token.approve(dexInfo.address, value)).wait();
    const dex = await getWriteContract('BeZhasDEX');
    const tx = await dex.swap(tokenIn, tokenOut, value, parseEther(minAmountOut || '0'));
    return tx.wait();
}

export type ProposalTxInput = {
    target: string;
    value?: string;
    calldata?: string;
    description: string;
};

function proposalArgs(input: ProposalTxInput): [string[], bigint[], string[], string] {
    return [
        [input.target],
        [parseEther(input.value || '0')],
        [input.calldata || '0x'],
        input.description,
    ];
}

export async function createProposalOnChain(input: ProposalTxInput) {
    const governance = await getWriteContract('GovernanceSystem');
    const [targets, values, calldatas, description] = proposalArgs(input);
    const tx = await governance.propose(targets, values, calldatas, description);
    return tx.wait();
}

export async function voteProposalOnChain(proposalId: string, vote: 'for' | 'against' | 'abstain') {
    const support = vote === 'for' ? 1 : vote === 'against' ? 0 : 2;
    const governance = await getWriteContract('GovernanceSystem');
    const tx = await governance.castVote(BigInt(proposalId), support);
    return tx.wait();
}

export async function queueProposalOnChain(input: ProposalTxInput) {
    const governance = await getWriteContract('GovernanceSystem');
    const [targets, values, calldatas, description] = proposalArgs(input);
    const tx = await governance.queue(targets, values, calldatas, id(description));
    return tx.wait();
}

export async function executeProposalOnChain(input: ProposalTxInput) {
    const governance = await getWriteContract('GovernanceSystem');
    const [targets, values, calldatas, description] = proposalArgs(input);
    const tx = await governance.execute(targets, values, calldatas, id(description), {
        value: values[0],
    });
    return tx.wait();
}
