'use client';

import { useState } from 'react';
import { ArrowLeftRight, ArrowDown, Clock, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useBridgeTransfers, initiateBridge, type BridgeTransfer } from '@/lib/hooks';

type Chain = 'l2' | 'polygon' | 'ethereum';

const CHAIN_META: Record<Chain, { name: string; id: number; token: string }> = {
    l2: { name: 'BeZhas L2', id: 901, token: '0x0000000000000000000000000000000000000000' },
    polygon: { name: 'Polygon', id: 137, token: '0x0000000000000000000000000000000000000000' },
    ethereum: { name: 'Ethereum', id: 1, token: '0x0000000000000000000000000000000000000000' },
};

export default function BridgePage() {
    const [fromChain, setFromChain] = useState<Chain>('l2');
    const [toChain, setToChain] = useState<Chain>('polygon');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const address = typeof window !== 'undefined' ? localStorage.getItem('bez_wallet') : null;
    const { data, isLoading, mutate } = useBridgeTransfers(address);
    const transfers: BridgeTransfer[] = data?.transfers ?? [];

    const swap = () => { setFromChain(toChain); setToChain(fromChain); };
    const chainOptions: Chain[] = ['l2', 'polygon', 'ethereum'];

    const handleBridge = async () => {
        if (!address || !amount) return;
        setLoading(true); setError(null); setSuccess(null);
        try {
            await initiateBridge({
                sender: address,
                recipient: address,
                fromChainId: CHAIN_META[fromChain].id,
                toChainId: CHAIN_META[toChain].id,
                tokenAddress: CHAIN_META[fromChain].token,
                amount: parseFloat(amount),
            });
            setSuccess('Bridge transfer initiated! Track progress below.');
            setAmount('');
            mutate();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Bridge failed');
        } finally { setLoading(false); }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Bridge</h1>
                <p className="text-slate-400 mt-1">Transfer $BEZ between BeZhas L2 and other networks</p>
            </div>

            {/* Info Banner */}
            <div className="card border-bez-primary/30 bg-bez-primary/5">
                <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-bez-primary mt-0.5" />
                    <div className="text-sm">
                        <p className="text-white font-medium">How the bridge works</p>
                        <p className="text-slate-400 mt-1">
                            <strong>L2 → Polygon:</strong> BEZCoinV2 is locked on L2, wBEZ is minted on Polygon (1:1).<br />
                            <strong>Polygon → L2:</strong> wBEZ is burned on Polygon, BEZCoinV2 is unlocked on L2.
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
            {success && <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">{success}</div>}

            {/* Bridge Card */}
            <div className="card max-w-lg mx-auto">
                <h2 className="text-lg font-semibold text-white mb-6">Transfer Assets</h2>

                {/* From */}
                <div className="space-y-2">
                    <label className="text-sm text-slate-400">From</label>
                    <div className="flex gap-2">
                        <select value={fromChain} onChange={(e) => setFromChain(e.target.value as Chain)}
                            className="bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-bez-primary">
                            {chainOptions.map((c) => <option key={c} value={c}>{CHAIN_META[c].name}</option>)}
                        </select>
                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                            className="flex-1 bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary" />
                    </div>
                    <p className="text-xs text-slate-500">Token: {fromChain === 'l2' ? 'BEZCoinV2' : 'wBEZ'}</p>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center my-4">
                    <button onClick={swap} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors">
                        <ArrowDown size={20} className="text-bez-primary" />
                    </button>
                </div>

                {/* To */}
                <div className="space-y-2">
                    <label className="text-sm text-slate-400">To</label>
                    <select value={toChain} onChange={(e) => setToChain(e.target.value as Chain)}
                        className="w-full bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-bez-primary">
                        {chainOptions.map((c) => <option key={c} value={c}>{CHAIN_META[c].name}</option>)}
                    </select>
                    <p className="text-xs text-slate-500">You receive: {amount || '0'} {toChain === 'l2' ? 'BEZCoinV2' : 'wBEZ'}</p>
                </div>

                {/* Fee info */}
                <div className="mt-4 p-3 bg-slate-800/50 rounded-lg text-sm">
                    <div className="flex justify-between text-slate-400"><span>Bridge Fee</span><span className="text-white">0.1%</span></div>
                    <div className="flex justify-between text-slate-400 mt-1"><span>Est. Time</span><span className="text-white">~5 min</span></div>
                </div>

                <button onClick={handleBridge} disabled={loading || !amount || !address}
                    className="btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <ArrowLeftRight size={16} />} Bridge Tokens
                </button>
            </div>

            {/* Recent Transactions */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
                {isLoading ? (
                    <div className="card flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
                ) : transfers.length === 0 ? (
                    <div className="card text-center text-slate-500 py-8">No bridge transactions yet</div>
                ) : (
                    transfers.map((tx) => (
                        <div key={tx.transferId} className="card flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <ArrowLeftRight size={16} className="text-bez-primary" />
                                <div>
                                    <p className="text-white text-sm font-medium">Chain {tx.fromChainId} → Chain {tx.toChainId}</p>
                                    <p className="text-xs text-slate-500">{tx.timestamp}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-white text-sm font-medium">{tx.amount}</p>
                                <span className={`inline-flex items-center gap-1 text-xs ${tx.status === 'finalized' ? 'text-green-400' : tx.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                                    {tx.status === 'finalized' ? <CheckCircle size={12} /> : <Clock size={12} />}
                                    {tx.status}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
