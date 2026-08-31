'use client';

import { useState } from 'react';
import { Coins, Lock, Unlock, Gift, Loader2 } from 'lucide-react';
import { useStakingPositions, stake, unstake, type StakePosition } from '@/lib/hooks';
import { stakeBEZOnChain, unstakeBEZOnChain } from '@/lib/contracts';

export default function StakingPage() {
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const address = typeof window !== 'undefined' ? localStorage.getItem('bez_wallet') : null;
    const { data, isLoading, mutate } = useStakingPositions(address);
    const positions: StakePosition[] = data?.positions ?? [];

    const totalStaked = positions.reduce((s, p) => s + parseFloat(p.amount || '0'), 0);
    const totalRewards = positions.reduce((s, p) => s + parseFloat(p.rewards || '0'), 0);

    const handleStake = async () => {
        if (!address || !amount) return;
        setLoading(true); setError(null); setSuccess(null);
        try {
            await stakeBEZOnChain(amount).catch(async () => stake(address, parseFloat(amount)));
            setSuccess(`Staked ${amount} BEZ successfully`);
            setAmount('');
            mutate();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Stake failed');
        } finally { setLoading(false); }
    };

    const handleUnstake = async (positionId: string, posAmount?: string) => {
        setLoading(true); setError(null); setSuccess(null);
        try {
            if (posAmount) {
                await unstakeBEZOnChain(posAmount).catch(async () => unstake(positionId));
            } else {
                await unstake(positionId);
            }
            setSuccess('Unstake initiated');
            mutate();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Unstake failed');
        } finally { setLoading(false); }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Staking</h1>
                <p className="text-slate-400 mt-1">Stake $BEZ to earn rewards and secure the network</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Staked', value: `${totalStaked.toLocaleString()} BEZ`, icon: Lock },
                    { label: 'Pending Rewards', value: `${totalRewards.toLocaleString()} BEZ`, icon: Gift },
                    { label: 'Positions', value: String(positions.length), icon: Coins },
                ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="card">
                        <div className="flex items-center gap-3 mb-2">
                            <Icon size={18} className="text-bez-primary" />
                            <span className="text-sm text-slate-400">{label}</span>
                        </div>
                        <p className="text-xl font-bold text-white">{isLoading ? '—' : value}</p>
                    </div>
                ))}
            </div>

            {/* Messages */}
            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
            {success && <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">{success}</div>}

            {/* Stake Form */}
            <div className="card max-w-lg">
                <h2 className="text-lg font-semibold text-white mb-4">Stake BEZ</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-slate-400 block mb-1">Amount</label>
                        <div className="flex gap-2">
                            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                                className="flex-1 bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary" />
                        </div>
                    </div>
                    <button onClick={handleStake} disabled={loading || !amount || !address}
                        className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />} Stake
                    </button>
                </div>
            </div>

            {/* Positions */}
            {positions.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-white">Your Positions</h2>
                    {positions.map((pos) => (
                        <div key={pos.positionId} className="card flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <p className="text-white font-medium">{pos.amount} BEZ</p>
                                <p className="text-xs text-slate-500">Rewards: {pos.rewards} BEZ · Since {pos.startDate}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${pos.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                    {pos.status}
                                </span>
                            </div>
                            <button onClick={() => handleUnstake(pos.positionId, pos.amount)} disabled={loading}
                                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50">
                                <Unlock size={14} /> Unstake
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {!address && (
                <div className="card text-center py-8">
                    <p className="text-slate-500">Connect your wallet to view staking positions</p>
                    <a href="/wallet" className="text-bez-primary text-sm mt-2 inline-block">Go to Wallet →</a>
                </div>
            )}
        </div>
    );
}
