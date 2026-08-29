'use client';

import { useEffect, useRef, useState } from 'react';
import s from '../home.module.css';

export type AnchorPill = { n: string; t: string; d: string };

/**
 * Panel ancla: un bloque a sangre que se encoge hasta convertirse en tarjeta
 * mientras se scrollea, momento en el que aparecen las tres ideas.
 *
 * Degrada a estado final estatico cuando no hay `sticky` util:
 * por debajo de 768 px y con `prefers-reduced-motion`. Ese fallback importa —
 * en Safari iOS el sticky dentro de contenedor con overflow se comporta de
 * forma inconsistente, y un panel congelado a media animacion es peor que uno
 * que nunca se movio.
 */
export default function AnchorPanel({
    title,
    pills,
    art,
    bars = 24,
}: {
    title: string;
    pills: AnchorPill[];
    art: 'port' | 'aegis';
    bars?: number;
}) {
    const sectionRef = useRef<HTMLElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const titleRef = useRef<HTMLHeadingElement | null>(null);
    const revealRef = useRef<HTMLDivElement | null>(null);
    const [staticState, setStaticState] = useState(false);

    // Alturas de las barras decorativas: deterministas, no aleatorias.
    // Math.random() aqui daria un valor distinto en servidor y cliente
    // y React marcaria mismatch de hidratacion en cada carga.
    const barHeights = Array.from({ length: bars }, (_, i) => {
        const wave = Math.sin(i * 0.7) * 0.5 + Math.sin(i * 1.9) * 0.3;
        return 18 + Math.abs(wave) * 68;
    });

    useEffect(() => {
        const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
        const mqNarrow = window.matchMedia('(max-width: 767px)');

        const evaluate = () => setStaticState(mqReduce.matches || mqNarrow.matches);
        evaluate();

        mqReduce.addEventListener('change', evaluate);
        mqNarrow.addEventListener('change', evaluate);
        return () => {
            mqReduce.removeEventListener('change', evaluate);
            mqNarrow.removeEventListener('change', evaluate);
        };
    }, []);

    useEffect(() => {
        if (staticState) return;

        const section = sectionRef.current;
        const panel = panelRef.current;
        const heading = titleRef.current;
        const reveal = revealRef.current;
        if (!section || !panel || !heading || !reveal) return;

        let ticking = false;
        const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

        const paint = () => {
            ticking = false;
            const rect = section.getBoundingClientRect();
            const travel = section.offsetHeight - window.innerHeight;
            if (travel <= 0) return;

            const p = clamp(-rect.top / travel, 0, 1);
            // easeInOutQuad: el encogido arranca y termina suave
            const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

            panel.style.setProperty('--inset', `${e * 22}%`);
            panel.style.setProperty('--rad', `${e * 28}px`);

            // El titulo se va entre 0 y 0.55; las ideas entran a partir de 0.55.
            const titleOut = clamp(p / 0.55, 0, 1);
            heading.style.opacity = String(1 - titleOut);
            heading.style.transform = `translateY(${titleOut * -34}px) scale(${1 - titleOut * 0.12})`;

            const revealIn = clamp((p - 0.55) / 0.32, 0, 1);
            reveal.style.opacity = String(revealIn);
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
            // Devolver el panel a su estado neutro por si el modo cambia en caliente.
            panel.style.removeProperty('--inset');
            panel.style.removeProperty('--rad');
            heading.style.cssText = '';
            reveal.style.opacity = '';
        };
    }, [staticState]);

    const panelInner = (
        <div
            ref={panelRef}
            className={`${s.anchorPanel} ${staticState ? s.staticState : ''}`.trim()}
        >
            <div className={`${s.panelArt} ${art === 'port' ? s.panelArtPort : s.panelArtAegis}`} aria-hidden="true" />
            <div className={s.panelBars} aria-hidden="true">
                {barHeights.map((h, i) => (
                    <i key={i} style={{ height: `${h}%` }} />
                ))}
            </div>

            <h2 ref={titleRef} className={s.anchorTitle}>
                {title}
            </h2>

            <div ref={revealRef} className={s.anchorReveal}>
                {pills.map((pill) => (
                    <div key={pill.n} className={s.pill}>
                        <span className={s.pillN}>{pill.n}</span>
                        <span className={s.pillT}>{pill.t}</span>
                        <span className={s.pillD}>{pill.d}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    // En estado estatico no hace falta el carril de 210vh que alimenta el scroll.
    if (staticState) {
        return (
            <section className={s.slab} style={{ paddingBlock: 'clamp(48px, 6vw, 92px)' }}>
                <div className={s.wrap}>{panelInner}</div>
            </section>
        );
    }

    return (
        <section ref={sectionRef} className={s.anchor}>
            <div className={s.anchorSticky}>{panelInner}</div>
        </section>
    );
}
