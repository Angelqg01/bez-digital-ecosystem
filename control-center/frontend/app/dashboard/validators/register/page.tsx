'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ArrowLeft, Check, Loader2, Info, Zap } from 'lucide-react';
import ValidatorTierBadge from '@/components/ValidatorTierBadge';

const TIER_REQUIREMENTS = [
    { tier: 1, label: 'Bronze', minStake: 10_000, boost: '1.0x', sequencer: false, governance: false, color: 'orange' },
    { tier: 2, label: 'Silver', minStake: 50_000, boost: '1.25x', sequencer: false, governance: true, color: 'gray' },
    { tier: 3, label: 'Gold', minStake: 250_000, boost: '1.5x', sequencer: true, governance: true, color: 'yellow' },
    { tier: 4, label: 'Platinum', minStake: 1_000_000, boost: '2.0x', sequencer: true, governance: true, color: 'cyan' },
];

type Step = 'info' | 'stake' | 'confirm' | 'done';

export default function ValidatorRegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('info');
    const [companyName, setCompanyName] = useState('');
    const [stakeAmount, setStakeAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const stakeNum = parseFloat(stakeAmount) || 0;
    const predictedTier = TIER_REQUIREMENTS.slice().reverse().find(t => stakeNum >= t.minStake)?.tier || 0;

    async function handleSubmit() {
        if (!companyName.trim() || stakeNum < 10_000) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const token = typeof window !== 'undefined' ? localStorage.getItem('bezhas_token') : null;
            const res = await fetch(`${apiBase}/validators/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    company_name: companyName.trim(),
                    stake_amount: stakeNum,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');
            setTxHash(data.tx_hash || null);
            setStep('done');
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error al registrarse');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 max-w-3xl mx-auto space-y-6">
            <button onClick={() => router.push('/dashboard/validators')}
                className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-sm">
                <ArrowLeft className="w-4 h-4" /> Validadores
            </button>

            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Shield className="w-6 h-6 text-cyan-400" /> Registrarse como Validador
                </h1>
                <p className="text-zinc-500 text-sm mt-1">
                    Registra tu empresa como nodo validador de BeZhas L2. Necesitas BEZ para hacer stake.
                </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-xs">
                {(['info', 'stake', 'confirm', 'done'] as Step[]).map((s, i) => (
                    <div key={s} className="flex items-center gap-1">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                            ${step === s ? 'bg-cyan-600 text-white' :
                                (['info', 'stake', 'confirm', 'done'].indexOf(step) > i ? 'bg-emerald-700 text-white' : 'bg-zinc-800 text-zinc-500')}`}>
                            {['info', 'stake', 'confirm', 'done'].indexOf(step) > i ? <Check className="w-3 h-3" /> : i + 1}
                        </span>
                        <span className="text-zinc-400 capitalize hidden sm:inline">{s === 'info' ? 'Información' : s === 'stake' ? 'Stake' : s === 'confirm' ? 'Confirmar' : 'Listo'}</span>
                        {i < 3 && <span className="w-6 h-px bg-zinc-700" />}
                    </div>
                ))}
            </div>

            {/* Step: Info */}
            {step === 'info' && (
                <div className="space-y-4">
                    <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5 space-y-4">
                        <label className="block">
                            <span className="text-sm text-zinc-400">Nombre de la empresa</span>
                            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                                placeholder="Global Logistics S.A."
                                className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-700" />
                        </label>
                        <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-800/50 rounded-lg p-3">
                            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                            <span>El nombre se registrará en el contrato ValidatorRegistry y será visible públicamente en la L2.</span>
                        </div>
                    </div>
                    <button disabled={!companyName.trim()} onClick={() => setStep('stake')}
                        className="px-6 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition">
                        Siguiente
                    </button>
                </div>
            )}

            {/* Step: Stake */}
            {step === 'stake' && (
                <div className="space-y-4">
                    <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5 space-y-4">
                        <label className="block">
                            <span className="text-sm text-zinc-400">Cantidad de BEZ a stakear</span>
                            <div className="relative mt-1">
                                <input type="number" value={stakeAmount} onChange={e => setStakeAmount(e.target.value)}
                                    placeholder="10000" min="10000"
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 pr-16 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-700" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">BEZ</span>
                            </div>
                        </label>

                        {predictedTier > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                                <Zap className="w-4 h-4 text-yellow-400" />
                                <span className="text-zinc-400">Tier resultante:</span>
                                <ValidatorTierBadge tier={predictedTier} size="md" />
                            </div>
                        )}

                        {/* Tier requirements table */}
                        <div className="overflow-hidden rounded-lg border border-zinc-800">
                            <table className="w-full text-xs">
                                <thead className="bg-zinc-800/60 text-zinc-500 uppercase">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Tier</th>
                                        <th className="px-3 py-2 text-right">Min Stake</th>
                                        <th className="px-3 py-2 text-right">Boost</th>
                                        <th className="px-3 py-2 text-center">Sequencer</th>
                                        <th className="px-3 py-2 text-center">Governance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {TIER_REQUIREMENTS.map(t => (
                                        <tr key={t.tier} className={`border-t border-zinc-800/40 ${predictedTier === t.tier ? 'bg-cyan-900/20' : ''}`}>
                                            <td className="px-3 py-2"><ValidatorTierBadge tier={t.tier} /></td>
                                            <td className="px-3 py-2 text-right font-mono text-zinc-300">{t.minStake.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-zinc-300">{t.boost}</td>
                                            <td className="px-3 py-2 text-center">{t.sequencer ? '✅' : '—'}</td>
                                            <td className="px-3 py-2 text-center">{t.governance ? '✅' : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setStep('info')} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition">Atrás</button>
                        <button disabled={stakeNum < 10_000} onClick={() => setStep('confirm')}
                            className="px-6 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition">
                            Siguiente
                        </button>
                    </div>
                </div>
            )}

            {/* Step: Confirm */}
            {step === 'confirm' && (
                <div className="space-y-4">
                    <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5 space-y-3">
                        <h2 className="text-sm font-semibold text-zinc-300">Resumen del registro</h2>
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                            <dt className="text-zinc-500">Empresa</dt>
                            <dd className="text-zinc-100 font-medium">{companyName}</dd>
                            <dt className="text-zinc-500">Stake</dt>
                            <dd className="text-zinc-100 font-mono">{stakeNum.toLocaleString()} BEZ</dd>
                            <dt className="text-zinc-500">Tier</dt>
                            <dd><ValidatorTierBadge tier={predictedTier} /></dd>
                        </dl>
                        {error && <p className="text-red-400 text-xs">{error}</p>}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setStep('stake')} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition">Atrás</button>
                        <button disabled={isSubmitting} onClick={handleSubmit}
                            className="px-6 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 rounded-lg text-sm font-medium transition flex items-center gap-2">
                            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</> : 'Confirmar Registro'}
                        </button>
                    </div>
                </div>
            )}

            {/* Step: Done */}
            {step === 'done' && (
                <div className="bg-zinc-900/70 border border-emerald-800/40 rounded-xl p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-900/40 mx-auto flex items-center justify-center">
                        <Check className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h2 className="text-lg font-bold text-emerald-300">Registro exitoso</h2>
                    <p className="text-sm text-zinc-400">Tu empresa ha sido registrada como validador en BeZhas L2.</p>
                    {txHash && <p className="text-xs text-zinc-500 font-mono break-all">TX: {txHash}</p>}
                    <button onClick={() => router.push('/dashboard/validators')}
                        className="mt-3 px-6 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-sm font-medium transition">
                        Ver Validadores
                    </button>
                </div>
            )}
        </div>
    );
}
