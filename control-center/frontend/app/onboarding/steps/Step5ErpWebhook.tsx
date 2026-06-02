'use client';

import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import type { OnboardingData } from '../page';

interface Props {
    data: OnboardingData;
    update: (d: Partial<OnboardingData>) => void;
    next: () => void;
    prev: () => void;
}

const REQUIRED_TIERS = ['professional', 'enterprise'];
const REQUIRED_TIERS_LABEL = 'Professional o Enterprise';

const ERP_TYPES = [
    { id: 'sap', label: 'SAP S/4HANA', icon: '🏭' },
    { id: 'oracle', label: 'Oracle ERP', icon: '🔶' },
    { id: 'dynamics', label: 'Microsoft Dynamics', icon: '🔷' },
    { id: 'shopify', label: 'Shopify', icon: '🛒' },
    { id: 'woocommerce', label: 'WooCommerce', icon: '🛍️' },
    { id: 'generic', label: 'Custom / Genérico', icon: '⚙️' },
];

const SECTORS = [
    'Agro', 'Salud', 'Educación', 'Logística', 'Gobierno', 'Energía',
    'Finanzas', 'Retail', 'Manufactura', 'Inmobiliario', 'Turismo',
    'Tecnología', 'Legal', 'Telecomunicaciones', 'Construcción', 'Minería',
];

export default function Step5ErpWebhook({ data, update }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [testResult, setTestResult] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
    const [tierEligible, setTierEligible] = useState<boolean | null>(null);
    const [currentTier, setCurrentTier] = useState<string>('');

    // Check subscription tier on mount
    useEffect(() => {
        (async () => {
            try {
                const token = localStorage.getItem('bezhas_token') || '';
                const res = await api.get<{ tier?: string }>('/ai-billing/subscription', { token });
                const tier = res.tier || 'free';
                setCurrentTier(tier);
                setTierEligible(REQUIRED_TIERS.includes(tier));
            } catch {
                // If check fails, allow through (backend will enforce)
                setTierEligible(true);
            }
        })();
    }, []);

    const toggleSector = (sector: string) => {
        const current = data.selectedSectors;
        const next = current.includes(sector)
            ? current.filter((s) => s !== sector)
            : [...current, sector];
        update({ selectedSectors: next });
    };

    const saveWebhook = async () => {
        if (!data.webhookUrl.trim()) {
            setError('Ingrese la URL del webhook');
            return;
        }
        if (data.selectedSectors.length === 0) {
            setError('Seleccione al menos un sector');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('bezhas_token') || '';
            await api.post('/config/webhooks/setup', {
                erpType: data.erpType,
                url: data.webhookUrl,
                secret: data.webhookSecret || undefined,
                sectors: data.selectedSectors,
                walletAddress: data.walletAddress || undefined,
            }, { token });
            update({ webhookConfigured: true });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al configurar webhook';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const testWebhook = async () => {
        if (!data.webhookUrl.trim()) {
            setError('Ingrese la URL del webhook primero');
            return;
        }
        setTestResult('testing');
        setError('');
        try {
            const token = localStorage.getItem('bezhas_token') || '';
            const res = await api.post<{ success: boolean }>('/config/webhooks/test', {
                url: data.webhookUrl,
                secret: data.webhookSecret || undefined,
            }, { token });
            setTestResult(res.success ? 'ok' : 'fail');
        } catch {
            setTestResult('fail');
        }
    };

    return (
        <div className="space-y-6">
            <div className="border border-[#0D2040] rounded-xl p-6 bg-[#0C1628]">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    🔗 Paso 5: Configurar ERP / Webhook
                </h2>
                <p className="text-[#3D5E80] mt-2 text-sm">
                    Conecte su sistema ERP con la blockchain BeZhas para notarización automática
                    de transacciones, trazabilidad y auditoría en tiempo real.
                </p>

                {/* Tier eligibility gate */}
                {tierEligible === false && (
                    <div className="mt-5 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                        <p className="text-amber-400 font-medium">
                            ⚠ Webhooks requieren plan {REQUIRED_TIERS_LABEL}
                        </p>
                        <p className="text-sm text-[#3D5E80] mt-1">
                            Su plan actual es <span className="text-white font-medium">{currentTier}</span>.
                            Los webhooks ERP solo están disponibles para suscripciones{' '}
                            <span className="text-cyan-400">{REQUIRED_TIERS_LABEL}</span>.
                        </p>
                        <a
                            href="/settings/billing"
                            className="inline-block mt-3 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500
                                       text-sm font-medium transition-colors"
                        >
                            Actualizar Suscripción →
                        </a>
                    </div>
                )}

                {tierEligible === null && (
                    <p className="mt-4 text-sm text-[#3D5E80] animate-pulse">Verificando elegibilidad...</p>
                )}

                {/* ERP Type selection */}
                {tierEligible && (<>
                <div className="mt-5">
                    <p className="text-sm text-[#3D5E80] mb-3">Tipo de ERP</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {ERP_TYPES.map((erp) => (
                            <button
                                key={erp.id}
                                onClick={() => update({ erpType: erp.id })}
                                className={`p-3 rounded-lg border text-left transition-all ${
                                    data.erpType === erp.id
                                        ? 'border-cyan-500/60 bg-cyan-500/5'
                                        : 'border-[#0D2040] hover:border-[#1A3055]'
                                }`}
                            >
                                <span className="text-lg">{erp.icon}</span>
                                <p className="text-sm font-medium mt-1">{erp.label}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Webhook URL + Secret */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <label className="space-y-1.5">
                        <span className="text-sm text-[#3D5E80]">Webhook URL *</span>
                        <input
                            className="w-full bg-[#03060E] border border-[#0D2040] rounded-lg px-3 py-2.5
                                       focus:outline-none focus:border-cyan-500/60 transition-colors"
                            placeholder="https://mi-erp.com/api/bezhas/webhook"
                            value={data.webhookUrl}
                            onChange={(e) => update({ webhookUrl: e.target.value })}
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-sm text-[#3D5E80]">
                            Webhook Secret <span className="text-[#2A4060]">(Opcional)</span>
                        </span>
                        <input
                            type="password"
                            className="w-full bg-[#03060E] border border-[#0D2040] rounded-lg px-3 py-2.5
                                       focus:outline-none focus:border-cyan-500/60 transition-colors"
                            placeholder="whsec_..."
                            value={data.webhookSecret}
                            onChange={(e) => update({ webhookSecret: e.target.value })}
                        />
                    </label>
                </div>

                {/* Test webhook */}
                <div className="mt-4 flex items-center gap-3">
                    <button
                        onClick={testWebhook}
                        disabled={testResult === 'testing'}
                        className="px-4 py-2 rounded-lg bg-[#0D2040] hover:bg-[#1A3055] text-sm
                                   transition-colors disabled:opacity-50"
                    >
                        {testResult === 'testing' ? 'Probando...' : '🧪 Probar Webhook'}
                    </button>
                    {testResult === 'ok' && (
                        <span className="text-emerald-400 text-sm">✓ Webhook respondió correctamente</span>
                    )}
                    {testResult === 'fail' && (
                        <span className="text-amber-400 text-sm">⚠ Webhook no respondió</span>
                    )}
                </div>

                {/* Sector selection */}
                <div className="mt-6">
                    <p className="text-sm text-[#3D5E80] mb-3">
                        Sectores a monitorear <span className="text-[#2A4060]">(seleccione los que apliquen)</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {SECTORS.map((sector) => (
                            <button
                                key={sector}
                                onClick={() => toggleSector(sector)}
                                className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                                    data.selectedSectors.includes(sector)
                                        ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-400'
                                        : 'border-[#0D2040] text-[#3D5E80] hover:border-[#1A3055]'
                                }`}
                            >
                                {sector}
                            </button>
                        ))}
                    </div>
                    {data.selectedSectors.length > 0 && (
                        <p className="text-xs text-[#3D5E80] mt-2">
                            {data.selectedSectors.length} sector(es) seleccionado(s)
                        </p>
                    )}
                </div>

                {error && (
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {data.webhookConfigured ? (
                    <div className="mt-5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <p className="text-emerald-400 font-medium">✓ Webhook configurado exitosamente</p>
                        <p className="text-sm text-[#3D5E80] mt-1">
                            ERP: {ERP_TYPES.find((e) => e.id === data.erpType)?.label || data.erpType} ·{' '}
                            {data.selectedSectors.length} sectores
                        </p>
                        <div className="mt-3 p-4 rounded-lg bg-[#03060E] border border-emerald-500/20">
                            <p className="text-emerald-400 font-semibold text-lg">
                                🎉 ¡Onboarding Completo!
                            </p>
                            <p className="text-sm text-[#3D5E80] mt-1">
                                Su empresa está configurada como validador en la red BeZhas.
                                Visite el Dashboard para monitorear sus operaciones.
                            </p>
                            <a
                                href="/dashboard"
                                className="inline-block mt-3 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500
                                           text-sm font-medium transition-colors"
                            >
                                Ir al Dashboard →
                            </a>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={saveWebhook}
                        disabled={loading}
                        className="mt-6 px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-medium
                                   transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                        {loading ? 'Guardando...' : 'Guardar Configuración Webhook'}
                    </button>
                )}
                </>)}
            </div>

            {/* Webhook payload example */}
            <div className="border border-[#0D2040] rounded-xl p-5 bg-[#0C1628]/50">
                <h3 className="text-sm font-semibold text-[#3D5E80]">📨 Ejemplo de Payload del Webhook</h3>
                <pre className="mt-2 p-3 bg-[#03060E] border border-[#0D2040] rounded-lg overflow-auto text-xs text-cyan-400/80">
{`{
  "event": "transaction.notarized",
  "sector": "Logística",
  "timestamp": "2026-04-01T12:00:00Z",
  "data": {
    "txHash": "0xabc...def",
    "blockNumber": 12345,
    "operator": "0x1234...5678",
    "amount": "1500.00",
    "metadata": {
      "invoiceId": "INV-2026-001",
      "origin": "SAP"
    }
  },
  "signature": "hmac-sha256:..."
}`}
                </pre>
            </div>
        </div>
    );
}
