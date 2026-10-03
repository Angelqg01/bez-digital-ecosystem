/**
 * Hooks del pipeline del chat. Permiten añadir comportamiento (guardas, saneado, auditoría,
 * métricas) sin tocar las rutas.
 *
 * Etapas:
 *   beforeChat  ctx = { principal, message }            → puede devolver { message } (reescribe) o lanzar {status} (bloquea)
 *   afterModel  ctx = { principal, text }               → puede devolver { text } (reescribe la respuesta)
 *   onAction    ctx = { principal, action, outcome }    → auditoría; no puede bloquear (el resultado ya se decidió)
 *
 * Los hooks `critical` (guardas de seguridad) fallan CERRADO: si lanzan, la operación se bloquea.
 * Los demás fallan ABIERTO: el error se registra y el pipeline continúa.
 */
const { sanitizeModelOutput } = require('./outputSanitizer');

const STAGES = Object.freeze(['beforeChat', 'afterModel', 'onAction']);

class HookRegistry {
    constructor() { this.hooks = new Map(STAGES.map((s) => [s, []])); }

    register(stage, fn, { name = fn.name || 'anonymous', priority = 100, critical = false } = {}) {
        if (!this.hooks.has(stage)) throw new Error(`Etapa de hook desconocida: ${stage}`);
        if (typeof fn !== 'function') throw new TypeError('El hook debe ser una función');
        const list = this.hooks.get(stage);
        list.push({ name, fn, priority, critical });
        list.sort((a, b) => a.priority - b.priority); // estable: mismo priority = orden de registro
        return () => { const i = list.findIndex((h) => h.fn === fn); if (i >= 0) list.splice(i, 1); }; // unregister
    }

    list(stage) { return (this.hooks.get(stage) || []).map((h) => h.name); }

    async run(stage, ctx) {
        if (!this.hooks.has(stage)) throw new Error(`Etapa de hook desconocida: ${stage}`);
        let current = { ...ctx };
        for (const h of this.hooks.get(stage)) {
            try {
                const out = await h.fn({ ...current });
                if (out && typeof out === 'object') current = { ...current, ...out, principal: ctx.principal }; // el principal no se puede sustituir
            } catch (err) {
                if (h.critical || err.status) throw err; // bloqueo explícito ({status}) o guarda crítica
                console.warn(`⚠️ hook ${stage}/${h.name} falló: ${err.message}`);
            }
        }
        return current;
    }
}

const MAX_MESSAGE = 4000;

/** Hooks por defecto (los que activan la protección en el chat). */
function registerDefaultHooks(registry, { audit = () => {} } = {}) {
    // Guarda de entrada: normaliza y rechaza mensajes con caracteres de control o bytes nulos.
    registry.register('beforeChat', ({ message }) => {
        const clean = (typeof message === 'string' ? message : '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, '').trim();
        if (!clean) throw Object.assign(new Error('message es obligatorio'), { status: 400 });
        if (clean.length > MAX_MESSAGE) throw Object.assign(new Error(`Máximo ${MAX_MESSAGE} caracteres`), { status: 413 });
        return { message: clean };
    }, { name: 'inputGuard', priority: 10, critical: true });

    // Saneado de salida: sin imágenes, enlaces externos, HTML ni claves.
    registry.register('afterModel', ({ text }) => ({ text: sanitizeModelOutput(text) }), { name: 'outputSanitizer', priority: 10, critical: true });

    registry.register('onAction', (ctx) => audit(ctx), { name: 'actionAudit', priority: 100 });
    return registry;
}

module.exports = { HookRegistry, registerDefaultHooks, STAGES, MAX_MESSAGE };
