'use strict';

/**
 * adminAutomation — el panel SuperAdmin pone a trabajar a OPERANT.
 *
 * Cada automatización une tres cosas:
 *   - una SECCIÓN del panel de admin (`section` = id de la pestaña),
 *   - una SEÑAL: un colector de solo lectura que mide algo real (compras sin
 *     asignar, suscripciones en mora, cobertura del RAG, informes DMARC…),
 *   - una TAREA para un departamento de OPERANT, que se lanza únicamente si la
 *     señal lo pide.
 *
 * Reglas, y por qué:
 *   - Los colectores miden AGREGADOS (recuentos, tasas, antigüedades). Nunca
 *     emails de clientes, texto de conversaciones ni contenido de correos: la
 *     política del RAG es no leer ni guardar lo que escribe la gente, y la
 *     tarea que recibe OPERANT sale de esas cifras, no de datos personales.
 *   - Una señal que no se puede medir se declara `available: false` con el
 *     motivo. Nunca se rellena con un valor por defecto: "todo bien" inventado
 *     es peor que "no lo sé".
 *   - Mismo problema, misma tarea una sola vez: la huella de las métricas
 *     (`fingerprint`) más un enfriamiento evitan que un tick cada hora cree
 *     veinticuatro tareas idénticas al día.
 *   - Lo que la tarea haga fuera (enviar un correo, mover dinero, tocar un
 *     contrato) lo frenan las líneas rojas y la cola de aprobación de OPERANT,
 *     no el texto de este fichero. Aquí solo se pide trabajo.
 */

const crypto = require('crypto');

const COOLDOWN_MS = (Number(process.env.ADMIN_AUTOMATION_COOLDOWN_HOURS) || 24) * 3_600_000;

const huella = (obj) => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const horas = (ms) => Math.round((ms / 3_600_000) * 10) / 10;

/** Ejecuta una consulta de solo lectura; si la tabla o columna no existe, lo dice. */
async function consulta(query, sql, params = []) {
    try {
        return { rows: (await query(sql, params)).rows };
    } catch (err) {
        return { error: `consulta no disponible (${err.code || err.message})` };
    }
}

const noDisponible = (reason) => ({ available: false, attention: false, summary: reason, metrics: {}, fingerprint: null });

/**
 * Catálogo. `collect(deps)` devuelve { available, attention, summary, metrics, fingerprint, input? }.
 * `input` es el texto que recibirá el departamento (solo cifras agregadas).
 */
const CATALOG = [
    {
        id: 'pending-plan-assignments',
        section: 'ecosystem',
        department: 'support',
        title: 'Compras de plan sin asignar',
        description: 'Clientes que ya pagaron un plan y siguen sin tenerlo asignado a una app.',
        async collect({ query, now }) {
            const r = await consulta(query, "SELECT COUNT(*)::int AS n, MIN(created_at) AS desde FROM plan_purchases WHERE status = 'pending_assignment'");
            if (r.error) return noDisponible(r.error);
            const { n, desde } = r.rows[0] || { n: 0 };
            const espera = desde ? now - new Date(desde).getTime() : 0;
            const metrics = { pendientes: n, esperaMaximaHoras: horas(espera) };
            return {
                available: true, attention: n > 0, metrics,
                summary: n ? `${n} compra(s) pagada(s) sin asignar; la más antigua espera ${horas(espera)} h.` : 'Ninguna compra pendiente de asignar.',
                fingerprint: huella({ n }),
                input: `Hay ${n} compra(s) de plan ya pagadas sin asignar a una app; la más antigua espera ${horas(espera)} horas. `
                    + 'Prepara, para cada caso, el mensaje de bienvenida con los pasos para activar su plan y deja los borradores en cola de aprobación. No envíes nada sin aprobación humana.',
            };
        },
    },
    {
        id: 'past-due-subscriptions',
        section: 'treasury',
        department: 'finance',
        title: 'Suscripciones en mora',
        description: 'Planes con el pago vencido, por tipo de plan.',
        async collect({ query }) {
            const r = await consulta(query, "SELECT plan_id, COUNT(*)::int AS n FROM gateway_subscriptions WHERE status = 'past_due' GROUP BY plan_id ORDER BY n DESC");
            if (r.error) return noDisponible(r.error);
            const porPlan = Object.fromEntries(r.rows.map((x) => [x.plan_id, x.n]));
            const total = r.rows.reduce((a, x) => a + x.n, 0);
            return {
                available: true, attention: total > 0, metrics: { total, porPlan },
                summary: total ? `${total} suscripción(es) en mora (${Object.entries(porPlan).map(([p, n]) => `${p}: ${n}`).join(', ')}).` : 'Sin suscripciones en mora.',
                fingerprint: huella(porPlan),
                input: `Hay ${total} suscripción(es) en mora (${JSON.stringify(porPlan)}). `
                    + 'Prepara el recordatorio de cobro para cada plan afectado, con tono cordial y el enlace de pago, como borrador para aprobar. No contactes a nadie sin aprobación.',
            };
        },
    },
    {
        id: 'failed-payments',
        section: 'treasury',
        department: 'finance',
        title: 'Pagos fallidos recientes',
        description: 'Compras o pagos que han fallado en los últimos 7 días.',
        async collect({ query }) {
            const r = await consulta(query, "SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_usd), 0)::float AS usd FROM payment_transactions WHERE status = 'failed' AND created_at > NOW() - INTERVAL '7 days'");
            if (r.error) return noDisponible(r.error);
            const { n, usd } = r.rows[0] || { n: 0, usd: 0 };
            return {
                available: true, attention: n >= 3, metrics: { fallidos7d: n, importeUsd: Math.round(usd * 100) / 100 },
                summary: `${n} pago(s) fallido(s) en 7 días (${usd.toFixed(2)} USD)${n >= 3 ? ': por encima del umbral de 3.' : '.'}`,
                fingerprint: huella({ n }),
                input: `En los últimos 7 días han fallado ${n} pagos por un total de ${usd.toFixed(2)} USD. `
                    + 'Analiza si hay un patrón (método, importe, hora) y propón una causa probable y los pasos para corregirla. Solo análisis y recomendaciones.',
            };
        },
    },
    {
        id: 'stuck-onboarding',
        section: 'ecosystem',
        department: 'support',
        title: 'Altas atascadas',
        description: 'Sesiones de alta que llevan más de 3 días sin completarse.',
        async collect({ query }) {
            const r = await consulta(query, "SELECT kind, COUNT(*)::int AS n FROM onboarding_sessions WHERE status IN ('pendiente', 'en_curso') AND created_at < NOW() - INTERVAL '3 days' AND expires_at > NOW() GROUP BY kind");
            if (r.error) return noDisponible(r.error);
            const porTipo = Object.fromEntries(r.rows.map((x) => [x.kind, x.n]));
            const total = r.rows.reduce((a, x) => a + x.n, 0);
            return {
                available: true, attention: total > 0, metrics: { total, porTipo },
                summary: total ? `${total} alta(s) atascada(s) (${Object.entries(porTipo).map(([k, n]) => `${k}: ${n}`).join(', ')}).` : 'Ninguna alta atascada.',
                fingerprint: huella(porTipo),
                input: `Hay ${total} alta(s) sin completar desde hace más de 3 días, por tipo: ${JSON.stringify(porTipo)}. `
                    + 'Redacta la plantilla de mensaje de ayuda para cada tipo y sugiere en qué paso suelen atascarse. Borradores para aprobar.',
            };
        },
    },
    {
        id: 'rag-coverage',
        section: 'intelligence',
        department: 'support',
        title: 'Cobertura del asistente (RAG)',
        description: 'Proporción de preguntas del chat que no encuentran documentación suficiente.',
        async collect({ metricValues }) {
            const valores = await metricValues('bezhas_ai_retrieval_total');
            if (!valores) return noDisponible('métrica del RAG no disponible en esta instancia');
            const c = { hit: 0, weak: 0, none: 0 };
            for (const v of valores) if (v.labels?.resultado in c) c[v.labels.resultado] += v.value;
            const total = c.hit + c.weak + c.none;
            if (total < 20) {
                return { available: true, attention: false, metrics: { ...c, total }, summary: `Solo ${total} consultas medidas en esta instancia: muestra insuficiente (mínimo 20).`, fingerprint: null };
            }
            const sinCobertura = (c.weak + c.none) / total;
            const attention = sinCobertura >= 0.25;
            return {
                available: true, attention,
                metrics: { ...c, total, sinCoberturaPct: Math.round(sinCobertura * 1000) / 10 },
                summary: `${(sinCobertura * 100).toFixed(1)}% de ${total} consultas sin cobertura suficiente (${c.weak} débiles, ${c.none} sin fuentes).`,
                // Redondeo a 5 puntos: no se crea una tarea nueva por cada décima que se mueva.
                fingerprint: huella({ tramo: Math.round(sinCobertura * 20) }),
                input: `El asistente no encuentra documentación suficiente en el ${(sinCobertura * 100).toFixed(1)}% de ${total} consultas (${c.weak} débiles, ${c.none} sin fuentes). `
                    + 'Revisa la base de conocimiento pública frente al catálogo de planes y SubApps, lista qué temas probablemente faltan y redacta borradores de documentos públicos para aprobar. No hay texto de usuarios: razona solo desde el catálogo.',
            };
        },
    },
    {
        id: 'dmarc-health',
        section: 'identity',
        department: 'operations',
        title: 'Autenticación del correo (DMARC)',
        description: 'Remitentes que usan bezhas.com y no pasan DMARC.',
        async collect({ operant }) {
            let d;
            try { d = await operant.mailboxDmarc({ tenantId: process.env.BEZHAS_TENANT_ID || 'bezhas', days: 14 }); }
            catch (err) { return noDisponible(`digest DMARC no disponible: ${err.message}`); }
            const fallan = (d.failing || []).slice(0, 5).map((s) => ({ origen: s.label, mensajes: s.fail }));
            return {
                available: true, attention: d.fail > 0, metrics: { informes: d.reports, mensajes: d.messages, noPasan: d.fail, politica: d.policy },
                summary: d.fail ? `${d.fail} de ${d.messages} mensajes no pasan DMARC; ${d.recommendation?.text || ''}` : `Todo el tráfico informado pasa DMARC (${d.messages} mensajes).`,
                fingerprint: huella((d.failing || []).map((s) => s.sourceIp).sort()),
                input: `Los informes DMARC de 14 días muestran ${d.fail} de ${d.messages} mensajes que no pasan, desde estos orígenes: ${JSON.stringify(fallan)}. `
                    + 'Distingue reenvíos legítimos (SPF roto al reenviar) de posibles suplantaciones y propón los cambios de SPF/DKIM necesarios. Solo recomendaciones: el DNS lo cambia una persona.',
            };
        },
    },
    {
        id: 'operant-failures',
        section: 'watchdog',
        department: 'operations',
        title: 'Tareas fallidas de OPERANT',
        description: 'Tareas recientes que fallaron, se interrumpieron o agotaron reintentos.',
        async collect({ operant }) {
            let o;
            try { o = await operant.tenantDashboard({ tenantId: process.env.BEZHAS_TENANT_ID || 'bezhas' }); }
            catch (err) { return noDisponible(`OPERANT no disponible: ${err.message}`); }
            const malas = (o.tasks || []).filter((t) => ['failed', 'interrupted'].includes(t.status) || t.deadLetter);
            return {
                available: true, attention: malas.length > 0,
                metrics: { recientes: (o.tasks || []).length, fallidas: malas.length },
                summary: malas.length ? `${malas.length} de las últimas ${(o.tasks || []).length} tareas fallaron o se interrumpieron.` : 'Las tareas recientes terminaron bien.',
                fingerprint: huella(malas.map((t) => t.id).sort()),
                input: `${malas.length} tareas recientes fallaron o se interrumpieron: ${JSON.stringify(malas.map((t) => ({ id: t.id, departamento: t.department, tipo: t.type, estado: t.status, deadLetter: !!t.deadLetter })))}. `
                    + 'Diagnostica la causa probable de cada una y di cuáles son seguras de reintentar (las que ya tuvieron efecto externo no lo son).',
            };
        },
    },
    {
        id: 'audit-chain',
        section: 'governance',
        department: 'legal',
        title: 'Integridad de la auditoría',
        description: 'Verificación de la cadena de hashes de la auditoría de OPERANT.',
        async collect({ operant }) {
            let a;
            try { a = await operant.auditVerify({ tenantId: process.env.BEZHAS_TENANT_ID || 'bezhas' }); }
            catch (err) { return noDisponible(`verificación no disponible: ${err.message}`); }
            const valida = a.valid ?? a.ok;
            return {
                available: true, attention: valida === false, metrics: { valida: valida !== false },
                summary: valida === false ? 'La cadena de auditoría NO es íntegra.' : 'La cadena de auditoría es íntegra.',
                fingerprint: huella({ valida: valida !== false, detalle: a.brokenAt ?? null }),
                input: 'La verificación de la cadena de auditoría de OPERANT ha encontrado una discrepancia. '
                    + 'Redacta el informe de incidente (qué se detectó, impacto posible sobre el cumplimiento y pasos de contención) como borrador para el responsable legal.',
            };
        },
    },
];

function crearAdminAutomation({ query, operant, metricValues, knowledgeStore, now = () => Date.now() } = {}) {
    const tenantId = () => process.env.BEZHAS_TENANT_ID || 'bezhas';
    const deps = () => ({ query, operant, metricValues, now: now() });

    const porId = (id) => CATALOG.find((a) => a.id === id);

    async function evaluar(def) {
        let s;
        try { s = await def.collect(deps()); } catch (err) { s = noDisponible(`error al medir: ${err.message}`); }
        return s;
    }

    /**
     * Última acción registrada de una automatización (para el enfriamiento y
     * para mostrarla). Devuelve { error } si el registro no se puede leer.
     */
    async function ultima(id) {
        const r = await consulta(query, "SELECT status, task_id, fingerprint, created_at FROM admin_automation_runs WHERE kind = 'run' AND automation_id = $1 AND status = 'dispatched' ORDER BY created_at DESC LIMIT 1", [id]);
        if (r.error) return { error: r.error };
        return r.rows[0] || null;
    }

    async function registrar({ kind, automationId = null, fingerprint = null, actor, status, taskId = null, detail = {} }) {
        const r = await consulta(query,
            'INSERT INTO admin_automation_runs (kind, automation_id, fingerprint, actor, status, task_id, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [kind, automationId, fingerprint, actor, status, taskId, JSON.stringify(detail)]);
        return !r.error;
    }

    /** Catálogo con la señal actual de cada automatización. Sin efectos. */
    async function listar() {
        return Promise.all(CATALOG.map(async (def) => {
            const [s, u] = await Promise.all([evaluar(def), ultima(def.id)]);
            return {
                id: def.id, section: def.section, department: def.department, title: def.title, description: def.description,
                available: s.available, attention: s.attention, summary: s.summary, metrics: s.metrics,
                lastRun: u && !u.error ? { at: u.created_at, taskId: u.task_id } : null,
            };
        }));
    }

    /**
     * Mide y, si la señal lo pide, lanza la tarea a OPERANT.
     * @param {string} id
     * @param {{actor: string, force?: boolean}} o
     */
    async function ejecutar(id, { actor, force = false }) {
        const def = porId(id);
        if (!def) return { id, status: 'unknown' };
        const s = await evaluar(def);
        if (!s.available) return { id, status: 'unavailable', reason: s.summary };
        if (!s.attention && !force) return { id, status: 'skipped', reason: 'la señal no pide acción', summary: s.summary };

        // Sin registro no hay ni enfriamiento ni auditoría: lanzar tareas sin
        // poder saber si ya se lanzaron (ni quién las lanzó) las duplicaría en
        // cada tick. Se niega, también con force, y se dice por qué.
        const previa = await ultima(id);
        if (previa?.error) return { id, status: 'unavailable', reason: `registro de automatizaciones no disponible (¿migración 068?): ${previa.error}` };
        if (!force && s.fingerprint && previa && previa.fingerprint === s.fingerprint && now() - new Date(previa.created_at).getTime() < COOLDOWN_MS) {
            return { id, status: 'duplicate', reason: 'ya se lanzó una tarea por esta misma señal', taskId: previa.task_id, summary: s.summary };
        }

        const input = s.input || `Revisa: ${s.summary}`;
        const r = await operant.dispatchTask({
            tenantId: tenantId(), department: def.department, input, async: true,
            context: { channel: 'admin-automation', automationId: id, section: def.section },
        });
        const audited = await registrar({ kind: 'run', automationId: id, fingerprint: s.fingerprint, actor, status: 'dispatched', taskId: r.taskId, detail: { department: def.department, metrics: s.metrics, forced: force } });
        return { id, status: 'dispatched', taskId: r.taskId, department: def.department, summary: s.summary, audited };
    }

    /** Evalúa todo y lanza lo que toque. Es lo que llama el programador (Cloud Scheduler). */
    async function tick({ actor = 'scheduler' } = {}) {
        const resultados = [];
        for (const def of CATALOG) {
            try { resultados.push(await ejecutar(def.id, { actor })); }
            catch (err) { resultados.push({ id: def.id, status: 'error', reason: err.message }); }
        }
        return resultados;
    }

    /** Resuelve una aprobación de OPERANT desde el panel, dejando constancia de quién fue. */
    async function resolverAprobacion({ approvalId, decision, reason, actor }) {
        if (!['approve', 'reject'].includes(decision)) {
            const e = new Error('decision debe ser approve o reject'); e.status = 400; throw e;
        }
        const r = await operant.resolveApproval({ tenantId: tenantId(), approvalId, decision, reason: reason || undefined, approver: `admin:${actor}` });
        await registrar({ kind: 'resolve', actor, status: decision, detail: { approvalId } });
        return r;
    }

        /**
     * Copia a la base de conocimiento de OPERANT la documentación PÚBLICA del
     * RAG, para que Soporte conteste con la misma verdad que el chat. Solo
     * documentos globales, publicados y clasificados PUBLIC: nada de tenants ni
     * de contenido interno. Idempotente: OPERANT reemplaza por id (`rag:<id>`).
     */
    async function sincronizarConocimiento({ actor }) {
        if (!knowledgeStore) { const e = new Error('almacén de conocimiento no disponible'); e.status = 503; throw e; }
        const chunks = await knowledgeStore.chunksVisibles(null);
        const docs = new Map();
        for (const c of chunks) {
            if (c.tenant_id || c.classification !== 'PUBLIC' || c.status !== 'published') continue;
            const d = docs.get(c.document_id) || { id: c.document_id, title: c.title, partes: [] };
            d.partes.push([c.chunk_index, c.content]);
            docs.set(c.document_id, d);
        }
        let enviados = 0; const fallos = [];
        for (const d of docs.values()) {
            const body = d.partes.sort((a, b) => a[0] - b[0]).map((p) => p[1]).join('\n\n');
            try {
                await operant.kbIngest({ tenantId: tenantId(), id: `rag:${d.id}`, title: d.title, body, tags: ['rag', 'publico'] });
                enviados += 1;
            } catch (err) { fallos.push({ id: d.id, error: err.message }); }
        }
        await registrar({ kind: 'kb_sync', actor, status: fallos.length ? 'partial' : 'ok', detail: { documentos: docs.size, enviados, fallos: fallos.length } });
        return { documentos: docs.size, enviados, fallos };
    }

    return { sincronizarConocimiento, catalog: CATALOG.map(({ id, section, department, title }) => ({ id, section, department, title })), listar, ejecutar, tick, resolverAprobacion, registrar, evaluar, porId };
}

module.exports = { crearAdminAutomation, CATALOG, COOLDOWN_MS };
