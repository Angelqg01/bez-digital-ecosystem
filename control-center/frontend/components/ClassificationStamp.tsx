'use client';
import { usePathname } from 'next/navigation';
import { SHOW_CLASSIFICATION_STAMPS, classifyPath, type Level } from '@/lib/page-classification';

/**
 * Sello de clasificación (ver lib/page-classification.ts): el nivel de
 * suscripción al que pertenece una página. Borrador visual, no bloquea nada.
 * `compact` pinta sólo un punto de color (menú colapsado).
 */
export default function ClassificationStamp({ level, nota, compact = false }: { level?: Level | null; nota?: string | null; compact?: boolean }) {
    if (!SHOW_CLASSIFICATION_STAMPS || !level) return null;
    const titulo = `Sello: ${level.label}${nota ? ` · ${nota}` : ''}`;
    if (compact) {
        return (
            <span
                data-stamp={level.id}
                title={titulo}
                aria-label={titulo}
                className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ring-black/40"
                style={{ background: level.color }}
            />
        );
    }
    return (
        <span
            data-stamp={level.id}
            title={titulo}
            className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide leading-none whitespace-nowrap"
            style={{ color: level.color, borderColor: level.color, background: `${level.color}22` }}
        >
            {level.label}
        </span>
    );
}

/**
 * Sello de la página actual, flotante y fijo en la esquina: cubre TODAS las
 * páginas (públicas, panel, admin, monitor…) sin tocar cada layout, que algunos
 * son de pantalla completa.
 */
export function PageStamp() {
    const pathname = usePathname();
    const sello = classifyPath(pathname);
    if (!SHOW_CLASSIFICATION_STAMPS || !sello) return null;
    return (
        <div
            data-page-stamp={sello.level.id}
            className="pointer-events-none fixed bottom-3 right-3 z-[60] flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-[10px] text-gray-300 backdrop-blur"
            title={sello.nota || undefined}
        >
            <span className="uppercase tracking-wide opacity-70">Sello de esta página</span>
            <ClassificationStamp level={sello.level} />
        </div>
    );
}
