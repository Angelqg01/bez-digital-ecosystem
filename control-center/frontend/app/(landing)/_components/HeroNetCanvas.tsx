'use client';

import { useEffect, useRef } from 'react';

/**
 * Red de nodos animada del hero.
 *
 * Se apaga sola en tres casos, y los tres importan para la factura de bateria:
 * `prefers-reduced-motion`, pestana oculta y viewport estrecho. En movil el
 * canvas cuesta mas de lo que aporta — ahi el hero ya tiene su propia imagen.
 */
export default function HeroNetCanvas({ className = '' }: { className?: string }) {
    const ref = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const narrow = window.matchMedia('(max-width: 767px)').matches;
        if (reduce || narrow) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        type Node = { x: number; y: number; vx: number; vy: number };
        let nodes: Node[] = [];
        let raf = 0;
        let w = 0;
        let h = 0;

        const seed = () => {
            const count = Math.min(74, Math.round((w * h) / 17000));
            nodes = Array.from({ length: count }, (_, i) => {
                // Distribucion determinista: sin Math.random no hay salto entre
                // recargas ni diferencias entre servidor y cliente.
                const a = i * 2.399963; // angulo aureo
                const r = Math.sqrt(i / count);
                return {
                    x: (0.5 + Math.cos(a) * r * 0.52) * w,
                    y: (0.5 + Math.sin(a) * r * 0.52) * h,
                    vx: Math.cos(a * 3.1) * 0.16,
                    vy: Math.sin(a * 2.7) * 0.16,
                };
            });
        };

        const resize = () => {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const rect = canvas.getBoundingClientRect();
            w = rect.width;
            h = rect.height;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed();
        };

        const frame = () => {
            ctx.clearRect(0, 0, w, h);

            for (const n of nodes) {
                n.x += n.vx;
                n.y += n.vy;
                if (n.x < 0 || n.x > w) n.vx *= -1;
                if (n.y < 0 || n.y > h) n.vy *= -1;
            }

            const LINK = 148;
            ctx.lineWidth = 1;
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const d = Math.hypot(dx, dy);
                    if (d > LINK) continue;
                    ctx.strokeStyle = `rgba(34,211,238,${(1 - d / LINK) * 0.26})`;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }

            ctx.fillStyle = 'rgba(34,211,238,0.75)';
            for (const n of nodes) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
                ctx.fill();
            }

            raf = requestAnimationFrame(frame);
        };

        resize();
        raf = requestAnimationFrame(frame);

        const onResize = () => {
            resize();
        };
        const onVisibility = () => {
            if (document.hidden) {
                cancelAnimationFrame(raf);
                raf = 0;
            } else if (!raf) {
                raf = requestAnimationFrame(frame);
            }
        };

        window.addEventListener('resize', onResize);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            if (raf) cancelAnimationFrame(raf);
            window.removeEventListener('resize', onResize);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    return <canvas ref={ref} className={className} aria-hidden="true" />;
}
