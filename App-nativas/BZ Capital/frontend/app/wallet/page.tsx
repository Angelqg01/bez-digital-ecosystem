'use client';

import { useState } from 'react';
import { Wallet as WalletIcon, Copy, ArrowUpRight, ArrowDownLeft, RefreshCw, Loader2 } from 'lucide-react';
import { useWalletBalance, useWalletHistory, type WalletTx } from '@/lib/hooks';
import { sessionAddress } from '@/lib/api';
import { useAuth } from '@/components/SSOProvider';

function txIcon(type: string) {
    switch (type) {
        case 'send': return <ArrowUpRight size={14} className="text-red-400" />;
        case 'receive': return <ArrowDownLeft size={14} className="text-green-400" />;
        case 'bridge': return <RefreshCw size={14} className="text-blue-400" />;
        default: return <WalletIcon size={14} className="text-purple-400" />;
    }
}

export default function WalletPage() {
    const { loginWithWallet } = useAuth();
    const [address, setAddress] = useState(() => sessionAddress() || '');
    const [sendTo, setSendTo] = useState('');
    const [sendAmount, setSendAmount] = useState('');
    const [sendToken, setSendToken] = useState('BEZ');

    const { data: balance, isLoading: balLoading, mutate: refreshBalance } = useWalletBalance(address || null);
    const { data: historyData, isLoading: histLoading } = useWalletHistory(address || null);
    const transactions: WalletTx[] = historyData?.transactions ?? [];

    // Login SIWE del SSOProvider (nonce de la API): antes se firmaba un mensaje
    // libre y se ignoraba el fallo del login, así que la página «conectaba» una
    // wallet sin sesión y todas las lecturas daban 401.
    const [connectError, setConnectError] = useState('');
    const connectWallet = async () => {
        setConnectError('');
        try {
            const session = await loginWithWallet('login');
            setAddress(session.address);
        } catch (e: unknown) {
            setConnectError(e instanceof Error ? e.message : 'No se pudo conectar la wallet.');
        }
    };

    if (!address) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <div className="w-20 h-20 rounded-full bg-bez-primary/20 flex items-center justify-center">
                    <WalletIcon size={36} className="text-bez-primary" />
                </div>
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white">Connect Your Wallet</h1>
                    <p className="text-slate-400 mt-2">Connect your wallet to view balances and manage assets</p>
                </div>
                <button onClick={connectWallet} className="btn-primary text-lg px-8 py-3">Connect Wallet</button>
                {connectError && <p className="text-sm text-red-400">{connectError}</p>}
            </div>
        );
    }

    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Wallet</h1>
                <p className="text-slate-400 mt-1">Manage your assets across BeZhas L2 and Polygon</p>
            </div>

            {/* Address + Balance */}
            <div className="card">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-slate-400">Connected Wallet</p>
                        <div className="flex items-center gap-2 mt-1">
                            <code className="text-white text-lg">{shortAddr}</code>
                            <button onClick={() => navigator.clipboard.writeText(address)} className="text-slate-400 hover:text-white"><Copy size={16} /></button>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-400">BEZ Balance</p>
                        {balLoading ? (
                            <Loader2 className="animate-spin text-slate-400 ml-auto" size={20} />
                        ) : (
                            <p className="text-2xl font-bold text-white">{balance?.balanceBEZ ?? '0'} BEZ</p>
                        )}
                        <p className="text-xs text-slate-500">ETH: {balance?.balanceETH ?? '0'}</p>
                        <button onClick={() => refreshBalance()} className="text-xs text-slate-500 hover:text-white mt-1 flex items-center gap-1 ml-auto">
                            <RefreshCw size={12} /> Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <a href="/staking" className="btn-secondary flex items-center justify-center gap-2"><WalletIcon size={16} /> Stake</a>
                <a href="/bridge" className="btn-secondary flex items-center justify-center gap-2"><RefreshCw size={16} /> Bridge</a>
                <a href="/farming" className="btn-secondary flex items-center justify-center gap-2"><ArrowUpRight size={16} /> Farm</a>
                <a href="/payments" className="btn-secondary flex items-center justify-center gap-2"><ArrowDownLeft size={16} /> Payments</a>
            </div>

            {/* Send Tokens */}
            <div className="card max-w-lg">
                <h2 className="text-lg font-semibold text-white mb-4">Send Tokens</h2>
                <div className="space-y-3">
                    <div>
                        <label className="text-sm text-slate-400 block mb-1">Recipient</label>
                        <input type="text" value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="0x..."
                            className="w-full bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary" />
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-sm text-slate-400 block mb-1">Amount</label>
                            <input type="number" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.00"
                                className="w-full bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-bez-primary" />
                        </div>
                        <div>
                            <label className="text-sm text-slate-400 block mb-1">Token</label>
                            <select value={sendToken} onChange={(e) => setSendToken(e.target.value)}
                                className="bg-slate-800 border border-bez-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-bez-primary">
                                <option>BEZ</option><option>wBEZ</option><option>ETH</option>
                            </select>
                        </div>
                    </div>
                    <button className="btn-primary w-full mt-2"><ArrowUpRight className="inline mr-2" size={16} /> Send</button>
                </div>
            </div>

            {/* Transaction History */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">Transaction History</h2>
                {histLoading ? (
                    <div className="card flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
                ) : transactions.length === 0 ? (
                    <div className="card text-center text-slate-500 py-8">No transactions yet</div>
                ) : (
                    transactions.map((tx) => (
                        <div key={tx.hash} className="card flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {txIcon(tx.type)}
                                <div>
                                    <p className="text-white text-sm font-medium capitalize">{tx.type}</p>
                                    <p className="text-xs text-slate-500">{tx.to}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium text-white">{tx.value}</p>
                                <p className="text-xs text-slate-500">{tx.timestamp}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
