'use client';

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import s from '../home.module.css';

/**
 * Aparicion al entrar en viewport.
 *
 * `index` escalona el retardo entre hermanos (el CSS lo lee como `--i`).
 * Con `prefers-reduced-motion` no se observa nada: el contenido nace visible,
 * porque una animacion desactivada nunca dispara el observador que la revela.
 */
export default function Reveal({
    children,
    index = 0,
    as: Tag = 'div',
    className = '',
    style,
    ...rest
}: {
    children: ReactNode;
    index?: number;
    as?: ElementType;
    className?: string;
    style?: CSSProperties;
} & Record<string, unknown>) {
    const ref = useRef<HTMLElement | null>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce || !('IntersectionObserver' in window)) {
            setShown(true);
            return;
        }

        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setShown(true);
                        io.unobserve(entry.target);
                    }
                }
            },
            { rootMargin: '0px 0px -12% 0px', threshold: 0.06 },
        );

        io.observe(node);
        return () => io.disconnect();
    }, []);

    return (
        <Tag
            ref={ref}
            className={`${s.rv} ${shown ? s.rvIn : ''} ${className}`.trim()}
            style={{ ...(style ?? {}), ['--i' as string]: index }}
            {...rest}
        >
            {children}
        </Tag>
    );
}
