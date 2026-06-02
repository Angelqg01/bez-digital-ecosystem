
'use client';
import React from 'react';
import { useTokenomics } from '../hooks/useTokenomics';
import { useAuth } from '@/lib/auth-context';
import { Wallet, Clock, Coins } from 'lucide-react';

export default function StakingCard() {
  const { user } = useAuth();
  const { staking, rewards, isLoading, unstake, claimRewards } = useTokenomics(user?.wallet_address || undefined);

  if (isLoading && !staking) return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-slate-800 rounded mb-4"></div>
        <div className="h-10 bg-slate-800 rounded"></div>
    </div>
  );

  if (!staking?.position) return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-center">
        <p className="text-slate-500">No tienes BEZ en staking.</p>
    </div>
  );

  const { amount, lockEnd, apy } = staking.position;
  const pendingTotal = rewards?.stakingRewards ?? 0;

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Wallet className="text-cyan-400" /> Staking BEZ
        </h3>
        <span className="bg-cyan-500/10 text-cyan-300 text-xs px-3 py-1 rounded-full border border-cyan-500/20">APY {apy}%</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
          <p className="text-slate-400 text-xs mb-1 uppercase tracking-wider">Bloqueado</p>
          <p className="text-white font-mono font-bold text-lg">{amount} BEZ</p>
        </div>
        <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
          <p className="text-slate-400 text-xs mb-1 uppercase tracking-wider">Desbloqueo</p>
          <p className="text-white font-mono flex items-center gap-1 font-bold">
            <Clock size={14} className="text-slate-400" />
            {new Date(lockEnd * 1000).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-4 flex justify-between items-center border border-slate-700/30">
        <div className="flex items-center gap-2">
          <Coins className="text-amber-400" size={18} />
          <span className="text-slate-300">Recompensas pendientes</span>
        </div>
        <span className="text-amber-300 font-bold text-xl">{pendingTotal} BEZ</span>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => claimRewards()}
          className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-xl font-bold hover:from-cyan-600 transition-all shadow-lg shadow-cyan-900/20 active:scale-95"
        >
          Reclamar
        </button>
        <button
          onClick={() => unstake(amount)}
          className="flex-1 border border-slate-700 text-slate-300 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-95"
        >
          Retirar
        </button>
      </div>
    </div>
  );
}
