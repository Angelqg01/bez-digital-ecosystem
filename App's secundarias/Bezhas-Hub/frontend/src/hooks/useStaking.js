/**
 * useStaking.js — Hook de Staking BEZ en Polygon Mainnet
 *
 * Permite al usuario stakear BEZ, ver sus rewards y retirar,
 * usando el contrato StakingPool.sol desplegado en Mainnet.
 *
 * Uso:
 *   const { staked, earned, stake, unstake, claim, totalStaked, apy } = useStaking();
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

// ── Addresses ─────────────────────────────────────────────────────────────────
export const BEZ_TOKEN = import.meta.env.VITE_BEZCOIN_CONTRACT_ADDRESS
    || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

export const STAKING_POOL = import.meta.env.VITE_STAKING_POOL_ADDRESS
    || '0x0000000000000000000000000000000000000000'; // Actualizar tras deploy

const POLYGON_CHAIN_ID = 137;

// ── ABIs ──────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
    {
        name: 'approve', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
        outputs: [{ name: '', type: 'bool' }]
    },
    {
        name: 'allowance', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'balanceOf', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
    },
];

const STAKING_ABI = [
    {
        name: 'stake', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: 'amount', type: 'uint256' }], outputs: []
    },
    {
        name: 'unstake', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: 'amount', type: 'uint256' }], outputs: []
    },
    {
        name: 'claimReward', type: 'function', stateMutability: 'nonpayable',
        inputs: [], outputs: []
    },
    {
        name: 'unstakeAndClaim', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: 'amount', type: 'uint256' }], outputs: []
    },
    {
        name: 'stakes', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: 'amount', type: 'uint256' }, { name: 'since', type: 'uint256' }]
    },
    {
        name: 'earned', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'totalStaked', type: 'function', stateMutability: 'view',
        inputs: [], outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'rewardRate', type: 'function', stateMutability: 'view',
        inputs: [], outputs: [{ name: '', type: 'uint256' }]
    },
];

// ── Hook Principal ────────────────────────────────────────────────────────────
export function useStaking() {
    const { address } = useAccount();
    const isDeployed = STAKING_POOL !== '0x0000000000000000000000000000000000000000';

    // ── Leer datos on-chain ───────────────────────────────────────────────────
    const { data: stakeData, refetch: refetchStake } = useReadContract({
        address: STAKING_POOL,
        abi: STAKING_ABI,
        functionName: 'stakes',
        args: [address],
        chainId: POLYGON_CHAIN_ID,
        enabled: !!address && isDeployed,
        watch: true,
    });

    const { data: earnedData, refetch: refetchEarned } = useReadContract({
        address: STAKING_POOL,
        abi: STAKING_ABI,
        functionName: 'earned',
        args: [address],
        chainId: POLYGON_CHAIN_ID,
        enabled: !!address && isDeployed,
        watch: true,
    });

    const { data: totalStakedData } = useReadContract({
        address: STAKING_POOL,
        abi: STAKING_ABI,
        functionName: 'totalStaked',
        chainId: POLYGON_CHAIN_ID,
        enabled: isDeployed,
        watch: true,
    });

    const { data: rewardRateData } = useReadContract({
        address: STAKING_POOL,
        abi: STAKING_ABI,
        functionName: 'rewardRate',
        chainId: POLYGON_CHAIN_ID,
        enabled: isDeployed,
    });

    const { data: bezBalance } = useReadContract({
        address: BEZ_TOKEN,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
        chainId: POLYGON_CHAIN_ID,
        enabled: !!address,
        watch: true,
    });

    // ── Valores calculados ────────────────────────────────────────────────────
    const staked = stakeData ? formatEther(stakeData[0]) : '0';
    const since = stakeData ? Number(stakeData[1]) : 0;
    const earned = earnedData ? formatEther(earnedData) : '0';
    const totalStaked = totalStakedData ? formatEther(totalStakedData) : '0';
    const balance = bezBalance ? formatEther(bezBalance) : '0';

    // APY aproximado: (rewardRate tokens/seg × 31536000 seg/año) / totalStaked × 100
    const apy = (() => {
        if (!rewardRateData || !totalStakedData || totalStakedData === 0n) return 0;
        const annualRewards = Number(formatEther(rewardRateData)) * 31_536_000;
        const tvl = Number(formatEther(totalStakedData));
        return tvl > 0 ? ((annualRewards / tvl) * 100).toFixed(2) : 0;
    })();

    // ── Writes ────────────────────────────────────────────────────────────────
    const { writeContract: write, data: txHash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash: txHash,
        onSuccess: () => {
            refetchStake();
            refetchEarned();
        },
    });

    const { writeContract: writeApprove, data: approveTxHash, isPending: isApprovePending } = useWriteContract();
    const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
        hash: approveTxHash,
        onSuccess: () => toast.success('✅ BEZ aprobado para staking'),
    });

    // ── Funciones públicas ────────────────────────────────────────────────────
    const approveBEZ = useCallback((amount) => {
        if (!isDeployed) { toast.error('Staking contract no desplegado aún'); return; }
        writeApprove({
            address: BEZ_TOKEN,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [STAKING_POOL, parseEther(amount.toString())],
            chainId: POLYGON_CHAIN_ID,
        });
    }, [writeApprove, isDeployed]);

    const stake = useCallback((amount) => {
        if (!isDeployed) { toast.error('Staking contract no desplegado aún'); return; }
        write({
            address: STAKING_POOL,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [parseEther(amount.toString())],
            chainId: POLYGON_CHAIN_ID,
        });
    }, [write, isDeployed]);

    const unstake = useCallback((amount) => {
        write({
            address: STAKING_POOL,
            abi: STAKING_ABI,
            functionName: 'unstake',
            args: [parseEther(amount.toString())],
            chainId: POLYGON_CHAIN_ID,
        });
    }, [write]);

    const claim = useCallback(() => {
        write({
            address: STAKING_POOL,
            abi: STAKING_ABI,
            functionName: 'claimReward',
            args: [],
            chainId: POLYGON_CHAIN_ID,
        });
    }, [write]);

    const unstakeAndClaim = useCallback((amount) => {
        write({
            address: STAKING_POOL,
            abi: STAKING_ABI,
            functionName: 'unstakeAndClaim',
            args: [parseEther(amount.toString())],
            chainId: POLYGON_CHAIN_ID,
        });
    }, [write]);

    return {
        // Estado
        staked,
        earned,
        totalStaked,
        balance,
        apy,
        since: since ? new Date(since * 1000) : null,
        isDeployed,

        // Loading
        isLoading: isPending || isConfirming || isApprovePending || isApproveConfirming,

        // Acciones
        approveBEZ,
        stake,
        unstake,
        claim,
        unstakeAndClaim,

        // Hash de la última tx
        txHash,
    };
}
