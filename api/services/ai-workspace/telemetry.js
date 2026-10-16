'use strict';

/**
 * Métricas del chat con RAG. Prometheus (se exponen con el resto en /metrics) + una línea de log JSON por mensaje.
 *
 * NUNCA se registra el texto de la pregunta ni de la respuesta, ni el contenido de los fragmentos: sólo contadores,
 * duraciones, nº de fuentes y cobertura. Los IDs de usuario no van en las etiquetas (cardinalidad) y sí en el log.
 */
const client = require('prom-client');
const { register } = require('../../middleware/metrics');
const logger = require('../../utils/logger');

const nuevo = (Clase, cfg) => register.getSingleMetric(cfg.name) || new Clase({ ...cfg, registers: [register] });

const mensajes = nuevo(client.Counter, {
    name: 'bezhas_ai_chat_messages_total', help: 'Mensajes del chat con IA por resultado y proveedor', labelNames: ['canal', 'outcome', 'provider'],
});
const duracion = nuevo(client.Histogram, {
    name: 'bezhas_ai_chat_duration_seconds', help: 'Duración total de un mensaje del chat', labelNames: ['canal', 'provider'],
    buckets: [0.1, 0.5, 1, 2, 4, 8, 15, 30, 60],
});
const retrievalSeg = nuevo(client.Histogram, {
    name: 'bezhas_ai_retrieval_duration_seconds', help: 'Duración de la recuperación (RAG) por mensaje', labelNames: ['modo'],
    buckets: [0.001, 0.005, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2],
});
const retrievalRes = nuevo(client.Counter, {
    name: 'bezhas_ai_retrieval_total', help: 'Recuperaciones por resultado: hit (cobertura >= 0,5), weak (< 0,5) o none (sin fuentes)', labelNames: ['resultado'],
});
const degradaciones = nuevo(client.Counter, {
    name: 'bezhas_ai_provider_degradations_total', help: 'Veces que el proveedor de IA falló y se sirvió el modo extractivo', labelNames: ['provider'],
});

const cifras = nuevo(client.Counter, {
    name: 'bezhas_ai_figures_removed_total', help: 'Cifras con unidad (€, $, %) retiradas de una respuesta porque no constaban en la documentación', labelNames: [],
});
function cifrasRetiradas(n) { cifras.inc(n); }

const UMBRAL_DEBIL = 0.5;

/** Cobertura máxima declarada en el contexto recuperado (atributo relevance de cada <untrusted_document>). */
function coberturaMax(context) {
    const v = [...String(context || '').matchAll(/relevance="([0-9.]+)"/g)].map((m) => Number(m[1])).filter(Number.isFinite);
    return v.length ? Math.max(...v) : 0;
}

/** Mide una recuperación ya hecha: { ms, fuentes, cobertura, resultado }. */
function retrieval({ ms, sources, context }) {
    const fuentes = (sources || []).length;
    const cobertura = coberturaMax(context);
    const resultado = !fuentes ? 'none' : cobertura < UMBRAL_DEBIL ? 'weak' : 'hit';
    retrievalSeg.observe({ modo: process.env.KNOWLEDGE_RETRIEVAL === 'fts' ? 'fts' : 'completo' }, ms / 1000);
    retrievalRes.inc({ resultado });
    return { ms: Math.round(ms * 10) / 10, fuentes, cobertura, resultado };
}

function degradacion(provider) { degradaciones.inc({ provider: provider || 'desconocido' }); }

/**
 * Cierra un turno. outcome: ok | blocked | degraded | error | aborted.
 * `degraded` = se pidió un proveedor de pago y se sirvió el extractivo por fallo (no cuenta el modo extractivo elegido).
 */
function turno({ canal = 'chat', outcome, provider = 'none', ms = 0, retrieval: r = null, userId = null, tenant = null, tokens = null }) {
    mensajes.inc({ canal, outcome, provider });
    if (ms) duracion.observe({ canal, provider }, ms / 1000);
    logger.info({
        evento: 'ai_chat_turno', canal, outcome, provider, ms: Math.round(ms), userId, tenant,
        retrieval: r ? { ms: r.ms, fuentes: r.fuentes, cobertura: r.cobertura, resultado: r.resultado } : undefined,
        tokens: tokens || undefined,
    }, 'ai-workspace turno');
}

module.exports = { retrieval, turno, degradacion, cifrasRetiradas, coberturaMax, _metricas: { mensajes, duracion, retrievalSeg, retrievalRes, degradaciones } };
