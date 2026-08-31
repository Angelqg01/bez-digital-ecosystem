'use client';

import { useState } from 'react';
import { ArrowDownUp, Loader2, Repeat2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { swapOnChain } from '@/lib/contracts';

type QuoteResponse = {
    quote?: {
        amountIn: string;
        amountOut: string;
        amountOutWei: string;
    };
};

const BEZ_POLYGON_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

export default function TradingPage() {
    const [tokenIn, setTokenIn] = useState(BEZ_POLYGON_ADDRESS);
    const [tokenOut, setTokenOut] = useState('');
    const [amountIn, setAmountIn] = useState('');
    const [minAmountOut, setMinAmountOut] = useState('0');
    const [quote, setQuote] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    async function fetchQuote() {
        if (!tokenIn || !tokenOut || !amountIn) return;
        setLoading(true);
        setFeedback(null);
        try {
            const qs = new URLSearchParams({ tokenIn, tokenOut, amountIn }).toString();
            const data = await apiFetch<QuoteResponse>(`/api/dex/quote?${qs}`);
            const amountOut = data.quote?.amountOut || '0';
            setQuote(amountOut);
            setMinAmountOut(amountOut);
        } catch (e: unknown) {
            setFeedback({ type: 'error', msg: e instanceof Error ? e.message : 'Quote unavailable' });
        } finally {
            setLoading(false);
        }
    }

    async function handleSwap() {
        if (!tokenIn || !tokenOut || !amountIn) return;
        setLoading(true);
        setFeedback(null);
        try {
            await swapOnChain(tokenIn, tokenOut, amountIn, minAmountOut || '0');
            setFeedback({ type: 'success', msg: 'Swap submitted on-chain' });
            setAmountIn('');
            setQuote(null);
        } catch (e: unknown) {
            setFeedback({ type: 'error', msg: e instanceof Error ? e.message : 'Swap failed' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Trading</h1>
                <p className="text-slate-400 mt-1">Swap BEZ-Coin against approved ecosystem tokens through BeZhasDEX</p>
            </div>

            {feedback && (
                <div className={`card text-sm ${feedback.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                    {feedback.msg}
                </div>
            )}

            <div className="card max-w-xl">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-slate-400 block mb-1">Token in</label>
                        <input value={tokenIn} onChange={(e) => setTokenIn(e.target.value)} placeholder="0x..."
                            className="w-full bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary" />
                    </div>

                    <button
                        onClick={() => { setTokenIn(tokenOut); setTokenOut(tokenIn); setQuote(null); }}
                        className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
                        aria-label="Switch tokens"
                    >
                        <ArrowDownUp size={18} className="text-bez-primary" />
                    </button>

                    <div>
                        <label className="text-sm text-slate-400 block mb-1">Token out</label>
                        <input value={tokenOut} onChange={(e) => setTokenOut(e.target.value)} placeholder="0x..."
                            className="w-full bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary" />
                    </div>

                    <div>
                        <label className="text-sm text-slate-400 block mb-1">Amount in</label>
                        <input type="number" value={amountIn} onChange={(e) => setAmountIn(e.target.value)} placeholder="0.00"
                            className="w-full bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary" />
                    </div>

                    <div className="rounded-lg bg-slate-800/50 p-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Estimated receive</span>
                            <span className="text-white">{quote ?? 'Get quote first'}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-slate-400">Minimum receive</span>
                            <input value={minAmountOut} onChange={(e) => setMinAmountOut(e.target.value)}
                                className="w-40 bg-transparent text-right text-white focus:outline-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={fetchQuote} disabled={loading || !tokenIn || !tokenOut || !amountIn}
                            className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50">
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Repeat2 size={16} />} Quote
                        </button>
                        <button onClick={handleSwap} disabled={loading || !tokenIn || !tokenOut || !amountIn}
                            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                            {loading ? <Loader2 size={16} className="animate-spin" /> : null} Swap
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
