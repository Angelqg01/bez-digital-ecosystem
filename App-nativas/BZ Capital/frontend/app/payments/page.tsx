'use client';

import { useState } from 'react';
import { CreditCard, Smartphone, QrCode, ArrowRight, CheckCircle, Clock, Loader2, AlertCircle, DollarSign, ArrowDownToLine } from 'lucide-react';
import { usePaymentHistory, useTokenPrice, buyBEZ, sellBEZ, sendPayment } from '@/lib/hooks';

type PaymentMethod = 'crypto' | 'card' | 'qr' | 'bank';
type Tab = 'buy' | 'sell' | 'pay' | 'history';

export default function PaymentsPage() {
    const [tab, setTab] = useState<Tab>('buy');
    const [buyAmount, setBuyAmount] = useState('');
    const [payAmount, setPayAmount] = useState('');
    const [sellAmount, setSellAmount] = useState('');
    const [payRecipient, setPayRecipient] = useState('');
    const [payNote, setPayNote] = useState('');
    const [payMethod, setPayMethod] = useState<PaymentMethod>('crypto');
    const [receiveMethod, setReceiveMethod] = useState<PaymentMethod>('card');
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [bankTransfer, setBankTransfer] = useState<{
        beneficiaryAlias: string;
        iban: string;
        bic: string;
        currency: string;
        paymentRail: string;
        reference: string;
        instructions: string;
    } | null>(null);

    const { data: priceData } = useTokenPrice();
    const { data: historyData, error: histErr, isLoading: histLoading } = usePaymentHistory();

    const rate = priceData?.priceUSD ?? 0.10;
    const payments = historyData?.payments ?? [];

    const walletAddr = typeof window !== 'undefined' ? localStorage.getItem('bez_wallet') : null;

    async function handleBuy() {
        if (!buyAmount || !walletAddr) return;
        setLoading(true);
        setFeedback(null);
        setBankTransfer(null);
        try {
            const result = await buyBEZ({
                walletAddress: walletAddr,
                amountUSD: parseFloat(buyAmount),
                paymentMethod: payMethod,
                stripeUseCase: payMethod === 'card' ? 'token_purchase' : undefined,
            });
            if (result.nextAction === 'redirect_to_checkout' && result.checkoutUrl) {
                window.location.href = result.checkoutUrl;
                return;
            }
            if (result.nextAction === 'display_bank_transfer_instructions' && result.bankTransfer) {
                setBankTransfer(result.bankTransfer);
                setFeedback({ type: 'success', msg: 'Bank transfer order created. Use the reference shown below.' });
                setBuyAmount('');
                return;
            }
            setFeedback({ type: 'success', msg: 'Purchase initiated successfully' });
            setBuyAmount('');
        } catch (e: unknown) {
            setFeedback({ type: 'error', msg: e instanceof Error ? e.message : 'Purchase failed' });
        } finally {
            setLoading(false);
        }
    }

    async function handleSell() {
        if (!sellAmount || !walletAddr) return;
        setLoading(true);
        setFeedback(null);
        try {
            await sellBEZ({ walletAddress: walletAddr, amountBEZ: parseFloat(sellAmount), receiveMethod });
            setFeedback({ type: 'success', msg: 'Sale initiated successfully' });
            setSellAmount('');
        } catch (e: unknown) {
            setFeedback({ type: 'error', msg: e instanceof Error ? e.message : 'Sale failed' });
        } finally {
            setLoading(false);
        }
    }

    async function handleSend() {
        if (!payAmount || !payRecipient || !walletAddr) return;
        setLoading(true);
        setFeedback(null);
        try {
            await sendPayment({ sender: walletAddr, recipient: payRecipient, amount: parseFloat(payAmount), note: payNote || undefined });
            setFeedback({ type: 'success', msg: 'Payment sent successfully' });
            setPayAmount('');
            setPayRecipient('');
            setPayNote('');
        } catch (e: unknown) {
            setFeedback({ type: 'error', msg: e instanceof Error ? e.message : 'Payment failed' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Payments</h1>
                <p className="text-slate-400 mt-1">Buy $BEZ and make payments with BezPay</p>
            </div>

            {feedback && (
                <div className={`card text-sm flex items-center gap-2 ${feedback.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                    {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {feedback.msg}
                </div>
            )}

            {bankTransfer && (
                <div className="card max-w-lg border-blue-500/30 bg-blue-500/10 text-sm">
                    <h2 className="text-white font-semibold mb-3">Bank transfer details</h2>
                    <div className="space-y-2 text-slate-300">
                        <div className="flex justify-between gap-4"><span className="text-slate-400">Alias</span><span className="font-medium text-white">{bankTransfer.beneficiaryAlias}</span></div>
                        <div className="flex justify-between gap-4"><span className="text-slate-400">IBAN</span><span className="font-mono text-white">{bankTransfer.iban}</span></div>
                        <div className="flex justify-between gap-4"><span className="text-slate-400">BIC</span><span className="font-mono text-white">{bankTransfer.bic}</span></div>
                        <div className="flex justify-between gap-4"><span className="text-slate-400">Currency</span><span className="text-white">{bankTransfer.currency}</span></div>
                        <div className="flex justify-between gap-4"><span className="text-slate-400">Reference</span><span className="font-mono text-white">{bankTransfer.reference}</span></div>
                    </div>
                    <p className="text-slate-400 mt-3">{bankTransfer.instructions}</p>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-bez-border pb-2">
                {([
                    { key: 'buy' as Tab, label: 'Buy BEZ', icon: CreditCard },
                    { key: 'sell' as Tab, label: 'Sell BEZ', icon: ArrowDownToLine },
                    { key: 'pay' as Tab, label: 'BezPay', icon: Smartphone },
                    { key: 'history' as Tab, label: 'History', icon: Clock },
                ]).map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm transition-colors ${tab === key ? 'bg-bez-primary/20 text-bez-primary font-semibold' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            {/* Buy BEZ */}
            {tab === 'buy' && (
                <div className="card max-w-lg">
                    <h2 className="text-lg font-semibold text-white mb-4">Buy BEZ Tokens</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-slate-400 block mb-1">Amount (USD)</label>
                            <input
                                type="number"
                                value={buyAmount}
                                onChange={(e) => setBuyAmount(e.target.value)}
                                placeholder="100.00"
                                className="w-full bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary"
                            />
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-lg">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">You receive</span>
                                <span className="text-white font-medium">
                                    {buyAmount ? `~${(parseFloat(buyAmount) / rate).toFixed(2)} BEZ` : '0 BEZ'}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-slate-400">Rate</span>
                                <span className="text-slate-300">1 BEZ = ${rate.toFixed(4)}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-slate-400">Fee</span>
                                <span className="text-slate-300">2.5%</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm text-slate-400 block mb-2">Payment Method</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {([
                                    { method: 'card' as PaymentMethod, label: 'Card', icon: CreditCard },
                                    { method: 'bank' as PaymentMethod, label: 'Bank', icon: DollarSign },
                                    { method: 'crypto' as PaymentMethod, label: 'Crypto', icon: ArrowRight },
                                    { method: 'qr' as PaymentMethod, label: 'QR Code', icon: QrCode },
                                ]).map(({ method, label, icon: Icon }) => (
                                    <button
                                        key={method}
                                        onClick={() => setPayMethod(method)}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors ${payMethod === method
                                            ? 'border-bez-primary bg-bez-primary/10 text-bez-primary'
                                            : 'border-bez-border text-slate-400 hover:text-white hover:border-slate-600'
                                            }`}
                                    >
                                        <Icon size={20} />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleBuy}
                            disabled={loading || !buyAmount || !walletAddr}
                            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                            {walletAddr ? 'Buy BEZ' : 'Connect wallet first'}
                        </button>
                    </div>
                </div>
            )}

            {/* Sell BEZ */}
            {tab === 'sell' && (
                <div className="card max-w-lg">
                    <h2 className="text-lg font-semibold text-white mb-4">Sell BEZ Tokens</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-slate-400 block mb-1">Amount (BEZ)</label>
                            <input
                                type="number"
                                value={sellAmount}
                                onChange={(e) => setSellAmount(e.target.value)}
                                placeholder="1000"
                                className="w-full bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary"
                            />
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-lg">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">You receive</span>
                                <span className="text-white font-medium">
                                    {sellAmount ? `~$${(parseFloat(sellAmount) * rate).toFixed(2)}` : '$0.00'}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-slate-400">Rate</span>
                                <span className="text-slate-300">1 BEZ = ${rate.toFixed(4)}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-slate-400">Fee</span>
                                <span className="text-slate-300">2.5%</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm text-slate-400 block mb-2">Receive to</label>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { method: 'card' as PaymentMethod, label: 'Card', icon: CreditCard },
                                    { method: 'bank' as PaymentMethod, label: 'Bank', icon: DollarSign },
                                    { method: 'crypto' as PaymentMethod, label: 'Crypto', icon: QrCode },
                                ]).map(({ method, label, icon: Icon }) => (
                                    <button
                                        key={method}
                                        onClick={() => setReceiveMethod(method)}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors ${receiveMethod === method
                                            ? 'border-bez-primary bg-bez-primary/10 text-bez-primary'
                                            : 'border-bez-border text-slate-400 hover:text-white hover:border-slate-600'
                                            }`}
                                    >
                                        <Icon size={20} />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleSell}
                            disabled={loading || !sellAmount || !walletAddr}
                            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                            {walletAddr ? 'Sell BEZ' : 'Connect wallet first'}
                        </button>
                    </div>
                </div>
            )}

            {/* BezPay */}
            {tab === 'pay' && (
                <div className="space-y-6">
                    <div className="card max-w-lg">
                        <h2 className="text-lg font-semibold text-white mb-4">Send Payment</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-400 block mb-1">Recipient</label>
                                <input
                                    type="text"
                                    value={payRecipient}
                                    onChange={(e) => setPayRecipient(e.target.value)}
                                    placeholder="Address, email, or @username"
                                    className="w-full bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-slate-400 block mb-1">Amount (BEZ)</label>
                                <input
                                    type="number"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-slate-400 block mb-1">Note (optional)</label>
                                <input
                                    type="text"
                                    value={payNote}
                                    onChange={(e) => setPayNote(e.target.value)}
                                    placeholder="Payment for..."
                                    className="w-full bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary"
                                />
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={loading || !payAmount || !payRecipient || !walletAddr}
                                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
                                {walletAddr ? 'Send with BezPay' : 'Connect wallet first'}
                            </button>
                        </div>
                    </div>

                    {/* QR Payment */}
                    <div className="card max-w-lg">
                        <h2 className="text-lg font-semibold text-white mb-4">QR Payment</h2>
                        <div className="flex flex-col items-center py-6">
                            <div className="w-48 h-48 bg-slate-800 rounded-lg flex items-center justify-center border border-bez-border">
                                <QrCode size={80} className="text-slate-600" />
                            </div>
                            <p className="text-sm text-slate-400 mt-4">
                                {walletAddr ? `Your address: ${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : 'Connect wallet to generate QR'}
                            </p>
                            <button className="btn-secondary mt-3" disabled={!walletAddr}>Generate QR</button>
                        </div>
                    </div>
                </div>
            )}

            {/* History */}
            {tab === 'history' && (
                <div className="space-y-4">
                    {histErr && (
                        <div className="card border-red-500/30 bg-red-500/10 text-red-300 text-sm">
                            Failed to load payment history.
                        </div>
                    )}
                    {histLoading ? (
                        <div className="flex justify-center py-8"><Loader2 size={28} className="animate-spin text-slate-500" /></div>
                    ) : payments.length === 0 ? (
                        <div className="card text-center text-slate-500 py-8">No payment history</div>
                    ) : (
                        payments.map((record) => (
                            <div key={record.id} className="card flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {record.type === 'buy' ? <CreditCard size={16} className="text-bez-primary" /> : record.type === 'sell' ? <DollarSign size={16} className="text-blue-400" /> : <Smartphone size={16} className="text-green-400" />}
                                    <div>
                                        <p className="text-white text-sm font-medium capitalize">{record.type === 'buy' ? 'Token Purchase' : record.type === 'sell' ? 'Token Sale' : 'BezPay Payment'}</p>
                                        <p className="text-xs text-slate-500">{record.method} · {record.date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-white text-sm font-medium">{record.amount}</p>
                                    {record.status === 'completed' ? <CheckCircle size={14} className="text-green-400" /> :
                                        record.status === 'pending' ? <Clock size={14} className="text-yellow-400" /> :
                                            <AlertCircle size={14} className="text-red-400" />}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
