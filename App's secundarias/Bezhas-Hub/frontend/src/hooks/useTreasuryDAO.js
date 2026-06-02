// hooks/useTreasuryDAO.js
// Hook para interactuar con el sistema Treasury DAO y LP Rewards
// Integración con QuickSwap LP Pool y Real Yield

import { useState, useCallback, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';

// Direcciones oficiales
const TREASURY_DAO_ADDRESS = '0x89c23890c742d710265dd61be789c71dc8999b12';
const LP_POOL_QUICKSWAP = '0x4edc77de01f2a2c87611c2f8e9249be43df745a9';
const BEZ_COIN_ADDRESS = import.meta.env.VITE_BEZ_COIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

// ABI simplificado para LP Token
const LP_TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

// ABI simplificado para ERC20
const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];

// Configuración QuickSwap
const QUICKSWAP_CONFIG = {
    name: 'QuickSwap V2',
    chainId: 137,
    addLiquidityUrl: `https://quickswap.exchange/#/add/v2/${BEZ_COIN_ADDRESS}/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`, // USDC
    removeLiquidityUrl: `https://quickswap.exchange/#/remove/v2/${BEZ_COIN_ADDRESS}/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`,
    poolUrl: `https://info.quickswap.exchange/#/pair/${LP_POOL_QUICKSWAP}`,
    dexScreenerUrl: `https://dexscreener.com/polygon/${LP_POOL_QUICKSWAP}`
};

export const useTreasuryDAO = () => {
    const { address, isConnected } = useAccount();
    const [loading, setLoading] = useState(false);

    const [treasuryStats, setTreasuryStats] = useState({
        balance: '0',
        balance24hChange: '0',
        totalDistributed: '0',
        lpRewardsPool: '0'
    });

    const [lpStats, setLpStats] = useState({
        totalLiquidity: '0',
        bezReserve: '0',
        usdcReserve: '0',
        userLpBalance: '0',
        userLpShare: '0',
        estimatedApy: '0'
    });

    const [realYieldStats, setRealYieldStats] = useState({
        totalFeesCollected: '0',
        treasuryShare: '0',
        lpShare: '0',
        lpMultiplier: 0.3, // x0.3
        effectiveApy: '0'
    });

    // Cargar estadísticas del Treasury
    const loadTreasuryStats = useCallback(async () => {
        if (!window.ethereum) return;

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const bezCoin = new ethers.Contract(BEZ_COIN_ADDRESS, ERC20_ABI, provider);

            const balance = await bezCoin.balanceOf(TREASURY_DAO_ADDRESS);

            setTreasuryStats(prev => ({
                ...prev,
                balance: ethers.formatEther(balance),
                // Los demás valores vendrían de un indexer o API
            }));
        } catch (error) {
            console.error('Error loading treasury stats:', error);
        }
    }, []);

    // Cargar estadísticas del LP Pool
    const loadLpStats = useCallback(async () => {
        if (!window.ethereum) return;

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const lpToken = new ethers.Contract(LP_POOL_QUICKSWAP, LP_TOKEN_ABI, provider);

            const [totalSupply, reserves, token0, token1] = await Promise.all([
                lpToken.totalSupply(),
                lpToken.getReserves(),
                lpToken.token0(),
                lpToken.token1()
            ]);

            // Determinar cuál reserve es BEZ y cuál es USDC
            const isBezToken0 = token0.toLowerCase() === BEZ_COIN_ADDRESS.toLowerCase();
            const bezReserve = isBezToken0 ? reserves.reserve0 : reserves.reserve1;
            const usdcReserve = isBezToken0 ? reserves.reserve1 : reserves.reserve0;

            let userLpBalance = '0';
            let userLpShare = '0';

            if (isConnected && address) {
                const balance = await lpToken.balanceOf(address);
                userLpBalance = ethers.formatEther(balance);
                userLpShare = totalSupply > 0
                    ? ((Number(balance) / Number(totalSupply)) * 100).toFixed(4)
                    : '0';
            }

            // Calcular liquidez total en USD (asumiendo USDC tiene 6 decimales)
            const usdcValue = Number(ethers.formatUnits(usdcReserve, 6));
            const totalLiquidity = usdcValue * 2; // Liquidez total = 2x el valor de un lado

            setLpStats({
                totalLiquidity: totalLiquidity.toLocaleString('en-US', { maximumFractionDigits: 2 }),
                bezReserve: ethers.formatEther(bezReserve),
                usdcReserve: ethers.formatUnits(usdcReserve, 6),
                userLpBalance,
                userLpShare,
                estimatedApy: '18.5' // Esto vendría de la API de QuickSwap o cálculo
            });
        } catch (error) {
            console.error('Error loading LP stats:', error);
        }
    }, [isConnected, address]);

    // Calcular Real Yield estimado
    const calculateRealYield = useCallback(async () => {
        // Simular cálculo de Real Yield basado en:
        // - Fees de transacciones (1.4% en ventas)
        // - Split: 70% Treasury, 30% LP Rewards
        // - Multiplicador LP: x0.3

        const dailyVolume = 50000; // Simulado - vendría de API
        const feeRate = 0.014; // 1.4%
        const dailyFees = dailyVolume * feeRate;
        const treasuryShare = dailyFees * 0.7;
        const lpShare = dailyFees * 0.3;

        // APY estimado para LPs
        const lpTvl = parseFloat(lpStats.totalLiquidity.replace(/,/g, '')) || 1;
        const annualLpRewards = lpShare * 365;
        const baseApy = (annualLpRewards / lpTvl) * 100;
        const effectiveApy = baseApy * 1.3; // Con multiplicador x0.3

        setRealYieldStats({
            totalFeesCollected: dailyFees.toFixed(2),
            treasuryShare: treasuryShare.toFixed(2),
            lpShare: lpShare.toFixed(2),
            lpMultiplier: 0.3,
            effectiveApy: effectiveApy.toFixed(2)
        });
    }, [lpStats.totalLiquidity]);

    // Obtener precio BEZ actual
    const getBezPrice = useCallback(async () => {
        if (!window.ethereum) return 0;

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const lpToken = new ethers.Contract(LP_POOL_QUICKSWAP, LP_TOKEN_ABI, provider);

            const [reserves, token0] = await Promise.all([
                lpToken.getReserves(),
                lpToken.token0()
            ]);

            const isBezToken0 = token0.toLowerCase() === BEZ_COIN_ADDRESS.toLowerCase();
            const bezReserve = isBezToken0 ? reserves.reserve0 : reserves.reserve1;
            const usdcReserve = isBezToken0 ? reserves.reserve1 : reserves.reserve0;

            // Precio = USDC Reserve / BEZ Reserve
            const bezReserveFormatted = Number(ethers.formatEther(bezReserve));
            const usdcReserveFormatted = Number(ethers.formatUnits(usdcReserve, 6));

            if (bezReserveFormatted === 0) return 0;
            return usdcReserveFormatted / bezReserveFormatted;
        } catch (error) {
            console.error('Error getting BEZ price:', error);
            return 0;
        }
    }, []);

    // Calcular ROI para cantidad de tokens
    const calculateRoi = useCallback((tokenAmount, stakingDays, vipTier = 'starter') => {
        const vipMultipliers = {
            starter: 1.0,
            creator: 1.5,
            business: 2.0,
            enterprise: 2.5
        };

        const baseApy = parseFloat(realYieldStats.effectiveApy) || 18.5;
        const multiplier = vipMultipliers[vipTier] || 1.0;
        const effectiveApy = baseApy * multiplier;

        const dailyRate = effectiveApy / 365 / 100;
        const returns = tokenAmount * (Math.pow(1 + dailyRate, stakingDays) - 1);

        return {
            initialAmount: tokenAmount,
            stakingDays,
            vipTier,
            vipMultiplier: multiplier,
            baseApy,
            effectiveApy,
            estimatedReturns: returns.toFixed(4),
            totalValue: (tokenAmount + returns).toFixed(4)
        };
    }, [realYieldStats.effectiveApy]);

    // Cargar todos los datos
    const refreshAll = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadTreasuryStats(),
                loadLpStats()
            ]);
            await calculateRealYield();
        } finally {
            setLoading(false);
        }
    }, [loadTreasuryStats, loadLpStats, calculateRealYield]);

    // Efecto inicial
    useEffect(() => {
        refreshAll();

        // Actualizar cada 30 segundos
        const interval = setInterval(refreshAll, 30000);
        return () => clearInterval(interval);
    }, [refreshAll]);

    return {
        // Estado
        loading,
        isConnected,

        // Estadísticas
        treasuryStats,
        lpStats,
        realYieldStats,

        // Direcciones
        addresses: {
            treasury: TREASURY_DAO_ADDRESS,
            lpPool: LP_POOL_QUICKSWAP,
            bezCoin: BEZ_COIN_ADDRESS
        },

        // QuickSwap Config
        quickswapConfig: QUICKSWAP_CONFIG,

        // Utilidades
        getBezPrice,
        calculateRoi,

        // Refresh
        refreshAll
    };
};

export default useTreasuryDAO;
