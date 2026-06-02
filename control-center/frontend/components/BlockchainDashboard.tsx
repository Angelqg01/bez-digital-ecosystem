'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  Zap,
  Box,
  Shield,
  Globe,
  Cpu,
  RefreshCw,
  AlertTriangle,
  Clock3,
  Users,
  RotateCcw,
  Wifi,
  WifiOff,
  Radio,
  Gavel,
  FileText,
  TrendingUp,
  Layers,
  ArrowRightLeft,
  Fuel,
  BarChart3,
  Filter,
  ExternalLink,
} from 'lucide-react';
import {
  useStats,
  useGasStatus,
  useAegisStatus,
  useAegisSuggestions,
  useChartData,
  useRealtimeKpis,
  useTransactions,
  useBlockchainOverview,
  useBlockchainValidators,
  useCurrentSequencer,
  useBlockchainEvents,
  useValidatorStats,
  useGovernanceProposals,
  useBlockchainSSE,
} from '../lib/hooks';
import { useContractRead } from '../lib/contract-hooks';
import { useSequencerOnChain, useValidatorRegistryOnChain } from '../lib/validator-hooks';
import { useBridgeContractStats } from '../lib/bridge-onchain-hooks';
import { ethers } from 'ethers';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

// ── Cross-page navigation ──
const BLOCKCHAIN_PAGES = [
  { href: '/dashboard/blockchain', label: 'Blockchain L2', icon: Layers, description: 'Red & Consenso' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, description: 'KPIs & Forecast' },
  { href: '/dashboard/transactions', label: 'Transacciones', icon: FileText, description: 'TX Explorer' },
  { href: '/dashboard/gas', label: 'Gas Tanks', icon: Fuel, description: 'Gas & Facturación' },
  { href: '/dashboard/bridge', label: 'Bridge', icon: ArrowRightLeft, description: 'L1 ↔ L2' },
] as const;

function BlockchainEcosystemNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {BLOCKCHAIN_PAGES.map(({ href, label, icon: Icon, description }) => {
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

const EVENT_TYPES = ['validator', 'sequencer', 'edge-node', 'bridge', 'staking', 'nft'] as const;

export default function BlockchainDashboard() {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('validator');
  const [showAllValidators, setShowAllValidators] = useState(false);

  const { data: stats, isLoading: statsLoading, error: statsError, mutate } = useStats();
  const { data: gasStatus, isLoading: gasLoading } = useGasStatus();
  const { data: aegisRes, isLoading: aegisLoading } = useAegisStatus();
  const { data: suggestionsRes } = useAegisSuggestions(1);
  const { data: chart7d } = useChartData(7);
  const { data: realtime } = useRealtimeKpis();
  const { data: recentTxs, isLoading: txLoading } = useTransactions(1, 8);
  const { data: overview } = useBlockchainOverview();
  const { data: validatorsRes, isLoading: validatorsLoading } = useBlockchainValidators('active');
  const { data: sequencerNow, isLoading: sequencerLoading } = useCurrentSequencer();
  const { data: blockchainEvents } = useBlockchainEvents(eventTypeFilter, 10);
  const { data: validatorStats } = useValidatorStats();
  const { data: governanceRes } = useGovernanceProposals(5);
  const { events: liveEvents, connected: sseConnected } = useBlockchainSSE();

  // ── On-chain contract reads ──
  const { data: rawTotalSupply, loading: supplyLoading } = useContractRead<bigint>(
    'BEZCoinV2', 'totalSupply', [], { refreshInterval: 60_000 },
  );
  const { data: rawStakedTotal } = useContractRead<bigint>(
    'StakingPool', 'totalStaked', [], { refreshInterval: 60_000 },
  );

  // ── Direct on-chain hooks (FASE 2) ──
  const { status: sequencerOnChain } = useSequencerOnChain();
  const { stats: registryOnChain } = useValidatorRegistryOnChain();
  const { stats: bridgeOnChain } = useBridgeContractStats();

  const isLoading = statsLoading || gasLoading || supplyLoading;
  const blockHeight = stats?.block_height?.toLocaleString() ?? '-';
  const tps = stats?.tps?.toFixed(1) ?? '0';
  const gasPrice = gasStatus?.gasPrice ? `${Number(gasStatus.gasPrice).toFixed(4)} gwei` : '-';

  const totalSupplyFormatted = rawTotalSupply
    ? Number(ethers.formatEther(rawTotalSupply)).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '-';

  const stakedBez = rawStakedTotal ? Number(ethers.formatEther(rawStakedTotal)) : 0;

  const circulatingSupply = rawTotalSupply && rawStakedTotal
    ? Number(ethers.formatEther(rawTotalSupply - rawStakedTotal)).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '-';

  const lockedPct = rawTotalSupply && rawStakedTotal && rawTotalSupply > BigInt(0)
    ? ((stakedBez / Number(ethers.formatEther(rawTotalSupply))) * 100).toFixed(1)
    : '0';

  const aegis = aegisRes?.data;
  const aegisOnline = aegis?.system_status === 'operational';
  const aegisModels = aegis?.models ?? {};
  const aegisComponents = aegis?.components ?? {} as { database?: string; redis?: string; monitor?: string };

  const lastSuggestion = suggestionsRes?.data?.suggestions?.[0];
  const lastDecisionText = lastSuggestion
    ? `"${lastSuggestion.type}: ${lastSuggestion.reason}" (${(lastSuggestion.confidence * 100).toFixed(0)}% conf.)`
    : 'Sin decisiones recientes.';

  const refreshData = () => { mutate(); };
  const hasError = !!statsError;

  const tpsSparklineData = useMemo(() => {
    if (!realtime) return [];
    return [
      { label: '1m', value: realtime.tps_1m ?? 0 },
      { label: '5m', value: realtime.tps_5m ?? 0 },
      { label: '1h', value: realtime.tps_1h ?? 0 },
    ];
  }, [realtime]);

  const validators = validatorsRes?.validators ?? [];
  const topValidators = showAllValidators ? validators : validators.slice(0, 5);
  const proposals = governanceRes?.proposals ?? [];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Cross-page navigation */}
      <BlockchainEcosystemNav />
      {hasError && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-sm font-medium">
          <AlertTriangle size={18} />
          <span>Error al conectar con la API. Algunos datos pueden estar desactualizados.</span>
          <button onClick={refreshData} className="ml-auto underline text-rose-600 hover:text-rose-800">Reintentar</button>
        </div>
      )}

      {/* ── Sequencer AI Pause Alert ── */}
      {sequencerOnChain?.isPaused && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm font-medium animate-pulse">
          <AlertTriangle size={18} className="text-amber-600" />
          <div>
            <span className="font-bold">⚠️ Sequencer L2 PAUSADO por IA</span>
            <span className="ml-2 text-amber-600">
              Razón: {sequencerOnChain.pauseReason || 'Sin especificar'}
              {sequencerOnChain.pauseTimeRemaining > 0 && (
                <> · Auto-resume en {Math.ceil(sequencerOnChain.pauseTimeRemaining / 60)}min</>)}
            </span>
          </div>
          <span className="ml-auto text-xs font-bold text-amber-500 uppercase">ON-CHAIN</span>
        </div>
      )}

      <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 text-white shadow-2xl shadow-blue-500/10">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-bezhas-cyan blur-[120px] opacity-20"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-bezhas-purple blur-[120px] opacity-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-3 py-1 bg-bezhas-cyan/10 border border-bezhas-cyan/20 rounded-full text-[10px] font-bold uppercase tracking-widest text-bezhas-cyan">
                Mainnet Alpha - Chain ID {gasStatus?.chainId ?? overview?.chain_id ?? 2708}
              </span>
              <div className={`h-2 w-2 rounded-full ${aegisOnline ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}></div>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">
              BeZhas Sovereign L2
            </h1>
            <p className="text-slate-400 mt-2 font-medium max-w-lg">
              Infraestructura escalable impulsada por IA. Validando transacciones en tiempo real con protocolo de consenso OP-Stack optimizado.
            </p>
          </div>

          <button
            onClick={refreshData}
            className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-3 rounded-2xl transition-all backdrop-blur-md group"
          >
            <RefreshCw size={18} className={`text-bezhas-cyan ${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span className="text-sm font-bold">Sincronizar L2</span>
          </button>
        </div>

        {/* SSE Connection + Overview Stats */}
        <div className="relative z-10 flex items-center gap-3 mt-4">
          {sseConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <Radio size={12} className="animate-pulse" /> SSE Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
              <WifiOff size={12} /> SSE Offline
            </span>
          )}
          {overview && (
            <>
              <span className="text-[10px] text-slate-500">|</span>
              <span className="text-[10px] text-slate-400">Epoch {overview.current_epoch}</span>
              <span className="text-[10px] text-slate-500">•</span>
              <span className="text-[10px] text-slate-400">{overview.active_validators} validadores</span>
              <span className="text-[10px] text-slate-500">•</span>
              <span className="text-[10px] text-slate-400">{overview.total_contracts_deployed} contratos</span>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 border-t border-white/5 pt-10">
          <StatBox label="Block Height" value={blockHeight} loading={statsLoading} icon={<Box size={20} className="text-bezhas-cyan" />} />
          <StatBox label="Native Token" value="$BEZ" subValue={totalSupplyFormatted} loading={supplyLoading} icon={<Zap size={20} className="text-amber-400" />} />
          <StatBox label="Gas Price (Avg)" value={gasPrice} loading={gasLoading} icon={<Activity size={20} className="text-emerald-400" />} />
          <StatBox label="TPS" value={tps} loading={statsLoading} icon={<Shield size={20} className="text-bezhas-purple" />} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold text-slate-900 flex items-center">
              <Globe className="mr-3 text-bezhas-accent" size={24} />
              Tesoreria & Circulacion
            </h3>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live On-Chain</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-bezhas-cyan rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
              <p className="text-sm font-bold text-slate-500 mb-1">Total Supply</p>
              {supplyLoading ? <div className="h-9 w-48 bg-slate-200 rounded-lg animate-pulse" /> : (
                <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{totalSupplyFormatted} <span className="text-lg text-slate-400">BEZ</span></h4>
              )}
              <div className="mt-4 h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-bezhas-cyan transition-all" style={{ width: `${lockedPct}%` }}></div>
              </div>
              <p className="text-[10px] mt-2 text-slate-400 font-bold uppercase">{lockedPct}% Staked (Ecosystem Lock)</p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-bezhas-purple rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
              <p className="text-sm font-bold text-slate-500 mb-1">Circulating Supply</p>
              {supplyLoading ? <div className="h-9 w-48 bg-slate-200 rounded-lg animate-pulse" /> : (
                <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{circulatingSupply} <span className="text-lg text-slate-400">BEZ</span></h4>
              )}
              <div className="flex items-center mt-4 space-x-2">
                <span className={`h-2 w-2 rounded-full ${rawTotalSupply ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                  {stakedBez > 0 ? `${stakedBez.toLocaleString(undefined, { maximumFractionDigits: 0 })} BEZ en Staking` : 'Sin staking activo'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-bezhas-blue to-slate-900 rounded-3xl p-6 text-white relative shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)`,
            }}
          ></div>
          <h3 className="text-xl font-bold mb-6 flex items-center relative z-10">
            <Cpu className="mr-3 text-bezhas-cyan" size={24} />
            AI Gateway Status
          </h3>

          <div className="space-y-4 relative z-10">
            {aegisLoading ? (
              <>
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
              </>
            ) : (
              <>
                <LogEntry label="Aegis Core" status={aegisOnline ? 'Active' : 'Offline'} color={aegisOnline ? 'bg-emerald-500' : 'bg-rose-500'} />
                <LogEntry label="Database" status={aegisComponents.database === 'connected' ? 'Connected' : 'Down'} color={aegisComponents.database === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'} />
                <LogEntry label="Redis Cache" status={aegisComponents.redis === 'connected' ? 'Connected' : 'Down'} color={aegisComponents.redis === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'} />
                <LogEntry
                  label="ML Models"
                  status={`${Object.values(aegisModels).filter(Boolean).length}/${Object.keys(aegisModels).length} online`}
                  color={Object.values(aegisModels).every(Boolean) ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}
                />
              </>
            )}
          </div>

          <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/10 relative z-10">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Last Decision</p>
            <p className="text-sm font-medium italic text-slate-200">{lastDecisionText}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Transacciones (7 dias)</h3>
            <span className="text-xs text-slate-500 uppercase tracking-widest">Descriptiva</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart7d || []}>
                <defs>
                  <linearGradient id="txColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="transactions" stroke="#0284c7" fill="url(#txColor)" strokeWidth={2} />
                <Area type="monotone" dataKey="gas_used" stroke="#f97316" fillOpacity={0} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">TPS Realtime</h3>
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">TPS 1m</span><strong>{realtime?.tps_1m ?? 0}</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">TPS 5m</span><strong>{realtime?.tps_5m ?? 0}</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">TPS 1h</span><strong>{realtime?.tps_1h ?? 0}</strong></div>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tpsSparklineData}>
                <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Ultimas transacciones on-chain</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-2">Tx Hash</th>
                  <th className="py-2 pr-2">Contrato</th>
                  <th className="py-2 pr-2">Metodo</th>
                  <th className="py-2 pr-2">Bloque</th>
                  <th className="py-2 pr-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {txLoading && (
                  <tr><td className="py-3 text-slate-400" colSpan={5}>Cargando transacciones...</td></tr>
                )}
                {!txLoading && (recentTxs?.rows || []).slice(0, 8).map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-50">
                    <td className="py-2 pr-2 font-mono text-xs text-slate-700">{String(tx.tx_hash).slice(0, 10)}...{String(tx.tx_hash).slice(-6)}</td>
                    <td className="py-2 pr-2 text-slate-700">{tx.contract_name || 'N/A'}</td>
                    <td className="py-2 pr-2 text-slate-700">{(tx as any).method_name || (tx as any).method || 'N/A'}</td>
                    <td className="py-2 pr-2 text-slate-700">{tx.block_number || 0}</td>
                    <td className="py-2 pr-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${tx.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : tx.status === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <RotateCcw size={18} /> Sequencer
            {sequencerOnChain && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                sequencerOnChain.isPaused
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {sequencerOnChain.isPaused ? 'PAUSED' : 'ACTIVE'}
              </span>
            )}
          </h3>
          {sequencerLoading ? (
            <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Epoch</span><strong>{sequencerNow?.epoch ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Bloques restantes</span><strong>{sequencerNow?.blocks_remaining ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Cola</span><strong>{(sequencerNow?.queue_position ?? 0) + 1}/{sequencerNow?.queue_length ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Epochs servidos</span><strong>{sequencerNow?.epochs_served ?? 0}</strong></div>
              {sequencerOnChain && (
                <>
                  <div className="border-t border-slate-100 pt-2 mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">On-Chain (L2Sequencer.sol)</p>
                  </div>
                  <div className="flex justify-between"><span className="text-slate-500">Pausas totales</span><strong>{sequencerOnChain.pauseCount}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Duración acumulada</span><strong>{Math.floor(sequencerOnChain.cumulativePauseDuration / 60)}m</strong></div>
                </>
              )}
              <div className="pt-2 text-xs font-mono text-slate-500 break-all">{sequencerNow?.sequencer || 'N/A'}</div>
            </div>
          )}

          {/* Bridge on-chain stats */}
          {bridgeOnChain && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Bridge L1↔L2 (On-Chain)</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-slate-500">Depositado</p>
                  <p className="font-bold text-slate-900">{parseFloat(bridgeOnChain.totalDeposited).toLocaleString()} BEZ</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-slate-500">wBEZ Supply</p>
                  <p className="font-bold text-slate-900">{parseFloat(bridgeOnChain.wrappedBEZSupply).toLocaleString()} wBEZ</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Users size={18} /> Validadores Activos</h3>
            {validators.length > 5 && (
              <button
                onClick={() => setShowAllValidators(!showAllValidators)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {showAllValidators ? 'Mostrar menos' : `Ver todos (${validators.length})`}
              </button>
            )}
          </div>
          <div className="space-y-3">
            {validatorsLoading && <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />}
            {!validatorsLoading && topValidators.map((v) => (
              <div key={v.operator} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{v.company_name || v.operator.slice(0, 8)}</p>
                  <span className="text-xs px-2 py-1 rounded-full bg-sky-50 text-sky-700">Tier {v.tier}</span>
                </div>
                <p className="text-xs font-mono text-slate-500 mt-1">{v.operator}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                  <span>{v.total_stake_bez.toLocaleString(undefined, { maximumFractionDigits: 0 })} BEZ</span>
                  <span>Uptime {v.uptime_pct.toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock3 size={18} /> Eventos On-Chain
            </h3>
            <div className="flex items-center gap-1">
              <Filter size={14} className="text-slate-400" />
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {(blockchainEvents?.events || []).map((evt) => (
              <div key={evt.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900 text-sm">{evt.event_name}</p>
                  <span className="text-xs text-slate-500">#{evt.block_number}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{evt.contract_name}</p>
                <p className="text-xs font-mono text-slate-500 mt-1">{evt.tx_hash.slice(0, 10)}...{evt.tx_hash.slice(-6)}</p>
              </div>
            ))}
            {!blockchainEvents?.events?.length && <p className="text-sm text-slate-500">Sin eventos indexados para &quot;{eventTypeFilter}&quot;.</p>}
          </div>
        </div>
      </div>

      {/* Validator Network Stats + Governance Proposals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Network-wide validator stats */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500" /> Red de Validadores
          </h3>
          {validatorStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Total Validadores</p>
                  <p className="text-xl font-bold text-slate-900">{validatorStats.total_validators}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Candidatos Sequencer</p>
                  <p className="text-xl font-bold text-slate-900">{validatorStats.sequencer_candidates}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Eventos últimas 24h</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center rounded-lg bg-emerald-50 border border-emerald-100 py-2">
                    <p className="text-lg font-bold text-emerald-700">{validatorStats.events_24h?.registrations ?? 0}</p>
                    <p className="text-[10px] text-emerald-600">Registros</p>
                  </div>
                  <div className="text-center rounded-lg bg-blue-50 border border-blue-100 py-2">
                    <p className="text-lg font-bold text-blue-700">{validatorStats.events_24h?.heartbeats ?? 0}</p>
                    <p className="text-[10px] text-blue-600">Heartbeats</p>
                  </div>
                  <div className="text-center rounded-lg bg-rose-50 border border-rose-100 py-2">
                    <p className="text-lg font-bold text-rose-700">{validatorStats.events_24h?.slashes ?? 0}</p>
                    <p className="text-[10px] text-rose-600">Slashes</p>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Calculado: {new Date(validatorStats.computed_at).toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
          )}
        </div>

        {/* Governance proposals */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Gavel size={18} className="text-purple-500" /> Gobernanza
          </h3>
          {proposals.length > 0 ? (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {proposals.map((p) => (
                <div key={p.proposal_id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900 text-sm truncate max-w-[70%]">
                      {p.description || `Propuesta #${p.proposal_id}`}
                    </p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${p.state === 'active' || p.state === 'Active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : p.state === 'executed' || p.state === 'Executed'
                        ? 'bg-blue-50 text-blue-700'
                        : p.state === 'defeated' || p.state === 'Defeated'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-slate-50 text-slate-600'
                      }`}>
                      {p.state ?? 'pending'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-500 mt-1">{p.tx_hash.slice(0, 10)}...{p.tx_hash.slice(-6)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Block #{p.block_number} · {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-6">Sin propuestas de gobernanza indexadas.</p>
          )}
        </div>
      </div>

      {/* Live SSE Events Feed */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Wifi size={18} className={sseConnected ? 'text-emerald-500' : 'text-slate-400'} />
            Eventos Blockchain en Vivo (SSE)
          </h3>
          <span className="text-xs text-slate-400">{liveEvents.length} eventos en buffer</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
          {liveEvents.length === 0 ? (
            <p className="text-sm text-slate-500 col-span-full text-center py-8">
              {sseConnected ? 'Esperando eventos en tiempo real...' : 'Conexión SSE no disponible'}
            </p>
          ) : (
            liveEvents.slice(0, 18).map((evt, i) => (
              <div key={`${evt.timestamp}-${i}`} className="flex items-center gap-2 text-xs border border-slate-50 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                <span className="text-slate-500 font-mono shrink-0">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                <span className="font-medium text-slate-700 truncate">{evt.channel}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, subValue, icon, loading }: { label: string, value: string, subValue?: string, icon: React.ReactNode, loading?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2 text-slate-500">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 w-24 bg-white/10 rounded-lg animate-pulse" />
      ) : (
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-black text-white">{value}</span>
          {subValue && <span className="text-xs text-slate-500 font-medium">{subValue}</span>}
        </div>
      )}
    </div>
  );
}

function LogEntry({ label, status, color }: { label: string, status: string, color: string }) {
  return (
    <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors cursor-default">
      <span className="text-sm font-bold text-slate-300">{label}</span>
      <div className="flex items-center space-x-2">
        <span className={`h-2 w-2 rounded-full ${color}`}></span>
        <span className="text-xs font-bold uppercase tracking-tight text-white/80">{status}</span>
      </div>
    </div>
  );
}