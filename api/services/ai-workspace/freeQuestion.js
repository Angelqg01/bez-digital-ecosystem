'use strict';

/**
 * Pregunta gratis del chat para visitantes sin sesión.
 *
 *   consumir(ip) → { ok: true, clave } la primera vez en VENTANA_DIAS;
 *                  { ok: false, motivo: 'USADA' | 'SATURADO' } si no.
 *   devolver(clave) → si la respuesta falló antes de empezar, se devuelve la
 *                     pregunta (solo en los minutos siguientes).
 *
 * La clave es HMAC-SHA256(ip) con un secreto del servidor: no se guarda la IP
 * y no se puede recalcular sin el secreto. El tope global por hora limita el
 * gasto si alguien rota IPs.
 */
const crypto = require('crypto');

const VENTANA_DIAS = 30;
const TOPE_HORA = () => Number(process.env.AI_FREE_QUESTIONS_PER_HOUR || 300);

function claveDe(ip) {
    const secreto = process.env.AI_FREE_QUESTION_SECRET || process.env.JWT_SECRET || 'dev-only-secret';
    return crypto.createHmac('sha256', secreto).update(`ai-free:${String(ip || 'desconocida')}`).digest('hex');
}

class MemoryFreeQuestions {
    constructor({ now = () => Date.now() } = {}) { this.now = now; this.usadas = new Map(); }

    async consumir(ip) {
        const clave = claveDe(ip);
        const t = this.now();
        const enHora = [...this.usadas.values()].filter((u) => u > t - 3600_000).length;
        if (enHora >= TOPE_HORA()) return { ok: false, motivo: 'SATURADO' };
        const previa = this.usadas.get(clave);
        if (previa && previa > t - VENTANA_DIAS * 86400_000) return { ok: false, motivo: 'USADA' };
        this.usadas.set(clave, t);
        return { ok: true, clave };
    }

    async devolver(clave) { this.usadas.delete(clave); }
}

class PgFreeQuestions {
    constructor(db) { this.db = db; }

    async consumir(ip) {
        const clave = claveDe(ip);
        const { rows } = await this.db.query(
            `SELECT COUNT(*)::int AS n FROM ai_free_questions WHERE used_at > NOW() - INTERVAL '1 hour'`
        );
        if (rows[0].n >= TOPE_HORA()) return { ok: false, motivo: 'SATURADO' };
        // Atómico: dos peticiones a la vez desde la misma IP no consiguen dos preguntas.
        const r = await this.db.query(
            `INSERT INTO ai_free_questions (key_hash, used_at) VALUES ($1, NOW())
             ON CONFLICT (key_hash) DO UPDATE SET used_at = NOW()
               WHERE ai_free_questions.used_at < NOW() - INTERVAL '${VENTANA_DIAS} days'
             RETURNING key_hash`,
            [clave]
        );
        return r.rowCount ? { ok: true, clave } : { ok: false, motivo: 'USADA' };
    }

    async devolver(clave) {
        await this.db.query(
            `DELETE FROM ai_free_questions WHERE key_hash = $1 AND used_at > NOW() - INTERVAL '10 minutes'`,
            [clave]
        );
    }
}

function crearPreguntasGratis() {
    if (process.env.KNOWLEDGE_STORE === 'memory') return new MemoryFreeQuestions();
    return new PgFreeQuestions(require('../../db/pool'));
}

module.exports = { crearPreguntasGratis, MemoryFreeQuestions, PgFreeQuestions, claveDe, VENTANA_DIAS };
