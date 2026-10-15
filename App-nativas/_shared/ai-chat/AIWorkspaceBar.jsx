/**
 * BeZhas AI — barra de chat flotante de la plataforma, para las SubApps Vite.
 *
 * ES EL MISMO CHAT que www.bezhas.com (control-center/frontend/components/AIWorkspaceBar.tsx): mismo servidor
 * (/api/ai-workspace), mismo aspecto, mismas reglas. Visible para todos; sin sesión, UNA pregunta gratis (la controla el
 * servidor) y después registro o login; con sesión, el mismo JWT que usa la SubApp (BezhasAuthProvider), así que NO hay
 * un segundo inicio de sesión. Respuesta en streaming, historial, acciones y tarjetas de las apps del ecosistema. El
 * destino de cada acción lo decide siempre el servidor; el chat nunca ejecuta operaciones ni pide claves.
 *
 * Uso (dentro de <BezhasAuthProvider>):
 *   <AIWorkspaceBar hideAppId="app_energy" bottomOffset={92} suggestions={[...]} />
 *
 * Props:
 *   hideAppId     id de la tarjeta de app que NO se muestra (la app en la que ya estás)
 *   bottomOffset  px sobre el borde inferior (para no tapar una barra de navegación fija)
 *   bottomOffsetMobile  igual, pero en pantallas ≤ 768 px (si la navegación cambia en móvil); por defecto bottomOffset
 *   leftOffset    px de margen izquierdo en pantallas > 768 px (para no pisar una barra lateral fija)
 *   suggestions   preguntas sugeridas; si falta, las genéricas de la plataforma
 *   siteUrl       origen de la web principal (las rutas internas del catálogo se abren allí). Por defecto VITE_SITE_URL o https://www.bezhas.com
 *
 * Los estilos están acotados bajo `.bzai` (ai-chat.css) y no dependen de Tailwind ni de la hoja de la SubApp.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowUp, Check, ChevronDown, Copy, Crown, CreditCard, FileText, Fuel, Globe, History, Landmark, LayoutGrid, Loader2, Lock, Plus,
    ScanLine, Sparkles, Square, Trash2, Truck, Wallet, X, Zap,
} from 'lucide-react';
import { useAuth } from '../BezhasAuthProvider.jsx';
import {
    createAiClient, createSseParser, describeUsage, esApp, freeQuestionUsed, markFreeQuestionUsed, renderChatMarkdown,
} from './ai-workspace.js';
import './ai-chat.css';

const SUGGESTIONS = ['¿Qué planes ofrece BeZhas?', '¿Cómo compro BEZ?', '¿Cómo conecto mi IA por MCP?'];
const CTA = 'Has usado tu pregunta gratis. Regístrate o inicia sesión para seguir conversando con BeZhas AI.';

const MARCA = {
    app_hub: { icon: Globe, tono: 'cyan' },
    app_defi: { icon: Landmark, tono: 'violet' },
    app_purescan: { icon: ScanLine, tono: 'emerald' },
    app_energy: { icon: Zap, tono: 'amber' },
    app_wallet: { icon: Wallet, tono: 'sky' },
    app_gas: { icon: Fuel, tono: 'lime' },
    app_pay: { icon: CreditCard, tono: 'teal' },
    app_prestige: { icon: Crown, tono: 'yellow' },
    app_cargolink: { icon: Truck, tono: 'rose' },
};

function envSiteUrl() {
    try { if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SITE_URL) return import.meta.env.VITE_SITE_URL; } catch { /* no es Vite */ }
    return 'https://www.bezhas.com';
}

/** Accesos directos a las apps del ecosistema. El destino lo decide el servidor (POST /actions/:id/open). */
function AppShortcuts({ apps, onOpen, disabled, compact = false, hideAppId }) {
    const lista = apps.filter((a) => esApp(a) && a.id !== hideAppId);
    if (lista.length === 0) return null;
    return (
        <nav aria-label="Apps del ecosistema BeZhas" className={compact ? 'bzai-apps bzai-apps-compact' : 'bzai-apps'}>
            {!compact && <p className="bzai-apps-title">Apps del ecosistema</p>}
            <ul>
                {lista.map((a) => {
                    const m = MARCA[a.id] || MARCA.app_hub;
                    const Icon = m.icon;
                    const caida = !!a.unavailable;
                    return (
                        <li key={a.id}>
                            <button type="button" onClick={() => onOpen(a)} disabled={disabled}
                                title={caida ? `${a.title} no está disponible ahora mismo` : a.description}
                                aria-label={caida ? `${a.title} (no disponible)` : `Abrir ${a.title}`}
                                className={`bzai-app bzai-tono-${m.tono}${caida ? ' is-down' : ''}`}>
                                <span className="bzai-app-head">
                                    <span className="bzai-app-icon"><Icon size={15} /></span>
                                    <span className="bzai-app-name">{a.title}</span>
                                </span>
                                {!compact && <span className="bzai-app-desc">{a.description}</span>}
                                <span className="bzai-app-open">{caida ? 'Próximamente' : 'Abrir en pestaña nueva ↗'}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

export default function AIWorkspaceBar({ hideAppId, bottomOffset = 12, bottomOffsetMobile, leftOffset = 0, suggestions, siteUrl }) {
    const { token, isAuthenticated, openLoginModal, apiBase } = useAuth();
    const { AI_BASE, aiFetch } = useMemo(() => createAiClient(apiBase), [apiBase]);
    const site = (siteUrl || envSiteUrl()).replace(/\/+$/, '');
    const sugerencias = suggestions && suggestions.length ? suggestions : SUGGESTIONS;

    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [panel, setPanel] = useState('chat');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState();
    const [history, setHistory] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [dialog, setDialog] = useState(null);
    const [copied, setCopied] = useState(null);
    const [freeUsed, setFreeUsed] = useState(false);
    const [appsPublicas, setAppsPublicas] = useState([]);

    const textareaRef = useRef(null);
    const endRef = useRef(null);
    const abortRef = useRef(null);

    useEffect(() => { setMounted(true); setFreeUsed(freeQuestionUsed()); }, []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, open, panel]);
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [input]);

    const loggedIn = mounted && isAuthenticated && !!token;
    const notice = (content) => setMessages((m) => [...m, { role: 'notice', content }]);

    /** Abre la ventana de planes (para contratar o mejorar el plan que paga el chat). */
    const verPlanes = useCallback(async () => {
        if (!token) return;
        try {
            const p = await aiFetch('/plans', token);
            setDialog({ kind: 'plans', plans: p.plans, current: p.current });
        } catch { /* sin conexión: queda el aviso */ }
    }, [token, aiFetch]);

    const pedirRegistro = useCallback(() => {
        markFreeQuestionUsed();
        setFreeUsed(true);
        setMessages((m) => (m.some((x) => x.role === 'cta') ? m : [...m, { role: 'cta', content: CTA }]));
    }, []);
    const patchLast = (fn) => setMessages((all) => (all.length ? [...all.slice(0, -1), fn(all[all.length - 1])] : all));

    const send = useCallback(async (raw) => {
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
                        : res.status === 503 && body.code === 'AI_DISABLED' ? 'El asistente está en mantenimiento. Vuelve a intentarlo más tarde.'
                            : body.error || 'No pude responder ahora mismo. Inténtalo de nuevo.');
            }
            let gratisGastada = false;
            const parse = createSseParser(({ event, data }) => {
                if (event === 'meta') { if (data.conversationId) setConversationId(String(data.conversationId)); patchLast((m) => ({ ...m, sources: data.sources })); }
                else if (event === 'done') {
                    if (data.freeQuestionUsed) gratisGastada = true;
                    if (data.usage) patchLast((m) => ({ ...m, usage: data.usage }));
                } else if (event === 'actions') patchLast((m) => ({ ...m, actions: Array.isArray(data.actions) ? data.actions : undefined }));
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
        } catch (e) {
            const aborted = e?.name === 'AbortError';
            patchLast((m) => ({
                ...m, streaming: false, error: !aborted || undefined,
                content: aborted ? (m.content || '_Respuesta detenida._') : (m.content || e.message),
            }));
        } finally {
            abortRef.current = null;
            setLoading(false);
        }
    }, [loading, loggedIn, token, conversationId, openLoginModal, freeUsed, pedirRegistro, verPlanes, AI_BASE]);

    const stop = () => abortRef.current?.abort();
    const newChat = () => { stop(); setMessages([]); setConversationId(undefined); setPanel('chat'); };

    const showHistory = async () => {
        if (panel === 'history') { setPanel('chat'); return; }
        setPanel('history');
        try { setHistory((await aiFetch('/conversations', token)).conversations || []); } catch { setHistory([]); }
    };

    // Las tarjetas de apps necesitan el catálogo (con la disponibilidad que mide el servidor) en cuanto hay sesión.
    useEffect(() => {
        if (!loggedIn || !token) return undefined;
        let vivo = true;
        aiFetch('/actions', token).then((r) => { if (vivo) setCatalog(r.actions || []); }).catch(() => {});
        return () => { vivo = false; };
    }, [loggedIn, token, aiFetch]);

    // Visitante sin sesión: las apps son destinos públicos, así que también ve las tarjetas y las abre directamente.
    useEffect(() => {
        if (loggedIn) return undefined;
        let vivo = true;
        fetch(`${AI_BASE}/public/apps`).then((r) => r.json()).then((r) => { if (vivo) setAppsPublicas(r.apps || []); }).catch(() => {});
        return () => { vivo = false; };
    }, [loggedIn, AI_BASE]);
    const abrirAppPublica = (a) => {
        if (a.unavailable || !a.href || !/^https:\/\//.test(a.href)) return;
        window.open(a.href, '_blank', 'noopener,noreferrer');
    };

    const showActions = async () => {
        if (panel === 'actions') { setPanel('chat'); return; }
        setPanel('actions');
        try { setCatalog((await aiFetch('/actions', token)).actions || []); } catch { setCatalog([]); }
    };

    const openConversation = async (id) => {
        try {
            const res = await aiFetch(`/conversations/${encodeURIComponent(id)}`, token);
            setMessages(res.turns.map((t) => ({ role: t.role, content: t.content })));
            setConversationId(id);
            setPanel('chat');
        } catch (e) { notice(e.message || 'No se pudo abrir la conversación'); }
    };

    const deleteConversation = async (id) => {
        try {
            await aiFetch(`/conversations/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
            setHistory((h) => h.filter((c) => c.id !== id));
            if (id === conversationId) newChat();
        } catch { /* se mantiene en la lista */ }
    };

    /** Las rutas internas del catálogo son de la web principal: desde una SubApp se abren allí, en pestaña nueva. */
    const irA = (href) => {
        const h = String(href || '');
        const destino = /^https:\/\//.test(h) ? h : /^\/(?!\/)/.test(h) ? `${site}${h}` : null;
        if (destino) window.open(destino, '_blank', 'noopener,noreferrer');
    };

    /** Abre una acción: el servidor revalida el acceso y devuelve el destino. */
    const openAction = async (action) => {
        if (!loggedIn || !token) { openLoginModal(); return; }
        try {
            const r = await aiFetch(`/actions/${action.id}/open`, token, { method: 'POST' });
            if (r.kind === 'plans') {
                const p = await aiFetch('/plans', token);
                setDialog({ kind: 'plans', plans: p.plans, current: p.current });
            } else if (r.kind === 'docs') {
                const d = await aiFetch('/knowledge', token);
                setDialog({ kind: 'docs', docs: d.documents });
            } else if (r.kind === 'app') {
                // App nativa: pestaña nueva, sin opener ni referrer y sin datos de la conversación en la URL.
                if (/^https:\/\//.test(r.href)) window.open(r.href, '_blank', 'noopener,noreferrer');
            } else if (r.sensitive) {
                setDialog({ kind: 'confirm', action, href: r.href });
            } else {
                irA(r.href);
            }
        } catch (e) {
            setDialog({ kind: 'locked', action, message: e.message || 'No disponible' });
        }
    };

    const copyMessage = async (index, text) => {
        try { await navigator.clipboard.writeText(text); setCopied(index); setTimeout(() => setCopied(null), 1500); } catch { /* sin permiso de portapapeles */ }
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); }
        if (e.key === 'Escape') setOpen(false);
    };

    if (!mounted) return null;

    return (
        <div className="bzai" style={{ '--bzai-bottom': `${bottomOffset}px`, '--bzai-bottom-m': `${bottomOffsetMobile ?? bottomOffset}px`, '--bzai-left': `${leftOffset}px` }}>
            <div className="bzai-col">
                {open && (
                    <section aria-label="Conversación con BeZhas AI" className="bzai-panel">
                        <header className="bzai-head">
                            <div className="bzai-title"><Sparkles size={16} className="bzai-cyan" /> BeZhas AI</div>
                            <div className="bzai-tools">
                                {loggedIn && <button type="button" onClick={() => void showActions()} className={`bzai-icon${panel === 'actions' ? ' is-on' : ''}`} aria-label="Acciones de la plataforma" title="Acciones"><LayoutGrid size={16} /></button>}
                                {loggedIn && <button type="button" onClick={() => void showHistory()} className={`bzai-icon${panel === 'history' ? ' is-on' : ''}`} aria-label="Historial de conversaciones" title="Historial"><History size={16} /></button>}
                                {loggedIn && messages.length > 0 && <button type="button" onClick={newChat} className="bzai-icon" aria-label="Nueva conversación" title="Nueva conversación"><Plus size={16} /></button>}
                                <button type="button" onClick={() => setOpen(false)} className="bzai-icon" aria-label="Minimizar chat"><ChevronDown size={18} /></button>
                            </div>
                        </header>

                        <div className="bzai-body" aria-live="polite">
                            {panel === 'actions' && loggedIn ? (
                                <div className="bzai-grid">
                                    {catalog.length === 0 && <p className="bzai-empty bzai-span">Cargando acciones…</p>}
                                    {catalog.filter((a) => a.id !== hideAppId).map((a) => (
                                        <button type="button" key={a.id} onClick={() => void openAction(a)} className="bzai-card">
                                            <span className="bzai-card-title">{a.locked && <Lock size={12} className="bzai-amber" />}{a.title}</span>
                                            <span className="bzai-card-desc">{a.description}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : panel === 'history' && loggedIn ? (
                                <div className="bzai-hist">
                                    <p className="bzai-hist-title">Conversaciones</p>
                                    {history.length === 0 && <p className="bzai-empty">Todavía no hay conversaciones.</p>}
                                    {history.map((c) => (
                                        <div key={c.id} className="bzai-hist-row">
                                            <button type="button" onClick={() => void openConversation(c.id)} className="bzai-hist-open">
                                                <span className="bzai-hist-name">{c.title || 'Sin título'}</span>
                                                <span className="bzai-hist-meta">{new Date(c.updatedAt).toLocaleString()} · {c.messages} mensajes</span>
                                            </button>
                                            <button type="button" onClick={() => void deleteConversation(c.id)} className="bzai-icon bzai-hist-del" aria-label={`Borrar «${c.title}»`}><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {messages.length === 0 && (
                                        <div className="bzai-welcome">
                                            <p>
                                                {loggedIn ? 'Pregúntame sobre BeZhas, planes, pagos, BEZ, MCP o tu cuenta.'
                                                    : freeUsed ? 'Regístrate o inicia sesión para seguir conversando con BeZhas AI.'
                                                        : 'Tienes una pregunta gratis. Después, regístrate o inicia sesión para seguir.'}
                                            </p>
                                            {!loggedIn && appsPublicas.length > 0 && <div className="bzai-left"><AppShortcuts apps={appsPublicas} hideAppId={hideAppId} onOpen={abrirAppPublica} /></div>}
                                            {loggedIn && catalog.some((a) => esApp(a) && a.id !== hideAppId) && <div className="bzai-left"><AppShortcuts apps={catalog} hideAppId={hideAppId} onOpen={(a) => void openAction(a)} disabled={loading} /></div>}
                                            <div className="bzai-chips">
                                                {sugerencias.map((q) => <button type="button" key={q} onClick={() => void send(q)} className="bzai-chip">{q}</button>)}
                                            </div>
                                        </div>
                                    )}
                                    {messages.map((m, i) => (
                                        <div key={i} className={m.role === 'user' ? 'bzai-row bzai-row-user' : 'bzai-row'}>
                                            {m.role === 'user' ? (
                                                <div className="bzai-user">{m.content}</div>
                                            ) : m.role === 'notice' ? (
                                                <p className="bzai-notice">{m.content}</p>
                                            ) : m.role === 'cta' ? (
                                                loggedIn ? null : (
                                                    <div className="bzai-cta">
                                                        <p>{m.content}</p>
                                                        <button type="button" onClick={openLoginModal}>Registrarme o iniciar sesión</button>
                                                    </div>
                                                )
                                            ) : (
                                                <div className={`bzai-bot${m.error ? ' is-error' : ''}`}>
                                                    {m.streaming && !m.content && <span className="bzai-thinking"><Loader2 size={14} className="bzai-spin" /> Pensando…</span>}
                                                    <div className="bzai-md"
                                                        // HTML generado por renderChatMarkdown: todo escapado, enlaces solo internos o bezhas.com.
                                                        dangerouslySetInnerHTML={{ __html: renderChatMarkdown(m.content) }} />
                                                    {m.streaming && m.content && <span className="bzai-caret" aria-hidden />}
                                                    {m.usage && <p className="bzai-usage">{describeUsage(m.usage)}</p>}
                                                    {m.sources && m.sources.length > 0 && (
                                                        <div className="bzai-sources">
                                                            {m.sources.map((s) => (
                                                                <span key={s.ref} title={s.section || undefined} className="bzai-source"><FileText size={11} /> [{s.ref}] {s.title} · v{s.version}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {!m.streaming && m.actions && m.actions.length > 0 && (
                                                        <div className="bzai-actions">
                                                            {m.actions.some((a) => esApp(a) && a.id !== hideAppId) && <div className="bzai-full"><AppShortcuts compact apps={m.actions} hideAppId={hideAppId} onOpen={(a) => void openAction(a)} disabled={loading} /></div>}
                                                            {m.actions.filter((a) => !esApp(a)).map((a) => (
                                                                <button type="button" key={a.id} onClick={() => void openAction(a)} disabled={loading} className="bzai-pill">
                                                                    {a.locked && <Lock size={11} />}{a.title}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {!m.streaming && m.content && !m.error && (
                                                        <button type="button" onClick={() => void copyMessage(i, m.content)} className="bzai-copy" aria-label="Copiar respuesta">
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
                            <div className="bzai-modal" role="dialog" aria-modal="true">
                                <div className="bzai-modal-box">
                                    <div className="bzai-modal-head">
                                        <p>{dialog.kind === 'plans' ? 'Planes de BeZhas' : dialog.kind === 'docs' ? 'Documentos' : dialog.action.title}</p>
                                        <button type="button" onClick={() => setDialog(null)} className="bzai-icon" aria-label="Cerrar"><X size={16} /></button>
                                    </div>
                                    {dialog.kind === 'confirm' && (
                                        <>
                                            <p className="bzai-modal-text">{dialog.action.description}</p>
                                            <p className="bzai-modal-note">El chat no ejecuta operaciones ni te pedirá nunca claves privadas o frases semilla: las firmas se hacen en la pantalla correspondiente.</p>
                                            <div className="bzai-modal-btns">
                                                <button type="button" onClick={() => setDialog(null)} className="bzai-btn-ghost">Cancelar</button>
                                                <button type="button" onClick={() => { const h = dialog.href; setDialog(null); irA(h); }} className="bzai-btn">Abrir</button>
                                            </div>
                                        </>
                                    )}
                                    {dialog.kind === 'locked' && (
                                        <>
                                            <p className="bzai-modal-text">{dialog.message}</p>
                                            {dialog.action.upgradeActionId && (
                                                <button type="button" onClick={() => { setDialog(null); void openAction({ ...dialog.action, id: dialog.action.upgradeActionId, kind: 'plans' }); }} className="bzai-btn bzai-mt">Ver planes</button>
                                            )}
                                        </>
                                    )}
                                    {dialog.kind === 'plans' && (
                                        <div className="bzai-plans">
                                            {dialog.plans.map((p) => (
                                                <div key={p.id} className={`bzai-plan${p.id === dialog.current ? ' is-current' : ''}`}>
                                                    <div className="bzai-plan-head">
                                                        <span className="bzai-plan-name">{p.name}{p.id === dialog.current && <span className="bzai-plan-tag">tu plan</span>}</span>
                                                        <span className="bzai-plan-price">{p.priceEUR ? `${p.priceEUR.toLocaleString('es-ES')} €/mes + IVA` : 'Pago por uso'}</span>
                                                    </div>
                                                    <p className="bzai-plan-sub">{p.profile}{p.yearlyEUR ? ` · ${p.yearlyEUR.toLocaleString('es-ES')} €/año + IVA` : ''}</p>
                                                    {p.id !== dialog.current && (p.monthlyUrl || p.annualUrl) && (
                                                        <div className="bzai-plan-btns">
                                                            {p.monthlyUrl && <a href={p.monthlyUrl} target="_blank" rel="noopener noreferrer" className="bzai-btn bzai-btn-sm">Mensual</a>}
                                                            {p.annualUrl && <a href={p.annualUrl} target="_blank" rel="noopener noreferrer" className="bzai-btn-ghost bzai-btn-sm bzai-ring">Anual</a>}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {dialog.kind === 'docs' && (
                                        <div className="bzai-docs">
                                            {dialog.docs.length === 0 && <p className="bzai-empty">No hay documentos disponibles.</p>}
                                            {dialog.docs.map((d) => (
                                                <button type="button" key={d.id} disabled={d.status !== 'published'}
                                                    onClick={() => { setDialog(null); setPanel('chat'); setInput(`Resume el documento «${d.title}» y dime lo más importante.`); textareaRef.current?.focus(); }}
                                                    className="bzai-doc">
                                                    <FileText size={14} className="bzai-muted" />
                                                    <span className="bzai-doc-name">{d.title}</span>
                                                    <span className="bzai-doc-tag">{d.status === 'published' ? (d.scope === 'global' ? 'BeZhas' : 'tuyo') : 'en cuarentena'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="bzai-form">
                    <textarea ref={textareaRef} value={input} rows={1} maxLength={4000}
                        onChange={(e) => setInput(e.target.value)} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
                        placeholder={loggedIn ? 'Pregunta a BeZhas AI…' : freeUsed ? 'Regístrate o inicia sesión para seguir…' : 'Haz tu pregunta gratis a BeZhas AI…'}
                        aria-label="Mensaje para BeZhas AI" />
                    {loading ? (
                        <button type="button" onClick={stop} aria-label="Detener respuesta" title="Detener" className="bzai-send bzai-stop"><Square size={14} fill="currentColor" /></button>
                    ) : (
                        <button type="submit" disabled={!input.trim()} aria-label="Enviar mensaje" className="bzai-send"><ArrowUp size={18} /></button>
                    )}
                </form>
            </div>
        </div>
    );
}
