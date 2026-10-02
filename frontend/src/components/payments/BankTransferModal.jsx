import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { X, Copy, Check, AlertCircle, ExternalLink } from 'lucide-react';

const BankTransferModal = ({ isOpen, onClose }) => {
    const { address, isConnected } = useAccount();
    const [amountEur, setAmountEur] = useState(100);
    const [estimatedBez, setEstimatedBez] = useState(0);
    const [bezPrice, setBezPrice] = useState(0);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(null);

    // Bank Details Config
    const BANK_DETAILS = {
        iban: "ES77 1465 0100 91 1766376210",
        bic: "INGDESMMXXX",
        beneficiary: "BeZhas Platform"
    };

    // Generate unique reference
    const reference = address ? `BEZ-${address.slice(-6).toUpperCase()}` : 'BEZ-REF';

    // Fetch price and calculate on mount and amount change
    useEffect(() => {
        if (isOpen && amountEur > 0) {
            fetchPriceAndCalculate();
        }
    }, [isOpen, amountEur]);

    const fetchPriceAndCalculate = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/fiat/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amountEur: parseFloat(amountEur) })
            });

            const data = await response.json();

            if (data.success) {
                setEstimatedBez(data.output.amountBez.toFixed(2));
                setBezPrice(data.rate);
            }
        } catch (error) {
            console.error('Error calculating BEZ amount:', error);
            // Fallback to default price
            setBezPrice(0.0015);
            setEstimatedBez((amountEur / 0.0015).toFixed(2));
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full text-white shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-purple-400">Buy BEZ via Bank Transfer</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Warning if not connected */}
                    {!isConnected && (
                        <div className="bg-yellow-900/30 border border-yellow-500/50 p-3 rounded-lg flex items-start space-x-2">
                            <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                            <p className="text-sm text-yellow-200">
                                Please connect your wallet first to generate your unique reference code.
                            </p>
                        </div>
                    )}

                    {/* Calculator */}
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <label className="block text-sm text-gray-400 mb-2">Amount to Send (€)</label>
                        <input
                            type="number"
                            value={amountEur}
                            onChange={(e) => setAmountEur(parseFloat(e.target.value) || 0)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-lg mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            min="1"
                            step="1"
                        />

                        <div className="flex justify-between items-center text-sm text-gray-400 mb-2">
                            <span>Current Rate:</span>
                            <span>1 BEZ ≈ {bezPrice.toFixed(4)} €</span>
                        </div>

                        <div className="pt-3 border-t border-gray-700 flex justify-between items-center">
                            <span className="text-gray-300">You Receive:</span>
                            <span className="text-green-400 text-2xl font-bold">
                                {loading ? '...' : estimatedBez} BEZ
                            </span>
                        </div>
                    </div>

                    {/* Bank Details */}
                    <div className="space-y-3">
                        <p className="font-semibold text-gray-300 flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            Bank Transfer Details:
                        </p>

                        {/* Beneficiary */}
                        <div className="bg-gray-800 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">Beneficiary:</span>
                                <div className="flex items-center space-x-2">
                                    <span className="font-mono text-sm">{BANK_DETAILS.beneficiary}</span>
                                    <button
                                        onClick={() => copyToClipboard(BANK_DETAILS.beneficiary, 'beneficiary')}
                                        className="text-gray-400 hover:text-white transition"
                                    >
                                        {copied === 'beneficiary' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* IBAN */}
                        <div className="bg-gray-800 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">IBAN:</span>
                                <div className="flex items-center space-x-2">
                                    <span className="font-mono text-sm text-blue-300">{BANK_DETAILS.iban}</span>
                                    <button
                                        onClick={() => copyToClipboard(BANK_DETAILS.iban, 'iban')}
                                        className="text-gray-400 hover:text-white transition"
                                    >
                                        {copied === 'iban' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* BIC */}
                        <div className="bg-gray-800 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">BIC/SWIFT:</span>
                                <div className="flex items-center space-x-2">
                                    <span className="font-mono text-sm">{BANK_DETAILS.bic}</span>
                                    <button
                                        onClick={() => copyToClipboard(BANK_DETAILS.bic, 'bic')}
                                        className="text-gray-400 hover:text-white transition"
                                    >
                                        {copied === 'bic' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Reference (Most Important) */}
                        <div className="bg-purple-900/30 border-2 border-purple-500 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-purple-300 font-semibold">Concept/Reference:</span>
                                <div className="flex items-center space-x-2">
                                    <span className="font-mono text-lg font-bold text-yellow-400">{reference}</span>
                                    <button
                                        onClick={() => copyToClipboard(reference, 'reference')}
                                        className="text-purple-300 hover:text-white transition"
                                    >
                                        {copied === 'reference' ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-purple-200 mt-2">
                                ⚠️ CRITICAL: Include this reference in your transfer so we can identify your payment!
                            </p>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-blue-900/20 border border-blue-500/50 p-4 rounded-lg space-y-2">
                        <h3 className="font-semibold text-blue-300 text-sm">📋 Instructions:</h3>
                        <ol className="text-xs text-blue-200 space-y-1 list-decimal list-inside">
                            <li>Open your banking app or online banking</li>
                            <li>Make a SEPA transfer to the IBAN above</li>
                            <li>Enter the amount: <strong>{amountEur}€</strong></li>
                            <li><strong>IMPORTANT:</strong> Add the reference code <strong>{reference}</strong> in the concept field</li>
                            <li>Submit the transfer</li>
                            <li>Tokens will be sent to your wallet within 1-24 hours</li>
                        </ol>
                    </div>

                    {/* Info Box */}
                    <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg">
                        <div className="flex items-start space-x-2 text-xs text-gray-300">
                            <AlertCircle size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="mb-1">🚀 <strong>Gas fees covered by BeZhas</strong> - You only pay the EUR amount.</p>
                                <p className="mb-1">⚡ SEPA Instant transfers are processed faster (usually same day).</p>
                                <p>🔒 Your banking details are never stored by BeZhas.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-700 flex space-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 transition font-medium"
                    >
                        Close
                    </button>
                    <button
                        className="flex-1 py-3 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 font-bold transition flex items-center justify-center space-x-2"
                        onClick={() => window.open('https://support.bezhas.com/fiat-payment', '_blank')}
                    >
                        <span>Need Help?</span>
                        <ExternalLink size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BankTransferModal;
