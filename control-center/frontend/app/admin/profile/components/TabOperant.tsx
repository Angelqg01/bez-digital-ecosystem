'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Mail, ShieldCheck, ClipboardCheck, Loader2, RefreshCw, Search } from 'lucide-react';
import api, { ApiError } from '@/lib/api';

// Fase 1: SOLO LECTURA. Todo pasa por /api/admin/operant, que exige la sesión de
// SuperAdmin y habla con OPERANT desde el servidor: la clave de OPERANT no llega
// nunca al navegador. Las acciones (aprobar, lanzar tareas, programar) son fase 2.

interface Status { configured: boolean; tenantId: string; runtime: { available: boolean; circuit?: string; reason?: string } }
interface Task { id: string; department?: string; type?: string; status: string; attempts?: number; deadLetter?: boolean }
interface Approval { approvalId: string; reason?: string; agentId?: string; action?: { category?: string } }
interface Overview {
    tenantId: string;
    plan?: string;
    limits?: { maxAgentCallsMonth?: number; maxConcurrentTasks?: number };
    agentCalls?: { used?: number; limit?: number | null; remaining?: number | null; allowed?: boolean };
    cost?: { costUsd?: number; calls?: number };
    invoice?: { totalUsd?: number };
    approvals?: Approval[];
    tasks?: Task[];
}
interface MailItem { uid: number; subject: string; from: string; fromName?: string; date: string | null; unread: boolean }
interface MailList { mailbox?: string; total: number; hasMore: boolean; offset: number; messages: MailItem[] }
interface MailDetail extends MailItem { to: { name: string; address: string }[]; text: string; attachments: { filename: string; size: number }[] }

const BASE = '/admin/operant';
const usd = (n?: number) => `$${Number(n || 0).toFixed(2)}`;
const fecha = (d: string | null) => (d ? new Date(d).toLocaleString() : '');
const errMsg = (e: unknown) => (e instanceof ApiError ? (e.data as { error?: string } | null)?.error || e.message : (e as Error).message);

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'idle'; children: React.ReactNode }) {
    const c = { ok: 'text-emerald-300 border-emerald-700 bg-emerald-900/30', warn: 'text-amber-300 border-amber-700 bg-amber-900/30', bad: 'text-red-300 border-red-700 bg-red-900/30', idle: 'text-gray-400 border-white/10 bg-white/5' }[tone];
    return <span className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 ${c}`}>{children}</span>;
}

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
    return (
        <div className="bg-white/5 border border-white/10 p-4">
            <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
            <div className="text-2xl font-black mt-1">{value}</div>
            {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
        </div>
    );
}

export default function TabOperant() {
    const [status, setStatus] = useState<Status | null>(null);
    const [overview, setOverview] = useState<Overview | null>(null);
    const [audit, setAudit] = useState<{ valid?: boolean; ok?: boolean; error?: string } | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const s = await api.get<Status>(`${BASE}/status`);
            setStatus(s);
            if (!s.configured || !s.runtime.available) {
                setOverview(null);
                return;
            }
            const [o, a] = await Promise.allSettled([
                api.get<Overview>(`${BASE}/overview`),
                api.get<{ valid?: boolean; ok?: boolean }>(`${BASE}/audit/verify`),
            ]);
            if (o.status === 'fulfilled') setOverview(o.value); else setError(`Panel del tenant: ${errMsg(o.reason)}`);
            setAudit(a.status === 'fulfilled' ? a.value : { error: errMsg(a.reason) });
        } catch (e) {
            setError(errMsg(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (loading && !status) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#0d33f2]" /></div>;

    const down = status && (!status.configured || !status.runtime.available);
    const calls = overview?.agentCalls;
    const approvals = overview?.approvals || [];
    const tasks = overview?.tasks || [];
    const auditOk = audit && (audit.valid ?? audit.ok);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">OPERANT · Agentes IA</h2>
                    <p className="text-gray-400 text-sm max-w-2xl">
                        Vista de solo lectura de la gestión empresarial autónoma de BeZhas: cuota, aprobaciones humanas pendientes, tareas, auditoría y bandeja del buzón.
                    </p>
                </div>
                <button onClick={load} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest border border-white/10 px-3 py-2 hover:bg-white/5">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
                </button>
            </div>

            {error && <div className="border border-red-700 bg-red-900/30 text-red-300 text-sm px-4 py-3">{error}</div>}

            {down && (
                <div className="border border-amber-700 bg-amber-900/20 text-amber-200 text-sm px-4 py-3">
                    {!status!.configured
                        ? 'OPERANT no está conectado: falta OPERANT_INTERNAL_KEY en la API.'
                        : `OPERANT no responde (${status!.runtime.reason || 'sin detalle'}; circuito ${status!.runtime.circuit || '?'}).`}
                    {' '}No se muestran datos de ejemplo.
                </div>
            )}

            {overview && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Kpi label="Plan" value={overview.plan || '-'} hint={`tenant ${overview.tenantId}`} />
                        <Kpi
                            label="Llamadas este mes"
                            value={<>{calls?.used ?? 0}<span className="text-sm text-gray-500"> / {calls?.limit ?? '∞'}</span></>}
                            hint={calls?.allowed === false ? 'cuota agotada' : `${calls?.remaining ?? '∞'} restantes`}
                        />
                        <Kpi label="Coste IA" value={usd(overview.cost?.costUsd)} hint={`${overview.cost?.calls || 0} llamadas al modelo`} />
                        <Kpi label="Factura estimada" value={usd(overview.invoice?.totalUsd)} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <section className="bg-white/5 border border-white/10 p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-[#0d33f2]"><ClipboardCheck size={22} /><h3 className="font-bold uppercase tracking-widest text-sm text-white">Aprobaciones humanas</h3></div>
                                <Pill tone={approvals.length ? 'warn' : 'ok'}>{approvals.length} pendientes</Pill>
                            </div>
                            {approvals.length === 0 && <p className="text-sm text-gray-500">Sin aprobaciones pendientes.</p>}
                            {approvals.map((a) => (
                                <div key={a.approvalId} className="border border-white/10 p-3 text-sm space-y-1">
                                    <div className="flex items-center gap-2"><code className="text-xs text-gray-400">{a.approvalId}</code><Pill tone="warn">{a.action?.category || 'acción'}</Pill></div>
                                    <div>{a.reason || 'Aprobación humana requerida.'}</div>
                                    {a.agentId && <div className="text-xs text-gray-500">{a.agentId}</div>}
                                </div>
                            ))}
                            {approvals.length > 0 && <p className="text-xs text-gray-500">Aprobar o rechazar desde aquí llega en la fase 2; mientras, se resuelven desde el panel de OPERANT o Telegram.</p>}
                        </section>

                        <section className="bg-white/5 border border-white/10 p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-[#0d33f2]"><ShieldCheck size={22} /><h3 className="font-bold uppercase tracking-widest text-sm text-white">Auditoría encadenada</h3></div>
                                {audit && (audit.error ? <Pill tone="bad">sin datos</Pill> : <Pill tone={auditOk ? 'ok' : 'bad'}>{auditOk ? 'íntegra' : 'rota'}</Pill>)}
                            </div>
                            <p className="text-sm text-gray-400">
                                {audit?.error
                                    ? `No se pudo verificar: ${audit.error}`
                                    : auditOk
                                        ? 'La cadena de hashes de OPERANT se verificó completa sin discrepancias.'
                                        : 'La verificación encontró una discrepancia: revisar antes de anclar nada.'}
                            </p>
                            <div className="flex items-center gap-3 text-[#0d33f2] pt-2"><Bot size={22} /><h3 className="font-bold uppercase tracking-widest text-sm text-white">Tareas recientes</h3></div>
                            {tasks.length === 0 && <p className="text-sm text-gray-500">Sin tareas todavía.</p>}
                            <div className="space-y-2">
                                {tasks.map((t) => (
                                    <div key={t.id} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                                        <div><code className="text-xs text-gray-400">{t.id}</code> <span className="text-gray-300">{t.department} · {t.type}</span></div>
                                        <div className="flex gap-2">
                                            {t.deadLetter && <Pill tone="bad">dead-letter</Pill>}
                                            <Pill tone={t.status === 'completed' ? 'ok' : t.status === 'failed' || t.status === 'interrupted' ? 'bad' : 'warn'}>{t.status}</Pill>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </>
            )}

            {status?.configured && status.runtime.available && <Mailbox />}
        </div>
    );
}

function Mailbox() {
    const [list, setList] = useState<MailItem[]>([]);
    const [meta, setMeta] = useState<MailList | null>(null);
    const [sort, setSort] = useState('newest');
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [detail, setDetail] = useState<MailDetail | null>(null);
    const [opening, setOpening] = useState<number | null>(null);

    const load = useCallback(async (reset: boolean, offset = 0) => {
        setBusy(true);
        setError('');
        try {
            const qs = new URLSearchParams({ sort, limit: '30', offset: String(reset ? 0 : offset) });
            if (q.trim()) qs.set('q', q.trim());
            const r = await api.get<MailList>(`${BASE}/mailbox?${qs}`);
            setMeta(r);
            setList((prev) => (reset ? r.messages : [...prev, ...r.messages]));
        } catch (e) {
            setError(errMsg(e));
        } finally {
            setBusy(false);
        }
    }, [sort, q]);

    useEffect(() => { load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sort]);

    const open = async (uid: number) => {
        setOpening(uid);
        try { setDetail(await api.get<MailDetail>(`${BASE}/mailbox/${uid}`)); }
        catch (e) { setError(errMsg(e)); }
        finally { setOpening(null); }
    };

    return (
        <section className="bg-white/5 border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[#0d33f2]"><Mail size={22} /><h3 className="font-bold uppercase tracking-widest text-sm text-white">Bandeja · {meta?.mailbox || 'buzón'}</h3></div>
                <Pill tone={error ? 'bad' : 'idle'}>{error ? 'no disponible' : `${meta?.total ?? 0} correos · solo lectura`}</Pill>
            </div>
            {error && <div className="text-sm text-red-300">{error}</div>}

            <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-black/30 border border-white/10 px-3 flex-1 min-w-[220px]">
                    <Search size={14} className="text-gray-500" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && load(true)}
                        placeholder="Buscar en asunto, remitente o texto"
                        className="bg-transparent py-2 text-sm outline-none w-full"
                    />
                </div>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-black/30 border border-white/10 px-3 py-2 text-sm">
                    <option value="newest">Más nuevos</option>
                    <option value="oldest">Más antiguos</option>
                    <option value="unread">Sin leer</option>
                </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-1 max-h-[560px] overflow-y-auto pr-1">
                    {list.length === 0 && !busy && !error && <p className="text-sm text-gray-500">No hay correos.</p>}
                    {list.map((m) => (
                        <button
                            key={m.uid}
                            onClick={() => open(m.uid)}
                            className={`w-full text-left border-b border-white/5 py-2 px-2 hover:bg-white/5 ${detail?.uid === m.uid ? 'bg-white/5' : ''}`}
                        >
                            <div className={`text-sm ${m.unread ? 'font-bold' : 'text-gray-300'}`}>{m.unread && '● '}{m.subject}{opening === m.uid && ' …'}</div>
                            <div className="text-xs text-gray-500">{m.fromName || m.from} · {fecha(m.date)}</div>
                        </button>
                    ))}
                    {busy && <div className="flex justify-center py-3"><Loader2 className="animate-spin text-[#0d33f2]" size={18} /></div>}
                    {meta?.hasMore && !busy && (
                        <button onClick={() => load(false, list.length)} className="w-full text-xs font-bold uppercase tracking-widest border border-white/10 py-2 hover:bg-white/5">
                            Mostrar 30 más
                        </button>
                    )}
                </div>

                <div className="border border-white/10 bg-black/20 p-4 min-h-[200px]">
                    {!detail && <p className="text-sm text-gray-500">Selecciona un correo. Se muestra como texto plano; el HTML de terceros no se ejecuta.</p>}
                    {detail && (
                        <div className="space-y-3">
                            <h4 className="font-bold">{detail.subject}</h4>
                            <div className="text-xs text-gray-500">
                                De: {detail.fromName ? `${detail.fromName} <${detail.from}>` : detail.from}<br />
                                Para: {detail.to.map((a) => a.address).join(', ')}<br />
                                {fecha(detail.date)}
                            </div>
                            {detail.attachments.length > 0 && (
                                <div className="text-xs text-gray-500">Adjuntos (no se descargan): {detail.attachments.map((a) => `${a.filename} (${Math.round(a.size / 1024)} KB)`).join(', ')}</div>
                            )}
                            <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans max-h-[420px] overflow-y-auto">{detail.text || '(sin texto)'}</pre>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
