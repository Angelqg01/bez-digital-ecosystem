"use client";

import React from "react";
import { ArrowUpRight, FileText, Layers, Lock } from "lucide-react";
import type { ChatAction } from "../../lib/chatActions";

/** Tarjetas de acciones sugeridas bajo una respuesta. Solo muestran título/descripcion del catálogo del servidor. */
export function ChatActionCards({ actions, onOpen, disabled }: { actions: ChatAction[]; onOpen: (a: ChatAction) => void; disabled?: boolean }) {
    if (!actions.length) return null;
    return (
        <div className="mt-2 grid gap-2 sm:grid-cols-2" role="group" aria-label="Acciones sugeridas">
            {actions.map((a) => (
                <button
                    key={a.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onOpen(a)}
                    data-action-id={a.id}
                    className="group flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:hover:bg-indigo-950"
                >
                    <span className="mt-0.5 text-indigo-600 dark:text-indigo-300">{a.locked ? <Lock size={16} /> : a.kind === "docs" ? <FileText size={16} /> : <ArrowUpRight size={16} />}</span>
                    <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{a.title}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{a.locked ? "Requiere un plan de pago" : a.description}</span>
                    </span>
                </button>
            ))}
        </div>
    );
}

/** Catálogo completo agrupado por categoría (panel «Acciones»). */
export function ChatActionsMenu({ actions, onOpen }: { actions: ChatAction[]; onOpen: (a: ChatAction) => void }) {
    const groups = new Map<string, ChatAction[]>();
    for (const a of actions) groups.set(a.categoryLabel || a.category, [...(groups.get(a.categoryLabel || a.category) || []), a]);
    if (!actions.length) return <p className="py-6 text-center text-sm text-gray-400">No hay acciones disponibles.</p>;
    return (
        <div className="space-y-4" data-testid="actions-menu">
            {[...groups.entries()].map(([label, items]) => (
                <div key={label}>
                    <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400"><Layers size={11} className="mr-1 inline" />{label}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {items.map((a) => (
                            <button key={a.id} type="button" onClick={() => onOpen(a)} data-action-id={a.id}
                                className="flex items-start gap-2 rounded-xl border border-gray-200 p-3 text-left hover:border-indigo-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                                <span className="mt-0.5 text-gray-500">{a.locked ? <Lock size={15} /> : <ArrowUpRight size={15} />}</span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{a.title}</span>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">{a.locked ? "Requiere un plan de pago" : a.description}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
