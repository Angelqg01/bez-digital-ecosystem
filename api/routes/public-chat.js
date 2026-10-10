'use strict';

/**
 * routes/public-chat.js — chat público de bezhas.com y de las SubApps.
 *
 *   POST /api/public-chat   { message }  →  { reply, sources[] }
 *
 * Coste cero: no llama a ningún LLM. Recupera con BM25 sobre la base pública
 * (config/public-kb.js) y compone la respuesta con los fragmentos. Para
 * preguntas fuera de la base responde que no lo sabe y enlaza a soporte, en
 * lugar de inventar.
 *
 * Es pública y sin estado: sin cookies, sin credenciales. Por eso lleva su
 * propio CORS abierto (`*`, sin credentials) —las SubApps viven en *.run.app,
 * que la allowlist global no cubre— y se monta ANTES del CORS global, que
 * cortaría el preflight. Por el mismo motivo lleva su propio parser acotado y
 * su propio límite de tasa por IP.
 */

const { Router, json } = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { ENTRADAS } = require('../config/public-kb');
const { indexar, buscarEn } = require('../services/knowledgeIndex');

const router = Router();
const INDICE = indexar(ENTRADAS.map((e) => ({ archivo: e.titulo, ...e })));
const MAX_MENSAJE = 300;
const UMBRAL = 1.0;   // por debajo, el acierto es ruido: se prefiere «no lo sé»

router.use(cors({ origin: '*', methods: ['POST', 'OPTIONS'], maxAge: 86400 }));

const limitador = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.PUBLIC_CHAT_RATE_MAX, 10) || 20,
    message: { error: 'Demasiadas preguntas seguidas. Espera un minuto.', code: 'CHAT_RATE_LIMIT' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/', limitador, json({ limit: '4kb' }), (req, res) => {
    const mensaje = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (mensaje.length < 2 || mensaje.length > MAX_MENSAJE) {
        return res.status(400).json({ error: `Escribe entre 2 y ${MAX_MENSAJE} caracteres.`, code: 'BAD_MESSAGE' });
    }

    const { fragmentos } = buscarEn(INDICE, mensaje, 2);
    // Sólo lo cercano al mejor acierto: el segundo fragmento flojo es ruido.
    const corte = Math.max(UMBRAL, (fragmentos[0]?.puntuacion || 0) * 0.6);
    const buenos = fragmentos.filter((f) => f.puntuacion >= corte);

    if (buenos.length === 0) {
        return res.json({
            reply: 'No tengo ese dato en la información pública de BeZhas. Puedes escribir a info.bezcoin@bezhas.com o abrir el centro de ayuda.',
            sources: [{ titulo: 'Centro de ayuda', enlace: 'https://bezhas.com/support' }],
            answered: false,
        });
    }
    res.json({
        reply: buenos.map((f) => f.texto).join('\n\n'),
        sources: buenos.map((f) => ({ titulo: f.seccion, enlace: f.enlace })),
        answered: true,
    });
});

module.exports = router;
