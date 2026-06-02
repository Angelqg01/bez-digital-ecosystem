'use client';

import { useMemo, useState } from 'react';
import { useAnalyticsDelta, useChartData, useForecast, useRealtimeKpis, useStats, useBlockchainSSE } from '@/lib/hooks';
import { api } from '@/lib/api';
import useSWR from 'swr';
import StatCard from '@/components/StatCard';
import {
    BarChart3, TrendingUp, Clock, Zap, Activity, Building2, FileCode2,
    Users, Wifi, WifiOff, Database, Layers, ArrowRightLeft, Fuel,
    TrendingDown, Minus, ExternalLink, Radio, Sprout, Award, ShieldCheck,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend, Area,
} from 'recharts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFarmingStats, useStakingPoolStats } from '@/lib/defi-hooks';
import { useBridgeContractStats } from '@/lib/bridge-onchain-hooks';
import { useValidatorRegistryOnChain } from '@/lib/validator-hooks';

// ── Cross-page navigation for analytics ecosystem ──
const ANALYTICS_PAGES = [
    { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, description: 'KPIs & Forecast' },
    { href: '/dashboard/market', label: 'Market', icon: TrendingUp, description: 'BEZ & Mercado' },
    { href: '/dashboard/transactions', label: 'Transacciones', icon: Layers, description: 'TX Explorer' },
    { href: '/dashboard/gas', label: 'Gas Tanks', icon: Fuel, description: 'Gas & Facturación' },
    { href: '/dashboard/bridge', label: 'Bridge', icon: ArrowRightLeft, description: 'L1 ↔ L2' },
] as const;

function AnalyticsEcosystemNav() {
    const pathname = usePathname();
    return (
        <nav className="flex gap-2 overflow-x-auto pb-1">
            {ANALYTICS_PAGES.map(({ href, label, icon: Icon, description }) => {
                const active = pathname === href;
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm whitespace-nowrap transition-all ${active
                            ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                            : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        <Icon className="w-4 h-4 shrink-0" />
                        <div className="flex flex-col leading-tight">
                            <span className="font-medium text-xs">{label}</span>
                            <span className="text-[10px] text-gray-400">{description}</span>
                        </div>
                    </Link>
                );
            })}
        </nav>
    );
}

// ── Platform analytics types & hook ──
interface PlatformAnalytics {
    users: { total: number; active24h: number; active7d: number; new24h: number };
    transactions: { total: number; volume_bez: number; today: number };
    nfts: { total: number; minted24h: number };
    telemetry: { total: number };
}

function usePlatformAnalytics() {
    return useSWR<PlatformAnalytics>('/analytics/platform', (url: string) => api.get<PlatformAnalytics>(url), {
        revalidateOnFocus: false,
        dedupingInterval: 30000,
        refreshInterval: 30000,
        onErrorRetry: (_err, _key, _config, revalidate, { retryCount }) => {
            if (retryCount >= 2) return;
            setTimeout(() => revalidate({ retryCount }), 5000);
        },
    });
}

export default function AnalyticsPage() {
    const [windowDays, setWindowDays] = useState<7 | 14 | 30>(7);
    const [forecastMetric, setForecastMetric] = useState<'transactions' | 'gas_used' | 'nfts_minted'>('transactions');
    const [forecastHorizon, setForecastHorizon] = useState<7 | 14 | 30>(7);
    const { data: stats, isLoading } = useStats();
    const { data: realtimeKpis, isLoading: kpisLoading } = useRealtimeKpis();
    const { data: chartWindow } = useChartData(windowDays);
    const { data: chart30 } = useChartData(30);
    const { data: chartForForecast } = useChartData(forecastHorizon);
    const { data: forecastSeries } = useForecast(forecastMetric, forecastHorizon);
    const { data: periodDelta } = useAnalyticsDelta(forecastMetric, forecastHorizon);
    const { data: platform } = usePlatformAnalytics();
    const { events: liveEvents, connected: sseConnected } = useBlockchainSSE();

    // ── On-chain DeFi stats (FASE 3) ──
    const { stats: farmingStats, pools: farmingPools } = useFarmingStats();
    const { stats: stakingStats } = useStakingPoolStats();
    const { stats: bridgeOnChain } = useBridgeContractStats();
    const { stats: validatorStats } = useValidatorRegistryOnChain();

    const farmingTVL = farmingPools.reduce((s, p) => s + parseFloat(p.tvl || '0'), 0);

    const forecastLabel =
        forecastMetric === 'transactions'
            ? 'TX'
            : forecastMetric === 'gas_used'
                ? 'Gas'
                : 'NFTs';

    const forecastComparisonData = useMemo(() => {
        const history = (chartForForecast ?? []).map((point) => ({
            date: point.date,
            actual: point[forecastMetric],
            predicted: null as number | null,
            lower: null as number | null,
            upper: null as number | null,
        }));

        const forecast = (forecastSeries?.points ?? []).map((point) => ({
            date: point.date,
            actual: null as number | null,
            predicted: point.predicted,
            lower: point.lower,
            upper: point.upper,
        }));

        return [...history, ...forecast];
    }, [chartForForecast, forecastMetric, forecastSeries]);

    const forecastInsights = useMemo(() => {
        const lastHistorical = chartForForecast?.[chartForForecast.length - 1]?.[forecastMetric] ?? null;
        const firstPredicted = forecastSeries?.points?.[0]?.predicted ?? null;
        if (lastHistorical == null || firstPredicted == null || lastHistorical === 0) {
            return null;
        }

        const deltaAbs = firstPredicted - lastHistorical;
        const deltaPct = (deltaAbs / lastHistorical) * 100;
        return {
            lastHistorical,
            firstPredicted,
            deltaAbs,
            deltaPct,
        };
    }, [chartForForecast, forecastMetric, forecastSeries]);

    const formatMetricValue = (value: number) => {
        if (forecastMetric === 'gas_used') return Math.round(value).toLocaleString();
        return Number(value.toFixed(2)).toLocaleString();
    };

    return (
        <div className="space-y-6">
            {/* Cross-page navigation */}
            <AnalyticsEcosystemNav />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BarChart3 className="w-7 h-7 text-bezhas-accent" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                        <p className="text-sm text-gray-500">Metricas del ecosistema BeZhas L2</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {sseConnected ? (
                        <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                            <Radio className="w-3 h-3 animate-pulse" /> Live
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                            <WifiOff className="w-3 h-3" /> Offline
                        </span>
                    )}
                </div>
            </div>

            {/* Main KPI cards — blockchain core */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="TPS Actual" value={isLoading ? '...' : (stats?.tps ?? 0)} icon={<Zap className="w-5 h-5" />} />
                <StatCard label="Block Height" value={isLoading ? '...' : (stats?.block_height ?? 0).toLocaleString()} icon={<TrendingUp className="w-5 h-5" />} />
                <StatCard label="Total TXs" value={isLoading ? '...' : (stats?.total_transactions ?? 0).toLocaleString()} icon={<BarChart3 className="w-5 h-5" />} />
                <StatCard label="Gas Total" value={isLoading ? '...' : `${stats?.total_gas_used ?? '0'} BEZ`} icon={<Clock className="w-5 h-5" />} />
            </div>

            {/* Secondary KPI cards — enterprise + contracts + NFTs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Empresas Activas"
                    value={isLoading ? '...' : (stats?.active_enterprises ?? 0)}
                    icon={<Building2 className="w-5 h-5" />}
                />
                <StatCard
                    label="Contratos Desplegados"
                    value={isLoading ? '...' : (stats?.active_contracts ?? 0)}
                    icon={<FileCode2 className="w-5 h-5" />}
                />
                <StatCard
                    label="NFTs Totales"
                    value={isLoading ? '...' : (stats?.total_nfts ?? 0).toLocaleString()}
                    icon={<Database className="w-5 h-5" />}
                />
                <StatCard
                    label="Modelo Forecast"
                    value={forecastSeries?.model ?? 'cargando...'}
                    sub={forecastSeries ? `Generado: ${new Date(forecastSeries.generated_at).toLocaleTimeString()}` : undefined}
                    icon={<Activity className="w-5 h-5" />}
                />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="TPS 1m"
                    value={kpisLoading ? '...' : (realtimeKpis?.tps_1m ?? 0)}
                    sub={kpisLoading ? undefined : `${(realtimeKpis?.tx_1m ?? 0).toLocaleString()} tx/min` as string}
                    icon={<Zap className="w-5 h-5" />}
                />
                <StatCard
                    label="TPS 5m"
                    value={kpisLoading ? '...' : (realtimeKpis?.tps_5m ?? 0)}
                    sub={kpisLoading ? undefined : `${(realtimeKpis?.tx_5m ?? 0).toLocaleString()} tx/5m` as string}
                    icon={<TrendingUp className="w-5 h-5" />}
                />
                <StatCard
                    label="Fallidas 24h"
                    value={kpisLoading ? '...' : (realtimeKpis?.failed_24h ?? 0).toLocaleString()}
                    icon={<BarChart3 className="w-5 h-5" />}
                />
                <StatCard
                    label="Gas Promedio 24h"
                    value={kpisLoading ? '...' : Number(realtimeKpis?.avg_gas_24h ?? 0).toFixed(2)}
                    sub="unidades gas"
                    icon={<Clock className="w-5 h-5" />}
                />
            </div>

            {/* DeFi On-Chain KPIs (FASE 3) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                    label="Farming TVL"
                    value={farmingTVL > 0 ? `${farmingTVL.toLocaleString(undefined, { maximumFractionDigits: 0 })} BEZ` : '...'}
                    icon={<Sprout className="w-5 h-5 text-green-500" />}
                />
                <StatCard
                    label="Staking TVL"
                    value={stakingStats ? `${parseFloat(stakingStats.totalStaked).toLocaleString(undefined, { maximumFractionDigits: 0 })} BEZ` : '...'}
                    icon={<Award className="w-5 h-5 text-purple-500" />}
                />
                <StatCard
                    label="Bridge Deposited"
                    value={bridgeOnChain ? `${parseFloat(bridgeOnChain.totalDeposited).toLocaleString(undefined, { maximumFractionDigits: 0 })} BEZ` : '...'}
                    icon={<ArrowRightLeft className="w-5 h-5 text-cyan-500" />}
                />
                <StatCard
                    label="Validadores"
                    value={validatorStats?.totalValidators?.toString() ?? '...'}
                    sub={validatorStats ? `${validatorStats.activeValidatorCount} activos` : undefined}
                    icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
                />
                <StatCard
                    label="Total Staked (Val)"
                    value={validatorStats ? `${parseFloat(validatorStats.totalStaked).toLocaleString(undefined, { maximumFractionDigits: 0 })} BEZ` : '...'}
                    icon={<Database className="w-5 h-5 text-amber-500" />}
                />
            </div>

            {/* Window bar chart */}
            {chartWindow && chartWindow.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4 gap-3">
                        <h3 className="text-sm font-semibold text-gray-700">Transacciones ({windowDays} dias)</h3>
                        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                            {[7, 14, 30].map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => setWindowDays(d as 7 | 14 | 30)}
                                    className={`px-3 py-1 text-xs rounded-md transition ${windowDays === d
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {d}d
                                </button>
                            ))}
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={chartWindow}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                            <Tooltip />
                            <Bar dataKey="transactions" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* 30-day line chart */}
            {chart30 && chart30.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Tendencia (30 dias)</h3>
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={chart30}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="transactions" stroke="#2563EB" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="nfts_minted" stroke="#10B981" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="gas_used" stroke="#F97316" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Forecast chart */}
            {forecastSeries?.points && forecastSeries.points.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4 gap-3">
                        <h3 className="text-sm font-semibold text-gray-700">Proyeccion de {forecastLabel} ({forecastHorizon} dias)</h3>
                        <div className="flex items-center gap-2">
                            <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                                {[
                                    { key: 'transactions', label: 'TX' },
                                    { key: 'gas_used', label: 'Gas' },
                                    { key: 'nfts_minted', label: 'NFTs' },
                                ].map((item) => (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => setForecastMetric(item.key as 'transactions' | 'gas_used' | 'nfts_minted')}
                                        className={`px-3 py-1 text-xs rounded-md transition ${forecastMetric === item.key
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                                {[7, 14, 30].map((h) => (
                                    <button
                                        key={h}
                                        type="button"
                                        onClick={() => setForecastHorizon(h as 7 | 14 | 30)}
                                        className={`px-3 py-1 text-xs rounded-md transition ${forecastHorizon === h
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {h}d
                                    </button>
                                ))}
                            </div>
                            <span className="text-xs text-gray-500">Modelo: {forecastSeries.model}</span>
                        </div>
                    </div>
                    {forecastInsights && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide text-gray-500">Ultimo historico</p>
                                <p className="text-sm font-semibold text-gray-800">{formatMetricValue(forecastInsights.lastHistorical)}</p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide text-gray-500">Primer forecast</p>
                                <p className="text-sm font-semibold text-gray-800">{formatMetricValue(forecastInsights.firstPredicted)}</p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide text-gray-500">Delta vs ultimo dato</p>
                                <p className={`text-sm font-semibold ${forecastInsights.deltaPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {forecastInsights.deltaPct >= 0 ? '+' : ''}
                                    {forecastInsights.deltaPct.toFixed(2)}% ({forecastInsights.deltaAbs >= 0 ? '+' : ''}{formatMetricValue(forecastInsights.deltaAbs)})
                                </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide text-gray-500">Vs periodo previo</p>
                                {periodDelta ? (
                                    <p className={`text-sm font-semibold ${periodDelta.delta_pct == null ? 'text-gray-600' : periodDelta.delta_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {periodDelta.delta_pct == null
                                            ? 'N/A'
                                            : `${periodDelta.delta_pct >= 0 ? '+' : ''}${periodDelta.delta_pct.toFixed(2)}%`}
                                        {` (${periodDelta.trend})`}
                                    </p>
                                ) : (
                                    <p className="text-sm font-semibold text-gray-400">...</p>
                                )}
                            </div>
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={forecastComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                            <Tooltip />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="actual"
                                stroke="#475569"
                                strokeWidth={2}
                                dot={false}
                                name="Historico"
                            />
                            <Area
                                type="monotone"
                                dataKey="upper"
                                stroke="none"
                                fill="#93C5FD"
                                fillOpacity={0.25}
                                name="Banda superior"
                            />
                            <Area
                                type="monotone"
                                dataKey="lower"
                                stroke="none"
                                fill="#FFFFFF"
                                fillOpacity={1}
                                name="Banda inferior"
                            />
                            <Line type="monotone" dataKey="predicted" stroke="#2563EB" strokeWidth={2} dot={false} name="Prediccion" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Platform Analytics (authenticated) */}
            {platform && (
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        Plataforma — Usuarios & Actividad
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">Usuarios totales</p>
                            <p className="text-lg font-bold text-gray-900">
                                {Number(platform.users?.total ?? 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400">
                                +{Number(platform.users?.new24h ?? 0)} nuevos (24h)
                            </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">Activos 24h / 7d</p>
                            <p className="text-lg font-bold text-gray-900">
                                {Number(platform.users?.active24h ?? 0).toLocaleString()}
                                <span className="text-sm font-normal text-gray-400"> / {Number(platform.users?.active7d ?? 0).toLocaleString()}</span>
                            </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">Volumen TX (BEZ)</p>
                            <p className="text-lg font-bold text-gray-900">
                                {Number(platform.transactions?.volume_bez ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-gray-400">
                                {Number(platform.transactions?.today ?? 0).toLocaleString()} TX hoy
                            </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">NFTs mintados (24h)</p>
                            <p className="text-lg font-bold text-gray-900">
                                {Number(platform.nfts?.minted24h ?? 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400">
                                {Number(platform.nfts?.total ?? 0).toLocaleString()} totales
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Live blockchain events (SSE) + All-time deltas side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Delta comparisons for all metrics */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-500" />
                        Delta vs Periodo Previo ({forecastHorizon}d)
                    </h3>
                    {periodDelta ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5">
                                <div>
                                    <p className="text-xs text-gray-500">{forecastLabel} — Periodo actual</p>
                                    <p className="text-sm font-bold text-gray-900">{periodDelta.current_total.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">Previo</p>
                                    <p className="text-sm font-semibold text-gray-600">{periodDelta.previous_total.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-3">
                                {periodDelta.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
                                {periodDelta.trend === 'down' && <TrendingDown className="w-4 h-4 text-rose-500" />}
                                {periodDelta.trend === 'flat' && <Minus className="w-4 h-4 text-gray-400" />}
                                <span className={`text-sm font-semibold ${periodDelta.trend === 'up' ? 'text-emerald-600' : periodDelta.trend === 'down' ? 'text-rose-600' : 'text-gray-500'}`}>
                                    {periodDelta.delta_pct != null ? `${periodDelta.delta_pct >= 0 ? '+' : ''}${periodDelta.delta_pct.toFixed(2)}%` : 'N/A'}
                                </span>
                                <span className="text-xs text-gray-400">
                                    ({periodDelta.delta_abs >= 0 ? '+' : ''}{periodDelta.delta_abs.toLocaleString()})
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-400 px-3">
                                Calculado: {new Date(periodDelta.computed_at).toLocaleString()}
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-6">Cargando comparativa...</p>
                    )}
                </div>

                {/* Live blockchain events (SSE) */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Wifi className={`w-4 h-4 ${sseConnected ? 'text-green-500' : 'text-gray-400'}`} />
                            Eventos Blockchain en Vivo
                        </h3>
                        <span className="text-[11px] text-gray-400">{liveEvents.length} eventos</span>
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                        {liveEvents.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-6">
                                {sseConnected ? 'Esperando eventos...' : 'SSE desconectado'}
                            </p>
                        ) : (
                            liveEvents.slice(0, 15).map((evt, i) => (
                                <div key={`${evt.timestamp}-${i}`} className="flex items-center gap-2 text-xs border border-gray-50 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                    <span className="text-gray-500 font-mono shrink-0">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                                    <span className="font-medium text-gray-700 truncate">{evt.channel}</span>
                                    {typeof evt.data === 'object' && evt.data && 'tx_hash' in evt.data && (
                                        <span className="text-gray-400 font-mono text-[10px] truncate ml-auto">
                                            {String((evt.data as Record<string, unknown>).tx_hash).slice(0, 10)}...
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
