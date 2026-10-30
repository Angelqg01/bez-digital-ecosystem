/**
 * Disparadores proactivos del chat: reglas, modo de privacidad y límites de frecuencia.
 * Es lógica pura (sin React ni DOM salvo el almacenamiento) para poder probarla entera.
 *
 * Política acordada en el debate ChatGPT × Gemini (docs/DEBATE_CAPTACION_CHAT_2026-10-30.md):
 *   · Máximo 1 aviso proactivo por sesión, compartido entre la web y las SubApps.
 *   · Cerrar el aviso → 7 días de silencio; rechazar la oferta → 14 días.
 *   · Cero avisos en checkout, login/registro, administración, con el chat abierto, con el cuestionario
 *     en marcha, mientras se escribe o si la persona ya tiene sesión.
 *   · Dos modos de privacidad:
 *       contextual     (sin consentimiento): solo la página actual y la sesión (sessionStorage).
 *       personalized   (cookies aceptadas):  además memoria entre sesiones (localStorage).
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const CONSENT_KEY = 'bezhas_cookie_consent'; // el mismo que escribe el banner de la landing
const SESSION_KEY = 'bz_chat_nudge_session';
const PERSIST_KEY = 'bz_chat_nudge_v1';
const SID_KEY = 'bz_chat_sid';

export const COOLDOWN = { closed: 7 * DAY_MS, rejected: 14 * DAY_MS, between: 7 * DAY_MS };

/** Rutas donde nunca se interrumpe. Prefijos. */
export const BLOCKED_PREFIXES = ['/login', '/register', '/auth', '/admin', '/superpanel', '/checkout', '/c/', '/vip/success', '/onboarding', '/o/'];

const OPEN_ONBOARDING = { action: 'onboarding', label: 'Configurar BeZhas para mi empresa' };

/**
 * Cada regla: dónde aplica, cuánto espera y qué señal de interés exige además del tiempo.
 * `needs`: 'idle' (no ha interactuado), 'interaction' (ha hecho scroll/clic/tecla) o { scroll: % }.
 * `personalizedOnly`: necesita memoria entre sesiones, así que solo existe con consentimiento.
 */
export const TRIGGERS = [
    {
        id: 'home', paths: ['/', '/home'], delayMs: 20_000, needs: 'idle',
        message: '¿Qué proceso empresarial quieres mejorar? Te ayudamos a encontrar la solución adecuada.', cta: OPEN_ONBOARDING,
    },
    {
        id: 'pricing', paths: ['/be-vip', '/vip', '/planes', '/pricing'], delayMs: 10_000, needs: { scroll: 40 },
        message: '¿Comparamos los planes según el volumen y las necesidades de tu empresa?', cta: { action: 'onboarding', label: 'Recomiéndame un plan' },
    },
    {
        id: 'developers', paths: ['/developers', '/developer-console', '/developers/docs'], delayMs: 30_000, needs: { scroll: 60 },
        message: '¿Necesitas ayuda para integrar BeZhas mediante API, SDK o MCP?',
        cta: { action: 'ask', label: 'Preguntar al asistente', prompt: '¿Cómo integro BeZhas mediante la API, el SDK o el MCP?' },
    },
    {
        id: 'subapp', prefixes: ['/cargolink', '/pay', '/wallet', '/energy', '/purescan', '/capital'], delayMs: 15_000, needs: 'interaction',
        message: '¿Quieres comprobar cómo aplicar esta solución a tu empresa?', cta: OPEN_ONBOARDING,
    },
    {
        id: 'second_visit', paths: ['/', '/home'], delayMs: 3_000, needs: 'none', personalizedOnly: true,
        message: '¿Quieres continuar descubriendo cómo BeZhas puede integrarse en tu empresa?', cta: OPEN_ONBOARDING,
    },
];

const matchesPath = (t, path) => (t.paths && t.paths.includes(path)) || (t.prefixes && t.prefixes.some((p) => path === p || path.startsWith(`${p}/`)));

export const isBlockedPath = (path) => BLOCKED_PREFIXES.some((p) => path === p.replace(/\/$/, '') || path.startsWith(p));

/** Reglas que aplican a una ruta y a un modo de privacidad. */
export function triggersFor(path, mode) {
    if (isBlockedPath(path)) return [];
    return TRIGGERS.filter((t) => matchesPath(t, path) && (!t.personalizedOnly || mode === 'personalized'));
}

// ── almacenamiento (a prueba de navegadores sin storage) ─────────────────────────────────────────
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const read = (store, key) => safe(() => JSON.parse(store.getItem(key) || 'null'), null) || {};
const write = (store, key, value) => safe(() => store.setItem(key, JSON.stringify(value)));

/** `personalized` solo si la persona aceptó las cookies en el banner. Cualquier otra cosa es `contextual`. */
export function getPrivacyMode() {
    return safe(() => (window.localStorage.getItem(CONSENT_KEY) === 'accepted' ? 'personalized' : 'contextual'), 'contextual');
}

/** Identificador aleatorio de la pestaña: sirve para contar un embudo, no para seguir a nadie. */
export function getSessionId() {
    return safe(() => {
        let sid = window.sessionStorage.getItem(SID_KEY);
        if (!sid) {
            const rnd = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
            sid = rnd.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 36);
            window.sessionStorage.setItem(SID_KEY, sid);
        }
        return sid;
    }, 'sin-sesion');
}

const sessionState = () => safe(() => read(window.sessionStorage, SESSION_KEY), {});
const persistState = (mode) => (mode === 'personalized' ? safe(() => read(window.localStorage, PERSIST_KEY), {}) : {});

/**
 * ¿Se puede mostrar un aviso ahora? Devuelve { ok, reason } para poder probar y depurar.
 */
export function canShow({ mode, now = Date.now(), session = sessionState(), persisted = persistState(mode) } = {}) {
    if (session.shown) return { ok: false, reason: 'ya-mostrado-en-sesion' };
    if (session.closed) return { ok: false, reason: 'cerrado-en-sesion' };
    if (mode === 'personalized') {
        if (persisted.closedAt && now - persisted.closedAt < COOLDOWN.closed) return { ok: false, reason: 'cerrado-hace-menos-de-7d' };
        if (persisted.rejectedAt && now - persisted.rejectedAt < COOLDOWN.rejected) return { ok: false, reason: 'rechazado-hace-menos-de-14d' };
        if (persisted.lastShownAt && now - persisted.lastShownAt < COOLDOWN.between) return { ok: false, reason: 'ultimo-aviso-hace-menos-de-7d' };
    }
    return { ok: true, reason: 'ok' };
}

const update = (mode, sessionPatch, persistPatch) => {
    safe(() => window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...sessionState(), ...sessionPatch })));
    if (mode === 'personalized' && persistPatch) safe(() => write(window.localStorage, PERSIST_KEY, { ...persistState(mode), ...persistPatch }));
};

export const recordShown = (mode, now = Date.now()) => update(mode, { shown: true }, { lastShownAt: now });
/** La persona cerró el aviso: silencio durante la sesión y, con consentimiento, 7 días. */
export const recordClosed = (mode, now = Date.now()) => update(mode, { closed: true }, { closedAt: now });
/** La persona aceptó la propuesta: no se vuelve a insistir en la sesión. */
export const recordAccepted = (mode) => update(mode, { closed: true }, null);

/**
 * Segunda visita: con consentimiento, cuenta una visita por día natural.
 * @returns {number} visitas acumuladas
 */
export function registerVisit(mode, now = Date.now()) {
    if (mode !== 'personalized') return 0;
    const p = persistState(mode);
    const day = new Date(now).toISOString().slice(0, 10);
    if (p.lastVisitDay === day) return p.visits || 1;
    const visits = (p.visits || 0) + 1;
    update(mode, {}, { visits, lastVisitDay: day });
    return visits;
}

export const visitsSoFar = (mode) => persistState(mode).visits || 0;

/** Contexto que impide interrumpir. */
export function isBlockedContext({ chatOpen, onboarding, authCard, typing, loggedIn, hidden, automated }) {
    return !!(chatOpen || onboarding || authCard || typing || loggedIn || hidden || automated);
}

/** ¿La señal de interés que pide la regla se ha cumplido? */
export function interestMet(trigger, { interacted, scrollPct }) {
    const n = trigger.needs;
    if (n === 'none') return true;
    if (n === 'idle') return !interacted;
    if (n === 'interaction') return !!interacted;
    if (n && typeof n === 'object' && 'scroll' in n) return scrollPct >= n.scroll || !!interacted;
    return true;
}
