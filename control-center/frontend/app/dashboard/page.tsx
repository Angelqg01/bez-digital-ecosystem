'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Boxes, Fuel, FileText, Layers, Zap, Shield, RotateCcw, Wallet, TrendingUp, BotMessageSquare, AlertTriangle, CheckCircle2, Clock, Server, XCircle, Check } from 'lucide-react';
import { useStats, useChartData, useTransactions, useValidatorStats, useSequencerStatus, useTreasuryStats, useAgentStatus } from '@/lib/hooks';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import ValidatorTierBadge from '@/components/ValidatorTierBadge';
import type { Transaction } from '@/lib/types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function DashboardHome() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: chart } = useChartData(14);
  const { data: txData } = useTransactions(1, 5);
  const { data: valStats } = useValidatorStats();
  const { data: seqStatus } = useSequencerStatus();
  const { data: treasury } = useTreasuryStats();
  const { data: agentStatus } = useAgentStatus();

  const pendingConfirmation = agentStatus?.pendingConfirmation ?? null;

  // ── Edge Node HITL confirmations ──────────────────────────────────────────
  interface EdgeConfirmation {
    requestId: string;
    operationType: string;
    contractAddress: string | null;
    estimatedValueBez: number;
    nodeId: string;
    requestedAt: string;
    decision: 'pending' | 'approved' | 'rejected';
    expiresAt: number;
  }

  const [edgeConfirms, setEdgeConfirms] = useState<EdgeConfirmation[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const pollEdgeConfirms = useCallback(async () => {
    try {
      const res = await api.get<{ data: EdgeConfirmation[] }>('/agent/edge-confirm');
      setEdgeConfirms((res.data ?? []).filter(c => c.decision === 'pending'));
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    pollEdgeConfirms();
    const t = setInterval(pollEdgeConfirms, 8000);
    return () => clearInterval(t);
  }, [pollEdgeConfirms]);

  const handleEdgeDecision = async (requestId: string, decision: 'approved' | 'rejected') => {
    setDecidingId(requestId);
    try {
      await api.patch(`/agent/edge-confirm/${requestId}`, { decision });
      setEdgeConfirms(prev => prev.filter(c => c.requestId !== requestId));
    } catch (e) {
      console.error('Edge decision failed:', e);
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* HITL Alert — Human-in-the-Loop pending confirmation */}
      {pendingConfirmation && (
        <Link href="/dashboard/ai-agent" className="block">
          <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-300 rounded-xl shadow-sm animate-pulse-slow">
            <div className="p-2 bg-amber-100 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800">
                ⚠️ Confirmación requerida — Acción on-chain pendiente
              </p>
              <p className="text-xs text-amber-700 mt-0.5 font-mono truncate">
                Tool: <strong>{pendingConfirmation.toolName}</strong>
              </p>
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expira en {pendingConfirmation.ttlSeconds}s — Ve al chat del agente y responde <strong>sí</strong> o <strong>no</strong>
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1 rounded-full">
              Ir al Agente →
            </span>
          </div>
        </Link>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Vista general de tu ecosistema BeZhas L2</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Transacciones"
          value={statsLoading ? '...' : (stats?.total_transactions ?? 0).toLocaleString()}
          icon={<FileText className="w-5 h-5" />}
        />
        <StatCard
          label="NFTs Minteados"
          value={statsLoading ? '...' : (stats?.total_nfts ?? 0).toLocaleString()}
          icon={<Boxes className="w-5 h-5" />}
        />
        <StatCard
          label="Contratos Activos"
          value={statsLoading ? '...' : (stats?.active_contracts ?? 0)}
          icon={<Layers className="w-5 h-5" />}
        />
        <StatCard
          label="Empresas"
          value={statsLoading ? '...' : (stats?.active_enterprises ?? 0)}
          icon={<Activity className="w-5 h-5" />}
        />
        <StatCard
          label="Block Height"
          value={statsLoading ? '...' : (stats?.block_height ?? 0).toLocaleString()}
          icon={<Zap className="w-5 h-5" />}
        />
        <StatCard
          label="Gas Utilizado"
          value={statsLoading ? '...' : `${stats?.total_gas_used ?? '0'} BEZ`}
          icon={<Fuel className="w-5 h-5" />}
        />
      </div>

      {/* Chart */}
      {chart && chart.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Actividad (14 dias)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip />
              <Area type="monotone" dataKey="transactions" stroke="#2563EB" fill="#2563EB" fillOpacity={0.1} strokeWidth={2} />
              <Area type="monotone" dataKey="nfts_minted" stroke="#10B981" fill="#10B981" fillOpacity={0.08} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Validator, Sequencer & AI Agent Widget */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/validators" className="group">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:border-cyan-200 transition">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-cyan-500" />
              <h3 className="text-sm font-semibold text-gray-700">Validadores</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-gray-900">{valStats?.total_validators ?? '-'}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{valStats?.sequencer_candidates ?? '-'}</p>
                <p className="text-xs text-gray-500">Sequencers</p>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{valStats?.events_24h?.heartbeats ?? '-'}</p>
                <p className="text-xs text-gray-500">Heartbeats 24h</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/sequencer" className="group">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:border-purple-200 transition">
            <div className="flex items-center gap-2 mb-3">
              <RotateCcw className="w-5 h-5 text-purple-500" />
              <h3 className="text-sm font-semibold text-gray-700">Sequencer</h3>
            </div>
            {seqStatus ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-gray-900">#{seqStatus.epoch_number}</p>
                  <p className="text-xs text-gray-500">Epoch</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{seqStatus.blocks_produced.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Bloques</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{seqStatus.queue_length}</p>
                  <p className="text-xs text-gray-500">En cola</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sequencer no disponible</p>
            )}
          </div>
        </Link>

        {/* AI Agent Status Widget */}
        <Link href="/dashboard/ai-agent" className="group">
          <div className={`bg-white rounded-xl border p-5 shadow-sm transition ${
            pendingConfirmation
              ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400'
              : 'border-gray-100 hover:border-violet-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BotMessageSquare className={`w-5 h-5 ${pendingConfirmation ? 'text-amber-500' : 'text-violet-500'}`} />
                <h3 className="text-sm font-semibold text-gray-700">Agente IA</h3>
              </div>
              {agentStatus?.enabled ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Online
                </span>
              ) : (
                <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">Offline</span>
              )}
            </div>
            {pendingConfirmation ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-700">⏳ Confirmación pendiente</p>
                <p className="text-[10px] font-mono text-amber-600 truncate">{pendingConfirmation.toolName}</p>
                <p className="text-[10px] text-amber-500">{pendingConfirmation.ttlSeconds}s restantes</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                {(['telegram', 'discord', 'whatsapp'] as const).map(ch => (
                  <div key={ch}>
                    <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${
                      agentStatus?.channels?.[ch]?.running ? 'bg-emerald-400' : 'bg-gray-200'
                    }`} />
                    <p className="text-[10px] text-gray-500 capitalize">{ch}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* Treasury & Protocol Metrics */}
      <div className="bg-white rounded-xl border border-emerald-100 p-5 shadow-sm bg-gradient-to-r from-emerald-50/20 to-teal-50/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-semibold text-gray-700">BeZhasPayment Treasury & Revenue</h3>
          </div>
          <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Live
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
            <p className="text-xs font-medium text-gray-500 mb-1">Volumen Total Procesado</p>
            <p className="text-xl font-bold text-gray-900">{treasury ? treasury.total_volume_bez.toLocaleString() : '...'} <span className="text-sm font-semibold text-gray-400">BEZ</span></p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
            <p className="text-xs font-medium text-gray-500 mb-1">Comisiones (Fees 0.1%)</p>
            <p className="text-xl font-bold text-emerald-600">+{treasury ? treasury.treasury_fees_bez.toLocaleString() : '...'} <span className="text-sm font-semibold text-emerald-600/60">BEZ</span></p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
            <p className="text-xs font-medium text-gray-500 mb-1">Pagos Exitosos</p>
            <p className="text-xl font-bold text-gray-900">{treasury ? treasury.total_payments.toLocaleString() : '...'}</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
            <p className="text-xs font-medium text-gray-500 mb-1">Tasa de Reembolsos</p>
            <p className="text-xl font-bold text-gray-900">{treasury ? treasury.refund_rate : '...'}%</p>
          </div>
        </div>
      </div>

      {/* Edge Node HITL Panel */}
      {edgeConfirms.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 shadow-sm animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-800">Confirmaciones Edge Node Pendientes</h3>
            <span className="ml-auto text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
              {edgeConfirms.length} pendiente{edgeConfirms.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {edgeConfirms.map(conf => (
              <div key={conf.requestId} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white rounded-lg border border-orange-100 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500 bg-orange-50 px-2 py-0.5 rounded">{conf.operationType}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{conf.nodeId}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 font-mono truncate">
                    Contract: {conf.contractAddress || 'N/A'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Valor: <strong>{conf.estimatedValueBez} BEZ</strong> · Solicitado: {new Date(conf.requestedAt).toLocaleTimeString('es-ES')}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleEdgeDecision(conf.requestId, 'approved')}
                    disabled={decidingId === conf.requestId}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" /> Aprobar
                  </button>
                  <button
                    onClick={() => handleEdgeDecision(conf.requestId, 'rejected')}
                    disabled={decidingId === conf.requestId}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Transacciones Recientes</h3>
        <DataTable<Transaction>
          columns={[
            {
              key: 'tx_hash', label: 'Hash', render: (r) => (
                <span className="font-mono text-xs text-bezhas-accent">{r.tx_hash?.slice(0, 10)}...</span>
              )
            },
            { key: 'contract_name', label: 'Contrato' },
            { key: 'method', label: 'Metodo' },
            {
              key: 'status', label: 'Estado', render: (r) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>{r.status}</span>
              )
            },
            { key: 'block_number', label: 'Bloque' },
          ]}
          data={txData?.rows ?? []}
          emptyMessage="No hay transacciones recientes"
        />
      </div>
    </div>
  );
}
