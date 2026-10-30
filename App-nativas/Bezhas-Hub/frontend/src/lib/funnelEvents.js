import { apiUrl } from '../utils/apiBase';
import { getPrivacyMode, getSessionId } from './chatTriggers';

/**
 * Eventos anónimos del embudo del chat. Sin cookies, sin contenido de mensajes, sin email ni respuestas:
 * solo qué evento, qué disparador/paso, la RUTA (sin query) y un id aleatorio de la pestaña.
 * La fuente de la campaña (utm_source) solo viaja con el consentimiento de cookies aceptado.
 * Medir nunca rompe la página: cualquier fallo se ignora.
 */
const SAFE_SOURCE = /^[a-z0-9_.-]{1,40}$/i;

function campaignSource(mode) {
    if (mode !== 'personalized') return undefined;
    try {
        const s = new URLSearchParams(window.location.search).get('utm_source');
        return s && SAFE_SOURCE.test(s) ? s : undefined;
    } catch { return undefined; }
}

export function track(event, { trigger, step } = {}) {
    try {
        if (typeof window === 'undefined') return;
        if (import.meta.env.PROD && window.navigator && window.navigator.webdriver) return;
        const mode = getPrivacyMode();
        const body = JSON.stringify({
            event, trigger, step, path: window.location.pathname, mode, sid: getSessionId(), source: campaignSource(mode),
        });
        fetch(apiUrl('/api/funnel/events'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'omit',
        }).catch(() => {});
    } catch { /* medir no debe romper nada */ }
}
