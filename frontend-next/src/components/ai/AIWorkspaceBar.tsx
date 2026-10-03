"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Check, ChevronDown, Copy, FileText, History, LayoutGrid, Loader2, LogOut, Paperclip, Plus, Sparkles, Square, Trash2, Wallet } from "lucide-react";
import api from "../../lib/api";
import { apiError } from "../../lib/apiError";
import { createSseParser } from "../../lib/sse";
import { useWalletLogin } from "../../hooks/useWalletLogin";
import { useUserStore } from "../../stores/userStore";
import { useChatActions } from "../../hooks/useChatActions";
import { classifyLink, type ChatAction } from "../../lib/chatActions";
import { ChatActionCards, ChatActionsMenu } from "./ChatActionCards";
import { ChatActionDialog } from "./ChatActionDialog";

type Source = { ref: number; title: string; section: string | null; version: number };
type Msg = { role: "user" | "assistant" | "notice"; content: string; sources?: Source[]; actions?: ChatAction[]; error?: boolean; streaming?: boolean };
type HistoryItem = { id: string; title: string; updatedAt: number; messages: number };

const MOCK_TOKEN = "siwe-session-mock-token"; // token simulado de sesiones antiguas (login SIWE previo): no es un JWT, hay que volver a iniciar sesión
const SUGGESTIONS = ["¿Cómo hago staking de BEZ?", "¿Qué métodos de pago acepta BeZhas?", "¿Cómo funciona la tokenización de activos?"];
const MAX_UPLOAD_CHARS = 200_000;
const ALLOWED_UPLOAD = /\.(txt|md|markdown|csv|json)$/i;

/** Enlaces del modelo: solo rutas internas del catálogo y dominios propios; el resto se pinta como texto plano. */
function SafeLink({ href, children }: { href?: string; children?: React.ReactNode }) {
    const d = classifyLink(href);
    if (d.type === "internal") return <a href={d.href}>{children}</a>;
    if (d.type === "external") return <a href={d.href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>;
    return <span title="Enlace bloqueado por seguridad">{children}</span>;
}

export default function AIWorkspaceBar() {
    const { token, setUser, setToken, logout } = useUserStore();
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [showAuth, setShowAuth] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [copied, setCopied] = useState<number | null>(null);
    const [showActions, setShowActions] = useState(false);
    const chatActions = useChatActions();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => setMounted(true), []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading, showAuth, open, showHistory]);

    const loggedIn = mounted && !!token && token !== MOCK_TOKEN;

    // Auto-grow del textarea (máx. ~6 líneas)
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [input]);

    const patchLast = (fn: (m: Msg) => Msg) => setMessages((all) => (all.length ? [...all.slice(0, -1), fn(all[all.length - 1])] : all));

    /** Envía el mensaje y pinta la respuesta a medida que llega (SSE). */
    const send = useCallback(async (text: string) => {
        const message = text.trim();
        if (!message || loading) return;
        setOpen(true);
        setShowHistory(false);
        if (!loggedIn) { setShowAuth(true); setInput(message); return; }

        setInput("");
        setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "", streaming: true }]);
        setLoading(true);
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch(`${api.defaults.baseURL}/api/ai-workspace/chat/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ message, conversationId }),
                signal: controller.signal,
            });

            if (!res.ok || !res.body) {
                const body = await res.json().catch(() => ({}));
                if (res.status === 401) { logout(); setShowAuth(true); setInput(message); }
                throw new Error(res.status === 401 ? "Tu sesión ha caducado. Inicia sesión de nuevo."
                    : res.status === 429 ? "Demasiadas solicitudes, espera un momento."
                    : body.error || "No pude responder ahora mismo. Inténtalo de nuevo.");
            }

            const parse = createSseParser(({ event, data }) => {
                if (event === "meta") { setConversationId(String(data.conversationId)); patchLast((m) => ({ ...m, sources: data.sources as Source[] })); }
                else if (event === "actions") patchLast((m) => ({ ...m, actions: Array.isArray(data.actions) ? (data.actions as ChatAction[]) : undefined }));
                else if (event === "delta") patchLast((m) => ({ ...m, content: m.content + String(data.text) }));
                // El servidor sanea la salida del modelo y, si cambió algo, reemplaza el texto mostrado.
                else if (event === "replace") patchLast((m) => ({ ...m, content: String(data.text) }));
                else if (event === "error") patchLast((m) => ({ ...m, error: true, content: m.content || String(data.error) }));
            });
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                parse(decoder.decode(value, { stream: true }));
            }
            patchLast((m) => ({ ...m, streaming: false }));
        } catch (e) {
            const aborted = (e as Error)?.name === "AbortError";
            patchLast((m) => ({
                ...m, streaming: false,
                error: !aborted || undefined,
                content: aborted ? (m.content || "_Respuesta detenida._") : (m.content || (e as Error).message),
            }));
        } finally {
            abortRef.current = null;
            setLoading(false);
        }
    }, [loading, loggedIn, token, conversationId, logout]);

    const stop = () => abortRef.current?.abort();

    const newChat = () => { stop(); setMessages([]); setConversationId(undefined); setShowHistory(false); };

    const loadHistory = async () => {
        try {
            const res = await api.get("/api/ai-workspace/conversations");
            setHistory(res.data.conversations || []);
        } catch { setHistory([]); }
    };

    const toggleHistory = () => {
        const next = !showHistory;
        setShowHistory(next);
        setShowActions(false);
        if (next) void loadHistory();
    };

    const openConversation = async (id: string) => {
        try {
            const res = await api.get(`/api/ai-workspace/conversations/${id}`);
            setMessages((res.data.turns || []).map((t: { role: "user" | "assistant"; content: string }) => ({ role: t.role, content: t.content })));
            setConversationId(id);
            setShowHistory(false);
        } catch (e) { setMessages((m) => [...m, { role: "notice", content: apiError(e, "No se pudo abrir la conversación") }]); }
    };

    const deleteConversation = async (id: string) => {
        try {
            await api.delete(`/api/ai-workspace/conversations/${id}`);
            setHistory((h) => h.filter((c) => c.id !== id));
            if (id === conversationId) newChat();
        } catch { /* se mantiene en la lista */ }
    };

    const copyMessage = async (index: number, text: string) => {
        try { await navigator.clipboard.writeText(text); setCopied(index); setTimeout(() => setCopied(null), 1500); } catch { /* sin permiso de portapapeles */ }
    };

    /** Añade un documento propio al conocimiento privado del tenant (RAG). */
    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setOpen(true);
        if (!loggedIn) { setShowAuth(true); return; }
        const notice = (content: string) => setMessages((m) => [...m, { role: "notice", content }]);
        if (!ALLOWED_UPLOAD.test(file.name)) return notice("Formato no admitido. Usa .txt, .md, .csv o .json.");
        try {
            const content = await file.text();
            if (content.length > MAX_UPLOAD_CHARS) return notice("El archivo es demasiado grande (máx. 200.000 caracteres).");
            const res = await api.post("/api/ai-workspace/knowledge", { title: file.name, content, classification: "INTERNAL" });
            notice(res.data.status === "quarantined"
                ? `«${file.name}» no se ha indexado: contiene instrucciones sospechosas.`
                : `«${file.name}» añadido a tu conocimiento privado. Ya puedes preguntarme sobre él.`);
        } catch (err) { notice(apiError(err, "No se pudo subir el documento")); }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); }
        if (e.key === "Escape") setOpen(false);
    };

    const onAuthed = (u: unknown, t: string) => {
        setUser(u); setToken(t); setShowAuth(false);
        if (input.trim()) setTimeout(() => void send(input), 0);
    };

    if (!mounted) return null;

    const iconBtn = "rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800";

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 sm:px-6 sm:pb-5">
            <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-2">
                {open && (
                    <section
                        aria-label="Conversación con BeZhas AI"
                        className="relative flex max-h-[min(60vh,560px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
                    >
                        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                <Sparkles size={16} className="text-indigo-500" /> BeZhas AI
                            </div>
                            <div className="flex items-center gap-1">
                                {loggedIn && (
                                    <button onClick={() => { setShowActions((v) => !v); setShowHistory(false); void chatActions.loadCatalog(); }} className={`${iconBtn} ${showActions ? "bg-gray-100 dark:bg-gray-800" : ""}`} aria-label="Acciones de la plataforma" title="Acciones"><LayoutGrid size={16} /></button>
                                )}
                                {loggedIn && (
                                    <button onClick={toggleHistory} className={`${iconBtn} ${showHistory ? "bg-gray-100 dark:bg-gray-800" : ""}`} aria-label="Historial de conversaciones" title="Historial"><History size={16} /></button>
                                )}
                                {loggedIn && messages.length > 0 && (
                                    <button onClick={newChat} className={iconBtn} aria-label="Nueva conversación" title="Nueva conversación"><Plus size={16} /></button>
                                )}
                                {loggedIn && (
                                    <button onClick={() => { logout(); newChat(); }} className={iconBtn} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></button>
                                )}
                                <button onClick={() => setOpen(false)} className={iconBtn} aria-label="Minimizar chat"><ChevronDown size={18} /></button>
                            </div>
                        </header>

                        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
                            {showActions && loggedIn && !showHistory ? (
                                <ChatActionsMenu actions={chatActions.catalog} onOpen={(a) => void chatActions.request(a)} />
                            ) : showHistory && loggedIn ? (
                                <div className="space-y-1">
                                    <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Conversaciones</p>
                                    {history.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Todavía no hay conversaciones.</p>}
                                    {history.map((c) => (
                                        <div key={c.id} className="group flex items-center gap-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <button onClick={() => void openConversation(c.id)} className="min-w-0 flex-1 px-3 py-2 text-left">
                                                <span className="block truncate text-sm text-gray-800 dark:text-gray-100">{c.title || "Sin título"}</span>
                                                <span className="text-[11px] text-gray-400">{new Date(c.updatedAt).toLocaleString()} · {c.messages} mensajes</span>
                                            </button>
                                            <button onClick={() => void deleteConversation(c.id)} className={`${iconBtn} opacity-0 group-hover:opacity-100 focus:opacity-100`} aria-label={`Borrar «${c.title}»`}><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {messages.length === 0 && !showAuth && (
                                        <div className="py-6 text-center">
                                            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Pregúntame sobre BeZhas, pagos, staking, RWA o tu cuenta.</p>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {SUGGESTIONS.map((q) => (
                                                    <button key={q} onClick={() => void send(q)} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">{q}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {messages.map((m, i) => (
                                        <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                                            {m.role === "user" ? (
                                                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100">{m.content}</div>
                                            ) : m.role === "notice" ? (
                                                <p className="w-full text-center text-xs italic text-gray-400">{m.content}</p>
                                            ) : (
                                                <div className={`max-w-full text-sm leading-relaxed ${m.error ? "text-red-600" : "text-gray-800 dark:text-gray-100"}`}>
                                                    {m.streaming && !m.content && <span className="flex items-center gap-2 text-gray-400"><Loader2 size={14} className="animate-spin" /> Pensando…</span>}
                                                    <div className="prose prose-sm max-w-none dark:prose-invert [&_pre]:overflow-x-auto">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: SafeLink, img: () => null }}>{m.content}</ReactMarkdown>
                                                    </div>
                                                    {m.streaming && m.content && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-gray-400 align-middle" aria-hidden />}
                                                    {m.sources && m.sources.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                            {m.sources.map((s) => (
                                                                <span key={s.ref} title={s.section || undefined} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                                                    <FileText size={11} /> [{s.ref}] {s.title} · v{s.version}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {!m.streaming && m.actions && m.actions.length > 0 && (
                                                        <ChatActionCards actions={m.actions} onOpen={(a) => void chatActions.request(a)} disabled={chatActions.busy} />
                                                    )}
                                                    {!m.streaming && m.content && !m.error && (
                                                        <button onClick={() => void copyMessage(i, m.content)} className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800" aria-label="Copiar respuesta">
                                                            {copied === i ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {showAuth && !loggedIn && <AuthCard onAuthed={onAuthed} />}
                                </>
                            )}
                            <div ref={endRef} />
                        </div>
                        {chatActions.dialog && (
                            <ChatActionDialog
                                dialog={chatActions.dialog}
                                plans={chatActions.plans}
                                currentPlan={chatActions.currentPlan}
                                docs={chatActions.docs}
                                onGo={(href) => chatActions.go(href)}
                                onClose={chatActions.close}
                                onUpgrade={(id) => chatActions.requestById(id)}
                                onAskDoc={(title) => { chatActions.close(); setShowActions(false); setInput(`Resume el documento «${title}» y dime lo más importante.`); textareaRef.current?.focus(); }}
                            />
                        )}
                    </section>
                )}

                <form
                    onSubmit={(e) => { e.preventDefault(); void send(input); }}
                    className="flex items-end gap-1 rounded-3xl border border-gray-200 bg-white p-2 pl-2 shadow-xl focus-within:border-indigo-400 dark:border-gray-700 dark:bg-gray-900"
                >
                    <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv,.json" className="hidden" onChange={onFile} />
                    <button type="button" onClick={() => fileRef.current?.click()} className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800" aria-label="Añadir un documento a mi conocimiento privado" title="Añadir documento (.txt, .md, .csv, .json)">
                        <Paperclip size={18} />
                    </button>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        rows={1}
                        maxLength={4000}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={() => setOpen(true)}
                        onKeyDown={onKeyDown}
                        placeholder={loggedIn ? "Pregunta a BeZhas AI…" : "Inicia sesión para chatear con BeZhas AI…"}
                        aria-label="Mensaje para BeZhas AI"
                        className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
                    />
                    {loading ? (
                        <button type="button" onClick={stop} aria-label="Detener respuesta" title="Detener" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900">
                            <Square size={14} fill="currentColor" />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            aria-label="Enviar mensaje"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-800"
                        >
                            <ArrowUp size={18} />
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}

function AuthCard({ onAuthed }: { onAuthed: (user: unknown, token: string) => void }) {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const wallet = useWalletLogin();

    const walletLogin = async () => {
        setError("");
        const session = await wallet.loginWithWallet();
        if (session) onAuthed(session.user, session.token);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
            const res = mode === "login"
                ? await api.post("/api/auth/login-email", { email, password })
                : await api.post("/api/auth/register-email", { email, password, username: username || undefined, accountType: "individual" });
            if (!res.data?.token) { setError(res.data?.message || "Se requiere verificación adicional (2FA). Usa la página de acceso."); return; }
            onAuthed(res.data.user, res.data.token);
        } catch (err) {
            setError(apiError(err, mode === "login" ? "Credenciales inválidas" : "No se pudo crear la cuenta"));
        } finally { setBusy(false); }
    };

    const field = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";
    return (
        <div className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-center text-sm font-semibold text-gray-800 dark:text-gray-100">Inicia sesión o crea tu cuenta para chatear</p>

            <button type="button" onClick={walletLogin} disabled={wallet.busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
                {wallet.busy ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                {wallet.isConnected ? `Firmar con ${wallet.short}` : "Conectar wallet"}
            </button>
            {wallet.isConnected && (
                <button type="button" onClick={() => wallet.disconnect()} className="block w-full text-center text-[11px] text-gray-400 hover:text-gray-600">Usar otra wallet</button>
            )}

            <div className="flex items-center gap-2 text-[11px] text-gray-400"><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />o con email<span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /></div>

            <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 text-xs font-semibold dark:bg-gray-800">
                    {(["login", "register"] as const).map((m) => (
                        <button key={m} type="button" onClick={() => { setMode(m); setError(""); }} className={`rounded-lg py-1.5 ${mode === m ? "bg-white text-indigo-600 shadow dark:bg-gray-900" : "text-gray-500"}`}>{m === "login" ? "Iniciar sesión" : "Crear cuenta"}</button>
                    ))}
                </div>
                {mode === "register" && <input className={field} placeholder="Nombre de usuario" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />}
                <input className={field} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <input className={field} type="password" required minLength={6} placeholder="Contraseña (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {busy && <Loader2 size={14} className="animate-spin" />} {mode === "login" ? "Entrar" : "Registrarme"}
                </button>
            </form>
            {(error || wallet.error) && <p role="alert" className="text-center text-xs text-red-600">{error || wallet.error}</p>}
        </div>
    );
}
