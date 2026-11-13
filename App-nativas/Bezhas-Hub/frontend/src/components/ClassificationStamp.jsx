import React from 'react';
import { SHOW_CLASSIFICATION_STAMPS } from '../config/pageClassification';

/**
 * Sello de clasificación: el nivel de suscripción al que pertenece una página.
 * Borrador visual (ver config/pageClassification.js): no bloquea nada.
 *
 * @param {{ level: {id:string,label:string,color:string}, nota?: string|null, compact?: boolean }} props
 *   compact → sólo un punto de color (sidebar colapsado).
 */
export default function ClassificationStamp({ level, nota, compact = false }) {
  if (!SHOW_CLASSIFICATION_STAMPS || !level) return null;
  const titulo = `Sello: ${level.label}${nota ? ` · ${nota}` : ''}`;
  if (compact) {
    return (
      <span
        data-stamp={level.id}
        title={titulo}
        aria-label={titulo}
        className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ring-white dark:ring-gray-900"
        style={{ background: level.color }}
      />
    );
  }
  return (
    <span
      data-stamp={level.id}
      title={titulo}
      className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide leading-none whitespace-nowrap"
      style={{ color: level.color, borderColor: level.color, background: `${level.color}14` }}
    >
      {level.label}
    </span>
  );
}
