'use client';

import { useEffect, useRef } from 'react';
import s from '../home.module.css';

/** Barra fina de progreso de lectura. Escribe el transform fuera de React. */
export default function ScrollProgress() {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        let ticking = false;
        const paint = () => {
            ticking = false;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
            node.style.transform = `scaleX(${p})`;
        };

        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(paint);
        };

        paint();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, []);

    return <div ref={ref} className={s.progress} aria-hidden="true" />;
}
