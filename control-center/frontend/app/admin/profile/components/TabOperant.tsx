'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Mail, ShieldCheck, ClipboardCheck, Loader2, RefreshCw, Search, MailCheck, Zap } from 'lucide-react';
import api, { ApiError } from '@/lib/api';

// Todo pasa por /api/admin/operant, que exige la sesión de SuperAdmin y habla con
// OPERANT desde el servidor: la clave de OPERANT no llega nunca al navegador.
// Las lecturas son GET; las escrituras (lanzar automatizaciones, resolver
// aprobaciones, sincronizar el RAG) llevan la cabecera x-bezhas-admin, que fuerza
// la comprobación previa de CORS, y quedan registradas con el admin como actor.

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

interface DmarcSender { sourceIp: string; label: string; reporters: string[]; messages: number; pass: number; fail: number; dkimPass: number; spfPass: number; quarantined: number; rejected: number }
interface DmarcReporter { org: string; reports: number; messages: number; pass: number; fail: number }
interface Dmarc {
    windowDays: number; reports: number; messages: number; pass: number; fail: number; passRate: number | null; policy: string | null;
    range: { from: string; to: string; spanDays: number } | null;
    reporters: DmarcReporter[]; senders: DmarcSender[]; failing: DmarcSender[];
    recommendation: { level: 'unknown' | 'blocked' | 'wait' | 'ready' | 'done'; text: string };
    scanned: number; skipped: { uid: number; reason: string }[];
}

const BASE = '/admin/operant';
const WRITE = { headers: { 'x-bezhas-admin': '1' } };

interface Automation {
    id: string; section: string; department: string; title: string; description: string;
    available: boolean; attention: boolean; summary: string; lastRun: { at: string; taskId: string } | null;
}
interface RunResult { id: string; status: 'dispatched' | 'skipped' | 'duplicate' | 'unavailable' | 'unknown' | 'error'; reason?: string; taskId?: string; summary?: string }
const SECCIONES: Record<string, string> = {
    identity: 'Identity & Security', treasury: 'Treasury & Web3', ecosystem: 'Ecosystem & RWA', intelligence: 'MCP Intelligence',
    obsidian: 'Obsidian Map', brainlive: 'Brain Live', watchdog: 'Watchdog', governance: 'DAO Governance', skills: 'SKILL Memory',
};
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
    const [deciding, setDeciding] = useState<string | null>(null);

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

    const resolve = async (approvalId: string, decision: 'approve' | 'reject') => {
        const nota = window.prompt(decision === 'approve' ? 'Nota de la aprobación (opcional):' : 'Motivo del rechazo (opcional):');
        if (nota === null) return;   // cancelado
        setDeciding(approvalId);
        try {
            await api.post(`${BASE}/approvals/${encodeURIComponent(approvalId)}/resolve`, { decision, reason: nota || undefined }, WRITE);
            await load();
        } catch (e) { setError(errMsg(e)); }
        finally { setDeciding(null); }
    };

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
                        Gestión empresarial autónoma de BeZhas conectada al panel: señales de cada sección, automatizaciones que lanzan tareas a OPERANT, aprobaciones humanas, auditoría y bandeja del buzón.
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
                                    <div className="flex gap-2 pt-1">
                                        <button disabled={deciding === a.approvalId} onClick={() => resolve(a.approvalId, 'approve')} className="text-[10px] font-bold uppercase tracking-widest border border-emerald-700 text-emerald-300 px-3 py-1 hover:bg-emerald-900/30 disabled:opacity-40">Aprobar</button>
                                        <button disabled={deciding === a.approvalId} onClick={() => resolve(a.approvalId, 'reject')} className="text-[10px] font-bold uppercase tracking-widest border border-red-700 text-red-300 px-3 py-1 hover:bg-red-900/30 disabled:opacity-40">Rechazar</button>
                                    </div>
                                </div>
                            ))}
                            {approvals.length > 0 && <p className="text-xs text-gray-500">La decisión queda registrada con tu sesión como aprobador y se ejecuta bajo las líneas rojas de OPERANT.</p>}
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

            {status?.configured && status.runtime.available && <Automations onChanged={load} />}
            {status?.configured && status.runtime.available && <DmarcDigest />}
            {status?.configured && status.runtime.available && <Mailbox />}
        </div>
    );
}

function Automations({ onChanged }: { onChanged: () => void }) {
    const [items, setItems] = useState<Automation[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ tone: 'ok' | 'warn' | 'bad'; text: string } | null>(null);

    const load = useCallback(async () => {
        try { setItems((await api.get<{ automations: Automation[] }>(`${BASE}/automations`)).automations); }
        catch (e) { setMsg({ tone: 'bad', text: errMsg(e) }); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const tone = (r: RunResult) => (r.status === 'dispatched' ? 'ok' : r.status === 'unavailable' || r.status === 'error' ? 'bad' : 'warn') as 'ok' | 'warn' | 'bad';
    const dicho = (r: RunResult) => ({
        dispatched: `Tarea ${r.taskId} lanzada a OPERANT.`,
        skipped: 'La señal no pide acción ahora.',
        duplicate: `Ya había una tarea por esta misma señal (${r.taskId || 'sin id'}).`,
        unavailable: `No se pudo medir: ${r.reason}`,
        unknown: 'Automatización desconocida.',
        error: r.reason || 'Error.',
    }[r.status]);

    const run = async (a: Automation, force: boolean) => {
        if (force && !window.confirm(`Lanzar «${a.title}» aunque la señal no lo pida?`)) return;
        setBusy(a.id);
        try {
            const r = await api.post<RunResult>(`${BASE}/automations/${a.id}/run`, { force }, WRITE);
            setMsg({ tone: tone(r), text: `${a.title}: ${dicho(r)}` });
            await load(); onChanged();
        } catch (e) { setMsg({ tone: 'bad', text: errMsg(e) }); }
        finally { setBusy(null); }
    };

    const tick = async () => {
        setBusy('tick');
        try {
            const { results } = await api.post<{ results: RunResult[] }>(`${BASE}/automations/tick`, {}, WRITE);
            const n = results.filter((r) => r.status === 'dispatched').length;
            setMsg({ tone: n ? 'ok' : 'warn', text: n ? `${n} tarea(s) lanzada(s) a OPERANT.` : 'Ninguna señal pide acción ahora mismo.' });
            await load(); onChanged();
        } catch (e) { setMsg({ tone: 'bad', text: errMsg(e) }); }
        finally { setBusy(null); }
    };

    const syncRag = async () => {
        setBusy('sync');
        try {
            const r = await api.post<{ documentos: number; enviados: number; fallos: unknown[] }>(`${BASE}/knowledge/sync`, {}, WRITE);
            setMsg({ tone: r.fallos.length ? 'warn' : 'ok', text: `RAG → OPERANT: ${r.enviados} de ${r.documentos} documentos públicos sincronizados${r.fallos.length ? `, ${r.fallos.length} con error` : ''}.` });
        } catch (e) { setMsg({ tone: 'bad', text: errMsg(e) }); }
        finally { setBusy(null); }
    };

    const porSeccion = items.reduce<Record<string, Automation[]>>((acc, a) => { (acc[a.section] ||= []).push(a); return acc; }, {});
    const atencion = items.filter((a) => a.attention).length;

    return (
        <section className="bg-white/5 border border-white/10 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[#0d33f2]"><Zap size={22} /><h3 className="font-bold uppercase tracking-widest text-sm text-white">Automatizaciones</h3></div>
                <div className="flex items-center gap-2">
                    <Pill tone={atencion ? 'warn' : 'ok'}>{atencion ? `${atencion} piden acción` : 'todo en orden'}</Pill>
                    <button disabled={busy !== null} onClick={syncRag} className="text-[10px] font-bold uppercase tracking-widest border border-white/10 px-3 py-1.5 hover:bg-white/5 disabled:opacity-40">{busy === 'sync' ? 'Sincronizando…' : 'Sincronizar RAG → OPERANT'}</button>
                    <button disabled={busy !== null} onClick={tick} className="text-[10px] font-bold uppercase tracking-widest border border-[#0d33f2] text-[#7b93ff] px-3 py-1.5 hover:bg-[#0d33f2]/10 disabled:opacity-40">{busy === 'tick' ? 'Evaluando…' : 'Evaluar y lanzar todo'}</button>
                </div>
            </div>
            <p className="text-xs text-gray-500">Cada tarjeta mide una señal real de su sección con cifras agregadas (sin emails, chats ni correos) y, si pide acción, lanza una tarea al departamento de OPERANT. Lo que la tarea haga hacia fuera pasa por la cola de aprobación.</p>

            {msg && <div className={`border px-4 py-2 text-sm ${msg.tone === 'ok' ? 'border-emerald-700 bg-emerald-900/20 text-emerald-200' : msg.tone === 'warn' ? 'border-amber-700 bg-amber-900/20 text-amber-200' : 'border-red-700 bg-red-900/30 text-red-300'}`}>{msg.text}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(porSeccion).map(([sec, list]) => (
                    <div key={sec} className="border border-white/10 bg-black/20 p-4 space-y-3">
                        <div className="text-[10px] uppercase tracking-widest text-gray-500">{SECCIONES[sec] || sec}</div>
                        {list.map((a) => (
                            <div key={a.id} className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold">{a.title}</span>
                                    <Pill tone={!a.available ? 'idle' : a.attention ? 'warn' : 'ok'}>{!a.available ? 'sin datos' : a.attention ? 'pide acción' : 'ok'}</Pill>
                                </div>
                                <div className="text-xs text-gray-400">{a.summary}</div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-gray-500">→ {a.department}{a.lastRun ? ` · última: ${fecha(a.lastRun.at)}` : ''}</span>
                                    <div className="flex gap-2">
                                        <button disabled={busy !== null || !a.available || !a.attention} onClick={() => run(a, false)} className="text-[10px] font-bold uppercase tracking-widest border border-white/10 px-2.5 py-1 hover:bg-white/5 disabled:opacity-30">{busy === a.id ? '…' : 'Lanzar'}</button>
                                        <button disabled={busy !== null || !a.available} onClick={() => run(a, true)} title="Lanzar aunque la señal no lo pida" className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-gray-300 disabled:opacity-30">forzar</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </section>
    );
}

const REC_TONE = { unknown: 'idle', blocked: 'bad', wait: 'warn', ready: 'ok', done: 'ok' } as const;
const REC_LABEL = { unknown: 'sin datos', blocked: 'no endurecer', wait: 'esperar', ready: 'listo para valorar', done: 'hecho' } as const;
const pct = (n: number | null) => (n === null ? '–' : `${(n * 100).toFixed(1)}%`);

function DmarcDigest() {
    const [days, setDays] = useState(14);
    const [data, setData] = useState<Dmarc | null>(null);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [all, setAll] = useState(false);

    const load = useCallback(async () => {
        setBusy(true);
        setError('');
        try { setData(await api.get<Dmarc>(`${BASE}/mailbox/dmarc?days=${days}`)); }
        catch (e) { setError(errMsg(e)); }
        finally { setBusy(false); }
    }, [days]);

    useEffect(() => { load(); }, [load]);

    const rows = data ? (all ? data.senders : data.failing) : [];
    return (
        <section className="bg-white/5 border border-white/10 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[#0d33f2]"><MailCheck size={22} /><h3 className="font-bold uppercase tracking-widest text-sm text-white">Digest DMARC</h3></div>
                <div className="flex items-center gap-2">
                    {data && <Pill tone={data.fail === 0 ? 'ok' : 'warn'}>{pct(data.passRate)} pasan</Pill>}
                    {data?.policy && <Pill tone="idle">p={data.policy}</Pill>}
                    <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="bg-black/30 border border-white/10 px-2 py-1 text-xs">
                        <option value={7}>7 días</option>
                        <option value={14}>14 días</option>
                        <option value={30}>30 días</option>
                    </select>
                    <button onClick={load} className="border border-white/10 p-1.5 hover:bg-white/5" aria-label="Recalcular digest"><RefreshCw size={13} className={busy ? 'animate-spin' : ''} /></button>
                </div>
            </div>

            {error && <div className="text-sm text-red-300">{error}</div>}
            {busy && !data && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-[#0d33f2]" size={18} /></div>}

            {data && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Kpi label="Informes" value={data.reports} hint={data.range ? `${data.range.spanDays} días de datos` : 'sin informes'} />
                        <Kpi label="Mensajes" value={data.messages} />
                        <Kpi label="Pasan DMARC" value={<span className="text-emerald-300">{data.pass}</span>} />
                        <Kpi label="No pasan" value={<span className={data.fail ? 'text-amber-300' : ''}>{data.fail}</span>} hint={`${data.failing.length} origen(es)`} />
                    </div>

                    <div className={`border px-4 py-3 text-sm flex items-start gap-3 ${data.recommendation.level === 'blocked' ? 'border-red-700 bg-red-900/20' : data.recommendation.level === 'wait' ? 'border-amber-700 bg-amber-900/20' : 'border-white/10 bg-black/20'}`}>
                        <Pill tone={REC_TONE[data.recommendation.level]}>{REC_LABEL[data.recommendation.level]}</Pill>
                        <span className="text-gray-300">{data.recommendation.text}</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Por receptor</div>
                            {data.reporters.map((r) => (
                                <div key={r.org} className="flex items-center justify-between text-sm border-b border-white/5 py-1.5">
                                    <span className="text-gray-300">{r.org}</span>
                                    <span className="text-xs text-gray-500">{r.messages} · <span className={r.fail ? 'text-amber-300' : 'text-emerald-300'}>{r.fail} fallos</span></span>
                                </div>
                            ))}
                        </div>
                        <div className="lg:col-span-2">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-[10px] uppercase tracking-widest text-gray-500">{all ? 'Todos los remitentes' : 'Remitentes que no pasan'}</div>
                                <button onClick={() => setAll(!all)} className="text-[10px] uppercase tracking-widest text-[#0d33f2] hover:underline">{all ? 'Ver solo fallos' : `Ver todos (${data.senders.length})`}</button>
                            </div>
                            {rows.length === 0 && <p className="text-sm text-gray-500">{all ? 'Sin remitentes.' : 'Ningún remitente falla en la ventana.'}</p>}
                            <div className="max-h-[300px] overflow-y-auto">
                                {rows.map((s) => (
                                    <div key={s.sourceIp} className="text-sm border-b border-white/5 py-1.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-gray-200">{s.label}{s.label !== s.sourceIp && <code className="text-xs text-gray-500"> {s.sourceIp}</code>}</span>
                                            <span className="text-xs whitespace-nowrap"><span className="text-emerald-300">{s.pass} ok</span> · <span className={s.fail ? 'text-amber-300' : 'text-gray-500'}>{s.fail} fallos</span></span>
                                        </div>
                                        <div className="text-[11px] text-gray-500">visto por {s.reporters.join(', ')} · DKIM {s.dkimPass} · SPF {s.spfPass}{s.quarantined ? ` · ${s.quarantined} en cuarentena` : ''}{s.rejected ? ` · ${s.rejected} rechazados` : ''}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {data.skipped.length > 0 && <p className="text-xs text-gray-500">{data.skipped.length} correo(s) con asunto de informe no contenían un informe legible y no cuentan.</p>}
                    <p className="text-xs text-gray-500">Solo lectura: el digest orienta, pero cambiar la política DMARC en el DNS lo decide una persona.</p>
                </>
            )}
        </section>
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
