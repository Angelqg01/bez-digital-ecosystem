'use client';

import { useState, useEffect } from 'react';
import { Wallet, KeyRound, ArrowRightLeft, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function TabTreasury() {
    const [config, setConfig] = useState({
        loginWallet: '',
        hotWallet: '',
        safeWallet: '',
        dailyLimit: 100,
        approvalThreshold: 500
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        api.get<any>('/admin-config/treasury')
            .then(res => {
                if(res.data) setConfig(res.data);
            })
            .catch(() => {
                setConfig(prev => ({
                    ...prev,
                    loginWallet: prev.loginWallet || '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
                    hotWallet: prev.hotWallet || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                }));
            })
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (field: string, value: string | number) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/admin-config/treasury', config);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch {
            setSuccess(false);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-fuchsia-500" /></div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            {success && (
                <div className="absolute top-0 right-0 bg-emerald-900/90 text-emerald-300 border border-emerald-700 px-4 py-2 flex items-center space-x-2">
                    <CheckCircle2 size={16} /><span>Bóveda sincronizada exitosamente</span>
                </div>
            )}
            <div>
                <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Bóveda Financiera & Web3</h2>
                <p className="text-gray-400 text-sm max-w-2xl">Gestión de carteras multisig (Safe), configuración de MPC para OpenClaw y límites de Account Abstraction (ERC-4337).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Wallets Setup */}
                <div className="bg-white/5 border border-white/10 p-6 space-y-6">
                    <div className="flex items-center space-x-3 text-[#0d33f2]">
                        <Wallet size={24} />
                        <h3 className="font-bold tracking-widest uppercase text-white">Configuración de Wallets</h3>
                    </div>

                    <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2 block">Login Wallet (Auth Only)</label>
                        <input type="text" value={config.loginWallet} onChange={e => handleChange('loginWallet', e.target.value)} className="w-full bg-[#05060a] border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-[#0d33f2] outline-none" />
                        <p className="text-[10px] text-gray-500 mt-1">Usada para firmar acceso. No mantiene fondos operativos.</p>
                    </div>

                    <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2 block">Hot Wallet: Pagos y Gas</label>
                        <input type="text" value={config.hotWallet} onChange={e => handleChange('hotWallet', e.target.value)} className="w-full bg-[#05060a] border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-[#0d33f2] outline-none" />
                        <p className="text-[10px] text-gray-500 mt-1">Wallet delegada a OpenClaw para operaciones frecuentes.</p>
                    </div>

                    <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2 block">Safe Wallet (SuperAdmin Treasury)</label>
                        <input type="text" value={config.safeWallet} onChange={e => handleChange('safeWallet', e.target.value)} placeholder="Ingresa dirección del Smart Contract (Gnosis Safe)" className="w-full bg-[#05060a] border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-red-500 outline-none" />
                        {!config.safeWallet && (
                            <div className="mt-2 flex items-center space-x-2 text-rose-500">
                                <ShieldAlert size={14} />
                                <span className="text-[10px] uppercase font-bold tracking-widest">No conectada. Riesgo de seguridad moderado.</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* MPC / Account Abstraction */}
                <div className="bg-white/5 border border-white/10 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center space-x-3 text-[#a855f7] mb-6">
                            <KeyRound size={24} />
                            <h3 className="font-bold tracking-widest uppercase text-white">Arquitectura MPC & Límites</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-black/30 p-4 border border-white/5">
                                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-2">Límites de Account Abstraction (ERC-4337)</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-gray-500 uppercase">Límite Gasto Diario (OpenClaw)</span>
                                        <div className="flex items-center space-x-2">
                                            <input type="number" value={config.dailyLimit} onChange={e => handleChange('dailyLimit', Number(e.target.value))} className="bg-[#05060a] border border-white/10 w-20 text-right px-2 py-1 text-xs text-white font-mono outline-none focus:border-[#a855f7]" />
                                            <span className="text-xs font-mono font-bold text-white">BEZ</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-white/10 h-1">
                                        <div className="bg-[#a855f7] h-1" style={{ width: '45%' }}></div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                        <span className="text-[10px] text-gray-500 uppercase">Contratos Autorizados (Whitelist)</span>
                                        <span className="text-xs text-[#0d33f2] font-bold">2 Activos (BeZhasVault, Escrow)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-black/30 p-4 border border-white/5">
                                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-2">Configuración MPC</h4>
                                <p className="text-[10px] text-gray-400 leading-relaxed mb-3">La clave privada se fragmenta. OpenClaw calcula transacciones; el Dueño firma biométricamente si superan los umbrales configurados.</p>
                                <div className="flex items-center justify-between bg-[#05060a] p-2 border border-white/10 text-white">
                                    <span className="text-xs text-gray-400">Umbral Aprobación Manual</span>
                                    <input type="number" value={config.approvalThreshold} onChange={e => handleChange('approvalThreshold', Number(e.target.value))} className="bg-transparent w-20 text-right text-white font-mono outline-none" />
                                    <span className="text-[10px] text-gray-500 uppercase ml-1">USD</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <button onClick={handleSave} disabled={saving} className="w-full bg-[#a855f7] text-white px-6 py-4 text-xs font-bold tracking-widest uppercase italic shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:brightness-110 transition-all flex items-center justify-center space-x-2">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
                            <span>Sincronizar Arquitectura Web3</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
