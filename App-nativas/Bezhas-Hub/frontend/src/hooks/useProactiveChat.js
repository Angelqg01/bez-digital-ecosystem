import { useCallback, useEffect, useRef, useState } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import {
    triggersFor, getPrivacyMode, canShow, recordShown, recordClosed, recordAccepted, registerVisit, visitsSoFar,
    isBlockedContext, interestMet,
} from '../lib/chatTriggers';
import { track } from '../lib/funnelEvents';

/** Ruta actual; funciona también fuera de un Router (tests, SubApps sin react-router). */
function usePathname() {
    const inRouter = useInRouterContext();
    // La condición no cambia durante la vida del componente: el orden de los hooks es estable.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return inRouter ? useLocation().pathname : window.location.pathname;
}

/**
 * Decide cuándo mostrar el aviso proactivo del chat. Devuelve el aviso activo (o null) y cómo resolverlo.
 * `blocked` agrupa lo que impide interrumpir (chat abierto, cuestionario, tarjeta de acceso, escribiendo, sesión).
 */
export function useProactiveChat({ blocked }) {
    const pathname = usePathname();
    const [nudge, setNudge] = useState(null);
    const interacted = useRef(false);
    const scrollPct = useRef(0);
    const blockedRef = useRef(blocked);
    blockedRef.current = blocked;
    const shownRef = useRef(null);

    // Señales de interés: scroll máximo y primera interacción. Solo viven en memoria.
    useEffect(() => {
        interacted.current = false;
        scrollPct.current = 0;
        // `capture`: el scroll no burbujea, y en el Hub se desplaza un contenedor interno, no la ventana.
        const onScroll = (e) => {
            const t = e.target;
            const el = !t || t === document || t === document.documentElement || t === document.body ? document.documentElement : t;
            if (!el || el.scrollHeight == null) return;
            const max = el.scrollHeight - (el === document.documentElement ? window.innerHeight : el.clientHeight);
            const top = el === document.documentElement ? window.scrollY : el.scrollTop;
            if (max > 0) scrollPct.current = Math.max(scrollPct.current, Math.round((top / max) * 100));
            if (top > 40) interacted.current = true;
        };
        const onAct = () => { interacted.current = true; };
        window.addEventListener('scroll', onScroll, { passive: true, capture: true });
        window.addEventListener('pointerdown', onAct, { passive: true });
        window.addEventListener('keydown', onAct);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('pointerdown', onAct);
            window.removeEventListener('keydown', onAct);
        };
    }, [pathname]);

    useEffect(() => {
        setNudge(null);
        const mode = getPrivacyMode();
        registerVisit(mode);
        const rules = triggersFor(pathname, mode)
            .filter((t) => t.id !== 'second_visit' || visitsSoFar(mode) >= 2);
        if (rules.length === 0) return undefined;

        const automated = import.meta.env.PROD && typeof navigator !== 'undefined' && !!navigator.webdriver;
        const timers = rules.map((rule) => {
            let waited = 0;
            // Se comprueba cada segundo tras el retardo: la condición de interés puede cumplirse más tarde.
            const start = setTimeout(function tick() {
                // Si ya no se puede mostrar nada (aviso ya visto o cerrado), se deja de comprobar.
                if (!canShow({ mode }).ok) return;
                waited += 1;
                const ctx = { ...blockedRef.current, hidden: document.visibilityState !== 'visible', automated };
                if (!isBlockedContext(ctx) && interestMet(rule, { interacted: interacted.current, scrollPct: scrollPct.current })) {
                    recordShown(mode);
                    shownRef.current = { rule, mode };
                    setNudge(rule);
                    track('nudge_shown', { trigger: rule.id });
                    return;
                }
                if (waited < 60) timers.push(setTimeout(tick, 1000));
            }, rule.delayMs);
            return start;
        });
        return () => timers.forEach(clearTimeout);
    }, [pathname]);

    const dismiss = useCallback(() => {
        const s = shownRef.current;
        if (!s) return;
        recordClosed(s.mode);
        track('nudge_dismissed', { trigger: s.rule.id });
        setNudge(null);
    }, []);

    const accept = useCallback(() => {
        const s = shownRef.current;
        if (!s) return null;
        recordAccepted(s.mode);
        track('nudge_clicked', { trigger: s.rule.id });
        setNudge(null);
        return s.rule.cta;
    }, []);

    return { nudge, dismiss, accept };
}
