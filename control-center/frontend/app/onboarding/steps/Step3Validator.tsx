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

type TierDef = { name: string; minStake: number; boostPct: number; color: string };

export default function Step3Validator({ data, update, next }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { data: tiersData } = useSWR<{ tiers: Record<string, TierDef> }>('/validators/tiers', fetcher);

    const tiers = tiersData?.tiers
        ? Object.entries(tiersData.tiers).map(([id, def]) => ({ id, ...def }))
        : [];

    const tierColors: Record<string, string> = {
        bronze: 'border-amber-600/40 bg-amber-600/5',
        silver: 'border-gray-400/40 bg-gray-400/5',
        gold: 'border-yellow-400/40 bg-yellow-400/5',
        platinum: 'border-cyan-300/40 bg-cyan-300/5',
    };

    const registerValidator = async () => {
        if (!data.companyName.trim()) {
            setError('Complete el nombre de empresa en el Paso 1');
            return;
        }
        if (!data.stakeAmount || parseFloat(data.stakeAmount) <= 0) {
            setError('Ingrese una cantidad de stake válida');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('bezhas_token') || '';
            const res = await api.post<{
                success: boolean;
                operatorAddress?: string;
                txHash?: string;
            }>('/validators/register', {
                companyName: data.companyName,
                stakeAmount: data.stakeAmount,
                tier: data.selectedTier || undefined,
                walletAddress: data.walletAddress || undefined,
            }, { token });

            update({
                validatorRegistered: true,
                operatorAddress: res.operatorAddress || data.walletAddress,
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al registrar validador';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="border border-[#0D2040] rounded-xl p-6 bg-[#0C1628]">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    ✅ Paso 3: Registrar como Validador
                </h2>
                <p className="text-[#3D5E80] mt-2 text-sm">
                    Registre su empresa como validador en la red BeZhas.
                    Seleccione un tier y haga stake de tokens BEZ para participar en la validación.
                </p>

                {/* Tier selection */}
                <div className="mt-5">
                    <p className="text-sm text-[#3D5E80] mb-3">Seleccione un Tier</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {tiers.length > 0
                            ? tiers.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() =>
                                        update({
                                            selectedTier: t.id,
                                            stakeAmount: String(t.minStake),
                                        })
                                    }
                                    className={`p-4 rounded-lg border text-center transition-all ${
                                        data.selectedTier === t.id
                                            ? 'ring-2 ring-cyan-500/60 ' + (tierColors[t.id] || 'border-cyan-500/40')
                                            : tierColors[t.id] || 'border-[#0D2040]'
                                    }`}
                                >
                                    <p className="font-semibold">{t.name}</p>
                                    <p className="text-xs text-[#3D5E80] mt-1">
                                        Min: {t.minStake.toLocaleString()} BEZ
                                    </p>
                                    <p className="text-xs text-cyan-400 mt-0.5">
                                        Boost: {t.boostPct / 100}x
                                    </p>
                                </button>
                            ))
                            : ['Bronze', 'Silver', 'Gold', 'Platinum'].map((name, i) => (
                                <button
                                    key={name}
                                    onClick={() =>
                                        update({
                                            selectedTier: name.toLowerCase(),
                                            stakeAmount: String([10000, 50000, 100000, 500000][i]),
                                        })
                                    }
                                    className={`p-4 rounded-lg border text-center transition-all ${
                                        data.selectedTier === name.toLowerCase()
                                            ? 'ring-2 ring-cyan-500/60 ' + (tierColors[name.toLowerCase()] || '')
                                            : tierColors[name.toLowerCase()] || 'border-[#0D2040]'
                                    }`}
                                >
                                    <p className="font-semibold">{name}</p>
                                    <p className="text-xs text-[#3D5E80] mt-1">
                                        Min: {[10000, 50000, 100000, 500000][i].toLocaleString()} BEZ
                                    </p>
                                </button>
                            ))}
                    </div>
                </div>

                {/* Stake amount */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <label className="space-y-1.5">
                        <span className="text-sm text-[#3D5E80]">Cantidad de Stake (BEZ) *</span>
                        <input
                            type="number"
                            className="w-full bg-[#03060E] border border-[#0D2040] rounded-lg px-3 py-2.5
                                       focus:outline-none focus:border-cyan-500/60 transition-colors"
                            placeholder="50000"
                            value={data.stakeAmount}
                            onChange={(e) => update({ stakeAmount: e.target.value })}
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-sm text-[#3D5E80]">Empresa</span>
                        <input
                            className="w-full bg-[#03060E] border border-[#0D2040] rounded-lg px-3 py-2.5
                                       text-[#3D5E80] cursor-not-allowed"
                            value={data.companyName || '(Complete en Paso 1)'}
                            readOnly
                        />
                    </label>
                </div>

                {error && (
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {data.validatorRegistered ? (
                    <div className="mt-5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <p className="text-emerald-400 font-medium">✓ Validador registrado exitosamente</p>
                        {data.operatorAddress && (
                            <p className="text-sm text-[#3D5E80] mt-1 break-all">
                                Operator: <code className="text-cyan-400">{data.operatorAddress}</code>
                            </p>
                        )}
                        <button
                            onClick={next}
                            className="mt-3 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm transition-colors"
                        >
                            Continuar al Paso 4 →
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={registerValidator}
                        disabled={loading}
                        className="mt-6 px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-medium
                                   transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                        {loading ? 'Registrando...' : 'Registrar Validador'}
                    </button>
                )}
            </div>

            {/* CLI fallback */}
            <div className="border border-[#0D2040] rounded-xl p-5 bg-[#0C1628]/50">
                <h3 className="text-sm font-semibold text-[#3D5E80]">🖥️ Alternativa: Registro por CLI</h3>
                <p className="text-xs text-[#3D5E80] mt-1">
                    Si prefiere registrar manualmente vía terminal:
                </p>
                <pre className="mt-2 p-3 bg-[#03060E] border border-[#0D2040] rounded-lg overflow-auto text-xs text-cyan-400/80">
{`node scripts/register-validator.js \\
  --chainId ${process.env.NEXT_PUBLIC_CHAIN_ID || '2708'} \\
  --rpcUrl ${process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'} \\
  --companyName "${data.companyName || 'MiEmpresa'}" \\
  --stakeAmountEth ${data.stakeAmount || '50000'} \\
  --privateKey <DEPLOYER_PRIVATE_KEY> \\
  --heartbeat --registerNode`}
                </pre>
            </div>
        </div>
    );
}
