import React from 'react';
import { Sparkles, X } from 'lucide-react';

/**
 * Aviso proactivo del chat (nivel 2: una línea, se puede ignorar). No bloquea la navegación, no tiene
 * cuenta atrás ni textos de culpa, y «No, gracias» pesa lo mismo que la acción principal.
 */
export default function ProactiveNudge({ nudge, onAccept, onDismiss }) {
    if (!nudge) return null;
    return (
        <div role="complementary" aria-label="Sugerencia de BeZhas AI" data-testid="chat-nudge"
            className="pointer-events-auto flex items-start gap-3 self-end rounded-2xl border border-indigo-200 bg-white p-3 pr-2 shadow-xl dark:border-indigo-900 dark:bg-gray-900 sm:max-w-sm">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-indigo-500" aria-hidden />
            <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800 dark:text-gray-100">{nudge.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={onAccept} className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700">{nudge.cta.label}</button>
                    <button type="button" onClick={onDismiss} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">No, gracias</button>
                </div>
            </div>
            <button type="button" onClick={onDismiss} aria-label="Cerrar sugerencia" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={14} /></button>
        </div>
    );
}
