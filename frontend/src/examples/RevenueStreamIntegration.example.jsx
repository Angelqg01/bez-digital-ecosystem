/**
 * Revenue Stream Native - Integration Example
 * 
 * This file shows how to integrate the SwapWithAI component
 * into different parts of the BeZhas platform.
 */

import React from 'react';
import SwapWithAI from '../components/payments/SwapWithAI';
import http from '../services/http';

// ============================================================================
// Example 1: Simple Integration - Liquidity Ramp Page
// ============================================================================

export function LiquidityRampPage() {
    const handleSuccess = (data) => {
        console.log('✅ Swap completed!', data);

        // Show success notification
        toast.success(`Successfully swapped ${data.amountUSDC} USDC for BEZ!`);

        // Update user balance
        refreshWalletBalance();

        // Track analytics
        trackEvent('swap_completed', {
            amount: data.amountUSDC,
            fee: data.feeAmount,
            txHash: data.txHash
        });
    };

    const handleError = (error) => {
        console.error('❌ Swap failed:', error);

        // Show error notification
        toast.error(error.message || 'Swap failed. Please try again.');

        // Track error
        trackEvent('swap_failed', {
            error: error.message
        });
    };

    return (
        <div className="liquidity-ramp-page">
            <h1>Buy BEZ Tokens</h1>
            <p>Convert USDC to BEZ with AI-powered security</p>

            <SwapWithAI
                serviceId="LIQUIDITY_RAMP"
                onSuccess={handleSuccess}
                onError={handleError}
            />

            <div className="info-section">
                <h3>How it works:</h3>
                <ul>
                    <li>Enter the amount of USDC you want to swap</li>
                    <li>Our AI evaluates the transaction for security</li>
                    <li>If approved, confirm the swap in MetaMask</li>
                    <li>Receive BEZ tokens instantly</li>
                </ul>

                <p className="fee-notice">
                    Platform fee: 0.5% (used to fund platform development)
                </p>
            </div>
        </div>
    );
}

// ============================================================================
// Example 2: NFT Purchase with Revenue Stream
// ============================================================================

export function NFTPurchasePage({ nftId, nftPrice }) {
    const handleNFTPurchaseSuccess = async (data) => {
        console.log('NFT purchase swap completed', data);

        try {
            // Call backend to mint NFT
            const response = await http.post('/api/nft/mint', {
                nftId,
                txHash: data.txHash,
                amountPaid: data.netAmount  // Net amount after platform fee
            });

            if (response.status === 200 || response.status === 201) {
                const { tokenId } = response.data;
                toast.success(`NFT #${tokenId} purchased successfully!`);

                // Redirect to NFT details
                navigate(`/nft/${tokenId}`);
            }
        } catch (error) {
            console.error('NFT minting failed:', error);
            toast.error('Payment received but NFT minting failed. Contact support.');
        }
    };

    return (
        <div className="nft-purchase-page">
            <div className="nft-preview">
                <img src={`/api/nft/${nftId}/image`} alt="NFT" />
                <h2>NFT #{nftId}</h2>
                <p className="price">{nftPrice} USDC</p>
            </div>

            <SwapWithAI
                serviceId="NFT_PURCHASE"
                onSuccess={handleNFTPurchaseSuccess}
                onError={(error) => toast.error(error.message)}
            />
        </div>
    );
}

// ============================================================================
// Example 3: Premium Subscription with Revenue Stream
// ============================================================================

export function PremiumSubscriptionPage({ plan }) {
    const handleSubscriptionSuccess = async (data) => {
        console.log('Subscription payment completed', data);

        try {
            // Activate premium subscription
            const response = await http.post('/api/user/subscribe', {
                plan: plan.id,
                txHash: data.txHash,
                amountPaid: data.netAmount
            });

            if (response.status === 200 || response.status === 201) {
                toast.success(`${plan.name} activated! Enjoy your benefits.`);

                // Reload user profile
                window.location.href = '/profile';
            }
        } catch (error) {
            console.error('Subscription activation failed:', error);
            toast.error('Payment received but activation failed. Contact support.');
        }
    };

    return (
        <div className="subscription-page">
            <div className="plan-details">
                <h2>{plan.name}</h2>
                <p>{plan.description}</p>
                <ul>
                    {plan.features.map((feature, idx) => (
                        <li key={idx}>✓ {feature}</li>
                    ))}
                </ul>
                <p className="price">{plan.priceUSDC} USDC/month</p>
            </div>

            <SwapWithAI
                serviceId="PREMIUM_SUBSCRIPTION"
                onSuccess={handleSubscriptionSuccess}
                onError={(error) => toast.error(error.message)}
            />
        </div>
    );
}

// ============================================================================
// Example 4: Modal Integration (Buy BEZ from anywhere)
// ============================================================================

export function BuyBezModal({ isOpen, onClose }) {
    const [swapCompleted, setSwapCompleted] = useState(false);

    const handleSuccess = (data) => {
        setSwapCompleted(true);

        // Auto-close after 3 seconds
        setTimeout(() => {
            onClose();
            setSwapCompleted(false);
        }, 3000);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>

                {!swapCompleted ? (
                    <>
                        <h2>Buy BEZ Tokens</h2>
                        <SwapWithAI
                            serviceId="LIQUIDITY_RAMP"
                            onSuccess={handleSuccess}
                            onError={(error) => toast.error(error.message)}
                        />
                    </>
                ) : (
                    <div className="success-message">
                        <div className="success-icon">✓</div>
                        <h3>Swap Completed!</h3>
                        <p>Your BEZ tokens have been received.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Usage:
// <BuyBezModal isOpen={showModal} onClose={() => setShowModal(false)} />

// ============================================================================
// Example 5: Dashboard with Revenue Stats (Admin)
// ============================================================================

export function AdminRevenueDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchRevenueStats() {
            try {
                // Get stats from smart contract
                const contract = new ethers.Contract(
                    import.meta.env.VITE_BEZ_LIQUIDITY_RAMP_ADDRESS,
                    ['function getStats() view returns (uint256, uint256, uint256)'],
                    provider
                );

                const [volume, fees, txCount] = await contract.getStats();

                setStats({
                    totalVolume: ethers.formatUnits(volume, 6),
                    totalFees: ethers.formatUnits(fees, 6),
                    transactions: txCount.toString(),
                    avgTxSize: parseFloat(ethers.formatUnits(volume, 6)) / parseInt(txCount),
                    avgFee: parseFloat(ethers.formatUnits(fees, 6)) / parseInt(txCount),
                    effectiveFeeRate: (parseFloat(ethers.formatUnits(fees, 6)) / parseFloat(ethers.formatUnits(volume, 6))) * 100,
                    projectedMonthly: parseFloat(ethers.formatUnits(fees, 6)),
                    projectedYearly: parseFloat(ethers.formatUnits(fees, 6)) * 12
                });

                setLoading(false);
            } catch (error) {
                console.error('Failed to fetch revenue stats:', error);
                setLoading(false);
            }
        }

        fetchRevenueStats();

        // Refresh every 30 seconds
        const interval = setInterval(fetchRevenueStats, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return <div className="loading">Loading revenue stats...</div>;
    }

    return (
        <div className="revenue-dashboard">
            <h1>Revenue Analytics</h1>

            <div className="stats-grid">
                <StatCard
                    title="Total Volume Processed"
                    value={`$${parseFloat(stats.totalVolume).toLocaleString()}`}
                    subtitle="USDC"
                    icon="💰"
                />

                <StatCard
                    title="Total Fees Collected"
                    value={`$${parseFloat(stats.totalFees).toLocaleString()}`}
                    subtitle="Platform Revenue"
                    icon="📈"
                    highlight
                />

                <StatCard
                    title="Total Transactions"
                    value={stats.transactions}
                    subtitle="Swaps Executed"
                    icon="🔄"
                />

                <StatCard
                    title="Avg Transaction Size"
                    value={`$${stats.avgTxSize.toFixed(2)}`}
                    subtitle="USDC per swap"
                    icon="📊"
                />

                <StatCard
                    title="Avg Fee per Tx"
                    value={`$${stats.avgFee.toFixed(2)}`}
                    subtitle="Revenue per swap"
                    icon="💵"
                />

                <StatCard
                    title="Effective Fee Rate"
                    value={`${stats.effectiveFeeRate.toFixed(2)}%`}
                    subtitle="Should be 0.5%"
                    icon="🎯"
                />

                <StatCard
                    title="Monthly Projection"
                    value={`$${parseFloat(stats.projectedMonthly).toLocaleString()}`}
                    subtitle="Based on current month"
                    icon="📅"
                />

                <StatCard
                    title="Yearly Projection"
                    value={`$${parseFloat(stats.projectedYearly).toLocaleString()}`}
                    subtitle="Annualized revenue"
                    icon="🚀"
                    highlight
                />
            </div>

            <div className="charts-section">
                <h2>Revenue Trends</h2>
                {/* Add charts here (recharts, chart.js, etc.) */}
                <RevenueChart stats={stats} />
            </div>
        </div>
    );
}

function StatCard({ title, value, subtitle, icon, highlight }) {
    return (
        <div className={`stat-card ${highlight ? 'highlight' : ''}`}>
            <div className="stat-icon">{icon}</div>
            <div className="stat-content">
                <h3>{title}</h3>
                <div className="stat-value">{value}</div>
                <div className="stat-subtitle">{subtitle}</div>
            </div>
        </div>
    );
}

// ============================================================================
// Example 6: Backend Webhook Handler (Service Delivery)
// ============================================================================

/**
 * Backend endpoint to handle successful swaps
 * 
 * This endpoint listens to blockchain events or receives webhooks
 * when a swap is completed, then delivers the service to the user.
 */

// Express.js backend example
app.post('/api/webhooks/swap-completed', async (req, res) => {
    const { txHash, userAddress, serviceId, amountUSDC, feeAmount, netAmount } = req.body;

    try {
        // Verify transaction on-chain
        const tx = await provider.getTransactionReceipt(txHash);
        if (!tx || tx.status !== 1) {
            return res.status(400).json({ error: 'Transaction not found or failed' });
        }

        // Verify it's a swap from our contract
        const liquidityRampAddress = process.env.BEZ_LIQUIDITY_RAMP_ADDRESS.toLowerCase();
        if (tx.to.toLowerCase() !== liquidityRampAddress) {
            return res.status(400).json({ error: 'Invalid contract address' });
        }

        // Parse event logs to verify AutoSwapExecuted event
        const iface = new ethers.Interface([
            'event AutoSwapExecuted(address indexed user, uint256 amountIn, uint256 bezReceived, string serviceId)'
        ]);

        let swapEvent = null;
        for (const log of tx.logs) {
            try {
                const parsed = iface.parseLog(log);
                if (parsed.name === 'AutoSwapExecuted') {
                    swapEvent = parsed;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!swapEvent) {
            return res.status(400).json({ error: 'AutoSwapExecuted event not found' });
        }

        // Verify user address matches
        if (swapEvent.args.user.toLowerCase() !== userAddress.toLowerCase()) {
            return res.status(400).json({ error: 'User address mismatch' });
        }

        // Deliver service based on serviceId
        switch (serviceId) {
            case 'LIQUIDITY_RAMP':
                // Just a swap, no additional service delivery
                console.log(`Swap completed for ${userAddress}`);
                break;

            case 'NFT_PURCHASE':
                // Mint NFT to user
                await mintNFT(userAddress, req.body.nftId);
                console.log(`NFT minted for ${userAddress}`);
                break;

            case 'PREMIUM_SUBSCRIPTION':
                // Activate premium subscription
                await activatePremium(userAddress, req.body.plan);
                console.log(`Premium activated for ${userAddress}`);
                break;

            default:
                console.warn(`Unknown service ID: ${serviceId}`);
        }

        // Record revenue in database
        await db.revenue.create({
            txHash,
            userAddress,
            serviceId,
            amountUSDC,
            feeAmount,
            netAmount,
            timestamp: new Date()
        });

        // Send notification to user
        await sendEmail(userAddress, {
            subject: 'Payment Confirmed',
            body: `Your payment of ${amountUSDC} USDC has been confirmed. Transaction: ${txHash}`
        });

        // Send alert to Discord (high-value transactions)
        if (amountUSDC >= 1000) {
            await sendDiscordAlert({
                title: '💰 High-Value Transaction',
                description: `User: ${userAddress}\nAmount: ${amountUSDC} USDC\nFee: ${feeAmount} USDC\nService: ${serviceId}`,
                color: 0x00ff00
            });
        }

        res.json({ success: true, message: 'Service delivered' });

    } catch (error) {
        console.error('Webhook processing failed:', error);
        res.status(500).json({ error: 'Failed to process webhook' });
    }
});

// ============================================================================
// Example 7: Real-Time Event Listener (Backend)
// ============================================================================

/**
 * Listen to blockchain events in real-time
 * 
 * This script runs continuously in the background,
 * listening for AutoSwapExecuted events and triggering service delivery.
 */

async function startEventListener() {
    const contract = new ethers.Contract(
        process.env.BEZ_LIQUIDITY_RAMP_ADDRESS,
        [
            'event AutoSwapExecuted(address indexed user, uint256 amountIn, uint256 bezReceived, string serviceId)',
            'event PlatformFeeCollected(address indexed user, uint256 feeAmount, string serviceId)'
        ],
        provider
    );

    console.log('🎧 Listening for swap events...');

    // Listen to AutoSwapExecuted
    contract.on('AutoSwapExecuted', async (user, amountIn, bezReceived, serviceId, event) => {
        console.log(`✅ Swap executed by ${user}`);
        console.log(`   Amount: ${ethers.formatUnits(amountIn, 6)} USDC`);
        console.log(`   BEZ Received: ${ethers.formatEther(bezReceived)} BEZ`);
        console.log(`   Service: ${serviceId}`);
        console.log(`   Tx: ${event.log.transactionHash}`);

        // Deliver service
        await deliverService(user, serviceId, event.log.transactionHash);
    });

    // Listen to PlatformFeeCollected (revenue tracking)
    contract.on('PlatformFeeCollected', async (user, feeAmount, serviceId, event) => {
        const feeUSDC = parseFloat(ethers.formatUnits(feeAmount, 6));

        console.log(`💰 Fee collected: $${feeUSDC} from ${user}`);

        // Send to Discord
        await sendDiscordAlert({
            title: 'Platform Revenue',
            description: `Fee: $${feeUSDC}\nUser: ${user}\nService: ${serviceId}`,
            color: 0x00ff00
        });

        // Update revenue database
        await db.revenue.increment({
            where: { date: new Date().toISOString().split('T')[0] },
            by: { totalFees: feeAmount }
        });
    });

    // Reconnect on error
    provider.on('error', (error) => {
        console.error('Provider error:', error);
        setTimeout(() => {
            console.log('Reconnecting...');
            startEventListener();
        }, 5000);
    });
}

// Start listener
if (require.main === module) {
    startEventListener().catch(console.error);
}

// ============================================================================
// Summary
// ============================================================================

/**
 * This integration example shows:
 * 
 * 1. Simple page integration (LiquidityRampPage)
 * 2. NFT purchase with revenue stream
 * 3. Subscription payment with revenue stream
 * 4. Modal integration for "Buy BEZ" anywhere
 * 5. Admin dashboard with revenue analytics
 * 6. Backend webhook handler for service delivery
 * 7. Real-time event listener for automation
 * 
 * Key Takeaways:
 * - SwapWithAI component is highly reusable
 * - Just provide serviceId, onSuccess, onError
 * - Backend receives webhook → delivers service
 * - Real-time events enable instant fulfillment
 * - Revenue tracking is automatic and transparent
 * 
 * The system is production-ready and can be extended
 * to any service that requires payment in USDC.
 */
