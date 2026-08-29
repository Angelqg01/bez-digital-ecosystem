'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Contador que cuenta al entrar en pantalla.
 *
 * Solo anima cuando `to` es un numero. Cifras como "2/N" o "100%" se pasan por
 * `label` y se pintan tal cual: intentar animarlas produciria un contador que
 * cuenta hasta un valor que no significa nada.
 */
export default function Counter({
    to,
    suffix = '',
    label,
    durationMs = 1100,
}: {
    to?: number;
    suffix?: string;
    label?: string;
    durationMs?: number;
}) {
    const ref = useRef<HTMLSpanElement | null>(null);
    const [value, setValue] = useState(typeof to === 'number' ? 0 : null);

    useEffect(() => {
        if (typeof to !== 'number') return;
        const node = ref.current;
        if (!node) return;

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce || !('IntersectionObserver' in window)) {
            setValue(to);
            return;
        }

        let raf = 0;
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    io.unobserve(entry.target);

                    const start = performance.now();
                    const tick = (now: number) => {
                        const p = Math.min(1, (now - start) / durationMs);
                        // easeOutCubic: llega rapido y frena, que es como se lee un dato
                        const eased = 1 - Math.pow(1 - p, 3);
                        setValue(Math.round(to * eased));
                        if (p < 1) raf = requestAnimationFrame(tick);
                    };
                    raf = requestAnimationFrame(tick);
                }
            },
            { threshold: 0.4 },
        );

        io.observe(node);
        return () => {
            io.disconnect();
            if (raf) cancelAnimationFrame(raf);
        };
    }, [to, durationMs]);

    if (typeof to !== 'number') {
        return <span ref={ref}>{label ?? ''}</span>;
    }

    return (
        <span ref={ref}>
            {value ?? 0}
            {suffix}
        </span>
    );
}
