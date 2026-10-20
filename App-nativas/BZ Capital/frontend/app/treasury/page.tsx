'use client';

import { PieChart, TrendingUp, DollarSign, BarChart3, ExternalLink, Loader2 } from 'lucide-react';
import { useTreasuryOverview, useTokenInfo } from '@/lib/hooks';

// Treasury DAO (CLAUDE.md, «Contratos deployados»).
const TREASURY_DAO = '0x89c23890c742d710265dD61be789C71dC8999b12';

const fmt = (v: string | number | null | undefined) =>
    v === null || v === undefined ? '—' : Number(v).toLocaleString('es-ES', { maximumFractionDigits: 2 });

export default function TreasuryPage() {
    const { data: treasury, error: tErr, isLoading: tLoading } = useTreasuryOverview();
    const { data: token } = useTokenInfo();

    // Antes la página esperaba totalFunds/allocations/recentSpends, que la API
    // nunca ha devuelto, y rellenaba seis sectores con «0 BEZ». Sólo lo real.
    const metrics = [
        { label: 'BEZ en staking', value: treasury ? `${fmt(treasury.totalStaked)} BEZ` : '—', icon: DollarSign },
        { label: 'Liquidez en farming', value: treasury ? `${fmt(treasury.totalFarming)} LP` : '—', icon: BarChart3 },
        { label: 'Volumen del bridge', value: treasury ? `${fmt(treasury.bridgeVolume)} BEZ` : '—', icon: TrendingUp },
        { label: 'Usuarios', value: treasury ? fmt(treasury.totalUsers) : '—', icon: PieChart },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Treasury</h1>
                <p className="text-slate-400 mt-1">Fondos del protocolo y del DAO, con datos de la API y de Polygon</p>
            </div>

            {tErr && (
                <div className="card border-red-500/30 bg-red-500/10 text-red-300 text-sm">
                    {tErr.message || 'No se pudieron cargar los datos de tesorería.'}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {metrics.map(({ label, value, icon: Icon }) => (
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

            <div className="card grid gap-4 md:grid-cols-2">
                <div>
                    <p className="text-sm text-slate-400">Token</p>
                    <p className="text-xl font-bold text-white mt-1">{token ? `${token.name} (${token.symbol})` : '—'}</p>
                    <p className="text-sm text-slate-400 mt-3">Supply total</p>
                    <p className="text-lg text-white">{token?.totalSupply ? `${fmt(token.totalSupply)} ${token.symbol}` : 'No disponible ahora mismo'}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-400">Treasury DAO (Polygon)</p>
                    <a
                        href={`https://polygonscan.com/address/${TREASURY_DAO}`}
                        target="_blank" rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-2 font-mono text-sm text-bez-primary break-all hover:underline"
                    >
                        {TREASURY_DAO} <ExternalLink size={14} />
                    </a>
                    {treasury?.updatedAt && (
                        <p className="text-xs text-slate-500 mt-3">Actualizado: {new Date(treasury.updatedAt).toLocaleString('es-ES')}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
