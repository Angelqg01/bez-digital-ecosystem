"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, ChevronDown, FileText, Loader2, LogOut, Plus, Sparkles } from "lucide-react";
import api from "../../lib/api";
import { useUserStore } from "../../stores/userStore";

type Source = { ref: number; title: string; section: string | null; version: number };
type Msg = { role: "user" | "assistant"; content: string; sources?: Source[]; error?: boolean };

const MOCK_TOKEN = "siwe-session-mock-token"; // sesión SIWE sin JWT: no sirve para el chat
const SUGGESTIONS = ["¿Cómo hago staking de BEZ?", "¿Qué métodos de pago acepta BeZhas?", "¿Cómo funciona la tokenización de activos?"];

function apiError(e: unknown, fallback: string): string {
    const d = (e as { response?: { data?: { error?: string; message?: string; errors?: { msg: string }[] } } })?.response?.data;
    return d?.error || d?.message || d?.errors?.[0]?.msg || fallback;
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
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => setMounted(true), []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, showAuth, open]);

    const loggedIn = mounted && !!token && token !== MOCK_TOKEN;

    // Auto-grow del textarea (máx. ~6 líneas)
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [input]);

    const send = useCallback(async (text: string) => {
        const message = text.trim();
        if (!message || loading) return;
        setOpen(true);
        if (!loggedIn) { setShowAuth(true); setInput(message); return; }

        setInput("");
        setMessages((m) => [...m, { role: "user", content: message }]);
        setLoading(true);
        try {
            const res = await api.post("/api/ai-workspace/chat", { message, conversationId }, { timeout: 60000 });
            setConversationId(res.data.conversationId);
            setMessages((m) => [...m, { role: "assistant", content: res.data.reply, sources: res.data.sources }]);
        } catch (e) {
            const status = (e as { response?: { status?: number } })?.response?.status;
            if (status === 401) { logout(); setShowAuth(true); setInput(message); }
            setMessages((m) => [...m, { role: "assistant", error: true, content: status === 401 ? "Tu sesión ha caducado. Inicia sesión de nuevo." : apiError(e, "No pude responder ahora mismo. Inténtalo de nuevo.") }]);
        } finally {
            setLoading(false);
        }
    }, [loading, loggedIn, conversationId, logout]);

    const newChat = () => { setMessages([]); setConversationId(undefined); };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); }
        if (e.key === "Escape") setOpen(false);
    };

    const onAuthed = (u: unknown, t: string) => {
        setUser(u); setToken(t); setShowAuth(false);
        if (input.trim()) setTimeout(() => void send(input), 0);
    };

    if (!mounted) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 sm:px-6 sm:pb-5">
            <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-2">
                {open && (
                    <section
                        aria-label="Conversación con BeZhas AI"
                        className="flex max-h-[min(60vh,560px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
                    >
                        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                <Sparkles size={16} className="text-indigo-500" /> BeZhas AI
                            </div>
                            <div className="flex items-center gap-1">
                                {loggedIn && messages.length > 0 && (
                                    <button onClick={newChat} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Nueva conversación" title="Nueva conversación"><Plus size={16} /></button>
                                )}
                                {loggedIn && (
                                    <button onClick={() => { logout(); newChat(); }} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></button>
                                )}
                                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Minimizar chat"><ChevronDown size={18} /></button>
                            </div>
                        </header>

                        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
                            {messages.length === 0 && !showAuth && (
                                <div className="py-6 text-center">
                                    <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Pregúntame sobre BeZhas, pagos, staking, RWA o tu cuenta.</p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {SUGGESTIONS.map((s) => (
                                            <button key={s} onClick={() => void send(s)} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">{s}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((m, i) => (
                                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                                    {m.role === "user" ? (
                                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100">{m.content}</div>
                                    ) : (
                                        <div className={`max-w-full text-sm leading-relaxed ${m.error ? "text-red-600" : "text-gray-800 dark:text-gray-100"}`}>
                                            <div className="prose prose-sm max-w-none dark:prose-invert [&_pre]:overflow-x-auto">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noopener noreferrer nofollow" />, img: () => null }}>{m.content}</ReactMarkdown>
                                            </div>
                                            {m.sources && m.sources.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {m.sources.map((s) => (
                                                        <span key={s.ref} title={s.section || undefined} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                                            <FileText size={11} /> [{s.ref}] {s.title} · v{s.version}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {loading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> Pensando…</div>}
                            {showAuth && !loggedIn && <AuthCard onAuthed={onAuthed} />}
                            <div ref={endRef} />
                        </div>
                    </section>
                )}

                <form
                    onSubmit={(e) => { e.preventDefault(); void send(input); }}
                    className="flex items-end gap-2 rounded-3xl border border-gray-200 bg-white p-2 pl-4 shadow-xl focus-within:border-indigo-400 dark:border-gray-700 dark:bg-gray-900"
                >
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
                    <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        aria-label="Enviar mensaje"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-800"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
                    </button>
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
        <form onSubmit={submit} className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-center text-sm font-semibold text-gray-800 dark:text-gray-100">Inicia sesión o crea tu cuenta para chatear</p>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 text-xs font-semibold dark:bg-gray-800">
                {(["login", "register"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => { setMode(m); setError(""); }} className={`rounded-lg py-1.5 ${mode === m ? "bg-white text-indigo-600 shadow dark:bg-gray-900" : "text-gray-500"}`}>{m === "login" ? "Iniciar sesión" : "Crear cuenta"}</button>
                ))}
            </div>
            {mode === "register" && <input className={field} placeholder="Nombre de usuario" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />}
            <input className={field} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input className={field} type="password" required minLength={6} placeholder="Contraseña (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {busy && <Loader2 size={14} className="animate-spin" />} {mode === "login" ? "Entrar" : "Registrarme"}
            </button>
        </form>
    );
}
