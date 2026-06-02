import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import contractsConfig from '../config/dao-contracts.json';

// ABIs simplificados (solo las funciones que usamos en el frontend)
const TreasuryABI = [
    'function checkRiskExposure() view returns (bool needsRebalance, uint256 currentExposure)',
    'function executeRebalance(address _targetToken, uint256 _amount)',
    'function getTotalValue() view returns (uint256)',
    'function getAssetComposition() view returns (uint256 nativeTokens, uint256 stablecoins, uint256 rwa)'
];

const HRABI = [
    'function calculateReleasableAmount(address _beneficiary) view returns (uint256)',
    'function release()',
    'function submitMilestoneProof(string memory _ipfsHash)',
    'function vestingSchedules(address) view returns (uint256 totalAmount, uint256 amountReleased, uint256 startTime, uint256 cliffDuration, uint256 vestingDuration, bool isRevoked, string memory contractType)'
];

const GovernanceABI = [
    'function createProposal(string memory _title, string memory _description, string memory _ipfsHash, bool _isOnChain, address _targetContract, bytes memory _callData) returns (uint256)',
    'function vote(uint256 _proposalId, bool _support, bool _abstain)',
    'function proposals(uint256) view returns (uint256 id, address proposer, string memory title, string memory description, string memory ipfsHash, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint256 startTime, uint256 endTime, uint256 executionTime, uint8 state, bool isOnChain, bytes memory callData, address targetContract)'
];

const AdvertisingABI = [
    'function adCards(uint256) view returns (uint256 id, address publisher, uint256 pricePerDay, uint256 totalImpressions, uint256 totalClicks, uint256 totalRevenue, address currentRenter, uint256 rentExpiry, bool isActive, string memory location, string memory dimensions)',
    'function rentAdSpace(uint256 _tokenId, uint256 _days)',
    'function getAdCardMetrics(uint256 _tokenId) view returns (uint256 impressions, uint256 clicks, uint256 revenue)'
];

const TokenABI = [
    'function balanceOf(address account) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
];

/**
 * Hook para interactuar con el TreasuryPlugin
 */
export function useTreasuryContract() {
    const { address } = useAccount();

    const { data: riskData, refetch: refetchRisk } = useReadContract({
        address: contractsConfig?.contracts?.treasury?.address,
        abi: TreasuryABI,
        functionName: 'checkRiskExposure',
        query: {
            enabled: !!contractsConfig?.contracts?.treasury?.address,
        }
    });

    const { data: totalValue } = useReadContract({
        address: contractsConfig?.contracts?.treasury?.address,
        abi: TreasuryABI,
        functionName: 'getTotalValue',
        query: {
            enabled: !!contractsConfig?.contracts?.treasury?.address,
        }
    });

    const { data: assetComposition } = useReadContract({
        address: contractsConfig?.contracts?.treasury?.address,
        abi: TreasuryABI,
        functionName: 'getAssetComposition',
        query: {
            enabled: !!contractsConfig?.contracts?.treasury?.address,
        }
    });


    const { writeContract, isPending: isRebalancing } = useWriteContract();

    const executeRebalance = (targetToken, amount) => {
        writeContract({
            address: contractsConfig?.contracts?.treasury?.address,
            abi: TreasuryABI,
            functionName: 'executeRebalance',
            args: [targetToken, amount],
        }, {
            onSuccess: () => {
                refetchRisk(); // Refrescar datos después de rebalancear
            }
        });
    };

    return {
        needsRebalance: riskData?.[0],
        currentExposure: riskData?.[1],
        totalValue,
        assetComposition,
        executeRebalance,
        isRebalancing,
    };
}

/**
 * Hook para interactuar con el HRPlugin
 */
export function useHRContract() {
    const { address } = useAccount();

    const { data: vestingSchedule } = useReadContract({
        address: contractsConfig?.contracts?.hr?.address,
        abi: HRABI,
        functionName: 'vestingSchedules',
        args: [address],
        query: {
            enabled: !!address,
        }
    });

    const { data: releasableAmount, refetch: refetchReleasable } = useContractRead({
        address: contractsConfig?.contracts?.hr?.address,
        abi: HRABI,
        functionName: 'calculateReleasableAmount',
        args: [address],
        enabled: !!address,
        watch: true,
    });

    const { write: claimVesting, isLoading: isClaiming } = useContractWrite({
        address: contractsConfig?.contracts?.hr?.address,
        abi: HRABI,
        functionName: 'release',
        onSuccess: () => {
            refetchReleasable();
        },
    });

    const { write: submitMilestone, isLoading: isSubmitting } = useContractWrite({
        address: contractsConfig?.contracts?.hr?.address,
        abi: HRABI,
        functionName: 'submitMilestoneProof',
    });

    return {
        vestingSchedule,
        releasableAmount,
        claimVesting,
        isClaiming,
        submitMilestone,
        isSubmitting,
    };
}

/**
 * Hook para interactuar con el GovernancePlugin
 */
export function useGovernanceContract() {
    const { address } = useAccount();

    const { write: createProposal, isLoading: isCreating } = useContractWrite({
        address: contractsConfig?.contracts?.governance?.address,
        abi: GovernanceABI,
        functionName: 'createProposal',
    });

    const { write: voteOnProposal, isLoading: isVoting } = useContractWrite({
        address: contractsConfig?.contracts?.governance?.address,
        abi: GovernanceABI,
        functionName: 'vote',
    });

    // Función helper para leer una propuesta específica
    const getProposal = (proposalId) => {
        return useContractRead({
            address: contractsConfig?.contracts?.governance?.address,
            abi: GovernanceABI,
            functionName: 'proposals',
            args: [proposalId],
        });
    };

    return {
        createProposal,
        isCreating,
        voteOnProposal,
        isVoting,
        getProposal,
    };
}

/**
 * Hook para interactuar con el AdvertisingPlugin
 */
export function useAdvertisingContract() {
    const { write: rentAdSpace, isLoading: isRenting } = useContractWrite({
        address: contractsConfig?.contracts?.advertising?.address,
        abi: AdvertisingABI,
        functionName: 'rentAdSpace',
    });

    const getAdCard = (tokenId) => {
        return useContractRead({
            address: contractsConfig?.contracts?.advertising?.address,
            abi: AdvertisingABI,
            functionName: 'adCards',
            args: [tokenId],
        });
    };

    const { data: metrics } = useContractRead({
        address: contractsConfig?.contracts?.advertising?.address,
        abi: AdvertisingABI,
        functionName: 'getAdCardMetrics',
    });

    return {
        rentAdSpace,
        isRenting,
        getAdCard,
        metrics,
    };
}

/**
 * Hook para interactuar con el Token de Gobernanza
 */
export function useDAOToken() {
    const { address } = useAccount();

    const { data: balance, refetch: refetchBalance } = useContractRead({
        address: contractsConfig?.contracts?.token?.address,
        abi: TokenABI,
        functionName: 'balanceOf',
        args: [address],
        enabled: !!address,
        watch: true,
    });

    const { write: approve, isLoading: isApproving } = useContractWrite({
        address: contractsConfig?.contracts?.token?.address,
        abi: TokenABI,
        functionName: 'approve',
        onSuccess: () => {
            refetchBalance();
        },
    });

    const getAllowance = (spender) => {
        return useContractRead({
            address: contractsConfig?.contracts?.token?.address,
            abi: TokenABI,
            functionName: 'allowance',
            args: [address, spender],
            enabled: !!address && !!spender,
        });
    };

    return {
        balance,
        approve,
        isApproving,
        getAllowance,
        refetchBalance,
    };
}

/**
 * Hook para obtener todas las direcciones de contratos
 */
export function useContractAddresses() {
    return {
        token: contractsConfig?.contracts?.token?.address,
        pluginManager: contractsConfig?.contracts?.pluginManager?.address,
        treasury: contractsConfig?.contracts?.treasury?.address,
        hr: contractsConfig?.contracts?.hr?.address,
        governance: contractsConfig?.contracts?.governance?.address,
        advertising: contractsConfig?.contracts?.advertising?.address,
        network: contractsConfig?.network,
        chainId: contractsConfig?.chainId,
    };
}
