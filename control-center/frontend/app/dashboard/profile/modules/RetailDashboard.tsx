
'use client';
import React from 'react';
import StakingCard from '../shared/StakingCard';
import BeZhasAgentWidget from '../shared/BeZhasAgentWidget';
import { useTokenomics } from '../hooks/useTokenomics';
import { useAuth } from '@/lib/auth-context';
import { TrendingUp, Award, Zap } from 'lucide-react';

export default function RetailDashboard() {
  const { user } = useAuth();
  const { portfolio } = useTokenomics(user?.wallet_address || undefined);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Columna Izquierda: Staking y Recompensas */}
      <div className="lg:col-span-2 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <TrendingUp className="text-emerald-400" size={20} />
                    <h4 className="text-slate-300 font-bold uppercase text-xs tracking-widest">Balance Total</h4>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white">{portfolio?.totalValue || '0.00'}</span>
                    <span className="text-slate-500 font-bold">BEZ</span>
                </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <Award className="text-amber-400" size={20} />
                    <h4 className="text-slate-300 font-bold uppercase text-xs tracking-widest">Nivel de Usuario</h4>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xl font-extrabold text-white">BeZhas Novice</span>
                    <Zap size={16} className="text-amber-400 fill-amber-400" />
                </div>
                <p className="text-slate-500 text-xs mt-1">Siguiente nivel: BeZhas Explorer (+500 XP)</p>
            </div>
        </div>

        <StakingCard />
        
        {/* Mock for Farming */}
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 p-6 border-dashed">
            <h3 className="text-slate-400 font-bold text-center">Módulo de Farming (Sprint 3 Beta)</h3>
            <p className="text-slate-600 text-sm text-center">Próximamente: Liquidity Pools y Yield Farming.</p>
        </div>
      </div>

      {/* Columna Derecha: Agente y Actividad */}
      <div className="space-y-6">
        <BeZhasAgentWidget />
        
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <h4 className="text-white font-bold mb-4">Historial Reciente</h4>
            <div className="space-y-4">
                {[1, 2].map((_, i) => (
                    <div key={i} className="flex justify-between items-center text-sm border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                        <div>
                            <p className="text-slate-200 font-medium">Recompensa Staking</p>
                            <p className="text-slate-500 text-xs">Hace 2 horas</p>
                        </div>
                        <span className="text-emerald-400 font-mono">+12.5 BEZ</span>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
