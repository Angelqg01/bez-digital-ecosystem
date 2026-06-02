// BeZhas Frontend Telemetry Utility
// Captura Core Web Vitals, errores JS, navegación, clicks y los envía en batch al backend

// OPTIMIZACIÓN: Usamos la API nativa del navegador en lugar de la librería 'uuid'
// Esto elimina ~10KB del bundle y es más rápido (implementación en C++)
const uuidv4 = () => {
    // Método nativo moderno (soportado en todos los navegadores modernos)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback robusto para máxima compatibilidad
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const TELEMETRY_ENDPOINT = '/api/v1/telemetry';
const BATCH_SIZE = 50;
const FLUSH_INTERVAL = 5000; // ms
const MAX_RETRIES = 2;

let sessionId = localStorage.getItem('bezhas_session_id');
if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem('bezhas_session_id', sessionId);
}

const buffer = [];
let flushTimeout = null;
let failureCount = 0;

function sendBatch() {
    if (buffer.length === 0) return;
    const events = buffer.splice(0, BATCH_SIZE);

    fetch(TELEMETRY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, events }),
        signal: AbortSignal.timeout(3000) // 3 segundos de timeout
    }).then(response => {
        if (response.ok) {
            failureCount = 0; // Reset en caso de éxito
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    }).catch((error) => {
        failureCount++;
        // Si falla múltiples veces, dejar de intentar para no llenar el buffer
        if (failureCount < MAX_RETRIES) {
            buffer.unshift(...events); // Requeue solo si no excede el límite
        }
        // Silently fail - telemetry no debe romper la app
    });
}

function scheduleFlush() {
    if (flushTimeout) clearTimeout(flushTimeout);
    flushTimeout = setTimeout(sendBatch, FLUSH_INTERVAL);
}

export function trackEvent(event) {
    buffer.push({ ...event, timestamp: Date.now() });
    if (buffer.length >= BATCH_SIZE) {
        sendBatch();
    } else {
        scheduleFlush();
    }
}

// Core Web Vitals
export function initWebVitals() {
    if (window.PerformanceObserver) {
        try {
            const po = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    trackEvent({
                        eventType: 'web-vital',
                        eventName: entry.name,
                        performance: {
                            value: entry.value,
                            startTime: entry.startTime
                        }
                    });
                }
            });
            po.observe({ type: 'largest-contentful-paint', buffered: true });
            po.observe({ type: 'first-input', buffered: true });
            po.observe({ type: 'layout-shift', buffered: true });
        } catch (e) { }
    }
}

// JS Errors
window.addEventListener('error', (e) => {
    trackEvent({
        eventType: 'js-error',
        eventName: e.message,
        error: {
            message: e.message,
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno
        }
    });
});

// Navigation
window.addEventListener('popstate', () => {
    trackEvent({
        eventType: 'navigation',
        eventName: window.location.pathname
    });
});

// Clicks
window.addEventListener('click', (e) => {
    const target = e.target.closest('[data-telemetry]');
    if (target) {
        trackEvent({
            eventType: 'click',
            eventName: target.getAttribute('data-telemetry')
        });
    }
});

// React hook for page views
import { useEffect } from 'react';
export function usePageView() {
    useEffect(() => {
        trackEvent({ eventType: 'pageview', eventName: window.location.pathname });
    }, [window.location.pathname]);
}

// React hook for custom telemetry
export function useTelemetry(eventType, eventName, metadata) {
    useEffect(() => {
        trackEvent({ eventType, eventName, metadata });
    }, []);
}

export default {
    trackEvent,
    initWebVitals,
    usePageView,
    useTelemetry
};
