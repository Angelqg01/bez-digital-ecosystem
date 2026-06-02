
'use client';
import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Trophy, CheckCircle, User, Building2, Landmark, Briefcase, Shield, KeyRound, ArrowLeft, Check } from 'lucide-react';

// --- Configuración de sectores y permisos ---
const SECTOR_PERMISSIONS = {
    retail: ['staking', 'swap', 'portfolio'],
    'private-investor': ['staking', 'swap', 'portfolio', 'governance'],
    whale: ['staking', 'swap', 'portfolio', 'governance', 'otc_desk', 'vip_pools'],
    company: ['b2b_payments', 'supply_chain', 'treasury', 'tokenization'],
    corporation: ['b2b_payments', 'supply_chain', 'treasury', 'tokenization', 'compliance'],
    institution: ['custody', 'liquidity_aggregator', 'lending_pro', 'compliance_report'],
    government: ['cbdc_admin', 'transparency_audit', 'identity_sovereign', 'supervision'],
} as const;

type ProfileType = keyof typeof SECTOR_PERMISSIONS;

// --- Validadores ---
const ethAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Dirección inválida');
const txId = z.string().regex(/^0x([A-Fa-f0-9]{64})$/, 'TxID inválido');
const multiSig = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Multi-sig inválida');

// --- Zod Schema ---
const profileSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('retail'), nickname: z.string().min(3), country: z.string(), sectors: z.array(z.string()) }),
    z.object({ type: z.literal('private-investor'), nickname: z.string().min(3), proofOfFunds: z.string().url(), sectors: z.array(z.string()) }),
    z.object({ type: z.literal('whale'), nickname: z.string().min(3), proofOfReserves: z.string().url(), sectors: z.array(z.string()) }),
    z.object({ type: z.literal('company'), companyName: z.string().min(2), taxId: z.string().min(6), wallet: ethAddress, sectors: z.array(z.string()) }),
    z.object({ type: z.literal('corporation'), companyName: z.string().min(2), taxId: z.string().min(6), wallet: ethAddress, complianceOfficer: z.string().min(3), sectors: z.array(z.string()) }),
    z.object({ type: z.literal('institution'), institutionName: z.string().min(2), registryId: z.string().min(6), multiSigWallet: multiSig, sectors: z.array(z.string()) }),
    z.object({ type: z.literal('government'), jurisdiction: z.string().min(2), authorityLevel: z.string().min(2), transparencyId: txId, multiSigWallet: multiSig, sectors: z.array(z.string()) }),
]);

type ProfileFormValues = z.infer<typeof profileSchema>;

const PROFILE_TYPES: { key: ProfileType; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'retail', label: 'Retail', icon: <User className="text-cyan-400" />, desc: 'Usuario individual.' },
    { key: 'private-investor', label: 'Inversor', icon: <Shield className="text-violet-400" />, desc: 'Acceso avanzado.' },
    { key: 'whale', label: 'Whale', icon: <Trophy className="text-amber-400" />, desc: 'Acceso VIP.' },
    { key: 'company', label: 'Empresa', icon: <Briefcase className="text-blue-400" />, desc: 'B2B.' },
    { key: 'corporation', label: 'Corporación', icon: <Building2 className="text-fuchsia-400" />, desc: 'Global.' },
    { key: 'institution', label: 'Institución', icon: <Landmark className="text-emerald-400" />, desc: 'Custodia.' },
    { key: 'government', label: 'Gobierno', icon: <KeyRound className="text-red-400" />, desc: 'Máxima Seg.' },
];

export default function ProfileConfig({ initialData, onSave, onCancel }: { initialData?: any, onSave: (data: any) => void, onCancel?: () => void }) {
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: initialData || { type: 'retail', nickname: '', country: '', sectors: [] },
        mode: 'onChange',
    });

    const selectedType = form.watch('type');
    const selectedSectors = form.watch('sectors') || [];

    const handleSave = async (data: ProfileFormValues) => {
        setLoading(true);
        await new Promise(r => setTimeout(r, 1800)); // Simulación de procesamiento en red
        onSave(data);
        setSaved(true);
        setLoading(false);
        setTimeout(() => setSaved(false), 2000);
    };

    const toggleSector = (sector: string) => {
        const current = form.getValues('sectors');
        if (current.includes(sector)) {
            form.setValue('sectors', current.filter(s => s !== sector));
        } else {
            form.setValue('sectors', [...current, sector]);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex items-center gap-4">
                {onCancel && (
                    <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-2xl text-slate-400 transition-all border border-slate-800">
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Configuración BeZ-Profile</h1>
                    <p className="text-sm text-slate-500 font-medium">Sincroniza tu identidad Web3 con el ecosistema BeZhas.</p>
                </div>
            </div>

            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-10">
                {/* Selector de tipo de perfil */}
                <section className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Rol Operativo</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {PROFILE_TYPES.map((pt) => (
                            <button
                                key={pt.key}
                                type="button"
                                onClick={() => form.setValue('type', pt.key as any)}
                                className={`rounded-2xl border-2 p-3 flex flex-col items-center gap-2 transition-all font-bold text-xs group
                                    ${selectedType === pt.key ? 'border-bezhas-accent bg-bezhas-accent/10 text-bezhas-accent shadow-[0_0_20px_rgba(6,182,212,0.15)]' : 'border-slate-800 bg-slate-900/60 text-slate-500 hover:border-slate-700 hover:text-slate-300'}`}
                            >
                                <div className={`p-2 rounded-xl transition-colors ${selectedType === pt.key ? 'bg-bezhas-accent/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                                    {pt.icon}
                                </div>
                                <span className="text-[10px] text-center">{pt.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Campos Dinámicos */}
                <section className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 space-y-6 shadow-xl backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-bezhas-accent animate-pulse" />
                        <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">Detalles de Identidad</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {selectedType === 'retail' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nickname</label>
                                    <input {...form.register('nickname')} className="input-bezhas" placeholder="Tu nombre en BeZhas" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">País</label>
                                    <input {...form.register('country')} className="input-bezhas" placeholder="Ubicación" />
                                </div>
                            </>
                        )}
                        {selectedType === 'private-investor' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nickname</label>
                                    <input {...form.register('nickname')} className="input-bezhas" placeholder="Nombre inversor" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Prueba de Fondos (URL)</label>
                                    <input {...form.register('proofOfFunds')} className="input-bezhas" placeholder="https://..." />
                                </div>
                            </>
                        )}
                        {selectedType === 'whale' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nickname</label>
                                    <input {...form.register('nickname')} className="input-bezhas" placeholder="Nombre VIP" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Prueba de Reservas (URL)</label>
                                    <input {...form.register('proofOfReserves')} className="input-bezhas" placeholder="https://..." />
                                </div>
                            </>
                        )}
                        {selectedType === 'company' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nombre Empresa</label>
                                    <input {...form.register('companyName')} className="input-bezhas" placeholder="Legal Name" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tax ID</label>
                                    <input {...form.register('taxId')} className="input-bezhas" placeholder="CIF/NIF" />
                                </div>
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">B2B Wallet Address</label>
                                    <input {...form.register('wallet')} className="input-bezhas font-mono" placeholder="0x..." />
                                </div>
                            </>
                        )}
                        {selectedType === 'corporation' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nombre Corporación</label>
                                    <input {...form.register('companyName')} className="input-bezhas" placeholder="Global Entity Name" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Compliance Officer</label>
                                    <input {...form.register('complianceOfficer')} className="input-bezhas" placeholder="Nombre responsable" />
                                </div>
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Global Wallet</label>
                                    <input {...form.register('wallet')} className="input-bezhas font-mono" placeholder="0x..." />
                                </div>
                            </>
                        )}
                        {selectedType === 'institution' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nombre Institución</label>
                                    <input {...form.register('institutionName')} className="input-bezhas" placeholder="Bank/Fund Name" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Registry ID</label>
                                    <input {...form.register('registryId')} className="input-bezhas" placeholder="Licencia / Registro" />
                                </div>
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Multi-Sig Vault Address</label>
                                    <input {...form.register('multiSigWallet')} className="input-bezhas font-mono" placeholder="0x..." />
                                </div>
                            </>
                        )}
                        {selectedType === 'government' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Jurisdicción</label>
                                    <input {...form.register('jurisdiction')} className="input-bezhas" placeholder="País/Región" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nivel de Autoridad</label>
                                    <input {...form.register('authorityLevel')} className="input-bezhas" placeholder="Ministerio / Agencia" />
                                </div>
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Ledger Transparency ID (TxHash)</label>
                                    <input {...form.register('transparencyId')} className="input-bezhas font-mono" placeholder="0x..." />
                                </div>
                            </>
                        )}
                    </div>
                </section>

                {/* Sectores Favoritos */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sectores Prioritarios</label>
                        <span className="text-[9px] font-bold text-bezhas-accent bg-bezhas-accent/5 px-2 py-0.5 rounded-full border border-bezhas-accent/10">Personalizado para {selectedType}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(SECTOR_PERMISSIONS[selectedType] || []).map((service) => (
                            <button
                                key={service}
                                type="button"
                                onClick={() => toggleSector(service)}
                                className={`p-4 rounded-2xl border transition-all flex items-center justify-between text-left group
                                    ${selectedSectors.includes(service) ? 'border-bezhas-accent bg-bezhas-accent/5' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'}`}
                            >
                                <div className="space-y-1">
                                    <p className={`text-xs font-black capitalize ${selectedSectors.includes(service) ? 'text-white' : 'text-slate-400'}`}>
                                        {service.replace(/_/g, ' ')}
                                    </p>
                                    <p className="text-[9px] text-slate-500 font-medium">Protocolo BeZhas Active</p>
                                </div>
                                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all
                                    ${selectedSectors.includes(service) ? 'bg-bezhas-accent border-bezhas-accent text-white' : 'border-slate-700 bg-slate-800 text-transparent'}`}>
                                    <Check size={12} strokeWidth={4} />
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                <div className="space-y-4">
                    <button type="submit" disabled={loading} className="w-full bg-bezhas-accent text-white p-5 rounded-[1.5rem] font-black text-lg shadow-[0_10px_40px_rgba(6,182,212,0.2)] hover:shadow-[0_15px_50px_rgba(6,182,212,0.3)] transition-all transform active:scale-[0.98] disabled:opacity-50">
                        {loading ? 'Sincronizando Identidad...' : 'Guardar y Vincular con BeZ-Key'}
                    </button>

                    {saved && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center gap-2 text-emerald-400 text-sm font-black animate-in fade-in slide-in-from-bottom-2">
                            <CheckCircle size={18} /> Identidad actualizada en el nodo local
                        </div>
                    )}
                </div>
            </form>
            
            <style jsx>{`
                .input-bezhas {
                    width: 100%;
                    padding: 0.85rem 1.25rem;
                    background: #0f172a;
                    border: 1px solid #1e293b;
                    border-radius: 1.25rem;
                    color: white;
                    font-size: 0.875rem;
                    font-weight: 600;
                    outline: none;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .input-bezhas:focus {
                    border-color: #06b6d4;
                    background: #1e293b;
                    box-shadow: 0 0 0 4px rgba(6,182,212,0.1);
                }
                .input-bezhas::placeholder {
                    color: #475569;
                    font-weight: 500;
                }
            `}</style>
        </div>
    );
}
