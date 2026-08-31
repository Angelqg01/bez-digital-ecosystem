/* eslint-disable */
'use client';

/**
 * BuyBezModal.tsx â€” Full BEZ Purchase Modal
 *
 * Wires useBuyBEZ() hook to a premium glassmorphism UI.
 * Supports USDT, USDC (ERC-20 approve flow) and MATIC (native).
 * Shows live quote, step progress, and tx confirmation.
 */

import React, { useState, useEffect } from 'react';
import { X, Zap, CheckCircle2, AlertCircle, ExternalLink, Loader2, ChevronRight } from 'lucide-react';
import { useBuyBEZ, PayCurrency, BuyStep } from '../../hooks/useBuyBEZ';
import { useBezPay } from '../../context/BezPayContext';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { BANK_TRANSFER_DETAILS, STRIPE_PAYMENT_LINKS, buildBankTransferInstructions } from '../../lib/bezhasPaymentConfig';

// â”€â”€â”€ Step Progress Labels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STEP_LABELS: Record<BuyStep, string> = {
    idle:             'Selecciona monto',
    quoting:          'Calculando precioâ€¦',
    approving:        'Aprobando tokenâ€¦',
    waiting_approval: 'Esperando aprobaciÃ³nâ€¦',
    initiating:       'Enviando pagoâ€¦',
    confirming:       'Confirmando en Polygonâ€¦',
    success:          'Â¡Pago exitoso!',
    error:            'Error en el pago',
};

type PaymentCurrency = PayCurrency | 'CARD' | 'BANK';

const CRYPTO_CURRENCIES: PayCurrency[] = ['USDT', 'USDC', 'MATIC'];

const CURRENCIES: Array<{ id: PaymentCurrency; label: string; icon: string; color: string }> = [
    { id: 'USDT',  label: 'USDT',  icon: 'â‚®', color: '#26A17B' },
    { id: 'USDC',  label: 'USDC',  icon: 'â—‰', color: '#2775CA' },
    { id: 'MATIC', label: 'MATIC', icon: 'â¬Ÿ', color: '#8247E5' },
    { id: 'CARD',  label: 'Stripe', icon: '$', color: '#2563EB' },
    { id: 'BANK',  label: 'Banco',  icon: 'IBAN', color: '#00C896' },
];

const PACKAGES = [
    { label: '100 BEZ',   usdValue: 10,  bonus: 0   },
    { label: '500 BEZ',   usdValue: 50,  bonus: 10  },
    { label: '1,000 BEZ', usdValue: 100, bonus: 30  },
    { label: '5,000 BEZ', usdValue: 500, bonus: 200 },
];

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function BuyBezModal() {
    const { isBuyModalOpen, closeBuyBez, livePrice, buyOptions } = useBezPay();
    const { isConnected } = useAccount();
    const { open } = useWeb3Modal();

    const { step, quote, txHash, bezReceived, errorMsg, fetchQuote, executePurchase, reset } = useBuyBEZ();

    const [currency,        setCurrency]        = useState<PaymentCurrency>('USDT');
    const [customAmount,    setCustomAmount]     = useState('');
    const [selectedPackage, setSelectedPackage]  = useState<number | null>(null);
    const [bankDetails,     setBankDetails]      = useState<ReturnType<typeof buildBankTransferInstructions> | null>(null);

    const isProcessing = !['idle', 'success', 'error'].includes(step);

    // Reset state when modal opens
    useEffect(() => {
        if (isBuyModalOpen) {
            reset();
            setBankDetails(null);
            if (buyOptions?.amount) {
                setCustomAmount(buyOptions.amount.toString());
                setSelectedPackage(null);
            }
        }
    }, [isBuyModalOpen]);

    // Debounced quote fetch on amount/currency change
    useEffect(() => {
        const amt = selectedPackage !== null
            ? PACKAGES[selectedPackage].usdValue
            : parseFloat(customAmount);

        if (!amt || amt <= 0 || step !== 'idle' || !CRYPTO_CURRENCIES.includes(currency as PayCurrency)) return;

        const timeout = setTimeout(() => {
            fetchQuote(amt, currency as PayCurrency);
        }, 600);
        return () => clearTimeout(timeout);
    }, [currency, customAmount, selectedPackage]);

    if (!isBuyModalOpen) return null;

    const activeAmount = selectedPackage !== null
        ? PACKAGES[selectedPackage].usdValue
        : parseFloat(customAmount) || 0;

    // Estimated BEZ from live price
    const estimatedBEZ = activeAmount > 0 ? (activeAmount / livePrice).toFixed(2) : 'â€”';

    const handleBuy = async () => {
        if (activeAmount <= 0) return;
        if (currency === 'CARD') {
            window.location.href = STRIPE_PAYMENT_LINKS.tokenPurchase;
            return;
        }
        if (currency === 'BANK') {
            setBankDetails(buildBankTransferInstructions(`BEZ-${Date.now().toString(36).toUpperCase().slice(-8)}`));
            return;
        }
        if (!isConnected) { open(); return; }
        await executePurchase(activeAmount, currency);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
                onClick={!isProcessing ? closeBuyBez : undefined}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
                    style={{ background: 'linear-gradient(145deg, #0C1628, #070D1C)', border: '1px solid #163560' }}
                >
                    {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    <div style={{ background: 'linear-gradient(135deg, #FFB80022, #00C89622)', borderBottom: '1px solid #163560' }} className="px-8 py-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-green-400 flex items-center justify-center text-xl">ðŸª™</div>
                                <div>
                                    <h2 className="text-xl font-bold text-white font-mono">Comprar BEZ-Coin</h2>
                                    <p className="text-xs text-gray-400">1 BEZ = <span className="text-yellow-400 font-bold">${livePrice.toFixed(4)}</span> USD Â· En vivo</p>
                                </div>
                            </div>
                            {!isProcessing && (
                                <button onClick={closeBuyBez} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* â”€â”€ Success State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    {step === 'success' && (
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-400 flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 size={40} className="text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Â¡Compra Completada!</h3>
                            <p className="text-gray-400 mb-2">Recibiste</p>
                            <p className="text-5xl font-mono font-black text-yellow-400 mb-6">{bezReceived?.toFixed(2)} BEZ</p>
                            {txHash && (
                                <a
                                    href={`https://polygonscan.com/tx/${txHash}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors mb-8"
                                >
                                    <ExternalLink size={14} /> Ver en PolygonScan
                                </a>
                            )}
                            <button onClick={() => { reset(); closeBuyBez(); }} className="w-full py-4 rounded-xl text-white font-bold" style={{ background: 'linear-gradient(135deg, #00C896, #2563EB)' }}>
                                Cerrar
                            </button>
                        </div>
                    )}

                    {/* â”€â”€ Error State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    {step === 'error' && (
                        <div className="p-8 text-center">
                            <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Error en el pago</h3>
                            <p className="text-red-300 text-sm mb-8 bg-red-500/10 border border-red-500/30 rounded-xl p-4">{errorMsg}</p>
                            <button onClick={reset} className="w-full py-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold transition-colors">
                                Intentar de nuevo
                            </button>
                        </div>
                    )}

                    {/* â”€â”€ Processing State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    {isProcessing && (
                        <div className="p-8 text-center">
                            <Loader2 size={48} className="text-green-400 animate-spin mx-auto mb-6" />
                            <h3 className="text-xl font-bold text-white mb-2">{STEP_LABELS[step]}</h3>
                            <p className="text-gray-400 text-sm">No cierres esta ventana durante el proceso.</p>
                            {txHash && (
                                <div className="mt-6 p-3 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-xs text-gray-500 mb-1 font-mono">TX HASH</p>
                                    <p className="text-xs text-blue-400 font-mono break-all">{txHash}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* â”€â”€ Main Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    {(step === 'idle' || step === 'quoting') && (
                        <div className="p-6 space-y-5">

                            {/* Currency Selector */}
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-mono">Pagar con</p>
                                <div className="grid grid-cols-5 gap-2">
                                    {CURRENCIES.map((c) => (
                                        <button
                                            key={c.id}
                                            onClick={() => { setCurrency(c.id); setBankDetails(null); reset(); }}
                                            className="py-3 rounded-xl text-sm font-bold font-mono transition-all"
                                            style={{
                                                background:  currency === c.id ? `${c.color}33` : 'rgba(255,255,255,0.04)',
                                                border:      `1.5px solid ${currency === c.id ? c.color : '#163560'}`,
                                                color:       currency === c.id ? c.color : '#3D5E80',
                                            }}
                                        >
                                            <span className="block text-xl mb-1">{c.icon}</span>
                                            {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Package Selector */}
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-mono">Paquetes</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {PACKAGES.map((pkg, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setSelectedPackage(i); setCustomAmount(''); }}
                                            className="p-3 rounded-xl text-left transition-all"
                                            style={{
                                                background: selectedPackage === i ? '#FFB80022' : 'rgba(255,255,255,0.04)',
                                                border:     `1.5px solid ${selectedPackage === i ? '#FFB800' : '#163560'}`,
                                            }}
                                        >
                                            <p className="text-yellow-400 font-bold font-mono text-sm">{pkg.label}</p>
                                            <p className="text-gray-400 text-xs">${pkg.usdValue} USD{pkg.bonus > 0 && <span className="text-green-400 ml-1">+{pkg.bonus} bonus</span>}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Amount */}
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-mono">O monto personalizado (USD)</p>
                                <input
                                    type="number"
                                    min="1"
                                    value={customAmount}
                                    onChange={(e) => { setCustomAmount(e.target.value); setSelectedPackage(null); }}
                                    placeholder="Ej: 25"
                                    className="w-full bg-white/5 border border-[#163560] rounded-xl px-4 py-3 text-white font-mono text-lg outline-none focus:border-green-400 transition-colors"
                                />
                            </div>

                            {/* Quote Summary */}
                            <div style={{ background: '#00C89611', border: '1px solid #00C89633' }} className="rounded-xl p-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">RecibirÃ¡s aprox.</span>
                                    <span className="text-2xl font-mono font-black text-green-400">
                                        {quote ? quote.toAmount.toFixed(2) : estimatedBEZ} BEZ
                                    </span>
                                </div>
                                <div className="flex justify-between mt-2 text-xs text-gray-500 font-mono">
                                    <span>Gas fee est.</span>
                                    <span>{quote ? `~${quote.estimatedGasFee} MATIC` : '~0.001 MATIC'}</span>
                                </div>
                            </div>

                            {bankDetails && (
                                <div className="rounded-xl p-4 space-y-2" style={{ background: '#052a0a88', border: '1px solid #00C89655' }}>
                                    <p className="text-green-400 font-bold text-sm font-mono">Transferencia bancaria SEPA</p>
                                    <p className="text-xs text-gray-400">Beneficiario: <span className="text-white">{BANK_TRANSFER_DETAILS.beneficiaryAlias}</span></p>
                                    <p className="text-xs text-gray-400">IBAN: <span className="text-white font-mono">{bankDetails.iban}</span></p>
                                    <p className="text-xs text-gray-400">BIC: <span className="text-white font-mono">{bankDetails.bic}</span></p>
                                    <p className="text-xs text-gray-400">Concepto: <span className="text-yellow-400 font-mono">{bankDetails.reference}</span></p>
                                </div>
                            )}

                            {/* Buy Button */}
                            <button
                                onClick={handleBuy}
                                disabled={activeAmount <= 0}
                                className="w-full py-4 rounded-xl text-white font-bold text-lg font-mono flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ background: 'linear-gradient(135deg, #FFB800, #00C896)' }}
                            >
                                {currency === 'CARD' ? (
                                    <><Zap size={20} /> Pagar con Stripe <ChevronRight size={18} /></>
                                ) : currency === 'BANK' ? (
                                    <><Zap size={20} /> Ver datos bancarios <ChevronRight size={18} /></>
                                ) : !isConnected ? (
                                    <><Zap size={20} /> Conectar Wallet para comprar</>
                                ) : (
                                    <><Zap size={20} /> Comprar {activeAmount > 0 ? `$${activeAmount} en BEZ` : 'BEZ'} <ChevronRight size={18} /></>
                                )}
                            </button>

                            <p className="text-center text-xs text-gray-600 font-mono">
                                ðŸ”’ Pago on-chain Â· Sin intermediarios Â· Red Polygon
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

