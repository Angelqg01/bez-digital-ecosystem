/**
 * GlassPipes — capa visual reusable de "tuberías de cristal con nodos".
 *
 * SVG puro + filtros Gaussian blur + currentColor. Sin three.js (mantiene el
 * bundle ligero). Las tuberías curvan entre puntos definidos, con partículas
 * de luz que viajan por el interior y nodos translúcidos en los empalmes.
 *
 * Pensado para vivir DETRÁS de cada sección comercial: posición absoluta y
 * pointer-events:none. Color por defecto cian-índigo (paleta del Hub).
 *
 * @example
 *   <GlassPipes
 *     paths={[{ from: [10, 50], to: [90, 50], curve: 30 }]}
 *     nodes={[{ x: 50, y: 50, label: 'API Hub' }]}
 *   />
 */
import React, { useId, useMemo, memo } from 'react';

const DEFAULT_PALETTE = {
    pipe: '#22d3ee',     // cyan-400 — vidrio principal
    glow: '#0d33f2',     // blue-700 — halo
    particle: '#ffffff', // partículas viajeras
    node: '#a855f7',     // purple-500 — empalmes
};

function pipePath({ from, to, curve = 40 }) {
    const [x1, y1] = from;
    const [x2, y2] = to;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 - curve;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function GlassPipes({
    paths = [],
    nodes = [],
    palette = DEFAULT_PALETTE,
    className = '',
    speed = 4,           // segundos por recorrido
    particleCount = 2,   // partículas por tubería
    viewBox = '0 0 100 100',
}) {
    const uid = useId().replace(/:/g, '');
    const blurId = `glass-blur-${uid}`;
    const glowId = `glass-glow-${uid}`;
    const gradId = `glass-grad-${uid}`;
    const innerGradId = `glass-inner-${uid}`;

    // Las curvas SVG no cambian salvo que cambien los paths → memoiza para no
    // recalcular la string en cada render del padre.
    const pipeDs = useMemo(() => paths.map((p) => pipePath(p)), [paths]);

    return (
        <svg
            className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
            viewBox={viewBox}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <defs>
                {/* Glow externo de la tubería (halo) */}
                <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.2" />
                </filter>
                <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.5" />
                </filter>
                {/* Gradiente de vidrio — translúcido en los extremos */}
                <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor={palette.pipe} stopOpacity="0.15" />
                    <stop offset="50%" stopColor={palette.pipe} stopOpacity="0.55" />
                    <stop offset="100%" stopColor={palette.pipe} stopOpacity="0.15" />
                </linearGradient>
                {/* Reflejo interior (cristal) */}
                <linearGradient id={innerGradId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                    <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* TUBERÍAS — 3 capas: halo, vidrio exterior, brillo interior */}
            {pipeDs.map((d, i) => {
                return (
                    <g key={`pipe-${i}`}>
                        {/* Halo */}
                        <path
                            d={d}
                            fill="none"
                            stroke={palette.glow}
                            strokeWidth="3.5"
                            strokeOpacity="0.35"
                            strokeLinecap="round"
                            filter={`url(#${glowId})`}
                        />
                        {/* Vidrio exterior */}
                        <path
                            d={d}
                            fill="none"
                            stroke={`url(#${gradId})`}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            filter={`url(#${blurId})`}
                        />
                        {/* Reflejo interior (línea fina) */}
                        <path
                            d={d}
                            fill="none"
                            stroke={`url(#${innerGradId})`}
                            strokeWidth="0.6"
                            strokeLinecap="round"
                        />

                        {/* Partículas viajeras dentro de la tubería */}
                        {Array.from({ length: particleCount }).map((_, j) => {
                            const delay = (speed / particleCount) * j;
                            return (
                                <circle key={j} r="0.7" fill={palette.particle} filter={`url(#${glowId})`}>
                                    <animateMotion
                                        dur={`${speed}s`}
                                        repeatCount="indefinite"
                                        begin={`${delay}s`}
                                        path={d}
                                        rotate="auto"
                                    />
                                </circle>
                            );
                        })}
                    </g>
                );
            })}

            {/* NODOS — empalmes translúcidos con pulso */}
            {nodes.map((n, i) => (
                <g key={`node-${i}`} transform={`translate(${n.x} ${n.y})`}>
                    {/* Halo del nodo */}
                    <circle r="3.2" fill={palette.node} opacity="0.18" filter={`url(#${glowId})`} />
                    {/* Esfera de vidrio */}
                    <circle r="1.8" fill={palette.node} opacity="0.55" />
                    <circle r="1.8" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="0.15" />
                    {/* Reflejo highlight */}
                    <circle cx="-0.55" cy="-0.6" r="0.5" fill="#ffffff" opacity="0.7" />
                    {/* Pulso */}
                    <circle r="1.8" fill="none" stroke={palette.node} strokeWidth="0.3" opacity="0.7">
                        <animate attributeName="r" from="1.8" to="4.5" dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.7" to="0" dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                    </circle>
                </g>
            ))}
        </svg>
    );
}

// Capa decorativa estática → memo evita re-render cuando el padre cambia estado
// (p.ej. el calculador de precios) sin tocar las props del SVG.
export default memo(GlassPipes);
export { DEFAULT_PALETTE };
