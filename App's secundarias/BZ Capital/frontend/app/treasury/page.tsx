'use client';

import { PieChart, TrendingUp, DollarSign, BarChart3, ExternalLink, Loader2 } from 'lucide-react';
import { useTreasuryOverview, useTokenInfo } from '@/lib/hooks';

const SECTOR_COLORS = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500',
    'bg-yellow-500', 'bg-red-500', 'bg-cyan-500',
    'bg-pink-500', 'bg-orange-500', 'bg-teal-500',
];

export default function TreasuryPage() {
    const { data: treasury, error: tErr, isLoading: tLoading } = useTreasuryOverview();
    const { data: token } = useTokenInfo();

    const allocations = treasury?.allocations ?? [];
    const recentSpends = treasury?.recentSpends ?? [];
    const totalFunds = treasury?.totalFunds ?? '—';

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Treasury</h1>
                <p className="text-slate-400 mt-1">DAO treasury allocations and spending transparency</p>
            </div>

            {tErr && (
                <div className="card border-red-500/30 bg-red-500/10 text-red-300 text-sm">
                    Failed to load treasury data. Please try again later.
                </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Treasury', value: totalFunds, icon: DollarSign },
                    { label: 'Token', value: token ? `${token.symbol}` : '—', icon: PieChart },
                    { label: 'Total Supply', value: token?.totalSupply ?? '—', icon: TrendingUp },
                    { label: 'Allocations', value: `${allocations.length} sectors`, icon: BarChart3 },
                ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="card">
                        <div className="flex items-center gap-3 mb-2">
                            <Icon size={18} className="text-bez-primary" />
                            <span className="text-sm text-slate-400">{label}</span>
                        </div>
                        {tLoading ? (
                            <Loader2 size={20} className="animate-spin text-slate-500" />
                        ) : (
                            <p className="text-xl font-bold text-white">{value}</p>
                        )}
                    </div>
                ))}
            </div>

            {/* Allocation Chart */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Fund Allocation</h2>
                {tLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={28} className="animate-spin text-slate-500" /></div>
                ) : allocations.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No allocation data available</p>
                ) : (
                    <div className="space-y-3">
                        {allocations.map((fund, i) => (
                            <div key={fund.sector}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-300">{fund.sector}</span>
                                    <span className="text-slate-400">{fund.percentage}% · {fund.amount}</span>
                                </div>
                                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${SECTOR_COLORS[i % SECTOR_COLORS.length]} rounded-full`}
                                        style={{ width: `${fund.percentage}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Sector Funds (derived from allocations) */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Sector Investment Funds</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {allocations.length > 0 ? allocations.map((s) => (
                        <div key={s.sector} className="bg-slate-800/50 rounded-lg p-4 border border-bez-border">
                            <p className="text-white font-medium">{s.sector}</p>
                            <p className="text-2xl font-bold text-white mt-2">{s.amount}</p>
                            <p className="text-xs text-slate-500 mt-1">{s.percentage}% of total</p>
                        </div>
                    )) : (
                        ['Agriculture', 'Technology', 'Real Estate', 'Education', 'Healthcare', 'Energy'].map((sector) => (
                            <div key={sector} className="bg-slate-800/50 rounded-lg p-4 border border-bez-border">
                                <p className="text-white font-medium">{sector}</p>
                                <p className="text-2xl font-bold text-white mt-2">0 BEZ</p>
                                <p className="text-xs text-slate-500 mt-1">0 proposals · 0 active</p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">Recent Treasury Activity</h2>
                {tLoading ? (
                    <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-slate-500" /></div>
                ) : recentSpends.length === 0 ? (
                    <div className="card text-center text-slate-500 py-8">No recent activity</div>
                ) : (
                    recentSpends.map((tx, i) => (
                        <div key={i} className="card flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div>
                                <p className="text-white text-sm font-medium">{tx.description}</p>
                                <p className="text-xs text-slate-500">{tx.date}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <p className={`text-sm font-medium ${tx.amount.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                                    {tx.amount}
                                </p>
                                <ExternalLink size={14} className="text-slate-600" />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
