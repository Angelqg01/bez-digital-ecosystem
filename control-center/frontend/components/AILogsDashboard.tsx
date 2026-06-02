import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, ShieldAlert, CheckCircle, BrainCircuit, Search, Fingerprint, Loader2, Filter, Link2,
  ExternalLink, ThumbsDown, Radio, BellOff, XCircle, Wifi, WifiOff,
} from 'lucide-react';
import { useAILogs, useAegisStatus } from '../lib/hooks';
import { api } from '../lib/api';
import type { AILog, AegisStatus } from '../lib/types';
import AIEcosystemNav from './AIEcosystemNav';

// Map known module prefixes to agent display names
const MODULE_AGENT: Record<string, { label: string; color: string }> = {
  aegis: { label: 'Aegis Core', color: '#7C3AED' },
  food: { label: 'Food Oracle', color: '#00C896' },
  shiptrack: { label: 'ShipTrack', color: '#00C8FF' },
  medrecord: { label: 'MedRecord', color: '#EF4444' },
  defi: { label: 'DeFi Engine', color: '#FFB800' },
  nft: { label: 'NFT Mint', color: '#EC4899' },
  bridge: { label: 'Bridge', color: '#2563EB' },
  governance: { label: 'DAO Gov', color: '#EAB308' },
  depub: { label: 'DePub', color: '#A855F7' },
  kleros: { label: 'Kleros', color: '#06B6D4' },
  did: { label: 'DID Identity', color: '#14B8A6' },
};

function agentFromModule(module: string): { label: string; color: string } {
  if (!module) return { label: 'System', color: '#6B7280' };
  const key = Object.keys(MODULE_AGENT).find(k => module.toLowerCase().includes(k));
  return key ? MODULE_AGENT[key] : { label: module, color: '#6B7280' };
}

const SEVERITY_OPTIONS = ['all', 'info', 'warning', 'critical'] as const;
type SeverityFilter = typeof SEVERITY_OPTIONS[number];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function AILogsDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [sevFilter, setSevFilter] = useState<SeverityFilter>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [walletFilter, setWalletFilter] = useState('');

  // Real filters passed to the hook (backend-side filtering)
  const apiFilters = {
    ...(sevFilter !== 'all' ? { severity: sevFilter } : {}),
    ...(searchTerm ? { q: searchTerm } : {}),
    ...(walletFilter ? { wallet: walletFilter } : {}),
  };

  const { data, isLoading, error, mutate: mutateLogs } = useAILogs(page, apiFilters);
  const { data: statusData } = useAegisStatus();

  const logs = data?.rows ?? [];
  const total = data?.total ?? 0;

  // Live Aegis Status
  const aegisStatus = statusData?.data;
  const aegisMode = aegisStatus?.mode ?? 'unknown';
  const aegisHealth = aegisStatus?.system_status ?? 'offline';

  // SSE real-time alerts
  const [sseAlerts, setSSEAlerts] = useState<{ id: string; module: string; action: string; created_at: string }[]>([]);
  const [sseConnected, setSSEConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('bezhas_token') : null;
    const params = token ? `?token=${encodeURIComponent(token)}` : '';
    const es = new EventSource(`${API_BASE}/aegis/alerts/stream${params}`);
    esRef.current = es;

    es.onopen = () => setSSEConnected(true);

    es.addEventListener('critical', (e) => {
      try {
        const parsed = JSON.parse(e.data);
        setSSEAlerts(prev => [{
          id: parsed.row?.id ?? String(Date.now()),
          module: parsed.row?.module ?? 'unknown',
          action: parsed.row?.action ?? '',
          created_at: parsed.row?.created_at ?? new Date().toISOString(),
        }, ...prev].slice(0, 20));
        // Auto-refresh logs on critical alert
        mutateLogs();
      } catch { /* ignore */ }
    });

    es.onerror = () => setSSEConnected(false);

    return () => { es.close(); esRef.current = null; };
  }, [mutateLogs]);

  // False positive handler
  const handleFalsePositive = useCallback(async (log: AILog) => {
    try {
      await api.post('/aegis/false-positive', {
        log_id: log.id,
        module: log.module,
        action: log.action,
      });
      mutateLogs();
    } catch { /* silently fail */ }
  }, [mutateLogs]);

  // Unique agent modules for filter dropdown
  const uniqueAgents = Array.from(new Set(logs.map((l: AILog) => agentFromModule(l.module).label))).sort();

  // Client-side agent filter (module is not a backend filter param)
  const filteredLogs = logs.filter((log: AILog) => {
    const matchAgent = agentFilter === 'all' || agentFromModule(log.module).label === agentFilter;
    return matchAgent;
  });

  const approvedCount = logs.filter((l: AILog) => l.action?.includes('APPROVED') || l.severity === 'info').length;
  const deniedCount = logs.filter((l: AILog) => l.action?.includes('DENIED') || l.severity === 'critical').length;

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      {/* Cross-page navigation */}
      <AIEcosystemNav />

      {/* SSE Alert Banner */}
      {sseAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <Radio className="w-4 h-4 animate-pulse" /> Alertas Críticas en Tiempo Real
              <span className="bg-red-200 text-red-800 text-xs px-2 py-0.5 rounded-full">{sseAlerts.length}</span>
            </h3>
            <button onClick={() => setSSEAlerts([])} className="text-red-400 hover:text-red-600">
              <BellOff className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {sseAlerts.map((a, i) => (
              <div key={`${a.id}-${i}`} className="flex items-center gap-2 text-xs text-red-700">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium">{a.module}</span>
                <span className="text-red-500">→ {a.action}</span>
                <span className="ml-auto text-red-400">{new Date(a.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <BrainCircuit size={120} />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Aegis Core Status</p>
          <div className="flex items-center space-x-3">
            <div className={`h-3 w-3 rounded-full ${aegisHealth === 'healthy' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`} />
            <p className="text-2xl font-extrabold tracking-tight">
              {aegisHealth === 'healthy' ? 'Active' : aegisHealth} ({aegisMode})
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {sseConnected ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
            <span className="text-[10px] text-slate-400">{sseConnected ? 'SSE Connected' : 'SSE Disconnected'}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firmas Prevenidas</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{deniedCount}</p>
            <p className="text-[10px] font-bold text-emerald-500 mt-1">Ahorro estimado en Gas L2</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center border border-rose-100 shadow-inner">
            <ShieldAlert size={20} />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firmas Autorizadas</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{approvedCount}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Total: {total} registros</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center border border-emerald-100 shadow-inner">
            <CheckCircle size={20} />
          </div>
        </div>

        {/* ML Models Status */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Modelos ML</p>
          <div className="flex flex-wrap gap-1.5">
            {aegisStatus?.models && Object.entries(aegisStatus.models).map(([name, active]) => (
              <span key={name} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${active ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                {name}
              </span>
            ))}
            {!aegisStatus?.models && <span className="text-xs text-slate-400">—</span>}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/30 backdrop-blur-sm gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight italic uppercase flex items-center">
              <Fingerprint className="mr-2 text-bezhas-blue" size={24} /> MCP Audit Logs
            </h2>
            <p className="text-sm text-slate-400 mt-1 font-medium">Historial de decisiones de la red neuronal previas a la inyección blockchain.</p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar contenedor o LOG-ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-bezhas-blue/20 focus:border-bezhas-blue w-full md:w-64 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-slate-400" />
            <select
              value={sevFilter}
              onChange={(e) => { setSevFilter(e.target.value as SeverityFilter); setPage(1); }}
              className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bezhas-blue/20"
            >
              <option value="all">Severidad: Todas</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bezhas-blue/20"
            >
              <option value="all">Agente: Todos</option>
              {uniqueAgents.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="0x... wallet"
              value={walletFilter}
              onChange={(e) => { setWalletFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bezhas-blue/20 w-36"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Auditoría (ID / Time)</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Agente</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contenedor / Telemetría</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Blockchain</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Razonamiento IA</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Decisión MCP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 font-medium">
                    <Loader2 className="animate-spin inline mr-2" size={16} /> Cargando logs de auditoría...
                  </td>
                </tr>
              )}
              {error && !isLoading && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-rose-500 font-medium">
                    Error al cargar datos. Verifica que la API esté activa.
                  </td>
                </tr>
              )}
              {!isLoading && filteredLogs.map((log: AILog) => {
                const inputData = (() => { try { const raw = log.input_data; return typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw ?? {}); } catch { return {}; } })();
                const decision = log.severity === 'critical' ? 'DENIED' : 'APPROVED';
                const timeAgo = log.created_at ? new Date(log.created_at).toLocaleString() : '—';

                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="p-6">
                      <p className="text-xs font-black text-slate-900">LOG-{log.id}</p>
                      <p className="text-[11px] font-bold text-slate-400 mt-1 flex items-center">
                        <Activity size={10} className="mr-1" /> {timeAgo}
                      </p>
                    </td>
                    <td className="p-6">
                      {(() => {
                        const agent = agentFromModule(log.module); return (
                          <div>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide" style={{ background: agent.color + '18', color: agent.color, border: `1px solid ${agent.color}33` }}>
                              {agent.label}
                            </span>
                            {log.tx_hash && (
                              <p className="text-[10px] font-mono text-slate-400 mt-1.5 flex items-center">
                                <Link2 size={9} className="mr-1" />
                                tx:{log.tx_hash.slice(0, 10)}…
                              </p>
                            )}
                            {log.contract_name && (
                              <p className="text-[10px] font-bold text-indigo-400 mt-0.5">📄 {log.contract_name}</p>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-6">
                      <div className="inline-flex items-center bg-slate-100 px-3 py-1 rounded-lg text-xs font-black text-slate-700 mb-2">
                        📦 {inputData.containerId || log.module || 'N/A'}
                      </div>
                      <p className="text-xs font-bold text-slate-500">
                        🌡️ {inputData.temperature ?? '—'}°C | 📍 {inputData.location || '—'}
                      </p>
                    </td>
                    <td className="p-6">
                      <div className="space-y-1">
                        {log.tx_hash && (
                          <p className="text-[10px] font-mono text-blue-600 flex items-center gap-1">
                            <ExternalLink size={9} />
                            tx:{log.tx_hash.slice(0, 8)}…{log.tx_hash.slice(-4)}
                          </p>
                        )}
                        {log.block_number && (
                          <p className="text-[10px] font-mono text-slate-500">Block #{log.block_number}</p>
                        )}
                        {log.contract_name && (
                          <p className="text-[10px] font-bold text-indigo-500">📄 {log.contract_name}</p>
                        )}
                        {log.wallet_address && (
                          <p className="text-[10px] font-mono text-slate-400">{log.wallet_address.slice(0, 6)}…{log.wallet_address.slice(-4)}</p>
                        )}
                        {log.gas_used && (
                          <p className="text-[10px] text-slate-400">⛽ {log.gas_used}</p>
                        )}
                        {!log.tx_hash && !log.block_number && !log.contract_name && (
                          <span className="text-[10px] text-slate-300">Off-chain</span>
                        )}
                      </div>
                    </td>
                    <td className="p-6 max-w-xs">
                      <p className="text-xs font-medium text-slate-600 leading-relaxed italic border-l-2 border-slate-200 pl-3">
                        &quot;{typeof log.output_data === 'string' ? log.output_data : JSON.stringify(log.output_data) || log.action}&quot;
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2 pl-3">
                        Confianza: <span className="text-bezhas-blue">{log.confidence ?? '—'}%</span>
                      </p>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border tracking-widest mb-2 ${decision === 'APPROVED'
                          ? 'text-emerald-500 bg-emerald-50 border-emerald-100'
                          : 'text-rose-500 bg-rose-50 border-rose-100'
                          }`}>
                          {decision}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 max-w-[150px] leading-tight">
                          {log.action}
                        </span>
                        {(log.severity === 'warning' || log.severity === 'critical') && (
                          <button
                            onClick={() => handleFalsePositive(log)}
                            className="mt-1 p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                            title="Marcar como falso positivo"
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!isLoading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 font-medium">
                    No se encontraron logs de auditoría para tu búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="p-6 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-400">
              Mostrando {filteredLogs.length} de {total} registros
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-xs font-bold bg-slate-100 rounded-xl disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * 20 >= total}
                className="px-4 py-2 text-xs font-bold bg-bezhas-blue text-white rounded-xl disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
