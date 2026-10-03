"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle, ArrowUpRight, FileText, Lock, ShieldCheck, X } from "lucide-react";
import { formatPrice, type KnowledgeDoc, type Plan } from "../../lib/chatActions";
import type { DialogState } from "../../hooks/useChatActions";

type Props = {
    dialog: DialogState;
    plans: Plan[];
    currentPlan: string;
    docs: KnowledgeDoc[];
    onGo: (href: string) => void;
    onClose: () => void;
    onUpgrade: (actionId: string) => void | Promise<void>;
    onAskDoc: (title: string) => void;
};

/** Ventana emergente dentro del chat: confirma y lleva al enlace directo; el chat nunca ejecuta operaciones. */
export function ChatActionDialog({ dialog, plans, currentPlan, docs, onGo, onClose, onUpgrade, onAskDoc }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => { ref.current?.focus(); }, [dialog]);

    const title = dialog.type === "error" ? "No se pudo abrir" : dialog.type === "locked" ? "Función bloqueada" : dialog.action.title;
    const primary = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700";
    const secondary = "rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

    return (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]" onClick={onClose}>
            <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
                className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl outline-none dark:border-gray-700 dark:bg-gray-900"
            >
                <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
                    <button onClick={onClose} aria-label="Cerrar ventana" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
                </div>

                {dialog.type === "error" && (
                    <>
                        <p className="mb-4 flex items-start gap-2 text-sm text-red-600"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {dialog.message}</p>
                        <button onClick={onClose} className={secondary}>Cerrar</button>
                    </>
                )}

                {dialog.type === "locked" && (
                    <>
                        <p className="mb-4 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"><Lock size={16} className="mt-0.5 shrink-0 text-amber-500" /> {dialog.message}</p>
                        <div className="flex flex-wrap gap-2">
                            {dialog.upgradeActionId && <button onClick={() => onUpgrade(dialog.upgradeActionId as string)} className={primary} data-testid="upgrade-btn">Ver planes</button>}
                            <button onClick={onClose} className={secondary}>Cerrar</button>
                        </div>
                    </>
                )}

                {dialog.type === "confirm" && (
                    <>
                        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">{dialog.action.description}</p>
                        {dialog.action.sensitive && (
                            <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                                Te llevaremos a la pantalla de la plataforma. El chat no ejecuta operaciones ni te pedirá claves privadas ni frases semilla: revisa y firma tú mismo allí.
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => onGo(dialog.result.href)} className={primary} data-testid="go-btn">Abrir <ArrowUpRight size={14} /></button>
                            <button onClick={onClose} className={secondary}>Cancelar</button>
                        </div>
                    </>
                )}

                {dialog.type === "plans" && (
                    <>
                        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Compara los planes y elige el tuyo. El pago se completa en Ajustes de cuenta.</p>
                        <ul className="mb-4 space-y-2" data-testid="plans-list">
                            {plans.length === 0 && <li className="text-sm text-gray-400">No se pudieron cargar los planes.</li>}
                            {plans.map((p) => (
                                <li key={p.id} className={`rounded-xl border p-3 ${p.id === currentPlan ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40" : "border-gray-200 dark:border-gray-700"}`}>
                                    <div className="flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        <span>{p.name}{p.id === currentPlan && <span className="ml-2 text-xs font-normal text-indigo-600">tu plan</span>}</span>
                                        <span className="text-xs font-normal text-gray-500">{formatPrice(p)}</span>
                                    </div>
                                    {p.description && <p className="text-xs text-gray-500 dark:text-gray-400">{p.description}</p>}
                                </li>
                            ))}
                        </ul>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => onGo(dialog.result.href)} className={primary} data-testid="go-btn">Ir a suscribirme <ArrowUpRight size={14} /></button>
                            <button onClick={onClose} className={secondary}>Cerrar</button>
                        </div>
                    </>
                )}

                {dialog.type === "docs" && (
                    <>
                        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Documentos a los que tienes acceso. Elige uno para preguntar sobre él en el chat.</p>
                        <ul className="mb-4 max-h-56 space-y-1 overflow-y-auto" data-testid="docs-list">
                            {docs.length === 0 && <li className="text-sm text-gray-400">Todavía no hay documentos. Sube uno con el clip.</li>}
                            {docs.map((d) => (
                                <li key={d.id}>
                                    <button onClick={() => onAskDoc(d.title)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <FileText size={14} className="shrink-0 text-gray-400" />
                                        <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-100">{d.title}</span>
                                        {d.classification && <span className="text-[10px] uppercase text-gray-400">{d.classification}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => onGo(dialog.result.href)} className={primary} data-testid="go-btn">Abrir consola <ArrowUpRight size={14} /></button>
                            <button onClick={onClose} className={secondary}>Cerrar</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
