
'use client';
import React from 'react';
import RetailDashboard from './modules/RetailDashboard';
import { useAuth } from '@/lib/auth-context';
import {
  Settings,
  ShieldCheck,
  Globe,
  Building2,
  Landmark,
  KeyRound,
  Fingerprint,
  Cpu,
  Network
} from 'lucide-react';

interface ProfileDashboardProps {
  profile: any;
  onEdit: () => void;
}

export default function ProfileDashboard({ profile, onEdit }: ProfileDashboardProps) {
  const { user } = useAuth();

  const renderMetadataGrid = () => {
    const items = [];

    if (profile.nickname) items.push({ label: 'Alias BeZhas', value: profile.nickname, icon: <Fingerprint size={14} /> });
    if (profile.country || profile.jurisdiction) items.push({ label: 'Jurisdicción', value: profile.country || profile.jurisdiction, icon: <Globe size={14} /> });
    if (profile.companyName || profile.institutionName) items.push({ label: 'Entidad Legal', value: profile.companyName || profile.institutionName, icon: <Building2 size={14} /> });
    if (profile.taxId || profile.registryId) items.push({ label: 'Registro/Tax ID', value: profile.taxId || profile.registryId, icon: <ShieldCheck size={14} /> });
    if (profile.wallet || profile.multiSigWallet) items.push({ label: 'Wallet Vinculada', value: profile.wallet || profile.multiSigWallet, icon: <KeyRound size={14} />, mono: true });
    if (profile.transparencyId) items.push({ label: 'Ledger Transparency', value: profile.transparencyId, icon: <Network size={14} />, mono: true });

    if (items.length === 0) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {items.map((item, i) => (
          <div key={i} className="bg-slate-900/40 border border-slate-800/50 p-4 rounded-2xl backdrop-blur-sm group hover:border-bezhas-accent/30 transition-all">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-bezhas-accent opacity-70">{item.icon}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
            </div>
            <p className={`text-sm font-bold text-slate-200 truncate ${item.mono ? 'font-mono text-xs' : ''}`} title={item.value}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header Premium */}
      <header className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-bezhas-accent/5 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Cpu size={120} className="text-bezhas-accent" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-bezhas-accent/20 border border-bezhas-accent/30 flex items-center justify-center text-bezhas-accent shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                {profile.type === 'government' ? <Landmark size={36} /> :
                  profile.type === 'institution' ? <Building2 size={36} /> :
                    <Fingerprint size={36} />}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-bezhas-accent/10 border border-bezhas-accent/20 text-bezhas-accent text-[10px] font-black uppercase tracking-tighter">
                  Perfil BeZhas {profile.type}
                </span>
                <span className="text-slate-500 text-[10px] font-bold">NODE: BEZ-772</span>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-2">
                {profile.nickname || profile.companyName || profile.institutionName || 'Operador BeZhas'}
              </h1>
              <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-700" />
                Wallet: <span className="font-mono text-xs text-slate-500">{user?.wallet_address?.slice(0, 6)}...{user?.wallet_address?.slice(-4)}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onEdit}
            className="group flex items-center gap-2 bg-slate-800 hover:bg-bezhas-accent text-slate-200 hover:text-white px-6 py-3 rounded-2xl transition-all border border-slate-700 hover:border-bezhas-accent shadow-lg text-sm font-black active:scale-95"
          >
            <Settings size={18} className="group-hover:rotate-90 transition-transform duration-500" />
            GESTIONAR IDENTIDAD
          </button>
        </div>
      </header>

      {/* Grid de Metadata Técnica */}
      <section>
        <div className="flex items-center gap-3 mb-4 px-2">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Configuración del Nodo</h3>
          <div className="h-[1px] flex-1 bg-slate-800/50" />
        </div>
        {renderMetadataGrid()}
      </section>

      {/* Dashboard Específico */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-6 px-2">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            Terminal Operativa
            <span className="text-[10px] text-emerald-400 bg-emerald-400/5 px-2 py-0.5 rounded-md border border-emerald-400/10 uppercase tracking-widest font-bold">Sincronizado</span>
          </h2>
        </div>
        <div className="border-t border-slate-800/30 pt-8">
          <RetailDashboard />
        </div>
      </section>
    </div>
  );
}
