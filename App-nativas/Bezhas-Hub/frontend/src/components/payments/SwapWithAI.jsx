import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
    gatherUserTelemetry,
    requestSwapSignature,
    calculateNetAmount,
    checkAddressSanctions
} from '../../services/aiRiskEngine';
import { useWeb3 } from '../../context/Web3Context';
import './SwapWithAI.css';

/**
 * SwapWithAI Component - Revenue Stream Native
 * 
 * Implements AI-powered swap flow with signature-based authorization:
 * 1. User enters USDC amount
 * 2. System gathers telemetry (on-chain + browser data)
 * 3. AI Risk Engine evaluates transaction (backend)
 * 4. If approved: Returns cryptographic signature
 * 5. User signs transaction with MetaMask
 * 6. Smart contract validates signature + collects fee + executes swap
 * 
 * Revenue Model: 0.5% platform fee → treasury wallet
 * Gas Optimized: No whitelist storage (signature validation only)
 */
const SwapWithAI = ({ serviceId, onSuccess, onError }) => {
    const { address, provider, isConnected } = useWeb3();

    // Form state
    const [amountUSDC, setAmountUSDC] = useState('');
    const [minBezAmount, setMinBezAmount] = useState('0');

    // Process state
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('input'); // input, telemetry, evaluating, approved, rejected, signing, success

    // AI response
    const [riskScore, setRiskScore] = useState(null);
    const [riskLevel, setRiskLevel] = useState(null);
    const [riskFlags, setRiskFlags] = useState([]);
    const [signature, setSignature] = useState(null);
    const [deadline, setDeadline] = useState(null);

    // Fee breakdown
    const [feeBreakdown, setFeeBreakdown] = useState(null);

    // Sanctions check
    const [sanctionsChecked, setSanctionsChecked] = useState(false);
    const [sanctionsClean, setSanctionsClean] = useState(true);

    // Calculate fee breakdown when amount changes
    useEffect(() => {
        if (amountUSDC && !isNaN(amountUSDC) && parseFloat(amountUSDC) > 0) {
            const breakdown = calculateNetAmount(parseFloat(amountUSDC));
            setFeeBreakdown(breakdown);
        } else {
            setFeeBreakdown(null);
        }
    }, [amountUSDC]);

    // Check sanctions on component mount
    useEffect(() => {
        if (address && !sanctionsChecked) {
            checkSanctions();
        }
    }, [address]);

    const checkSanctions = async () => {
        try {
            const result = await checkAddressSanctions(address);
            setSanctionsClean(result.clean);
            setSanctionsChecked(true);
        } catch (error) {
            console.error('Sanctions check failed:', error);
            // Default to clean if check fails (don't block users on network errors)
            setSanctionsClean(true);
            setSanctionsChecked(true);
        }
    };

    const handleRequestSignature = async () => {
        if (!isConnected) {
            onError?.({ message: 'Please connect your wallet first' });
            return;
        }

        if (!sanctionsClean) {
            onError?.({ message: 'This address is flagged. Please contact support.' });
            return;
        }

        if (!amountUSDC || isNaN(amountUSDC) || parseFloat(amountUSDC) <= 0) {
            onError?.({ message: 'Please enter a valid amount' });
            return;
        }

        try {
            setLoading(true);
            setStep('telemetry');

            // Step 1: Gather user telemetry (on-chain + browser data)
            const telemetry = await gatherUserTelemetry(address, provider);

            setStep('evaluating');

            // Step 2: Request signature from AI Risk Engine
            const response = await requestSwapSignature(
                telemetry,
                parseFloat(amountUSDC),
                serviceId || 'LIQUIDITY_RAMP'
            );

            // Step 3: Process AI response
            setRiskScore(response.riskScore);
            setRiskLevel(response.riskLevel);
            setRiskFlags(response.riskFlags || []);

            if (response.approved) {
                // Approved: Store signature for contract call
                setSignature(response.signature);
                setDeadline(response.deadline);
                setStep('approved');
            } else {
                // Rejected: Show risk factors
                setStep('rejected');
            }

        } catch (error) {
            console.error('Signature request failed:', error);
            setStep('input');
            onError?.({
                message: error.response?.data?.error || error.message || 'Failed to evaluate transaction'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteSwap = async () => {
        if (!signature || !deadline) {
            onError?.({ message: 'Missing signature data' });
            return;
        }

        try {
            setLoading(true);
            setStep('signing');

            // Get contract instance (you'll need to import this from your contracts)
            const liquidityRampAddress = import.meta.env.VITE_BEZ_LIQUIDITY_RAMP_ADDRESS;

            if (!liquidityRampAddress) {
                throw new Error('Contract address not configured');
            }

            // Contract ABI for swapFiatToBezWithSignature function
            const contractABI = [
                'function swapFiatToBezWithSignature(uint256 amountStablecoin, uint256 minBezAmount, string memory serviceId, uint256 deadline, bytes memory signature) external returns (uint256 bezReceived)'
            ];

            const signer = await provider.getSigner();
            const contract = new ethers.Contract(liquidityRampAddress, contractABI, signer);

            // Execute swap with signature
            const amountWei = ethers.parseUnits(amountUSDC, 6); // USDC has 6 decimals
            const minBezWei = ethers.parseUnits(minBezAmount || '0', 18); // BEZ has 18 decimals

            const tx = await contract.swapFiatToBezWithSignature(
                amountWei,
                minBezWei,
                serviceId || 'LIQUIDITY_RAMP',
                deadline,
                signature
            );

            // Wait for transaction confirmation
            const receipt = await tx.wait();

            setStep('success');
            onSuccess?.({
                txHash: receipt.hash,
                amountUSDC: parseFloat(amountUSDC),
                feeAmount: feeBreakdown.feeAmount,
                netAmount: feeBreakdown.netAmount
            });

        } catch (error) {
            console.error('Swap execution failed:', error);
            setStep('approved'); // Return to approved state
            onError?.({
                message: error.reason || error.message || 'Transaction failed'
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setAmountUSDC('');
        setMinBezAmount('0');
        setStep('input');
        setSignature(null);
        setDeadline(null);
        setRiskScore(null);
        setRiskLevel(null);
        setRiskFlags([]);
    };

    const getRiskLevelColor = (level) => {
        switch (level) {
            case 'HIGH_RISK': return '#ef4444';
            case 'MEDIUM_RISK': return '#f59e0b';
            case 'LOW_RISK': return '#10b981';
            case 'INSTITUTIONAL_LOW': return '#3b82f6';
            default: return '#6b7280';
        }
    };

    const getRiskLevelText = (level) => {
        switch (level) {
            case 'HIGH_RISK': return 'High Risk';
            case 'MEDIUM_RISK': return 'Medium Risk';
            case 'LOW_RISK': return 'Low Risk';
            case 'INSTITUTIONAL_LOW': return 'Institutional (Low Risk)';
            default: return 'Unknown';
        }
    };

    return (
        <div className="swap-with-ai">
            <div className="swap-header">
                <h3>Buy BEZ with AI Security</h3>
                <p>AI-powered fraud prevention • 0.5% platform fee</p>
            </div>

            {!sanctionsClean && (
                <div className="alert alert-error">
                    ⚠️ This address is flagged. Please contact support.
                </div>
            )}

            {step === 'input' && (
                <div className="swap-form">
                    <div className="form-group">
                        <label htmlFor="amount">Amount (USDC)</label>
                        <input
                            id="amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={amountUSDC}
                            onChange={(e) => setAmountUSDC(e.target.value)}
                            placeholder="Enter USDC amount"
                            disabled={loading || !isConnected}
                        />
                    </div>

                    {feeBreakdown && (
                        <div className="fee-breakdown">
                            <div className="fee-row">
                                <span>Amount:</span>
                                <span>{feeBreakdown.totalAmount.toFixed(2)} USDC</span>
                            </div>
                            <div className="fee-row">
                                <span>Platform Fee ({feeBreakdown.feePercentage}%):</span>
                                <span className="fee-amount">-{feeBreakdown.feeAmount.toFixed(2)} USDC</span>
                            </div>
                            <div className="fee-row fee-total">
                                <span>You'll swap:</span>
                                <span>{feeBreakdown.netAmount.toFixed(2)} USDC</span>
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="minBez">Minimum BEZ (optional)</label>
                        <input
                            id="minBez"
                            type="number"
                            min="0"
                            step="0.01"
                            value={minBezAmount}
                            onChange={(e) => setMinBezAmount(e.target.value)}
                            placeholder="Slippage protection"
                            disabled={loading || !isConnected}
                        />
                        <small>Transaction will revert if you receive less than this amount</small>
                    </div>

                    <button
                        className="btn-primary"
                        onClick={handleRequestSignature}
                        disabled={loading || !isConnected || !sanctionsClean || !amountUSDC}
                    >
                        {!isConnected ? 'Connect Wallet' : 'Continue'}
                    </button>
                </div>
            )}

            {step === 'telemetry' && (
                <div className="swap-status">
                    <div className="spinner"></div>
                    <h4>Gathering Security Data...</h4>
                    <p>Collecting wallet information and browser telemetry</p>
                </div>
            )}

            {step === 'evaluating' && (
                <div className="swap-status">
                    <div className="spinner"></div>
                    <h4>AI Risk Evaluation in Progress...</h4>
                    <p>Analyzing transaction for fraud patterns</p>
                </div>
            )}

            {step === 'approved' && (
                <div className="swap-approved">
                    <div className="approval-badge">✓</div>
                    <h4>Transaction Approved</h4>

                    <div className="risk-info">
                        <div className="risk-score">
                            <span>Risk Score:</span>
                            <span style={{ color: getRiskLevelColor(riskLevel) }}>
                                {riskScore}/100 ({getRiskLevelText(riskLevel)})
                            </span>
                        </div>
                    </div>

                    {riskFlags.length > 0 && (
                        <div className="risk-flags">
                            <p>⚠️ Flagged factors (approved anyway):</p>
                            <ul>
                                {riskFlags.map((flag, idx) => (
                                    <li key={idx}>{flag}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="swap-summary">
                        <p>Ready to execute swap:</p>
                        <ul>
                            <li>Amount: {amountUSDC} USDC</li>
                            <li>Platform Fee: {feeBreakdown?.feeAmount.toFixed(2)} USDC (0.5%)</li>
                            <li>Net Swap: {feeBreakdown?.netAmount.toFixed(2)} USDC → BEZ</li>
                        </ul>
                    </div>

                    <div className="button-group">
                        <button
                            className="btn-secondary"
                            onClick={resetForm}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleExecuteSwap}
                            disabled={loading}
                        >
                            Execute Swap
                        </button>
                    </div>
                </div>
            )}

            {step === 'rejected' && (
                <div className="swap-rejected">
                    <div className="rejection-badge">✗</div>
                    <h4>Transaction Rejected</h4>

                    <div className="risk-info">
                        <div className="risk-score">
                            <span>Risk Score:</span>
                            <span style={{ color: getRiskLevelColor(riskLevel) }}>
                                {riskScore}/100 ({getRiskLevelText(riskLevel)})
                            </span>
                        </div>
                    </div>

                    <div className="risk-flags">
                        <p>Risk factors detected:</p>
                        <ul>
                            {riskFlags.map((flag, idx) => (
                                <li key={idx}>{flag}</li>
                            ))}
                        </ul>
                    </div>

                    <p className="rejection-help">
                        To improve your risk score, consider:
                        <br />• Completing KYC verification
                        <br />• Using your wallet without VPN
                        <br />• Maintaining a positive balance
                        <br />• Building transaction history
                    </p>

                    <button
                        className="btn-secondary"
                        onClick={resetForm}
                    >
                        Try Again
                    </button>
                </div>
            )}

            {step === 'signing' && (
                <div className="swap-status">
                    <div className="spinner"></div>
                    <h4>Confirm in MetaMask...</h4>
                    <p>Waiting for transaction signature</p>
                </div>
            )}

            {step === 'success' && (
                <div className="swap-success">
                    <div className="success-badge">✓</div>
                    <h4>Swap Completed!</h4>
                    <p>Your BEZ tokens have been received</p>

                    <button
                        className="btn-primary"
                        onClick={resetForm}
                    >
                        Make Another Swap
                    </button>
                </div>
            )}
        </div>
    );
};

export default SwapWithAI;
