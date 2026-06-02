'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowDownCircle, ArrowRightLeft, ShieldCheck, Zap, Wallet,
  Loader2, AlertCircle, Clock, CheckCircle2, XCircle, ChevronDown, History,
  Activity, TrendingUp, AlertTriangle,
} from 'lucide-react';
import api from '@/lib/api';
import {
  useBridgeTransfers, useBridgeStatus, useBridgeFees, useBridgeInitiate, useBridgeStats,
  SUPPORTED_CHAINS, BRIDGE_TOKENS, BRIDGE_STEPS, getChain, getStatusColor,
  type ChainConfig, type BridgeToken,
} from '@/lib/bridge-hooks';
import { useWalletConnection } from '@/lib/wallet-hooks';
import { useBridgeContractStats, useBridgeDeposit, useWrappedBEZBalance } from '@/lib/bridge-onchain-hooks';
import { useSequencerOnChain } from '@/lib/validator-hooks';
import { useBlockchainSSE } from '@/lib/hooks';
import type { BridgeTransfer } from '@/lib/types';
import InfraEcosystemNav from './InfraEcosystemNav';

/**
 * @title BridgePortal
 * @description Full cross-chain bridge interface connected to:
 *   - POST /api/gateway/v1/bridge/initiate   (create transfer)
 *   - GET  /api/gateway/v1/bridge/transfers   (history)
 *   - GET  /api/gateway/v1/bridge/status      (live tracking)
 *   - GET  /api/gateway/v1/bridge/fees        (fee estimation)
 *   - GET  /api/gateway/v1/wallet/balance     (balance)
 */
export default function BridgePortal() {
  // ── Wallet State (on-chain) ──
  const wallet = useWalletConnection();
  const walletAddress = wallet.address;

  // ── Bridge Form State ──
  const [amount, setAmount] = useState('');
  const [fromChain, setFromChain] = useState<ChainConfig>(SUPPORTED_CHAINS[0]); // BeZhas
  const [toChain, setToChain] = useState<ChainConfig>(SUPPORTED_CHAINS[1]);     // Ethereum
  const [selectedToken, setSelectedToken] = useState<BridgeToken>(BRIDGE_TOKENS[0]); // BEZ
  const [showFromChains, setShowFromChains] = useState(false);
  const [showToChains, setShowToChains] = useState(false);
  const [showTokens, setShowTokens] = useState(false);

  // ── UI State ──
  const [view, setView] = useState<'form' | 'confirm' | 'tracking' | 'history'>('form');
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);

  // ── Hooks: API connections ──
  const { initiate, loading: initiating, error: initiateError, clearError } = useBridgeInitiate();
  const { data: historyData, mutate: refreshHistory } = useBridgeTransfers(walletAddress);
  const { data: statusData } = useBridgeStatus(activeTransferId);
  const { data: feesData } = useBridgeFees(fromChain.chainId, toChain.chainId, amount, selectedToken.address);
  const { data: statsData } = useBridgeStats();
  const { events: bridgeEvents, connected: sseConnected } = useBlockchainSSE('bridge');

  // ── On-chain hooks (FASE 2) ──
  const { stats: bridgeOnChain } = useBridgeContractStats();
  const bridgeDeposit = useBridgeDeposit(wallet.signer);
  const { balance: wrappedBEZBalance } = useWrappedBEZBalance(walletAddress);
  const { status: sequencerStatus } = useSequencerOnChain();

  const fees = feesData?.fees;
  const bridgeStats = statsData?.stats;
  const transfers = historyData?.transfers ?? [];
  const trackedTransfer = statusData?.transfer ?? null;

  // ── Available tokens for selected chain pair ──
  const availableTokens = useMemo(() =>
    BRIDGE_TOKENS.filter(t => t.chains.includes(fromChain.chainId) && t.chains.includes(toChain.chainId)),
    [fromChain, toChain],
  );

  // ── Auto-redirect when tracked transfer finalizes or fails ──
  useEffect(() => {
    if (trackedTransfer && (trackedTransfer.status === 'finalized' || trackedTransfer.status === 'failed')) {
      refreshHistory();
    }
  }, [trackedTransfer, refreshHistory]);

  // ── Handlers ──
  const swapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
  };

  const selectFromChain = (c: ChainConfig) => {
    setFromChain(c);
    if (c.chainId === toChain.chainId) setToChain(SUPPORTED_CHAINS.find(x => x.chainId !== c.chainId)!);
    setShowFromChains(false);
  };

  const selectToChain = (c: ChainConfig) => {
    setToChain(c);
    if (c.chainId === fromChain.chainId) setFromChain(SUPPORTED_CHAINS.find(x => x.chainId !== c.chainId)!);
    setShowToChains(false);
  };

  const handleBridge = () => {
    clearError();
    setView('confirm');
  };

  const confirmBridge = async () => {
    if (!walletAddress || !amount) return;
    const result = await initiate({
      sender: walletAddress,
      recipient: walletAddress,
      fromChainId: fromChain.chainId,
      toChainId: toChain.chainId,
      tokenAddress: selectedToken.address,
      amount: parseFloat(amount),
    });
    if (result) {
      setActiveTransferId(result.transferId);
      setView('tracking');
      refreshHistory();
    } else {
      setView('form');
    }
  };

  const resetForm = () => {
    setAmount('');
    setActiveTransferId(null);
    setView('form');
  };

  // ── Render ──
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-700">

      {/* Ecosystem Nav */}
      <InfraEcosystemNav />

      {/* Sequencer AI Pause Warning */}
      {sequencerStatus?.isPaused && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-700 text-sm font-medium">
          <AlertTriangle size={18} className="text-amber-500" />
          <div>
            <span className="font-bold">⚠️ Sequencer L2 Pausado</span>
            <span className="ml-2">Bridge deshabilitado temporalmente. Razón: {sequencerStatus.pauseReason || 'Sin especificar'}</span>
          </div>
          <span className="ml-auto text-[10px] font-bold text-amber-500 uppercase">ON-CHAIN</span>
        </div>
      )}

      {/* Bridge Stats Bar (hybrid: API + on-chain) */}
      {bridgeStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Bridged</p>
            <p className="text-lg font-black text-slate-900">{parseFloat(bridgeStats.totalBridged).toLocaleString()} BEZ</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transferencias</p>
            <p className="text-lg font-black text-slate-900">{bridgeStats.totalTransfers.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cadenas Activas</p>
            <p className="text-lg font-black text-slate-900">{bridgeStats.chainBreakdown?.length ?? 0}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Finalizadas (24h)</p>
            <p className="text-lg font-black text-emerald-600">{bridgeStats.recentFinalized}</p>
          </div>
        </div>
      )}

      {/* On-chain Bridge Contract Stats */}
      {bridgeOnChain && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 text-center text-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deposited (On-Chain)</p>
            <p className="text-lg font-black">{parseFloat(bridgeOnChain.totalDeposited).toLocaleString()} BEZ</p>
          </div>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 text-center text-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">wBEZ Supply</p>
            <p className="text-lg font-black">{parseFloat(bridgeOnChain.wrappedBEZSupply).toLocaleString()} wBEZ</p>
          </div>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 text-center text-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tu wBEZ</p>
            <p className="text-lg font-black">{parseFloat(wrappedBEZBalance).toFixed(4)}</p>
          </div>
        </div>
      )}

      {/* SSE Live Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className={`h-2 w-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
          <span>{sseConnected ? 'Eventos en vivo' : 'Desconectado'}</span>
          {bridgeEvents.length > 0 && (
            <span className="flex items-center gap-1 ml-2 text-bezhas-cyan">
              <Activity size={12} /> {bridgeEvents.length} eventos recientes
            </span>
          )}
        </div>
        {bridgeStats?.chainBreakdown && bridgeStats.chainBreakdown.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <TrendingUp size={12} />
            Top: {getChain(bridgeStats.chainBreakdown[0].chainId)?.shortName ?? '?'} ({bridgeStats.chainBreakdown[0].count} txs)
          </div>
        )}
      </div>

      {/* Header + History Toggle */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
            BeZhas Universal <span className="text-bezhas-cyan">Bridge</span>
          </h2>
          <p className="text-slate-500 font-medium max-w-md">
            Mueve activos entre redes de forma segura. Fees en vivo, seguimiento paso a paso.
          </p>
        </div>
        <button
          onClick={() => setView(view === 'history' ? 'form' : 'history')}
          className="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-sm font-bold text-slate-600 transition-all"
        >
          <History size={16} />
          {view === 'history' ? 'Nuevo Bridge' : `Historial (${transfers.length})`}
        </button>
      </div>

      {/* ═══ HISTORY VIEW ═══ */}
      {view === 'history' && (
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Transferencias Bridge</h3>
          </div>
          {transfers.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <ArrowRightLeft size={40} className="mx-auto mb-4 opacity-40" />
              <p className="font-bold">Sin transferencias aún</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {transfers.map((tx: BridgeTransfer) => {
                const from = getChain(tx.from_chain_id);
                const to = getChain(tx.to_chain_id);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 cursor-pointer transition-all"
                    onClick={() => { setActiveTransferId(tx.id); setView('tracking'); }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <div className={`w-3 h-3 rounded-full ${from?.color || 'bg-slate-300'}`} />
                        <span className="text-xs font-bold text-slate-500">{from?.shortName || '?'}</span>
                        <span className="text-slate-300 mx-1">→</span>
                        <div className={`w-3 h-3 rounded-full ${to?.color || 'bg-slate-300'}`} />
                        <span className="text-xs font-bold text-slate-500">{to?.shortName || '?'}</span>
                      </div>
                      <span className="font-black text-slate-900">{parseFloat(tx.amount).toFixed(4)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold uppercase ${getStatusColor(tx.status)}`}>
                        {tx.status}
                      </span>
                      <span className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TRACKING VIEW ═══ */}
      {view === 'tracking' && (
        <div className="bg-white rounded-[40px] shadow-lg border border-slate-100 p-10 space-y-8">
          <div className="text-center space-y-2">
            {trackedTransfer?.status === 'finalized' ? (
              <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
            ) : trackedTransfer?.status === 'failed' ? (
              <XCircle size={56} className="mx-auto text-red-500" />
            ) : (
              <Loader2 size={56} className="mx-auto text-bezhas-cyan animate-spin" />
            )}
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
              {trackedTransfer?.status === 'finalized' ? '¡Bridge Completado!' :
                trackedTransfer?.status === 'failed' ? 'Error en Bridge' :
                  'Procesando Bridge...'}
            </h3>
            <p className="text-xs font-mono text-slate-400">ID: {activeTransferId}</p>
          </div>

          {/* Step Progress */}
          <div className="flex items-center justify-between px-4">
            {BRIDGE_STEPS.map((s, i) => {
              const currentStep = trackedTransfer?.current_step ?? 0;
              const done = currentStep >= s.step;
              const active = currentStep === s.step;
              return (
                <div key={s.step} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all ${done ? 'bg-emerald-500 text-white' : active ? 'bg-bezhas-cyan text-white animate-pulse' : 'bg-slate-100 text-slate-400'
                    }`}>
                    {done ? '✓' : s.step}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 mt-2 text-center">{s.label}</span>
                  {i < BRIDGE_STEPS.length - 1 && (
                    <div className={`h-0.5 w-full mt-[-20px] ${done ? 'bg-emerald-300' : 'bg-slate-100'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Transfer Details */}
          {trackedTransfer && (
            <div className="bg-slate-50 rounded-2xl p-6 space-y-3 text-sm">
              <Row label="Cantidad" value={`${parseFloat(trackedTransfer.amount).toFixed(4)}`} />
              <Row label="Origen" value={getChain(trackedTransfer.from_chain_id)?.name || String(trackedTransfer.from_chain_id)} />
              <Row label="Destino" value={getChain(trackedTransfer.to_chain_id)?.name || String(trackedTransfer.to_chain_id)} />
              {trackedTransfer.l1_tx_hash && <Row label="TX L1" value={trackedTransfer.l1_tx_hash} mono />}
              {trackedTransfer.l2_tx_hash && <Row label="TX L2" value={trackedTransfer.l2_tx_hash} mono />}
              {trackedTransfer.relay_tx_hash && <Row label="TX Relay" value={trackedTransfer.relay_tx_hash} mono />}
            </div>
          )}

          <button onClick={resetForm} className="w-full bg-slate-900 text-white rounded-[24px] p-6 font-black uppercase tracking-widest shadow-lg">
            {trackedTransfer?.status === 'finalized' || trackedTransfer?.status === 'failed' ? 'Nuevo Bridge' : 'Volver al Portal'}
          </button>
        </div>
      )}

      {/* ═══ FORM VIEW ═══ */}
      {view === 'form' && (
        <div className="bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-bezhas-cyan rounded-full blur-[100px] opacity-10 -mr-20 -mt-20" />
          <div className="p-10 relative z-10 space-y-8">

            {/* Chain Selector */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-3xl border border-slate-100">
              <ChainSelector
                label="Origen"
                selected={fromChain}
                open={showFromChains}
                onToggle={() => { setShowFromChains(!showFromChains); setShowToChains(false); }}
                onSelect={selectFromChain}
              />
              <button
                onClick={swapChains}
                className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 hover:rotate-180 transition-transform duration-500 text-bezhas-cyan"
              >
                <ArrowRightLeft size={24} />
              </button>
              <ChainSelector
                label="Destino"
                selected={toChain}
                open={showToChains}
                onToggle={() => { setShowToChains(!showToChains); setShowFromChains(false); }}
                onSelect={selectToChain}
              />
            </div>

            {/* Token + Amount */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Cantidad a Enviar</label>
                <span className="text-xs font-bold text-slate-400">Saldo: {wallet.connected ? `${parseFloat(wrappedBEZBalance || '0').toFixed(4)} wBEZ` : '—'}</span>
              </div>
              <div className="relative group">
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.0001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-[32px] p-8 text-4xl font-black text-slate-900 focus:outline-none focus:border-bezhas-cyan transition-all"
                />
                {/* Token Selector */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                  <button
                    onClick={() => setShowTokens(!showTokens)}
                    className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all"
                  >
                    <span>{selectedToken.icon}</span>
                    <span className="font-black text-slate-900 tracking-tighter">{selectedToken.symbol}</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>
                  {showTokens && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden min-w-[180px]">
                      {availableTokens.map(t => (
                        <button
                          key={t.symbol}
                          onClick={() => { setSelectedToken(t); setShowTokens(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left ${t.symbol === selectedToken.symbol ? 'bg-slate-50' : ''}`}
                        >
                          <span>{t.icon}</span>
                          <div>
                            <div className="font-bold text-sm text-slate-900">{t.symbol}</div>
                            <div className="text-[10px] text-slate-400">{t.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Live Fee Estimation */}
            {fees && parseFloat(amount) > 0 && (
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                <FeeItem label="Bridge Fee" value={`${fees.bridgeFee} ${selectedToken.symbol}`} />
                <FeeItem label="Gas Origen" value={`$${fees.gasFeeOrigin}`} />
                <FeeItem label="Gas Destino" value={`$${fees.gasFeeDestination}`} />
                <FeeItem label="Tiempo Est." value={`~${fees.estimatedTimeMinutes} min`} icon={<Clock size={12} className="text-bezhas-cyan" />} />
              </div>
            )}

            {/* Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoTip icon={<Zap size={18} className="text-amber-400" />} text="Fee dinámica calculada en vivo" />
              <InfoTip icon={<ShieldCheck size={18} className="text-emerald-400" />} text="Smart Contracts auditados + MPC" />
            </div>

            {/* Error */}
            {initiateError && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-medium">
                <AlertCircle size={16} /> {initiateError}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleBridge}
              disabled={!amount || parseFloat(amount) <= 0 || !walletAddress || sequencerStatus?.isPaused}
              className="w-full bg-slate-950 text-white rounded-[32px] p-8 text-xl font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-[0_20px_40px_-10px_rgba(15,23,42,0.4)] disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {!walletAddress ? 'Conectar Wallet Primero' : sequencerStatus?.isPaused ? '🚧 Sequencer Pausado' : 'Iniciar Transferencia Bridge'}
              <ArrowDownCircle className="inline ml-3 group-hover:translate-y-1 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ CONFIRM VIEW ═══ */}
      {view === 'confirm' && (
        <div className="bg-white rounded-[40px] shadow-lg border border-slate-100 p-10 space-y-8 animate-in zoom-in-95 duration-300">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Confirma tu Operación</h3>
            <p className="text-slate-500 font-medium italic">Revisa los detalles antes de ejecutar</p>
          </div>

          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 space-y-4">
            <Row label="Enviando" value={`${amount} ${selectedToken.symbol}`} bold />
            <Row label="Ruta" value={fees?.route || `${fromChain.shortName} → ${toChain.shortName}`} />
            <Row label="Fee Total Estimada" value={fees ? `$${fees.totalFeeUSD}` : '—'} />
            <Row label="Tiempo Estimado" value={fees ? `~${fees.estimatedTimeMinutes} minutos` : '—'} />
            <Row label="Wallet" value={walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-6)}` : '—'} mono />
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => setView('form')}
              className="flex-1 bg-white border border-slate-200 rounded-[24px] p-6 font-bold text-slate-500 hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={confirmBridge}
              disabled={initiating}
              className="flex-[2] bg-bezhas-cyan text-white rounded-[24px] p-6 font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {initiating ? <Loader2 size={20} className="animate-spin" /> : null}
              {initiating ? 'Procesando...' : 'Confirmar Bridge'}
            </button>
          </div>
        </div>
      )}

      {/* Wallet Bar */}
      <div className="flex justify-center">
        <div className="bg-white/80 backdrop-blur-md border border-slate-200 px-8 py-4 rounded-full flex items-center space-x-3 shadow-lg">
          <Wallet className="text-bezhas-cyan" size={20} />
          <span className="text-sm font-black text-slate-700 font-mono">
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'No conectado'}
          </span>
          <div className={`h-2 w-2 rounded-full ${walletAddress ? 'bg-emerald-500' : 'bg-red-400'}`} />
          {!wallet.connected && (
            <button
              onClick={() => wallet.connect()}
              className="ml-2 text-xs font-bold text-bezhas-cyan hover:underline"
            >
              Conectar
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Sub-Components ──

function ChainSelector({ label, selected, open, onToggle, onSelect }: {
  label: string; selected: ChainConfig; open: boolean;
  onToggle: () => void; onSelect: (c: ChainConfig) => void;
}) {
  const supportedChains = SUPPORTED_CHAINS.filter(c => c.supported);
  return (
    <div className="relative flex-1">
      <button onClick={onToggle} className="w-full p-5 rounded-2xl hover:bg-white transition-all text-left">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-lg ${selected.color} flex items-center justify-center text-white font-black text-xs`}>
            {selected.shortName.charAt(0)}
          </div>
          <span className="text-sm font-black text-slate-900 tracking-tight">{selected.name}</span>
          <ChevronDown size={14} className="text-slate-400 ml-auto" />
        </div>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden">
          {supportedChains.map(c => (
            <button
              key={c.chainId}
              onClick={() => onSelect(c)}
              className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-left ${c.chainId === selected.chainId ? 'bg-slate-50' : ''}`}
            >
              <div className={`h-6 w-6 rounded ${c.color} flex items-center justify-center text-white text-[10px] font-bold`}>
                {c.shortName.charAt(0)}
              </div>
              <span className="text-sm font-bold text-slate-700">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center border-b border-slate-200 last:border-0 pb-3 last:pb-0">
      <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">{label}</span>
      <span className={`${bold ? 'font-black text-xl' : 'font-bold'} text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function FeeItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm font-black text-slate-900 flex items-center justify-center gap-1">{icon}{value}</p>
    </div>
  );
}

function InfoTip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
      {icon}
      <span className="text-xs font-bold text-slate-500">{text}</span>
    </div>
  );
}
