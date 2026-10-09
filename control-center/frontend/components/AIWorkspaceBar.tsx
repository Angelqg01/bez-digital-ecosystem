'use client';

/**
 * BeZhas AI — barra de chat flotante de la plataforma.
 *
 * Visible para todos. Sin sesión: UNA pregunta gratis (la controla el servidor);
 * después, registro o login. Con sesión: el mismo JWT del resto de la api. Respuesta en streaming, historial, documentos propios para el RAG y
 * acciones que abren secciones de la plataforma (el destino lo decide siempre
 * el servidor; el chat nunca ejecuta operaciones ni pide claves).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    ArrowUp, Check, ChevronDown, Copy, FileText, History, LayoutGrid, Loader2, Lock, Paperclip, Plus, Sparkles, Square, Trash2, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
    AI_BASE, aiFetch, createSseParser, describeUsage, freeQuestionUsed, markFreeQuestionUsed, renderChatMarkdown,
    type ChatAction, type ChatMessage, type PlanInfo,
} from '@/lib/ai-workspace';

const SUGGESTIONS = ['¿Qué planes ofrece BeZhas?', '¿Cómo compro BEZ?', '¿Cómo conecto mi IA por MCP?'];
const MAX_UPLOAD_CHARS = 200_000;
const ALLOWED_UPLOAD = /\.(txt|md|markdown|csv|json)$/i;
const HIDDEN_ON = [/^\/admin/, /^\/login/, /^\/register/];

type Panel = 'chat' | 'history' | 'actions';
type Dialog =
    | { kind: 'confirm'; action: ChatAction; href: string }
    | { kind: 'plans'; plans: PlanInfo[]; current: string }
    | { kind: 'docs'; docs: { id: string; title: string; scope: string; status: string }[] }
    | { kind: 'locked'; action: ChatAction; message: string };

export default function AIWorkspaceBar() {
    const { token, isAuthenticated, openLoginModal } = useAuth();
    const pathname = usePathname() || '/';
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [panel, setPanel] = useState<Panel>('chat');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [history, setHistory] = useState<{ id: string; title: string; updatedAt: number; messages: number }[]>([]);
    const [catalog, setCatalog] = useState<ChatAction[]>([]);
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const [copied, setCopied] = useState<number | null>(null);
    const [freeUsed, setFreeUsed] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => { setMounted(true); setFreeUsed(freeQuestionUsed()); }, []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, open, panel]);
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [input]);

    const loggedIn = mounted && isAuthenticated && !!token;
    const notice = (content: string) => setMessages((m) => [...m, { role: 'notice', content }]);
    const CTA = 'Has usado tu pregunta gratis. Regístrate o inicia sesión para seguir conversando con BeZhas AI.';
    /** Abre la ventana de planes (para contratar o mejorar el plan que paga el chat). */
    const verPlanes = useCallback(async () => {
        if (!token) return;
        try {
            const p = await aiFetch<{ plans: PlanInfo[]; current: string }>('/plans', token);
            setDialog({ kind: 'plans', plans: p.plans, current: p.current });
        } catch { /* sin conexión: queda el aviso */ }
    }, [token]);

    const pedirRegistro = useCallback(() => {
        markFreeQuestionUsed();
        setFreeUsed(true);
        setMessages((m) => (m.some((x) => x.role === 'cta') ? m : [...m, { role: 'cta', content: CTA }]));
    }, []);
    const patchLast = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((all) => (all.length ? [...all.slice(0, -1), fn(all[all.length - 1])] : all));

    const send = useCallback(async (raw: string) => {
        const message = raw.trim();
        if (!message || loading) return;
        setOpen(true);
        setPanel('chat');
        const anonimo = !loggedIn || !token;
        if (anonimo && freeUsed) { setInput(message); pedirRegistro(); openLoginModal(); return; }

        setInput('');
        setMessages((m) => [...m, { role: 'user', content: message }, { role: 'assistant', content: '', streaming: true }]);
        setLoading(true);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const res = await fetch(anonimo ? `${AI_BASE}/public/chat/stream` : `${AI_BASE}/chat/stream`, {
                method: 'POST',
                headers: anonimo ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(anonimo ? { message } : { message, conversationId }),
                signal: controller.signal,
            });
            if (!res.ok || !res.body) {
                const body = await res.json().catch(() => ({}));
                if (anonimo && (body.code === 'FREE_QUESTION_USED' || body.code === 'LOGIN_REQUIRED')) {
                    setMessages((m) => m.slice(0, -1));
                    setInput(message);
                    pedirRegistro();
                    openLoginModal();
                    return;
                }
                // El chat lo paga el plan: sin plan o con la cuota del mes agotada se ofrecen los planes.
                if (!anonimo && res.status === 402) {
                    setMessages((m) => [...m.slice(0, -1), { role: 'notice', content: body.error || 'Necesitas un plan para usar BeZhas AI.' }]);
                    setInput(message);
                    void verPlanes();
                    return;
                }
                if (!anonimo && (res.status === 401 || res.status === 403)) { setInput(message); openLoginModal(); }
                throw new Error(!anonimo && (res.status === 401 || res.status === 403) ? 'Tu sesión ha caducado. Inicia sesión de nuevo.'
                    : res.status === 429 ? 'Demasiadas solicitudes, espera un momento.'
                        : body.error || 'No pude responder ahora mismo. Inténtalo de nuevo.');
            }
            let gratisGastada = false;
            const parse = createSseParser(({ event, data }) => {
                if (event === 'meta') { if (data.conversationId) setConversationId(String(data.conversationId)); patchLast((m) => ({ ...m, sources: data.sources })); }
                else if (event === 'done') {
                    if (data.freeQuestionUsed) gratisGastada = true;
                    if (data.usage) patchLast((m) => ({ ...m, usage: data.usage }));
                }
                else if (event === 'actions') patchLast((m) => ({ ...m, actions: Array.isArray(data.actions) ? data.actions : undefined }));
                else if (event === 'delta') patchLast((m) => ({ ...m, content: m.content + String(data.text) }));
                else if (event === 'replace') patchLast((m) => ({ ...m, content: String(data.text) }));
                else if (event === 'error') patchLast((m) => ({ ...m, error: true, content: m.content || String(data.error) }));
            });
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                parse(decoder.decode(value, { stream: true }));
            }
            patchLast((m) => ({ ...m, streaming: false }));
            if (gratisGastada) pedirRegistro();
        } catch (e: any) {
            const aborted = e?.name === 'AbortError';
            patchLast((m) => ({
                ...m, streaming: false, error: !aborted || undefined,
                content: aborted ? (m.content || '_Respuesta detenida._') : (m.content || e.message),
            }));
        } finally {
            abortRef.current = null;
            setLoading(false);
        }
    }, [loading, loggedIn, token, conversationId, openLoginModal, freeUsed, pedirRegistro, verPlanes]);

    const stop = () => abortRef.current?.abort();
    const newChat = () => { stop(); setMessages([]); setConversationId(undefined); setPanel('chat'); };

    const showHistory = async () => {
        if (panel === 'history') { setPanel('chat'); return; }
        setPanel('history');
        try { setHistory((await aiFetch<{ conversations: typeof history }>('/conversations', token!)).conversations || []); }
        catch { setHistory([]); }
    };

    const showActions = async () => {
        if (panel === 'actions') { setPanel('chat'); return; }
        setPanel('actions');
        try { setCatalog((await aiFetch<{ actions: ChatAction[] }>('/actions', token!)).actions || []); }
        catch { setCatalog([]); }
    };

    const openConversation = async (id: string) => {
        try {
            const res = await aiFetch<{ turns: { role: 'user' | 'assistant'; content: string }[] }>(`/conversations/${encodeURIComponent(id)}`, token!);
            setMessages(res.turns.map((t) => ({ role: t.role, content: t.content })));
            setConversationId(id);
            setPanel('chat');
        } catch (e: any) { notice(e.message || 'No se pudo abrir la conversación'); }
    };

    const deleteConversation = async (id: string) => {
        try {
            await aiFetch(`/conversations/${encodeURIComponent(id)}`, token!, { method: 'DELETE' });
            setHistory((h) => h.filter((c) => c.id !== id));
            if (id === conversationId) newChat();
        } catch { /* se mantiene en la lista */ }
    };

    /** Abre una acción: el servidor revalida el acceso y devuelve el destino. */
    const openAction = async (action: ChatAction) => {
        if (!loggedIn || !token) { openLoginModal(); return; }
        try {
            const r = await aiFetch<{ kind: ChatAction['kind']; href: string; sensitive: boolean }>(`/actions/${action.id}/open`, token, { method: 'POST' });
            if (r.kind === 'plans') {
                const p = await aiFetch<{ plans: PlanInfo[]; current: string }>('/plans', token);
                setDialog({ kind: 'plans', plans: p.plans, current: p.current });
            } else if (r.kind === 'docs') {
                const d = await aiFetch<{ documents: { id: string; title: string; scope: string; status: string }[] }>('/knowledge', token);
                setDialog({ kind: 'docs', docs: d.documents });
            } else if (r.kind === 'app') {
                // App nativa: pestaña nueva, sin opener ni referrer y sin datos de la conversación en la URL.
                if (/^https:\/\//.test(r.href)) window.open(r.href, '_blank', 'noopener,noreferrer');
            } else if (r.sensitive) {
                setDialog({ kind: 'confirm', action, href: r.href });
            } else {
                router.push(r.href);
            }
        } catch (e: any) {
            setDialog({ kind: 'locked', action, message: e.message || 'No disponible' });
        }
    };

    const copyMessage = async (index: number, text: string) => {
        try { await navigator.clipboard.writeText(text); setCopied(index); setTimeout(() => setCopied(null), 1500); }
        catch { /* sin permiso de portapapeles */ }
    };

    /** Añade un documento propio al conocimiento privado de su organización (RAG). */
    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setOpen(true);
        setPanel('chat');
        if (!loggedIn || !token) { openLoginModal(); return; }
        if (!ALLOWED_UPLOAD.test(file.name)) return notice('Formato no admitido. Usa .txt, .md, .csv o .json.');
        try {
            const content = await file.text();
            if (content.length > MAX_UPLOAD_CHARS) return notice('El archivo es demasiado grande (máx. 200.000 caracteres).');
            const res = await aiFetch<{ status: string }>('/knowledge', token, {
                method: 'POST', body: JSON.stringify({ title: file.name, content, classification: 'INTERNAL' }),
            });
            notice(res.status === 'quarantined'
                ? `«${file.name}» no se ha indexado: contiene instrucciones sospechosas.`
                : `«${file.name}» añadido a tu conocimiento privado. Ya puedes preguntarme sobre él.`);
        } catch (err: any) { notice(err.message || 'No se pudo subir el documento'); }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); }
        if (e.key === 'Escape') setOpen(false);
    };

    if (!mounted || HIDDEN_ON.some((re) => re.test(pathname))) return null;

    const iconBtn = 'rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100';

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3 sm:px-6 sm:pb-5">
            <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-2">
                {open && (
                    <section aria-label="Conversación con BeZhas AI"
                        className="relative flex max-h-[min(60vh,560px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur">
                        <header className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-cyan-300" /> BeZhas AI</div>
                            <div className="flex items-center gap-1">
                                {loggedIn && <button onClick={() => void showActions()} className={`${iconBtn} ${panel === 'actions' ? 'bg-white/10' : ''}`} aria-label="Acciones de la plataforma" title="Acciones"><LayoutGrid size={16} /></button>}
                                {loggedIn && <button onClick={() => void showHistory()} className={`${iconBtn} ${panel === 'history' ? 'bg-white/10' : ''}`} aria-label="Historial de conversaciones" title="Historial"><History size={16} /></button>}
                                {loggedIn && messages.length > 0 && <button onClick={newChat} className={iconBtn} aria-label="Nueva conversación" title="Nueva conversación"><Plus size={16} /></button>}
                                <button onClick={() => setOpen(false)} className={iconBtn} aria-label="Minimizar chat"><ChevronDown size={18} /></button>
                            </div>
                        </header>

                        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
                            {panel === 'actions' && loggedIn ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {catalog.length === 0 && <p className="col-span-full py-6 text-center text-sm text-slate-400">Cargando acciones…</p>}
                                    {catalog.map((a) => (
                                        <button key={a.id} onClick={() => void openAction(a)}
                                            className="rounded-xl border border-white/10 px-3 py-2 text-left hover:border-cyan-300/40 hover:bg-white/5">
                                            <span className="flex items-center gap-1.5 text-sm font-semibold">{a.locked && <Lock size={12} className="text-amber-300" />}{a.title}</span>
                                            <span className="block text-xs text-slate-400">{a.description}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : panel === 'history' && loggedIn ? (
                                <div className="space-y-1">
                                    <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Conversaciones</p>
                                    {history.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Todavía no hay conversaciones.</p>}
                                    {history.map((c) => (
                                        <div key={c.id} className="group flex items-center gap-1 rounded-lg hover:bg-white/5">
                                            <button onClick={() => void openConversation(c.id)} className="min-w-0 flex-1 px-3 py-2 text-left">
                                                <span className="block truncate text-sm">{c.title || 'Sin título'}</span>
                                                <span className="text-[11px] text-slate-500">{new Date(c.updatedAt).toLocaleString()} · {c.messages} mensajes</span>
                                            </button>
                                            <button onClick={() => void deleteConversation(c.id)} className={`${iconBtn} opacity-0 focus:opacity-100 group-hover:opacity-100`} aria-label={`Borrar «${c.title}»`}><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {messages.length === 0 && (
                                        <div className="py-6 text-center">
                                            <p className="mb-4 text-sm text-slate-400">
                                                {loggedIn ? 'Pregúntame sobre BeZhas, planes, pagos, BEZ, MCP o tu cuenta.'
                                                    : freeUsed ? 'Regístrate o inicia sesión para seguir conversando con BeZhas AI.'
                                                        : 'Tienes una pregunta gratis. Después, regístrate o inicia sesión para seguir.'}
                                            </p>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {SUGGESTIONS.map((q) => (
                                                    <button key={q} onClick={() => void send(q)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5">{q}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {messages.map((m, i) => (
                                        <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                                            {m.role === 'user' ? (
                                                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-white/10 px-4 py-2.5 text-sm">{m.content}</div>
                                            ) : m.role === 'notice' ? (
                                                <p className="w-full text-center text-xs italic text-slate-400">{m.content}</p>
                                            ) : m.role === 'cta' ? (
                                                loggedIn ? null : (
                                                    <div className="w-full rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-center">
                                                        <p className="text-sm text-cyan-50">{m.content}</p>
                                                        <button onClick={openLoginModal} className="mt-2 rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Registrarme o iniciar sesión</button>
                                                    </div>
                                                )
                                            ) : (
                                                <div className={`max-w-full text-sm leading-relaxed ${m.error ? 'text-red-300' : ''}`}>
                                                    {m.streaming && !m.content && <span className="flex items-center gap-2 text-slate-400"><Loader2 size={14} className="animate-spin" /> Pensando…</span>}
                                                    <div className="space-y-2 [&_a]:text-cyan-300 [&_a]:underline [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/40 [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5"
                                                        // HTML generado por renderChatMarkdown: todo escapado, enlaces solo internos o bezhas.com.
                                                        dangerouslySetInnerHTML={{ __html: renderChatMarkdown(m.content) }} />
                                                    {m.streaming && m.content && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-slate-400 align-middle" aria-hidden />}
                                                    {m.usage && <p className="mt-1 text-[11px] text-slate-500">{describeUsage(m.usage)}</p>}
                                                    {m.sources && m.sources.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                            {m.sources.map((s) => (
                                                                <span key={s.ref} title={s.section || undefined} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">
                                                                    <FileText size={11} /> [{s.ref}] {s.title} · v{s.version}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {!m.streaming && m.actions && m.actions.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {m.actions.map((a) => (
                                                                <button key={a.id} onClick={() => void openAction(a)} disabled={loading}
                                                                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-300/20 disabled:opacity-50">
                                                                    {a.locked && <Lock size={11} />}{a.title}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {!m.streaming && m.content && !m.error && (
                                                        <button onClick={() => void copyMessage(i, m.content)} className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-white/5 hover:text-slate-300" aria-label="Copiar respuesta">
                                                            {copied === i ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}
                            <div ref={endRef} />
                        </div>

                        {dialog && (
                            <div className="absolute inset-0 flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true">
                                <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <p className="text-sm font-semibold">
                                            {dialog.kind === 'plans' ? 'Planes de BeZhas' : dialog.kind === 'docs' ? 'Tus documentos' : dialog.action.title}
                                        </p>
                                        <button onClick={() => setDialog(null)} className={iconBtn} aria-label="Cerrar"><X size={16} /></button>
                                    </div>
                                    {dialog.kind === 'confirm' && (
                                        <>
                                            <p className="text-sm text-slate-300">{dialog.action.description}</p>
                                            <p className="mt-2 text-xs text-slate-500">El chat no ejecuta operaciones ni te pedirá nunca claves privadas o frases semilla: las firmas se hacen en la pantalla correspondiente.</p>
                                            <div className="mt-4 flex justify-end gap-2">
                                                <button onClick={() => setDialog(null)} className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">Cancelar</button>
                                                <button onClick={() => { const h = dialog.href; setDialog(null); router.push(h); }} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Abrir</button>
                                            </div>
                                        </>
                                    )}
                                    {dialog.kind === 'locked' && (
                                        <>
                                            <p className="text-sm text-slate-300">{dialog.message}</p>
                                            {dialog.action.upgradeActionId && (
                                                <button onClick={() => { setDialog(null); void openAction({ ...dialog.action, id: dialog.action.upgradeActionId!, kind: 'plans' }); }}
                                                    className="mt-4 rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Ver planes</button>
                                            )}
                                        </>
                                    )}
                                    {dialog.kind === 'plans' && (
                                        <div className="space-y-2">
                                            {dialog.plans.map((p) => (
                                                <div key={p.id} className={`rounded-xl border px-3 py-2 ${p.id === dialog.current ? 'border-cyan-300/50' : 'border-white/10'}`}>
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <span className="text-sm font-semibold">{p.name}{p.id === dialog.current && <span className="ml-2 text-[11px] text-cyan-300">tu plan</span>}</span>
                                                        <span className="text-xs text-slate-300">{p.priceEUR ? `${p.priceEUR.toLocaleString('es-ES')} €/mes + IVA` : 'Pago por uso'}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500">{p.profile}{p.yearlyEUR ? ` · ${p.yearlyEUR.toLocaleString('es-ES')} €/año + IVA` : ''}</p>
                                                    {p.id !== dialog.current && (p.monthlyUrl || p.annualUrl) && (
                                                        <div className="mt-2 flex gap-2">
                                                            {p.monthlyUrl && <a href={p.monthlyUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-cyan-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-cyan-400">Mensual</a>}
                                                            {p.annualUrl && <a href={p.annualUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-cyan-300/40 px-2.5 py-1 text-xs text-cyan-100 hover:bg-cyan-300/10">Anual</a>}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {dialog.kind === 'docs' && (
                                        <div className="space-y-1">
                                            {dialog.docs.length === 0 && <p className="text-sm text-slate-400">Aún no hay documentos. Añade uno con el clip.</p>}
                                            {dialog.docs.map((d) => (
                                                <button key={d.id} disabled={d.status !== 'published'}
                                                    onClick={() => { setDialog(null); setPanel('chat'); setInput(`Resume el documento «${d.title}» y dime lo más importante.`); textareaRef.current?.focus(); }}
                                                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5 disabled:opacity-50">
                                                    <FileText size={14} className="shrink-0 text-slate-400" />
                                                    <span className="truncate">{d.title}</span>
                                                    <span className="ml-auto text-[11px] text-slate-500">{d.status === 'published' ? (d.scope === 'global' ? 'BeZhas' : 'tuyo') : 'en cuarentena'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                <form onSubmit={(e) => { e.preventDefault(); void send(input); }}
                    className="flex items-end gap-1 rounded-3xl border border-white/15 bg-slate-950/95 p-2 shadow-xl backdrop-blur focus-within:border-cyan-300/60">
                    <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv,.json" className="hidden" onChange={onFile} />
                    <button type="button" onClick={() => fileRef.current?.click()}
                        className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-slate-100"
                        aria-label="Añadir un documento a mi conocimiento privado" title="Añadir documento (.txt, .md, .csv, .json)">
                        <Paperclip size={18} />
                    </button>
                    <textarea ref={textareaRef} value={input} rows={1} maxLength={4000}
                        onChange={(e) => setInput(e.target.value)} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
                        placeholder={loggedIn ? 'Pregunta a BeZhas AI…' : freeUsed ? 'Regístrate o inicia sesión para seguir…' : 'Haz tu pregunta gratis a BeZhas AI…'}
                        aria-label="Mensaje para BeZhas AI"
                        className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500" />
                    {loading ? (
                        <button type="button" onClick={stop} aria-label="Detener respuesta" title="Detener"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-900 hover:bg-white">
                            <Square size={14} fill="currentColor" />
                        </button>
                    ) : (
                        <button type="submit" disabled={!input.trim()} aria-label="Enviar mensaje"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500">
                            <ArrowUp size={18} />
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
