'use client';

/**
 * Treasury & Web3 — Hot Wallet, Safe, firmantes y configuración de tesorería, en una
 * sola sección del SuperAdmin (antes «Treasury & Web3» y «Hot Wallet» por separado).
 *
 * Todo sale de un mismo resumen (GET /admin-hot-wallet), así que las partes se
 * hablan entre sí: el Safe marca cuál de sus propietarias es la Hot Wallet y cuáles
 * son firmantes, los firmantes marcan si son propietarias del Safe, y el
 * diagnóstico avisa de lo que no cuadra. Cambiar el Safe vigilado en la
 * configuración recarga el resumen entero.
 *
 * Las salidas de la Hot Wallet se proponen aquí, las firman con MetaMask (EIP-712)
 * los firmantes registrados y se ejecutan con 2 firmas. La clave de la Hot Wallet
 * no pasa por aquí ni por la API: la custodia el tx-signer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Wallet, ShieldCheck, ShieldAlert, PenLine, Send, Loader2, RefreshCw, ExternalLink, XCircle, CheckCircle2,
    Users, Vault, Settings2, AlertTriangle, Info,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';

type Balance = { asset: string; amount: string | null; error?: string };
type Approver = {
    address: string; label: string | null; status: string; expiresAt: string | null; safeOwner: boolean; isHotWallet: boolean;
};
type SafeOwner = { address: string; isHotWallet: boolean; isApprover: boolean };
type Safe = {
    address: string; isSafe: boolean; owners?: SafeOwner[]; threshold?: number; nonce?: number | null;
    version?: string | null; pol?: string | null; explorer?: string;
} | null;
type Aviso = { nivel: 'critico' | 'aviso' | 'info'; code: string; texto: string };
type Resumen = {
    hotWallet: {
        address: string; configured: boolean; registeredAddress: string; matchesRegistered: boolean; safeOwner: boolean;
        chainId: number; explorer: string; keyCustody: string;
    };
    balances: Balance[] | null;
    safe: Safe;
    approvers: Approver[];
    policy: { minApprovals: number; activeApprovers: number; ready: boolean };
    config: { safeWallet: string; dailyLimit: number; approvalThreshold: number; loginWallet: string | null };
    killSwitch: { estado: string; motivo: string | null };
    treasuryAppConfigured: boolean;
    marketplaceFees: { contract: string; treasury: string; feeBps: number; owedWei: string } | null;
    diagnostics: Aviso[];
};
type FilaIntent = {
    id: string; status: string; asset: string; amount: string; destination: string; destination_name: string | null;
    reference: string | null; required_approvals: number; approvals: number; tx_hash: string | null; created_at: string;
};
type TypedData = { domain: Record<string, unknown>; types: Record<string, { name: string; type: string }[]>; primaryType: string; message: Record<string, unknown> };
type Detalle = {
    intencion: {
        id: string; estado: string; aprobacionesRequeridas: number; motivos: { code: string; message?: string }[];
        txHash?: string; aprobacion?: { datosTipados: TypedData };
    };
    firmas: { address: string; decision: string; at: string }[];
};

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
const ethereum = (): Eth | null => (typeof window !== 'undefined' ? ((window as unknown as { ethereum?: Eth }).ethereum ?? null) : null);

const corto = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
// Saldo legible: miles separados y como mucho 4 decimales (formatEther devuelve hasta 18).
const importe = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('es-ES', { maximumFractionDigits: 4 }) : v;
};
const ESTADO_COLOR: Record<string, string> = {
    awaiting_approval: 'text-amber-400', approved: 'text-sky-400', executing: 'text-sky-400',
    broadcast: 'text-emerald-400', denied: 'text-red-400', rejected: 'text-red-400', failed: 'text-red-400',
    expired: 'text-gray-500', failed_needs_review: 'text-red-400',
};
const AVISO_ESTILO: Record<Aviso['nivel'], { caja: string; Icono: typeof AlertTriangle }> = {
    critico: { caja: 'border-red-800 bg-red-950/50 text-red-300', Icono: ShieldAlert },
    aviso: { caja: 'border-amber-800 bg-amber-950/40 text-amber-300', Icono: AlertTriangle },
    info: { caja: 'border-sky-900 bg-sky-950/40 text-sky-300', Icono: Info },
};

function mensajeError(e: unknown) {
    if (e instanceof ApiError) {
        const d = e.data as { error?: string; code?: string } | undefined;
        return d?.error ? `${d.error}${d.code ? ` (${d.code})` : ''}` : e.message;
    }
    return e instanceof Error ? e.message : String(e);
}

function Etiqueta({ children, tono }: { children: React.ReactNode; tono: 'rojo' | 'verde' | 'violeta' | 'gris' }) {
    const c = { rojo: 'border-red-700 text-red-300', verde: 'border-emerald-700 text-emerald-300', violeta: 'border-fuchsia-700 text-fuchsia-300', gris: 'border-white/15 text-gray-400' }[tono];
    return <span className={`shrink-0 border px-1.5 py-0.5 text-[9px] uppercase tracking-widest ${c}`}>{children}</span>;
}

export default function TabTreasury() {
    const [resumen, setResumen] = useState<Resumen | null>(null);
    const [intents, setIntents] = useState<FilaIntent[]>([]);
    const [detalle, setDetalle] = useState<Detalle | null>(null);
    const [cuenta, setCuenta] = useState<string | null>(null);
    const [cargando, setCargando] = useState(true);
    const [ocupado, setOcupado] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [form, setForm] = useState({ asset: 'BEZ', amount: '', destination: '', destinationName: '', reference: '' });
    const [config, setConfig] = useState({ safeWallet: '', dailyLimit: '', approvalThreshold: '' });

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const r = await api.get<Resumen>('/admin-hot-wallet');
            setResumen(r);
            setConfig({
                safeWallet: r.config.safeWallet,
                dailyLimit: String(r.config.dailyLimit),
                approvalThreshold: String(r.config.approvalThreshold),
            });
            if (r.treasuryAppConfigured) {
                const l = await api.get<{ intents: FilaIntent[] }>('/admin-hot-wallet/intents');
                setIntents(l.intents);
            }
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const aprobadoresActivos = useMemo(
        () => new Set((resumen?.approvers || []).filter((a) => a.status === 'active').map((a) => a.address.toLowerCase())),
        [resumen],
    );
    const cuentaEsAprobador = cuenta ? aprobadoresActivos.has(cuenta.toLowerCase()) : false;

    async function conectar() {
        const eth = ethereum();
        if (!eth) { setError('No se detecta MetaMask en este navegador.'); return; }
        try {
            const cuentas = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
            setCuenta(cuentas[0] || null);
        } catch (e) {
            setError(mensajeError(e));
        }
    }

    async function guardarConfig(e: React.FormEvent) {
        e.preventDefault();
        setOcupado('config');
        setError(null);
        try {
            await api.put('/admin-hot-wallet/config', {
                safeWallet: config.safeWallet.trim(),
                dailyLimit: Number(config.dailyLimit),
                approvalThreshold: Number(config.approvalThreshold),
            });
            setAviso('Configuración guardada. El Safe, los firmantes y el diagnóstico se han recalculado.');
            await cargar();
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setOcupado(null);
        }
    }

    async function abrir(id: string) {
        setOcupado(id);
        try {
            setDetalle(await api.get<Detalle>(`/admin-hot-wallet/intents/${id}`));
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setOcupado(null);
        }
    }

    async function proponer(e: React.FormEvent) {
        e.preventDefault();
        setOcupado('crear');
        setError(null);
        try {
            const r = await api.post<{ intencion: { id: string; estado: string } }>('/admin-hot-wallet/intents', {
                asset: form.asset, amount: form.amount.trim(), destination: form.destination.trim(),
                ...(form.destinationName.trim() ? { destinationName: form.destinationName.trim() } : {}),
                ...(form.reference.trim() ? { reference: form.reference.trim() } : {}),
            });
            setAviso(`Operación propuesta (${r.intencion.estado}). Faltan las firmas de los aprobadores.`);
            setForm({ ...form, amount: '', destination: '', destinationName: '', reference: '' });
            await cargar();
            await abrir(r.intencion.id);
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setOcupado(null);
        }
    }

    async function firmar(decision: 'APPROVE' | 'REJECT') {
        const datos = detalle?.intencion.aprobacion?.datosTipados;
        const eth = ethereum();
        if (!datos || !eth || !cuenta) return;
        setOcupado('firmar');
        setError(null);
        try {
            // MetaMask exige EIP712Domain en los tipos del v4. El dominio no lleva
            // chainId a propósito (ver api/services/txApproval.js).
            const payload = {
                ...datos,
                types: {
                    EIP712Domain: Object.keys(datos.domain).map((k) => ({ name: k, type: 'string' })),
                    ...datos.types,
                },
                message: { ...datos.message, decision },
            };
            const signature = (await eth.request({
                method: 'eth_signTypedData_v4',
                params: [cuenta, JSON.stringify(payload)],
            })) as string;
            await api.post(`/admin-hot-wallet/intents/${detalle!.intencion.id}/approvals`, { signature, decision });
            setAviso(decision === 'APPROVE' ? 'Firma registrada.' : 'Rechazo registrado.');
            await abrir(detalle!.intencion.id);
            await cargar();
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setOcupado(null);
        }
    }

    async function accion(tipo: 'execute' | 'cancel') {
        if (!detalle) return;
        if (tipo === 'cancel' && !window.confirm('¿Cancelar esta operación?')) return;
        setOcupado(tipo);
        setError(null);
        try {
            await api.post(`/admin-hot-wallet/intents/${detalle.intencion.id}/${tipo}`, {});
            setAviso(tipo === 'execute' ? 'Enviada al firmante aislado.' : 'Operación cancelada.');
            await abrir(detalle.intencion.id);
            await cargar();
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setOcupado(null);
        }
    }

    if (cargando && !resumen) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#0d33f2]" /></div>;

    const hw = resumen?.hotWallet;
    const safe = resumen?.safe;
    const yaFirmo = detalle?.firmas.some((f) => cuenta && f.address.toLowerCase() === cuenta.toLowerCase());
    const criticos = (resumen?.diagnostics || []).filter((d) => d.nivel === 'critico').length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Treasury &amp; Web3</h2>
                    <p className="text-gray-400 text-sm max-w-2xl">
                        Hot Wallet, Safe y firmantes de BeZhas en Polygon. Cada salida de la Hot Wallet se propone aquí y la firman con
                        MetaMask los firmantes de tesorería: sin {resumen?.policy.minApprovals ?? 2} firmas no sale nada, ni con esta sesión.
                    </p>
                </div>
                <button onClick={cargar} className="text-gray-400 hover:text-white p-2" aria-label="Recargar">
                    <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} />
                </button>
            </div>

            {error && <div className="border border-red-800 bg-red-950/60 text-red-300 px-4 py-3 text-sm flex gap-2"><XCircle size={16} className="shrink-0 mt-0.5" />{error}</div>}
            {aviso && <div className="border border-emerald-800 bg-emerald-950/60 text-emerald-300 px-4 py-3 text-sm flex gap-2"><CheckCircle2 size={16} className="shrink-0 mt-0.5" />{aviso}</div>}

            {/* Diagnóstico: lo que sólo se ve cruzando Hot Wallet, Safe, firmantes y configuración */}
            {resumen && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gray-400">
                        {criticos ? <ShieldAlert size={14} className="text-red-400" /> : <ShieldCheck size={14} className="text-emerald-400" />}
                        Diagnóstico · {criticos ? `${criticos} crítico(s)` : 'sin avisos críticos'}
                    </div>
                    {resumen.diagnostics.map((d) => {
                        const { caja, Icono } = AVISO_ESTILO[d.nivel];
                        return (
                            <div key={d.code} className={`border px-4 py-2 text-sm flex gap-2 ${caja}`}>
                                <Icono size={16} className="shrink-0 mt-0.5" />{d.texto}
                            </div>
                        );
                    })}
                </div>
            )}

            {resumen && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Hot Wallet */}
                    <div className="bg-white/5 border border-white/10 p-6 space-y-4">
                        <div className="flex items-center gap-3 text-[#0d33f2]"><Wallet size={22} /><h3 className="font-bold tracking-widest uppercase text-white text-sm">Hot Wallet</h3></div>
                        <a href={hw!.explorer} target="_blank" rel="noreferrer" className="font-mono text-sm break-all text-white hover:text-[#0d33f2] inline-flex items-center gap-2">
                            {hw!.address}<ExternalLink size={14} className="shrink-0" />
                        </a>
                        <div className="flex flex-wrap gap-1.5">
                            {hw!.safeOwner && <Etiqueta tono="rojo">propietaria del Safe</Etiqueta>}
                            <Etiqueta tono={hw!.configured ? 'verde' : 'gris'}>{hw!.configured ? 'desplegada' : 'sin configurar'}</Etiqueta>
                        </div>
                        {!hw!.matchesRegistered && <p className="text-[11px] text-red-400">La dirección del despliegue no coincide con la registrada ({corto(hw!.registeredAddress)}).</p>}
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Clave: {hw!.keyCustody}</p>
                        <div className="grid grid-cols-2 gap-2">
                            {(resumen.balances || [{ asset: 'Saldos', amount: null, error: 'sin POLYGON_RPC_URL' }]).map((b) => (
                                <div key={b.asset} className="bg-black/30 border border-white/5 p-3">
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest">{b.asset}</div>
                                    <div className="font-mono text-white text-sm break-all" title={b.amount ?? undefined}>
                                        {b.amount !== null ? importe(b.amount) : (b.error ? 'no disponible' : '—')}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {resumen.marketplaceFees && (
                            <p className="text-[11px] text-gray-400">
                                Comisión del marketplace pendiente en MarketplaceSettlement: <span className="font-mono text-white">{importe(String(Number(resumen.marketplaceFees.owedWei) / 1e18))} BEZ</span> (la retira la tesorería, no esta wallet).
                            </p>
                        )}
                    </div>

                    {/* Safe */}
                    <div className="bg-white/5 border border-white/10 p-6 space-y-4">
                        <div className="flex items-center gap-3 text-[#00D4AA]"><Vault size={22} /><h3 className="font-bold tracking-widest uppercase text-white text-sm">Safe (multisig)</h3></div>
                        {!safe && <p className="text-xs text-gray-500">No se pudo leer el Safe (¿sin POLYGON_RPC_URL?).</p>}
                        {safe && !safe.isSafe && <p className="text-xs text-amber-400">{safe.address} no responde como un Safe en Polygon.</p>}
                        {safe?.isSafe && (
                            <>
                                <a href={safe.explorer} target="_blank" rel="noreferrer" className="font-mono text-sm break-all text-white hover:text-[#00D4AA] inline-flex items-center gap-2">
                                    {safe.address}<ExternalLink size={14} className="shrink-0" />
                                </a>
                                <div className={`flex items-center gap-2 text-xs ${(safe.threshold ?? 0) >= 2 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {(safe.threshold ?? 0) >= 2 ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                                    Umbral {safe.threshold} de {safe.owners?.length}
                                </div>
                                <ul className="space-y-2">
                                    {safe.owners?.map((o) => (
                                        <li key={o.address} className="bg-black/30 border border-white/5 px-3 py-2">
                                            <div className="font-mono text-[11px] text-gray-300 break-all">{o.address}</div>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {o.isHotWallet && <Etiqueta tono="rojo">Hot Wallet</Etiqueta>}
                                                {o.isApprover && <Etiqueta tono="violeta">firmante</Etiqueta>}
                                                {!o.isHotWallet && !o.isApprover && <Etiqueta tono="gris">propietaria</Etiqueta>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                                    {safe.version ? `v${safe.version} · ` : ''}{safe.nonce ?? '—'} operaciones · {safe.pol ? `${importe(safe.pol)} POL` : ''}
                                </p>
                            </>
                        )}
                    </div>

                    {/* Firmantes */}
                    <div className="bg-white/5 border border-white/10 p-6 space-y-4">
                        <div className="flex items-center gap-3 text-[#a855f7]"><Users size={22} /><h3 className="font-bold tracking-widest uppercase text-white text-sm">Firmantes de tesorería</h3></div>
                        <div className={`flex items-center gap-2 text-xs ${resumen.policy.ready ? 'text-emerald-400' : 'text-red-400'}`}>
                            {resumen.policy.ready ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                            {resumen.policy.activeApprovers} activos · se exigen {resumen.policy.minApprovals} firmas
                        </div>
                        <ul className="space-y-2">
                            {resumen.approvers.length === 0 && <li className="text-xs text-gray-500">No hay wallets de tesorería registradas (POST /api/security/approvers con rol treasury).</li>}
                            {resumen.approvers.map((a) => (
                                <li key={a.address} className="bg-black/30 border border-white/5 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-xs text-white min-w-0">{a.label || 'Sin etiqueta'}</div>
                                        <span className={`shrink-0 text-[10px] uppercase tracking-widest ${a.status === 'active' ? 'text-emerald-400' : 'text-gray-500'}`}>{a.status}</span>
                                    </div>
                                    <div className="font-mono text-[11px] text-gray-400 break-all">{a.address}</div>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {a.safeOwner && <Etiqueta tono="verde">propietaria del Safe</Etiqueta>}
                                        {a.isHotWallet && <Etiqueta tono="rojo">es la Hot Wallet</Etiqueta>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="pt-2 border-t border-white/5 text-xs">
                            {cuenta ? (
                                <span className={cuentaEsAprobador ? 'text-emerald-400' : 'text-amber-400'}>
                                    MetaMask: {corto(cuenta)} {cuentaEsAprobador ? '· firmante registrado' : '· no es firmante de tesorería'}
                                </span>
                            ) : (
                                <button onClick={conectar} className="bg-[#a855f7] text-white px-4 py-2 font-bold uppercase tracking-widest text-[11px]">Conectar MetaMask</button>
                            )}
                        </div>
                        <p className={`text-[10px] uppercase tracking-widest ${resumen.killSwitch.estado === 'NORMAL' ? 'text-gray-500' : 'text-red-400'}`}>
                            Kill switch: {resumen.killSwitch.estado}{resumen.killSwitch.motivo ? ` · ${resumen.killSwitch.motivo}` : ''}
                        </p>
                    </div>
                </div>
            )}

            {resumen && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Configuración */}
                    <form onSubmit={guardarConfig} className="lg:col-span-2 bg-white/5 border border-white/10 p-6 space-y-3">
                        <div className="flex items-center gap-3 text-gray-300"><Settings2 size={20} /><h3 className="font-bold tracking-widest uppercase text-white text-sm">Configuración</h3></div>
                        <label className="block">
                            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Safe vigilado</span>
                            <input value={config.safeWallet} onChange={(e) => setConfig({ ...config, safeWallet: e.target.value })} className="mt-1 w-full bg-[#05060a] border border-white/10 text-white px-3 py-2 text-sm font-mono" />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Límite diario (BEZ)</span>
                                <input inputMode="decimal" value={config.dailyLimit} onChange={(e) => setConfig({ ...config, dailyLimit: e.target.value })} className="mt-1 w-full bg-[#05060a] border border-white/10 text-white px-3 py-2 text-sm font-mono" />
                            </label>
                            <label className="block">
                                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Aprobación manual (USD)</span>
                                <input inputMode="decimal" value={config.approvalThreshold} onChange={(e) => setConfig({ ...config, approvalThreshold: e.target.value })} className="mt-1 w-full bg-[#05060a] border border-white/10 text-white px-3 py-2 text-sm font-mono" />
                            </label>
                        </div>
                        <p className="text-[10px] text-gray-500">
                            Preferencias del panel: los límites que se aplican de verdad son los de la política y los del signer.json del tx-signer.
                        </p>
                        <div className="text-[11px] text-gray-400 space-y-1">
                            <div>Hot Wallet: <span className="font-mono text-gray-300">{corto(hw?.address)}</span> · viene del despliegue (TX_TREASURY_ADDRESS_137)</div>
                            <div>Login por wallet: <span className="font-mono text-gray-300">{corto(resumen.config.loginWallet)}</span> · ADMIN_WALLET</div>
                        </div>
                        <button disabled={ocupado === 'config'} className="w-full bg-white/10 hover:bg-white/15 text-white py-3 text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2 disabled:opacity-60">
                            {ocupado === 'config' ? <Loader2 size={14} className="animate-spin" /> : <Settings2 size={14} />} Guardar y recalcular
                        </button>
                    </form>

                    {/* Operaciones */}
                    <div className="lg:col-span-3 bg-white/5 border border-white/10 p-6 space-y-4">
                        <div className="flex items-center gap-3 text-[#0d33f2]"><Send size={20} /><h3 className="font-bold tracking-widest uppercase text-white text-sm">Salidas de la Hot Wallet</h3></div>
                        {!resumen.treasuryAppConfigured ? (
                            <p className="text-xs text-amber-300">Se activan cuando esté configurada BEZPAY_TREASURY_APP_ID (ver diagnóstico).</p>
                        ) : (
                            <>
                                <form onSubmit={proponer} className="grid grid-cols-1 md:grid-cols-6 gap-2">
                                    <select value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })} className="bg-[#05060a] border border-white/10 text-white px-2 py-2 text-sm">
                                        {['BEZ', 'USDC', 'USDT'].map((a) => <option key={a}>{a}</option>)}
                                    </select>
                                    <input required inputMode="decimal" placeholder="Importe" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="md:col-span-2 bg-[#05060a] border border-white/10 text-white px-3 py-2 text-sm font-mono" />
                                    <input required placeholder="Destino 0x…" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="md:col-span-3 bg-[#05060a] border border-white/10 text-white px-3 py-2 text-sm font-mono" />
                                    <input placeholder="Beneficiario (opcional)" value={form.destinationName} onChange={(e) => setForm({ ...form, destinationName: e.target.value })} className="md:col-span-3 bg-[#05060a] border border-white/10 text-white px-3 py-2 text-sm" />
                                    <input placeholder="Concepto (opcional)" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="md:col-span-2 bg-[#05060a] border border-white/10 text-white px-3 py-2 text-sm" />
                                    <button disabled={ocupado === 'crear'} className="bg-[#0d33f2] text-white py-2 text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2 disabled:opacity-60">
                                        {ocupado === 'crear' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Proponer
                                    </button>
                                </form>

                                {intents.length === 0 && <p className="text-xs text-gray-500">Sin operaciones todavía.</p>}
                                <div className="divide-y divide-white/5 max-h-[320px] overflow-y-auto">
                                    {intents.map((i) => (
                                        <button key={i.id} onClick={() => abrir(i.id)} className={`w-full text-left py-2 px-2 flex items-center justify-between hover:bg-white/5 ${detalle?.intencion.id === i.id ? 'bg-white/5' : ''}`}>
                                            <div>
                                                <div className="text-sm text-white font-mono">{i.amount} {i.asset} → {i.destination_name || corto(i.destination)}</div>
                                                <div className="text-[10px] text-gray-500">{new Date(i.created_at).toLocaleString('es-ES')} · firmas {i.approvals}/{i.required_approvals}</div>
                                            </div>
                                            <span className={`text-[10px] uppercase tracking-widest ${ESTADO_COLOR[i.status] || 'text-gray-400'}`}>{ocupado === i.id ? '…' : i.status}</span>
                                        </button>
                                    ))}
                                </div>

                                {detalle && (
                                    <div className="border-t border-white/10 pt-4 space-y-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-mono text-gray-400">{detalle.intencion.id}</span>
                                            <span className={ESTADO_COLOR[detalle.intencion.estado] || 'text-gray-400'}>{detalle.intencion.estado}</span>
                                        </div>
                                        {detalle.intencion.motivos.length > 0 && (
                                            <ul className="text-[11px] text-amber-300 list-disc pl-4">{detalle.intencion.motivos.map((m) => <li key={m.code}>{m.message || m.code}</li>)}</ul>
                                        )}
                                        <div className="text-xs text-gray-300">
                                            Firmas {detalle.firmas.filter((f) => f.decision === 'APPROVE').length}/{detalle.intencion.aprobacionesRequeridas}
                                            {detalle.firmas.map((f) => <div key={f.address + f.at} className="font-mono text-[11px] text-gray-500">{f.decision} · {corto(f.address)}</div>)}
                                        </div>
                                        {detalle.intencion.txHash && (
                                            <a className="text-xs text-[#0d33f2] inline-flex items-center gap-1" href={`https://polygonscan.com/tx/${detalle.intencion.txHash}`} target="_blank" rel="noreferrer">
                                                Ver transacción <ExternalLink size={12} />
                                            </a>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {detalle.intencion.estado === 'awaiting_approval' && (
                                                <>
                                                    <button disabled={!cuentaEsAprobador || yaFirmo || ocupado === 'firmar'} onClick={() => firmar('APPROVE')} className="bg-emerald-600 text-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest inline-flex items-center gap-2 disabled:opacity-40">
                                                        {ocupado === 'firmar' ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />} Firmar con MetaMask
                                                    </button>
                                                    <button disabled={!cuentaEsAprobador || yaFirmo || ocupado === 'firmar'} onClick={() => firmar('REJECT')} className="border border-red-700 text-red-300 px-4 py-2 text-[11px] font-bold uppercase tracking-widest disabled:opacity-40">Rechazar</button>
                                                </>
                                            )}
                                            {detalle.intencion.estado === 'approved' && (
                                                <button disabled={ocupado === 'execute'} onClick={() => accion('execute')} className="bg-[#0d33f2] text-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest inline-flex items-center gap-2">
                                                    {ocupado === 'execute' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Ejecutar
                                                </button>
                                            )}
                                            {['awaiting_approval', 'approved'].includes(detalle.intencion.estado) && (
                                                <button disabled={ocupado === 'cancel'} onClick={() => accion('cancel')} className="border border-white/20 text-gray-300 px-4 py-2 text-[11px] font-bold uppercase tracking-widest">Cancelar</button>
                                            )}
                                        </div>
                                        {detalle.intencion.estado === 'awaiting_approval' && !cuenta && <p className="text-[11px] text-gray-500">Conecta MetaMask con una wallet de tesorería para firmar.</p>}
                                        {yaFirmo && <p className="text-[11px] text-gray-500">Esta wallet ya firmó: la siguiente firma tiene que venir de otra.</p>}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
