/**
 * Revenue Analytics Dashboard Component
 * 
 * Displays real-time revenue statistics from the BezLiquidityRamp contract
 * Shows key metrics: volume, fees, transactions, projections
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../context/Web3Context';
import './RevenueAnalytics.css';

const BEZ_LIQUIDITY_RAMP_ABI = [
    'function getStats() view returns (uint256 totalVolumeProcessed, uint256 totalFeesCollected, uint256 totalTransactions)',
    'function platformFeeBps() view returns (uint256)',
    'function treasuryWallet() view returns (address)',
    'event PlatformFeeCollected(address indexed user, uint256 feeAmount, string serviceId)',
    'event AutoSwapExecuted(address indexed user, uint256 amountIn, uint256 bezReceived, string serviceId)'
];

const RevenueAnalytics = () => {
    const { provider } = useWeb3();

    const [stats, setStats] = useState({
        totalVolume: '0',
        totalFees: '0',
        transactions: '0',
        avgTxSize: '0',
        avgFee: '0',
        effectiveFeeRate: '0',
        projectedMonthly: '0',
        projectedYearly: '0'
    });

    const [recentFees, setRecentFees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);

    const fetchStats = useCallback(async () => {
        if (!provider) return;

        try {
            const contractAddress = import.meta.env.VITE_BEZ_LIQUIDITY_RAMP_ADDRESS;

            if (!contractAddress) {
                throw new Error('Contract address not configured');
            }

            const contract = new ethers.Contract(
                contractAddress,
                BEZ_LIQUIDITY_RAMP_ABI,
                provider
            );

            // Get on-chain stats
            const [volume, fees, txCount] = await contract.getStats();
            const feeBps = await contract.platformFeeBps();

            // Convert to readable format
            const volumeUSDC = parseFloat(ethers.formatUnits(volume, 6));
            const feesUSDC = parseFloat(ethers.formatUnits(fees, 6));
            const txCountNum = parseInt(txCount.toString());

            // Calculate derived metrics
            const avgTx = txCountNum > 0 ? volumeUSDC / txCountNum : 0;
            const avgFee = txCountNum > 0 ? feesUSDC / txCountNum : 0;
            const effectiveRate = volumeUSDC > 0 ? (feesUSDC / volumeUSDC) * 100 : 0;

            // Projections (based on last 30 days)
            const projectedMonthly = feesUSDC;
            const projectedYearly = feesUSDC * 12;

            setStats({
                totalVolume: volumeUSDC.toFixed(2),
                totalFees: feesUSDC.toFixed(2),
                transactions: txCountNum.toString(),
                avgTxSize: avgTx.toFixed(2),
                avgFee: avgFee.toFixed(4),
                effectiveFeeRate: effectiveRate.toFixed(2),
                projectedMonthly: projectedMonthly.toFixed(2),
                projectedYearly: projectedYearly.toFixed(2)
            });

            // Fetch recent fee events (last 100 blocks)
            try {
                const currentBlock = await provider.getBlockNumber();
                const fromBlock = Math.max(0, currentBlock - 10000); // Last ~5 hours on Polygon

                const feeFilter = contract.filters.PlatformFeeCollected();
                const feeEvents = await contract.queryFilter(feeFilter, fromBlock, 'latest');

                const recentFeesData = await Promise.all(
                    feeEvents.slice(-10).reverse().map(async (event) => {
                        const block = await event.getBlock();
                        return {
                            user: event.args.user,
                            amount: ethers.formatUnits(event.args.feeAmount, 6),
                            service: event.args.serviceId,
                            txHash: event.transactionHash,
                            timestamp: new Date(block.timestamp * 1000).toLocaleString()
                        };
                    })
                );

                setRecentFees(recentFeesData);
            } catch (eventError) {
                console.warn('Failed to fetch recent events:', eventError);
            }

            setLastUpdate(new Date());
            setLoading(false);
            setError(null);

        } catch (err) {
            console.error('Failed to fetch revenue stats:', err);
            setError(err.message);
            setLoading(false);
        }
    }, [provider]);

    useEffect(() => {
        fetchStats();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchStats, 30000);

        return () => clearInterval(interval);
    }, [fetchStats]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(value);
    };

    if (loading && !stats.totalVolume) {
        return (
            <div className="revenue-analytics">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading revenue data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="revenue-analytics">
                <div className="error-container">
                    <h3>⚠️ Failed to Load Data</h3>
                    <p>{error}</p>
                    <button onClick={fetchStats} className="btn-retry">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="revenue-analytics">
            <div className="analytics-header">
                <h2>Revenue Analytics</h2>
                <div className="header-actions">
                    <span className="last-update">
                        Last update: {lastUpdate?.toLocaleTimeString()}
                    </span>
                    <button onClick={fetchStats} className="btn-refresh" disabled={loading}>
                        {loading ? '⏳' : '🔄'} Refresh
                    </button>
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="metrics-grid">
                <MetricCard
                    title="Total Volume"
                    value={formatCurrency(stats.totalVolume)}
                    subtitle="USDC processed"
                    icon="💰"
                    trend={null}
                />

                <MetricCard
                    title="Total Revenue"
                    value={formatCurrency(stats.totalFees)}
                    subtitle="Platform fees collected"
                    icon="📈"
                    highlight
                />

                <MetricCard
                    title="Transactions"
                    value={stats.transactions}
                    subtitle="Swaps executed"
                    icon="🔄"
                />

                <MetricCard
                    title="Avg Transaction"
                    value={formatCurrency(stats.avgTxSize)}
                    subtitle="Per swap"
                    icon="📊"
                />

                <MetricCard
                    title="Avg Fee"
                    value={formatCurrency(stats.avgFee)}
                    subtitle="Per transaction"
                    icon="💵"
                />

                <MetricCard
                    title="Fee Rate"
                    value={`${stats.effectiveFeeRate}%`}
                    subtitle={stats.effectiveFeeRate === '0.50' ? 'Optimal ✓' : 'Check config'}
                    icon="🎯"
                />

                <MetricCard
                    title="Monthly Projection"
                    value={formatCurrency(stats.projectedMonthly)}
                    subtitle="Current month"
                    icon="📅"
                />

                <MetricCard
                    title="Yearly Projection"
                    value={formatCurrency(stats.projectedYearly)}
                    subtitle="Annualized"
                    icon="🚀"
                    highlight
                />
            </div>

            {/* Recent Fees Table */}
            {recentFees.length > 0 && (
                <div className="recent-fees">
                    <h3>Recent Fee Collections</h3>
                    <div className="fees-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>User</th>
                                    <th>Amount</th>
                                    <th>Service</th>
                                    <th>Transaction</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentFees.map((fee, idx) => (
                                    <tr key={idx}>
                                        <td>{fee.timestamp}</td>
                                        <td className="address-cell">
                                            {fee.user.slice(0, 6)}...{fee.user.slice(-4)}
                                        </td>
                                        <td className="amount-cell">
                                            ${parseFloat(fee.amount).toFixed(2)}
                                        </td>
                                        <td>{fee.service}</td>
                                        <td>
                                            <a
                                                href={`https://polygonscan.com/tx/${fee.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="tx-link"
                                            >
                                                View ↗
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Revenue Goals */}
            <div className="revenue-goals">
                <h3>Revenue Goals</h3>
                <div className="goals-grid">
                    <GoalCard
                        title="Q1 2026 Target"
                        target="$15,000"
                        current={stats.projectedMonthly}
                        period="Quarterly"
                    />
                    <GoalCard
                        title="Annual Target"
                        target="$60,000"
                        current={stats.projectedYearly}
                        period="Yearly"
                    />
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, subtitle, icon, highlight, trend }) => (
    <div className={`metric-card ${highlight ? 'highlight' : ''}`}>
        <div className="metric-icon">{icon}</div>
        <div className="metric-content">
            <h4>{title}</h4>
            <div className="metric-value">{value}</div>
            <div className="metric-subtitle">{subtitle}</div>
            {trend && <div className={`metric-trend ${trend > 0 ? 'up' : 'down'}`}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </div>}
        </div>
    </div>
);

const GoalCard = ({ title, target, current, period }) => {
    const progress = (parseFloat(current) / parseFloat(target.replace(/[$,]/g, ''))) * 100;
    const progressCapped = Math.min(progress, 100);

    return (
        <div className="goal-card">
            <h4>{title}</h4>
            <div className="goal-values">
                <span className="current">${parseFloat(current).toLocaleString()}</span>
                <span className="separator">/</span>
                <span className="target">{target}</span>
            </div>
            <div className="progress-bar">
                <div
                    className="progress-fill"
                    style={{ width: `${progressCapped}%` }}
                />
            </div>
            <div className="progress-text">
                {progressCapped.toFixed(1)}% of {period.toLowerCase()} goal
            </div>
        </div>
    );
};

export default RevenueAnalytics;
