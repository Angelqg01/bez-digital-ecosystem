import React, { useState, useEffect, useRef } from 'react';
import { Link2, Landmark, Award, Fingerprint, BarChart3, Terminal } from 'lucide-react';
import { SimBlock, NftItem, EscrowEvent } from '../engine/chain';
import { Validator, StepMetrics, ESCROW_COLLATERAL_BEZ, TARIFF_BEZ, PAYOUT_BEZ } from '../engine/types';

export interface ExplorerLogEntry {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'bc' | 'agent';
}

interface ExplorerPanelProps {
  blocks: SimBlock[];
  nfts: NftItem[];
  escrowEvents: EscrowEvent[];
  validators: Validator[];
  activeValidatorDid?: string;
  confirmedDids: string[];
  metrics: StepMetrics;
  logs: ExplorerLogEntry[];
  isBreached: boolean;
  isFinished: boolean;
}

type TabId = 'chain' | 'escrow' | 'nfts' | 'dids' | 'metrics' | 'logs';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'chain', label: 'Cadena', icon: <Link2 size={10} /> },
  { id: 'escrow', label: 'Escrow', icon: <Landmark size={10} /> },
  { id: 'nfts', label: 'NFTs', icon: <Award size={10} /> },
  { id: 'dids', label: 'DIDs', icon: <Fingerprint size={10} /> },
  { id: 'metrics', label: 'Metrics', icon: <BarChart3 size={10} /> },
  { id: 'logs', label: 'Logs', icon: <Terminal size={10} /> },
];

// Explorer multi-pestaña (Simulación 360°)
export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({
  blocks, nfts, escrowEvents, validators, activeValidatorDid, confirmedDids, metrics, logs, isBreached, isFinished,
}) => {
  const [tab, setTab] = useState<TabId>('chain');
  const chainScrollRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === 'chain' && chainScrollRef.current) chainScrollRef.current.scrollTop = chainScrollRef.current.scrollHeight;
  }, [blocks, tab]);
  useEffect(() => {
    if (tab === 'logs' && logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [logs, tab]);

  const escrowBalance = isFinished
    ? isBreached ? PAYOUT_BEZ : 0
    : escrowEvents.some((e) => e.type === 'debit') ? ESCROW_COLLATERAL_BEZ - TARIFF_BEZ
    : escrowEvents.length > 0 ? ESCROW_COLLATERAL_BEZ : 0;

  return (
    <div className="h-full flex flex-col bg-black/90 border border-teal-900/40 rounded-lg overflow-hidden font-mono">
      <div className="px-3 py-2 border-b border-amber-500/10 flex items-center justify-between shrink-0">
        <span className="text-amber-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
          <Link2 size={11} /> Explorer L2
        </span>
        <span className="text-[9px] text-zinc-500">{blocks.length} bloques</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-teal-900/30 shrink-0 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1.5 text-[9px] uppercase tracking-wider whitespace-nowrap border-b-2 transition-all flex items-center gap-1
              ${tab === t.id ? 'text-teal-300 border-teal-400' : 'text-zinc-500 border-transparent hover:text-white'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar min-h-0">
        {/* CADENA */}
        {tab === 'chain' && (
          <div ref={chainScrollRef} className="flex flex-col gap-1.5 h-full overflow-y-auto custom-scrollbar">
            {blocks.length === 0 && (
              <div className="text-center py-10 text-zinc-600 text-[9px]">
                <Link2 size={16} className="mx-auto mb-2 opacity-30" />
                Esperando inicio de la simulación...
              </div>
            )}
            {blocks.map((b) => (
              <div key={b.index} className="p-2 rounded border border-teal-500/10 bg-teal-500/[0.03] animate-fadeIn">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-teal-300 text-[10px] font-bold">#{b.index}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-semibold
                    ${b.phase === 'origin' ? 'bg-teal-500/10 text-teal-300' : b.phase === 'transit' ? 'bg-sky-500/10 text-sky-300' : 'bg-amber-500/10 text-amber-300'}`}>
                    {b.phase === 'origin' ? 'ORIGEN' : b.phase === 'transit' ? 'TRÁNSITO' : 'DESTINO'}
                  </span>
                </div>
                <div className="text-[9px] text-zinc-300 mb-1">{b.label}</div>
                <div className="text-[8px] text-zinc-600 break-all">HASH <span className="text-zinc-400">{b.hash}</span></div>
                <div className="flex justify-between text-[8px] text-zinc-600 mt-0.5">
                  <span>{b.ts}</span>
                  <span>{b.txs} txs · nonce {b.nonce}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ESCROW */}
        {tab === 'escrow' && (
          <div className="flex flex-col gap-2">
            <div className="text-center p-3 border border-teal-500/10 rounded">
              <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1">Balance en Escrow (Polygon L2)</div>
              <div className={`text-xl font-bold ${isFinished && isBreached ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                {escrowBalance.toLocaleString()} BEZ
              </div>
              {isFinished && isBreached && (
                <div className="text-[8px] text-red-400 mt-1 border border-red-500/20 bg-red-950/20 rounded px-2 py-1">
                  🛑 FONDOS CONGELADOS — DISPUTA L2 ACTIVA
                </div>
              )}
            </div>
            {escrowEvents.length === 0 && <div className="text-center text-zinc-600 text-[9px] py-6">Sin movimientos aún. El colateral se bloquea al tokenizar el RWA.</div>}
            {escrowEvents.map((e, i) => (
              <div key={i} className={`flex justify-between items-center px-2 py-1.5 rounded border text-[9px]
                ${e.type === 'lock' ? 'border-amber-500/20 text-amber-300' :
                  e.type === 'debit' ? 'border-sky-500/20 text-sky-300' :
                  e.type === 'release' ? 'border-emerald-500/20 text-emerald-300' :
                  'border-red-500/30 text-red-400 animate-pulse'}`}>
                <span>{e.label}</span>
                <span className="font-bold">{e.amount}</span>
              </div>
            ))}
          </div>
        )}

        {/* NFTs */}
        {tab === 'nfts' && (
          <div className="grid grid-cols-2 gap-2">
            {nfts.map((n) => (
              <div key={n.id} className={`rounded border p-2 transition-all ${n.minted ? 'border-teal-400/30 bg-teal-500/[0.04]' : 'border-zinc-800 opacity-50'}`}>
                <div className="text-lg text-center mb-1">{n.icon}</div>
                <div className="text-[9px] font-semibold text-zinc-200 leading-tight">{n.name}</div>
                <div className="text-[7px] text-zinc-500 mt-0.5">{n.id}</div>
                <div className={`text-[7px] mt-1 inline-block px-1.5 rounded ${n.minted ? 'bg-teal-500/10 text-teal-300' : 'bg-zinc-800 text-zinc-500'}`}>
                  {n.minted ? `MINTED · ${n.standard}` : 'PENDING'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DIDs */}
        {tab === 'dids' && (
          <div className="flex flex-col gap-1.5">
            {validators.map((v) => {
              const isActive = v.did === activeValidatorDid;
              const isConfirmed = confirmedDids.includes(v.did);
              return (
                <div key={v.did} className={`flex items-center gap-2 px-2 py-1.5 rounded border transition-all
                  ${isActive ? 'border-amber-500/40 bg-amber-500/[0.04]' : isConfirmed ? 'border-teal-500/20' : 'border-zinc-800/80'}`}>
                  <span className="text-sm">{v.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-semibold text-zinc-200">{v.name}</div>
                    <div className="text-[7px] text-zinc-500 truncate">{v.did}</div>
                  </div>
                  <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap
                    ${isActive ? 'bg-amber-500/10 text-amber-400 animate-pulse' : isConfirmed ? 'bg-teal-500/10 text-teal-300' : 'bg-zinc-800/80 text-zinc-500'}`}>
                    {isActive ? 'FIRMANDO' : isConfirmed ? 'VERIFICADO' : 'IDLE'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* METRICS */}
        {tab === 'metrics' && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '🛣️', label: 'Distancia Recorrida', value: `${metrics.km.toLocaleString()} km` },
              { icon: '🌍', label: 'Huella CO₂', value: `${metrics.co2.toLocaleString()} kg` },
              { icon: '⛽', label: 'Combustible', value: `${metrics.fuel.toLocaleString()} L` },
              { icon: '⛓️', label: 'Bloques Sellados', value: `${blocks.length}` },
            ].map((m, i) => (
              <div key={i} className="border border-teal-500/10 rounded p-2.5 text-center">
                <div className="text-base mb-1">{m.icon}</div>
                <div className="text-[13px] font-bold text-teal-300">{m.value}</div>
                <div className="text-[8px] text-zinc-500 mt-0.5 uppercase tracking-wide">{m.label}</div>
              </div>
            ))}
            <div className="col-span-2 border border-teal-500/10 rounded p-2 text-[8px] text-zinc-500 leading-relaxed">
              Métricas ancladas al Pasaporte Digital de Producto (DPP) para reporting ESG y auditoría de huella logística on-chain.
            </div>
          </div>
        )}

        {/* LOGS */}
        {tab === 'logs' && (
          <div ref={logScrollRef} className="flex flex-col gap-1.5 h-full overflow-y-auto custom-scrollbar">
            {logs.map((log) => (
              <div key={log.id} className={`border-l-2 pl-2 py-0.5 animate-fadeIn
                ${log.type === 'bc' ? 'border-teal-500' : log.type === 'agent' ? 'border-blue-500' : 'border-zinc-700'}`}>
                <span className="block text-[7px] text-zinc-600">[{log.time}]</span>
                <span className={`text-[9px] leading-snug block ${log.type === 'bc' ? 'text-teal-300/90' : log.type === 'agent' ? 'text-blue-400' : 'text-zinc-400'}`}>
                  {log.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
