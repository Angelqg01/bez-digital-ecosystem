'use client';

import { useState } from 'react';
import { TrendingUp, Droplets, Coins, ArrowRightLeft, Loader2 } from 'lucide-react';
import { useFarmingPositions, farmDeposit, type FarmPosition } from '@/lib/hooks';
import { farmDepositOnChain } from '@/lib/contracts';

export default function FarmingPage() {
    const [selectedPool, setSelectedPool] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const address = typeof window !== 'undefined' ? localStorage.getItem('bez_wallet') : null;
    const { data, isLoading, mutate } = useFarmingPositions(address);
    const positions: FarmPosition[] = data?.positions ?? [];

    const totalDeposited = positions.reduce((s, p) => s + parseFloat(p.deposited || '0'), 0);
    const totalRewards = positions.reduce((s, p) => s + parseFloat(p.rewards || '0'), 0);

    const handleDeposit = async (poolId: string) => {
        if (!address || !amount) return;
        setLoading(true); setError(null); setSuccess(null);
        try {
            await farmDepositOnChain(poolId, amount).catch(async () => farmDeposit(address, poolId, parseFloat(amount)));
            setSuccess(`Deposited ${amount} into pool ${poolId}`);
            setAmount('');
            setSelectedPool(null);
            mutate();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Deposit failed');
        } finally { setLoading(false); }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Yield Farming</h1>
                <p className="text-slate-400 mt-1">Provide liquidity and earn $BEZ rewards</p>
            </div>

            {/* Global Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Your Total Deposited', value: isLoading ? '—' : `${totalDeposited.toLocaleString()} LP`, icon: Droplets },
                    { label: 'Pending Rewards', value: isLoading ? '—' : `${totalRewards.toLocaleString()} BEZ`, icon: Coins },
                    { label: 'Active Positions', value: isLoading ? '—' : String(positions.length), icon: TrendingUp },
                ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="card">
                        <div className="flex items-center gap-3 mb-2">
                            <Icon size={18} className="text-bez-primary" />
                            <span className="text-sm text-slate-400">{label}</span>
                        </div>
                        <p className="text-xl font-bold text-white">{value}</p>
                    </div>
                ))}
            </div>

            {/* Messages */}
            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
            {success && <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">{success}</div>}

            {/* Positions / Pools */}
            {isLoading ? (
                <div className="card flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
            ) : positions.length === 0 ? (
                <div className="card text-center py-8">
                    <p className="text-slate-500">No farming positions found.</p>
                    {!address && <a href="/wallet" className="text-bez-primary text-sm mt-2 inline-block">Connect wallet →</a>}
                </div>
            ) : (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-white">Your Positions</h2>
                    {positions.map((pool) => (
                        <div key={pool.poolId} className="card">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-bez-primary/20 flex items-center justify-center">
                                        <ArrowRightLeft size={18} className="text-bez-primary" />
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold">{pool.poolName}</p>
                                        <p className="text-xs text-slate-400">APY: {pool.apy}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-slate-400 block">Deposited</span><span className="text-white font-medium">{pool.deposited}</span></div>
                                    <div><span className="text-slate-400 block">Rewards</span><span className="text-green-400 font-medium">{pool.rewards} BEZ</span></div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setSelectedPool(selectedPool === pool.poolId ? null : pool.poolId)}
                                        className="btn-primary text-sm">
                                        {selectedPool === pool.poolId ? 'Close' : 'Deposit More'}
                                    </button>
                                </div>
                            </div>

                            {selectedPool === pool.poolId && (
                                <div className="mt-4 pt-4 border-t border-bez-border">
                                    <div className="flex gap-2 max-w-md">
                                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                                            placeholder="LP token amount"
                                            className="flex-1 bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary" />
                                        <button onClick={() => handleDeposit(pool.poolId)} disabled={loading || !amount}
                                            className="btn-primary disabled:opacity-50 flex items-center gap-2">
                                            {loading ? <Loader2 className="animate-spin" size={14} /> : null} Confirm
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
