'use client';

import { useState } from 'react';
import { api } from '../../../lib/api';
import type { OnboardingData } from '../page';

interface Props {
    data: OnboardingData;
    update: (d: Partial<OnboardingData>) => void;
    next: () => void;
    prev: () => void;
}

export default function Step1Wallet({ data, update, next }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const createWallet = async () => {
        if (!data.companyName.trim()) {
            setError('Ingrese el nombre de la empresa');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('bezhas_token') || '';
            const res = await api.post<{
                success: boolean;
                walletAddress: string;
            }>('/wallet/create', {
                guardian: data.guardian || undefined,
                dailyLimit: parseFloat(data.dailyLimit) || 0,
                salt: data.companyName.toLowerCase().replace(/\s+/g, '-'),
            }, { token });

            if (res.walletAddress) {
                update({
                    walletAddress: res.walletAddress,
                    walletCreated: true,
                });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al crear wallet';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="border border-[#0D2040] rounded-xl p-6 bg-[#0C1628]">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    🏦 Paso 1: Crear Wallet Empresarial
                </h2>
                <p className="text-[#3D5E80] mt-2 text-sm">
                    Cree una Smart Wallet (Account Abstraction) para su empresa.
                    Esta wallet será el punto de acceso a todas las operaciones en BeZhas L2.
                </p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <label className="space-y-1.5">
                        <span className="text-sm text-[#3D5E80]">Nombre de la empresa *</span>
                        <input
                            className="w-full bg-[#03060E] border border-[#0D2040] rounded-lg px-3 py-2.5
                                       focus:outline-none focus:border-cyan-500/60 transition-colors"
                            placeholder="Mi Empresa S.A."
                            value={data.companyName}
                            onChange={(e) => update({ companyName: e.target.value })}
                        />
                    </label>

                    <label className="space-y-1.5">
                        <span className="text-sm text-[#3D5E80]">
                            Guardian Address <span className="text-[#2A4060]">(Opcional)</span>
                        </span>
                        <input
                            className="w-full bg-[#03060E] border border-[#0D2040] rounded-lg px-3 py-2.5
                                       focus:outline-none focus:border-cyan-500/60 transition-colors"
                            placeholder="0x..."
                            value={data.guardian}
                            onChange={(e) => update({ guardian: e.target.value })}
                        />
                    </label>

                    <label className="space-y-1.5">
                        <span className="text-sm text-[#3D5E80]">Límite diario (BEZ)</span>
                        <input
                            type="number"
                            className="w-full bg-[#03060E] border border-[#0D2040] rounded-lg px-3 py-2.5
                                       focus:outline-none focus:border-cyan-500/60 transition-colors"
                            placeholder="1000"
                            value={data.dailyLimit}
                            onChange={(e) => update({ dailyLimit: e.target.value })}
                        />
                    </label>
                </div>

                {error && (
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {data.walletCreated ? (
                    <div className="mt-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <p className="text-emerald-400 font-medium">✓ Wallet creada exitosamente</p>
                        <p className="text-sm text-[#3D5E80] mt-1 break-all">
                            Dirección: <code className="text-cyan-400">{data.walletAddress}</code>
                        </p>
                        <button
                            onClick={next}
                            className="mt-3 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm
                                       transition-colors"
                        >
                            Continuar al Paso 2 →
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={createWallet}
                        disabled={loading}
                        className="mt-6 px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-medium
                                   transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                        {loading ? 'Creando wallet...' : 'Crear Smart Wallet'}
                    </button>
                )}
            </div>

            {/* Info card */}
            <div className="border border-[#0D2040] rounded-xl p-5 bg-[#0C1628]/50">
                <h3 className="text-sm font-semibold text-[#3D5E80]">ℹ️ ¿Qué es una Smart Wallet?</h3>
                <ul className="mt-2 text-sm text-[#3D5E80] space-y-1 list-disc list-inside">
                    <li>Wallet con Account Abstraction (ERC-4337) para operaciones empresariales</li>
                    <li>Soporte para guardian (recuperación social) y límites diarios</li>
                    <li>Compatible con MultiSig para aprobaciones multi-firma</li>
                    <li>Gas patrocinado por la red BeZhas para empresas verificadas</li>
                </ul>
            </div>
        </div>
    );
}
