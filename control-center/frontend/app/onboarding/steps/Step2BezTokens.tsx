'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '../../../lib/api';
import type { OnboardingData } from '../page';

interface Props {
    data: OnboardingData;
    update: (d: Partial<OnboardingData>) => void;
    next: () => void;
    prev: () => void;
}

interface BalanceRes {
    balance: string;
    formatted: string;
}

export default function Step2BezTokens({ data, update, next }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [method, setMethod] = useState<'bridge' | 'faucet'>('bridge');

    // Fetch current BEZ balance if wallet exists
    const { data: balanceData, mutate: refreshBalance } = useSWR<BalanceRes>(
        data.walletAddress ? `/wallet/${data.walletAddress}/balance` : null,
        fetcher,
        { refreshInterval: 10000 },
    );

    const acquireTokens = async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('bezhas_token') || '';
            if (method === 'faucet') {
                await api.post('/wallet/faucet', {
                    address: data.walletAddress || data.operatorAddress,
                    amount: data.bridgeAmount,
                }, { token });
            } else {
                await api.post('/bridge/deposit', {
                    to: data.walletAddress || data.operatorAddress,
                    amount: data.bridgeAmount,
                    token: 'BEZ',
                }, { token });
            }
            await refreshBalance();
            update({ tokensAcquired: true, bezBalance: data.bridgeAmount });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al adquirir tokens';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const markDone = () => {
        update({ tokensAcquired: true });
        next();
    };

    return (
        <div className="space-y-6">
            <div className="border border-[#0D2040] rounded-xl p-6 bg-[#0C1628]">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    💰 Paso 2: Adquirir Tokens BEZ
                </h2>
                <p className="text-[#3D5E80] mt-2 text-sm">
                    Necesitará tokens BEZ para hacer stake como validador.
                    El mínimo requerido depende del tier seleccionado (desde 10,000 BEZ).
                </p>

                {/* Balance display */}
                <div className="mt-5 p-4 rounded-lg bg-[#03060E] border border-[#0D2040] flex items-center justify-between">
                    <div>
                        <p className="text-xs text-[#3D5E80]">Balance actual</p>
                        <p className="text-2xl font-bold text-cyan-400 mt-0.5">
                            {balanceData?.formatted || data.bezBalance || '0'} <span className="text-base text-[#3D5E80]">BEZ</span>
                        </p>
                    </div>
                    {data.walletAddress && (
                        <div className="text-right">
                            <p className="text-xs text-[#3D5E80]">Wallet</p>
                            <p className="text-xs text-cyan-400/60 font-mono">
                                {data.walletAddress.slice(0, 8)}...{data.walletAddress.slice(-6)}
                            </p>
                        </div>
                    )}
                </div>

                {/* Acquisition method */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                        onClick={() => setMethod('bridge')}
                        className={`p-4 rounded-lg border text-left transition-all ${
                            method === 'bridge'
                                ? 'border-cyan-500/60 bg-cyan-500/5'
                                : 'border-[#0D2040] hover:border-[#1A3055]'
                        }`}
                    >
                        <span className="text-lg">🌉</span>
                        <p className="font-medium mt-1">Bridge desde L1</p>
                        <p className="text-xs text-[#3D5E80] mt-0.5">
                            Transfiera ETH/tokens desde Ethereum mainnet al L2 BeZhas
                        </p>
                    </button>
                    <button
                        onClick={() => setMethod('faucet')}
                        className={`p-4 rounded-lg border text-left transition-all ${
                            method === 'faucet'
                                ? 'border-cyan-500/60 bg-cyan-500/5'
                                : 'border-[#0D2040] hover:border-[#1A3055]'
                        }`}
                    >
                        <span className="text-lg">🚰</span>
                        <p className="font-medium mt-1">Faucet (Testnet)</p>
                        <p className="text-xs text-[#3D5E80] mt-0.5">
                            Obtener BEZ de prueba para desarrollo y testing
                        </p>
                    </button>
                </div>

                {/* Amount */}
                <label className="block mt-5 space-y-1.5">
                    <span className="text-sm text-[#3D5E80]">Cantidad a adquirir (BEZ)</span>
                    <input
                        type="number"
                        className="w-full bg-[#03060E] border border-[#0D2040] rounded-lg px-3 py-2.5
                                   focus:outline-none focus:border-cyan-500/60 transition-colors"
                        placeholder="50000"
                        value={data.bridgeAmount}
                        onChange={(e) => update({ bridgeAmount: e.target.value })}
                    />
                </label>

                {error && (
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {data.tokensAcquired ? (
                    <div className="mt-5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <p className="text-emerald-400 font-medium">✓ Tokens adquiridos</p>
                        <button
                            onClick={next}
                            className="mt-3 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm transition-colors"
                        >
                            Continuar al Paso 3 →
                        </button>
                    </div>
                ) : (
                    <div className="mt-5 flex items-center gap-3">
                        <button
                            onClick={acquireTokens}
                            disabled={loading}
                            className="px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-medium
                                       transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {loading
                                ? 'Procesando...'
                                : method === 'bridge'
                                    ? 'Iniciar Bridge'
                                    : 'Solicitar desde Faucet'}
                        </button>
                        <button
                            onClick={markDone}
                            className="px-4 py-3 rounded-lg border border-[#0D2040] hover:bg-[#0C1628]
                                       text-sm text-[#3D5E80] transition-colors"
                        >
                            Ya tengo BEZ — Omitir
                        </button>
                    </div>
                )}
            </div>

            {/* Tier reference */}
            <div className="border border-[#0D2040] rounded-xl p-5 bg-[#0C1628]/50">
                <h3 className="text-sm font-semibold text-[#3D5E80]">📊 Requisitos de Stake por Tier</h3>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { name: 'Bronze', min: '10,000', color: 'text-amber-600' },
                        { name: 'Silver', min: '50,000', color: 'text-gray-300' },
                        { name: 'Gold', min: '100,000', color: 'text-yellow-400' },
                        { name: 'Platinum', min: '500,000', color: 'text-cyan-300' },
                    ].map((t) => (
                        <div key={t.name} className="p-3 rounded-lg bg-[#03060E] border border-[#0D2040] text-center">
                            <p className={`font-semibold ${t.color}`}>{t.name}</p>
                            <p className="text-xs text-[#3D5E80] mt-1">Min: {t.min} BEZ</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
