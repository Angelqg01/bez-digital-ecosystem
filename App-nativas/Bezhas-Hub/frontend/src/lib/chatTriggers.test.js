import { describe, it, expect, beforeEach } from 'vitest';
import {
    DAY_MS, CONSENT_KEY, triggersFor, isBlockedPath, getPrivacyMode, canShow, recordShown, recordClosed, recordAccepted,
    registerVisit, visitsSoFar, isBlockedContext, interestMet, getSessionId, TRIGGERS,
} from './chatTriggers';

const now = 1_800_000_000_000;

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });

describe('reglas por ruta', () => {
    it('cada página tiene su disparador y el modo contextual no incluye los que necesitan memoria', () => {
        expect(triggersFor('/', 'contextual').map((t) => t.id)).toEqual(['home']);
        expect(triggersFor('/', 'personalized').map((t) => t.id)).toEqual(['home', 'second_visit']);
        expect(triggersFor('/be-vip', 'contextual').map((t) => t.id)).toEqual(['pricing']);
        expect(triggersFor('/developers/docs', 'contextual').map((t) => t.id)).toEqual(['developers']);
        expect(triggersFor('/cargolink/rutas', 'contextual').map((t) => t.id)).toEqual(['subapp']);
        expect(triggersFor('/feed', 'contextual')).toEqual([]);
    });

    it('nunca hay avisos en checkout, acceso, administración ni alta segura', () => {
        ['/checkout', '/checkout/x', '/login', '/register', '/auth', '/admin', '/admin/users', '/superpanel', '/c/abc', '/vip/success', '/o/abc'].forEach((p) => {
            expect(isBlockedPath(p)).toBe(true);
            expect(triggersFor(p, 'personalized')).toEqual([]);
        });
        expect(isBlockedPath('/home')).toBe(false);
        expect(isBlockedPath('/cargolink')).toBe(false);
    });

    it('los textos no inventan urgencia ni escasez', () => {
        TRIGGERS.forEach((t) => expect(t.message).not.toMatch(/quedan|última|solo hoy|oferta limitada|plazas|\d+ ?%/i));
    });
});

describe('modo de privacidad', () => {
    it('es contextual salvo que el banner haya registrado «accepted»', () => {
        expect(getPrivacyMode()).toBe('contextual');
        window.localStorage.setItem(CONSENT_KEY, 'necessary');
        expect(getPrivacyMode()).toBe('contextual');
        window.localStorage.setItem(CONSENT_KEY, 'accepted');
        expect(getPrivacyMode()).toBe('personalized');
    });
});

describe('frecuencia', () => {
    it('1 aviso por sesión', () => {
        expect(canShow({ mode: 'contextual', now }).ok).toBe(true);
        recordShown('contextual', now);
        expect(canShow({ mode: 'contextual', now }).reason).toBe('ya-mostrado-en-sesion');
    });

    it('cerrar silencia el resto de la sesión', () => {
        recordClosed('contextual', now);
        expect(canShow({ mode: 'contextual', now }).ok).toBe(false);
        recordAccepted('contextual');
    });

    it('sin consentimiento no se guarda nada entre sesiones', () => {
        recordShown('contextual', now);
        recordClosed('contextual', now);
        expect(window.localStorage.getItem('bz_chat_nudge_v1')).toBeNull();
        window.sessionStorage.clear(); // otra sesión
        expect(canShow({ mode: 'contextual', now: now + 1000 }).ok).toBe(true);
    });

    it('con consentimiento: 7 días tras cerrar, 7 entre avisos', () => {
        recordShown('personalized', now);
        window.sessionStorage.clear();
        expect(canShow({ mode: 'personalized', now: now + 3 * DAY_MS }).reason).toBe('ultimo-aviso-hace-menos-de-7d');
        expect(canShow({ mode: 'personalized', now: now + 8 * DAY_MS }).ok).toBe(true);
        recordClosed('personalized', now);
        window.sessionStorage.clear();
        expect(canShow({ mode: 'personalized', now: now + 6 * DAY_MS }).ok).toBe(false);
        expect(canShow({ mode: 'personalized', now: now + 8 * DAY_MS }).ok).toBe(true);
    });

    it('rechazo explícito: 14 días', () => {
        const persisted = { rejectedAt: now };
        expect(canShow({ mode: 'personalized', now: now + 13 * DAY_MS, session: {}, persisted }).ok).toBe(false);
        expect(canShow({ mode: 'personalized', now: now + 15 * DAY_MS, session: {}, persisted }).ok).toBe(true);
    });

    it('cuenta una visita por día y solo con consentimiento', () => {
        expect(registerVisit('contextual', now)).toBe(0);
        expect(registerVisit('personalized', now)).toBe(1);
        expect(registerVisit('personalized', now + 1000)).toBe(1);
        expect(registerVisit('personalized', now + DAY_MS)).toBe(2);
        expect(visitsSoFar('personalized')).toBe(2);
        expect(visitsSoFar('contextual')).toBe(0);
    });
});

describe('contexto que impide interrumpir', () => {
    const libre = { chatOpen: false, onboarding: false, authCard: false, typing: false, loggedIn: false, hidden: false, automated: false };
    it('libre por defecto', () => expect(isBlockedContext(libre)).toBe(false));
    it.each(['chatOpen', 'onboarding', 'authCard', 'typing', 'loggedIn', 'hidden', 'automated'])('bloquea con %s', (k) => {
        expect(isBlockedContext({ ...libre, [k]: true })).toBe(true);
    });
});

describe('señal de interés', () => {
    const t = (id) => TRIGGERS.find((x) => x.id === id);
    it('home exige que no haya interactuado; subapp exige que sí', () => {
        expect(interestMet(t('home'), { interacted: false, scrollPct: 0 })).toBe(true);
        expect(interestMet(t('home'), { interacted: true, scrollPct: 0 })).toBe(false);
        expect(interestMet(t('subapp'), { interacted: false, scrollPct: 0 })).toBe(false);
        expect(interestMet(t('subapp'), { interacted: true, scrollPct: 0 })).toBe(true);
    });
    it('pricing y developers piden lectura real, no solo tiempo', () => {
        expect(interestMet(t('pricing'), { interacted: false, scrollPct: 10 })).toBe(false);
        expect(interestMet(t('pricing'), { interacted: false, scrollPct: 40 })).toBe(true);
        expect(interestMet(t('developers'), { interacted: false, scrollPct: 59 })).toBe(false);
        expect(interestMet(t('developers'), { interacted: false, scrollPct: 60 })).toBe(true);
    });
});

describe('identificador de sesión', () => {
    it('es el mismo durante la pestaña, con formato válido para la API', () => {
        const a = getSessionId();
        expect(a).toMatch(/^[a-z0-9-]{8,36}$/);
        expect(getSessionId()).toBe(a);
    });
});
