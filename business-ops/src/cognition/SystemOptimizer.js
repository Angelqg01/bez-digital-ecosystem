'use strict';

/**
 * SystemOptimizer — el agente que optimiza OPERANT a OPERANT.
 *
 * ── Qué lo diferencia del LearningEngine ────────────────────────────────────
 * `LearningEngine` mejora a CADA AGENTE: mina su memoria episódica y le destila
 * un playbook mejor. Es aprendizaje dentro del carril.
 *
 * Este optimiza EL SISTEMA: a qué departamento se enruta cada caso, con qué
 * modelo se resuelve, cuánta autonomía se concede y cada cuánto corre cada
 * trabajo programado. Son las decisiones que estaban escritas a mano en el
 * código y que, hasta ahora, solo cambiaban si alguien las cambiaba.
 *
 * ── Por qué dispara por señal y no por reloj ────────────────────────────────
 * Un cron diario tiene los dos defectos a la vez: gasta un ciclo completo de
 * análisis los días en que no pasó nada, y tarda hasta 24 h en reaccionar
 * cuando una regla de enrutado se rompe y todo cae al departamento por defecto.
 *
 * Aquí el reloj solo pregunta "¿hay bastante que mirar?" — que es una cuenta en
 * memoria, gratis. El ciclo caro corre cuando se cumple alguna de dos cosas:
 *
 *   1. Evidencia suficiente: bastantes tareas Y bastantes casos NUEVOS desde el
 *      último ciclo. El volumen solo no vale — 500 tareas idénticas no enseñan
 *      nada que no supiéramos ya.
 *   2. Urgencia: la tasa de fallo o de escalado se dispara. Ahí no se espera a
 *      juntar volumen; esperar es justamente lo que hace daño.
 *
 * Y siempre con un enfriado entre ciclos: sin él, un sistema que se optimiza a
 * sí mismo oscila — cambia un tier, ve ruido, lo revierte, vuelve a cambiarlo.
 *
 * ── Qué cuenta como "caso nuevo" ────────────────────────────────────────────
 * Dos señales, ambas baratas de medir:
 *   · el enrutado cayó al departamento por defecto (nadie reconoció el caso), y
 *   · la firma del caso (sus términos normalizados) no se había visto antes.
 * Es lo más cerca que se puede estar de "entró algo de fuera que no sabíamos
 * manejar" sin pedirle al modelo que opine sobre cada tarea.
 *
 * ── Qué se aplica solo y qué no ─────────────────────────────────────────────
 * Cada propuesta lleva un riesgo declarado. Las `safe` se aplican y se apuntan;
 * las `review` van a la cola humana. El criterio no es "cuánto cambia" sino
 * "qué pasa si me equivoco":
 *
 *   bajar autonomía        → safe   (más supervisión nunca hace daño)
 *   subir autonomía        → review (menos supervisión, decisión de negocio)
 *   bajar modelo interno   → safe   (ahorra; si la calidad cae, el ciclo lo ve)
 *   bajar modelo de cara al cliente → review (una propuesta comercial peor la
 *                                    lee un cliente antes que nuestro panel)
 *   subir modelo           → review (sube el coste que paga el cliente)
 *   añadir enrutado        → safe   (reversible y medible)
 *   espaciar un trabajo    → safe   (deja de gastar en vacío)
 *   apretar un trabajo     → review (más cómputo)
 *
 * ── Por qué mide antes de cambiar ───────────────────────────────────────────
 * Cada cambio aplicado guarda la métrica que lo justificó. El ciclo siguiente
 * la compara con la de ahora: si el cambio no mejoró lo que decía que iba a
 * mejorar, se propone revertirlo. Sin esa comparación esto no aprende, solo
 * deriva — y una deriva automática sobre la configuración de producción es
 * exactamente lo que nadie quiere.
 *
 * Todo cambio (aplicado o propuesto) entra en la cadena de auditoría del
 * tenant, que BeZhas ancla en L2. Las modificaciones que el sistema se hace a
 * sí mismo quedan notarizadas: es la diferencia entre "se optimiza solo" y
 * "se optimiza solo y puedes demostrar qué cambió, cuándo y por qué".
 */

const crypto = require('node:crypto');

/** Departamentos cuya salida la lee un cliente: bajarles el modelo no es inocuo. */
const CARA_AL_CLIENTE = new Set(['sales', 'marketing', 'fundraising']);

/** Orden de los tiers, de más capaz a menos. */
const TIERS = ['frontier', 'mid', 'fast'];

const DEFAULTS = {
    minTasks: 50,            // volumen mínimo desde el último ciclo
    minNovel: 8,             // casos nuevos mínimos: sin esto, solo es más de lo mismo
    cooldownMs: 6 * 60 * 60 * 1000,
    // Suelos de reloj. La señal decide CUÁNDO conviene mirar; estos garantizan
    // que se mire igualmente. Sin ellos había tres agujeros reales:
    //  · un tenant tranquilo no llega nunca al umbral y no se optimiza jamás,
    //  · un cambio aplicado se queda sin verificar para siempre si no vuelve a
    //    haber tráfico suficiente — y sin verificación esto no aprende,
    //  · hay deriva que no emite eventos (cambia el precio de un modelo, un
    //    trabajo programado deja de encontrar trabajo) y por tanto no da señal.
    verifyIntervalMs: 48 * 60 * 60 * 1000,   // con cambios sin verificar, se mira antes
    maxIntervalMs: 7 * 24 * 60 * 60 * 1000,  // latido de fondo pase lo que pase
    urgentFailureRate: 0.25, // 1 de cada 4 tareas falla → no se espera a juntar volumen
    urgentMinTasks: 15,      // ...pero con una muestra que signifique algo
    escalationCeiling: 0.45, // por encima, el departamento no está resolviendo solo
    approvalFloor: 0.9,      // aprobaciones humanas casi siempre "sí" → sobra fricción
    rejectionCeiling: 0.35,  // rechazos frecuentes → falta supervisión
    minPerDept: 12,          // muestra mínima por departamento antes de tocarle nada
};

const vacio = () => ({
    tasks: 0, failures: 0, retries: 0, escalations: 0,
    hitlApproved: 0, hitlRejected: 0,
    fallbackRoutes: 0,
    fallbackSamples: [],
    byDepartment: {},
    novelSignatures: [],
    since: new Date().toISOString(),
});

const deptVacio = () => ({ tasks: 0, failures: 0, escalations: 0, approved: 0, rejected: 0 });

class SystemOptimizer {
    /**
     * @param {object} ctx
     * @param {string} ctx.tenantId
     * @param {object} ctx.model         ModelGateway (para razonar sobre las anomalías)
     * @param {object} ctx.memory        MemoryManager (persistencia de evidencia y cambios)
     * @param {object} ctx.audit         AuditLog encadenado del tenant
     * @param {object} ctx.orchestrator  para leer/ajustar enrutado, tiers y agentes vivos
     * @param {object} [ctx.hitl]        cola humana para las propuestas de riesgo
     * @param {object} [ctx.learning]    LearningEngine, para re-destilar playbooks
     * @param {object} [ctx.scheduler]   para espaciar o apretar trabajos
     * @param {object} [ctx.autonomy]    dial de autonomía (SalesAutonomy)
     * @param {object} [ctx.thresholds]  sobreescribe DEFAULTS
     * @param {function} [ctx.now]       reloj inyectable (tests)
     */
    constructor(ctx = {}) {
        this.tenantId = ctx.tenantId;
        this.model = ctx.model;
        this.memory = ctx.memory;
        this.audit = ctx.audit;
        this.orchestrator = ctx.orchestrator;
        this.hitl = ctx.hitl || null;
        this.learning = ctx.learning || null;
        this.scheduler = ctx.scheduler || null;
        this.autonomy = ctx.autonomy || null;
        this.t = { ...DEFAULTS, ...(ctx.thresholds || {}) };
        this.now = ctx.now || (() => Date.now());

        this.evidence = vacio();
        this.lastCycleAt = null;
        // Referencia del latido cuando todavía no ha corrido ningún ciclo. Sin
        // esto, "nunca revisado" contaba como tiempo infinito y un tenant
        // recién dado de alta disparaba el latido en su primer minuto, con cero
        // datos que mirar. El reloj cuenta desde el alta, que es lo que
        // significa "hace N días que no se revisa esto".
        this.startedAt = new Date(this.now()).toISOString();
        this.lastCycle = null;
        this._seen = new Set();   // firmas de casos ya vistos (histórico)
        this._applied = [];       // cambios aplicados, con su métrica de partida
    }

    static get DEFAULTS() { return DEFAULTS; }

    // ── Persistencia ─────────────────────────────────────────────────────────

    /** Recupera evidencia, firmas conocidas y cambios aplicados tras un reinicio. */
    async hydrate() {
        if (!this.memory?.getFact) return false;
        const saved = await this.memory.getFact('optimizer:state').catch(() => null);
        if (!saved) return false;
        this.evidence = { ...vacio(), ...(saved.evidence || {}) };
        this.lastCycleAt = saved.lastCycleAt || null;
        // Si el reloj del latido se reiniciara en cada arranque, un servicio que
        // se despliega a menudo no alcanzaría nunca el suelo largo.
        this.startedAt = saved.startedAt || this.startedAt;
        this._seen = new Set(saved.seen || []);
        this._applied = saved.applied || [];
        return true;
    }

    async _persist() {
        if (!this.memory?.setFact) return;
        // Las firmas conocidas se recortan: son un filtro de novedad, no un
        // archivo histórico, y sin tope crecen sin final.
        const seen = [...this._seen].slice(-5_000);
        await this.memory.setFact('optimizer:state', {
            evidence: this.evidence,
            lastCycleAt: this.lastCycleAt,
            startedAt: this.startedAt,
            seen,
            applied: this._applied.slice(-50),
        }).catch(() => {});
    }

    // ── Observación ──────────────────────────────────────────────────────────

    /** Se engancha al bus del tenant. Todo lo que mide sale de eventos ya emitidos. */
    attach(bus) {
        if (!bus) return this;
        bus.on('task:queued', (t) => this.observe('queued', t));
        bus.on('task:completed', (t) => this.observe('completed', t));
        bus.on('task:failed', (t) => this.observe('failed', t));
        bus.on('task:retrying', (t) => this.observe('retrying', t));
        bus.on('hitl:pending', (a) => this.observe('hitl:pending', a));
        bus.on('hitl:resolved', (a) => this.observe('hitl:resolved', a));
        // `support:escalated` lo emite EscalationAgent y no incluye
        // departamento. Sin este relleno, el escalado subía el contador global
        // pero no el de soporte, y el optimizador leía "soporte lo resuelve
        // todo solo" justo cuando soporte estaba escalándolo todo. Se detectó
        // probando el ciclo contra el servicio real.
        bus.on('support:escalated', (e) => this.observe('escalated', { ...e, department: e?.department || 'support' }));
        return this;
    }

    /** Firma normalizada de un caso: sirve para saber si YA habíamos visto algo así. */
    static signature(input) {
        const texto = String(input?.payload?.text || input?.text || '')
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 3)
            .sort()
            .slice(0, 12)
            .join(' ');
        if (!texto) return null;
        return crypto.createHash('sha1').update(texto).digest('hex').slice(0, 16);
    }

    /** Acumula una observación. Barato a propósito: se llama en cada evento. */
    observe(kind, data = {}) {
        const e = this.evidence;
        const dept = data.department || data.dept || null;
        const d = dept ? (e.byDepartment[dept] ||= deptVacio()) : null;

        switch (kind) {
            case 'queued': {
                e.tasks++;
                if (d) d.tasks++;
                // El clasificador marca `fallback` cuando ninguna regla
                // reconoció el caso. Deducirlo aquí obligaba a reimplementar su
                // lógica, que es la clase de duplicado que se desincroniza.
                if (data.fallback === true) {
                    e.fallbackRoutes++;
                    const texto = String(data.payload?.text || '').slice(0, 300);
                    // Muestra acotada: el modelo necesita ejemplos, no el corpus.
                    if (texto && e.fallbackSamples.length < 40) e.fallbackSamples.push(texto);
                }
                const sig = SystemOptimizer.signature(data);
                if (sig && !this._seen.has(sig)) {
                    this._seen.add(sig);
                    if (!e.novelSignatures.includes(sig)) e.novelSignatures.push(sig);
                }
                break;
            }
            case 'failed':    e.failures++; if (d) d.failures++; break;
            case 'retrying':  e.retries++; break;
            case 'escalated': e.escalations++; if (d) d.escalations++; break;
            case 'hitl:resolved': {
                const ok = data.approved === true || data.decision === 'approve';
                if (ok) { e.hitlApproved++; if (d) d.approved++; }
                else { e.hitlRejected++; if (d) d.rejected++; }
                break;
            }
            default: break;
        }
        return this;
    }

    // ── Disparo ──────────────────────────────────────────────────────────────

    /**
     * ¿Merece la pena correr un ciclo? Es una cuenta en memoria: se puede
     * preguntar cada minuto sin coste.
     * @returns {{ready:boolean, reason:string, urgent:boolean, signal:object}}
     */
    readiness() {
        const e = this.evidence;
        const novel = e.novelSignatures.length;
        const failureRate = e.tasks ? e.failures / e.tasks : 0;
        const escalationRate = e.tasks ? e.escalations / e.tasks : 0;
        const signal = {
            tasks: e.tasks, novel, fallbackRoutes: e.fallbackRoutes,
            failureRate: +failureRate.toFixed(3),
            escalationRate: +escalationRate.toFixed(3),
            since: e.since,
        };

        // Dos relojes distintos a propósito:
        //  · el enfriado mide desde el ÚLTIMO CICLO — si no ha habido ninguno,
        //    no hay nada de lo que enfriarse;
        //  · el latido mide desde la última REVISIÓN, y para un tenant que
        //    nunca se revisó eso es su alta.
        const desdeCiclo = this.lastCycleAt ? this.now() - Date.parse(this.lastCycleAt) : Infinity;
        const desdeRevision = this.now() - Date.parse(this.lastCycleAt || this.startedAt);
        const enfriando = desdeCiclo < this.t.cooldownMs;

        // Urgencia: se salta el volumen, NUNCA el enfriado. Un sistema que se
        // reconfigura en bucle porque algo va mal empeora lo que ya iba mal.
        const urgente = e.tasks >= this.t.urgentMinTasks &&
            (failureRate >= this.t.urgentFailureRate || escalationRate >= this.t.urgentFailureRate);

        if (enfriando) {
            return { ready: false, urgent: urgente, reason: 'en enfriado desde el último ciclo', signal };
        }
        if (urgente) {
            return { ready: true, urgent: true, reason: 'tasa de fallo/escalado disparada', signal };
        }

        // Suelo corto: hay cambios aplicados esperando veredicto. Dejarlos sin
        // verificar es peor que no haberlos hecho — el bucle deja de aprender y
        // pasa a acumular decisiones que nadie ha comprobado.
        const sinVerificar = this._applied.filter((c) => !c.verified).length;
        if (sinVerificar > 0 && desdeRevision >= this.t.verifyIntervalMs) {
            return {
                ready: true, urgent: false, heartbeat: 'verify',
                reason: `${sinVerificar} cambio(s) sin verificar y ya toca comprobarlos`, signal,
            };
        }

        // Suelo largo: un tenant tranquilo nunca junta 50 tareas, y aun así su
        // configuración envejece. Esto es lo único que cubre la deriva que no
        // emite eventos.
        if (desdeRevision >= this.t.maxIntervalMs) {
            return {
                ready: true, urgent: false, heartbeat: 'max',
                reason: 'latido de fondo: demasiado tiempo sin revisar la configuración', signal,
            };
        }

        if (e.tasks < this.t.minTasks) {
            return { ready: false, urgent: false, reason: `faltan tareas (${e.tasks}/${this.t.minTasks})`, signal };
        }
        if (novel < this.t.minNovel) {
            return { ready: false, urgent: false, reason: `poca novedad (${novel}/${this.t.minNovel} casos nuevos)`, signal };
        }
        return { ready: true, urgent: false, reason: 'evidencia suficiente y casos nuevos', signal };
    }

    // ── Ciclo ────────────────────────────────────────────────────────────────

    /**
     * Analiza la evidencia, propone, aplica lo seguro y manda lo demás a HITL.
     * @param {{force?:boolean}} [opts]
     */
    async cycle({ force = false } = {}) {
        const r = this.readiness();
        if (!r.ready && !force) {
            return { ran: false, reason: r.reason, signal: r.signal };
        }

        const evidencia = this.evidence;
        const propuestas = [
            ...this._verificarCambiosPrevios(evidencia),
            ...this._proponerEnrutado(evidencia),
            ...this._proponerTiers(evidencia),
            ...this._proponerAutonomia(evidencia),
        ];

        // El modelo NO decide: comenta. Las propuestas salen de umbrales sobre
        // métricas, que son auditables y reproducibles; pedirle a un LLM que
        // reconfigure producción por su cuenta no es optimización, es azar caro.
        //
        // Y en un latido sin apenas datos no se le llama siquiera: pagar una
        // narración de "no ha pasado nada" cada semana y por tenant es
        // exactamente el desperdicio que justificaba no usar un cron.
        const merecePagarNarracion = evidencia.tasks >= this.t.minPerDept || propuestas.length > 0;
        const lectura = merecePagarNarracion ? await this._interpretar(evidencia, propuestas, r) : null;

        const aplicadas = [];
        const enRevision = [];
        for (const p of propuestas) {
            if (p.risk === 'safe') {
                const res = await this._aplicar(p, evidencia);
                (res.applied ? aplicadas : enRevision).push({ ...p, ...res });
            } else {
                await this._pedirAprobacion(p);
                enRevision.push({ ...p, queued: true });
            }
        }

        this.lastCycleAt = new Date(this.now()).toISOString();
        this.lastCycle = {
            at: this.lastCycleAt,
            trigger: r.urgent ? 'urgente'
                : r.heartbeat ? `reloj:${r.heartbeat}`
                : (force ? 'manual' : 'evidencia'),
            signal: r.signal,
            reading: lectura,
            applied: aplicadas,
            underReview: enRevision,
        };

        this.audit?.log({
            tenantId: this.tenantId,
            event: 'optimizer:cycle',
            trigger: this.lastCycle.trigger,
            signal: r.signal,
            applied: aplicadas.map((p) => p.id),
            underReview: enRevision.map((p) => p.id),
        });

        // La evidencia se reinicia: el próximo ciclo mide el efecto de estos
        // cambios, no vuelve a contar lo que ya los motivó.
        this.evidence = vacio();
        await this._persist();

        return { ran: true, ...this.lastCycle };
    }

    // ── Propuestas ───────────────────────────────────────────────────────────

    /**
     * ¿Los cambios del ciclo anterior hicieron lo que prometían? Si no, se
     * revierten. Esto es lo que convierte el bucle en aprendizaje.
     */
    _verificarCambiosPrevios(e) {
        const props = [];
        for (const cambio of this._applied.filter((c) => !c.verified)) {
            const d = e.byDepartment[cambio.department];
            if (!d || d.tasks < this.t.minPerDept) continue;   // sin muestra, no se juzga

            const ahora = cambio.metric === 'escalationRate'
                ? (d.tasks ? d.escalations / d.tasks : 0)
                : (d.tasks ? d.failures / d.tasks : 0);

            cambio.verified = true;
            cambio.after = +ahora.toFixed(3);

            // Margen del 20%: por debajo es ruido de muestra, no un empeoramiento.
            if (ahora > cambio.before * 1.2) {
                props.push({
                    id: `revert:${cambio.id}`,
                    kind: 'revert',
                    risk: 'safe',
                    department: cambio.department,
                    reason: `El cambio "${cambio.id}" prometía bajar ${cambio.metric} y subió de ` +
                        `${cambio.before} a ${ahora.toFixed(3)}. Se deshace.`,
                    revertOf: cambio,
                });
            }
        }
        return props;
    }

    /** Muchos casos cayendo al departamento por defecto = el enrutado no reconoce lo que entra. */
    _proponerEnrutado(e) {
        if (!e.tasks) return [];
        const tasa = e.fallbackRoutes / e.tasks;
        if (tasa < 0.15 || e.fallbackRoutes < 5) return [];
        return [{
            id: 'routing:learn-from-fallback',
            kind: 'routing',
            risk: 'safe',   // añadir una regla es reversible y se mide sola
            reason: `${e.fallbackRoutes} de ${e.tasks} casos (${Math.round(tasa * 100)}%) no los reconoció ` +
                `ninguna regla y acabaron en el departamento por defecto. Se extraen reglas de ` +
                `enrutado a partir de esos casos.`,
            fallbackRate: +tasa.toFixed(3),
            samples: e.fallbackSamples,
        }];
    }

    /**
     * Extrae reglas de enrutado de los casos que nadie reconoció.
     *
     * Aquí SÍ decide el modelo, y es la excepción deliberada al criterio de
     * "umbrales, no LLM": clasificar texto libre en un departamento es
     * exactamente lo que un modelo hace mejor que una lista de palabras. Lo que
     * NO se le deja es elegir el departamento libremente — solo puede repartir
     * entre los que este tenant tiene contratados, y cada regla que propone
     * queda apuntada con su origen para poder quitarla de una en una.
     */
    async _extraerReglas(samples) {
        if (!this.model || !this.orchestrator || !samples.length) return [];
        const disponibles = [...this.orchestrator.departments.keys()];
        if (!disponibles.length) return [];

        const out = await this.model.complete({
            tier: 'mid',
            system: 'Clasificas solicitudes de clientes en departamentos. Respondes SOLO con JSON ' +
                'válido, sin texto alrededor y sin bloques de código.',
            messages: [{
                role: 'user',
                content:
                    `Departamentos disponibles: ${disponibles.join(', ')}.\n\n` +
                    `Estas solicitudes no las reconoció ninguna regla de enrutado:\n` +
                    samples.map((t, i) => `${i + 1}. ${t}`).join('\n') +
                    `\n\nDevuelve un array JSON de como mucho 6 reglas nuevas, con la forma ` +
                    `[{"keyword":"término o frase en minúsculas","department":"uno de los disponibles"}]. ` +
                    `Usa términos que aparezcan literalmente en las solicitudes y que sean ` +
                    `inequívocos: si una palabra podría ser de dos departamentos, no la incluyas. ` +
                    `Si no hay ningún patrón claro, devuelve [].`,
            }],
            maxTokens: 400,
            meta: { tenantId: this.tenantId, agentId: 'cognition.optimizer' },
        });

        let propuestas;
        try {
            const limpio = String(out.text).replace(/```json?|```/g, '').trim();
            propuestas = JSON.parse(limpio.slice(limpio.indexOf('['), limpio.lastIndexOf(']') + 1));
        } catch {
            return [];   // el modelo no devolvió JSON: se descarta el ciclo de reglas
        }
        if (!Array.isArray(propuestas)) return [];

        // Filtro duro: solo departamentos que el tenant tiene, y nada de
        // términos de una sola letra o vacíos que enrutarían medio tráfico.
        return propuestas
            .filter((r) => r && typeof r.keyword === 'string' && disponibles.includes(r.department))
            .map((r) => ({ keyword: r.keyword.toLowerCase().trim(), department: r.department }))
            .filter((r) => r.keyword.length >= 4)
            .slice(0, 6);
    }

    /**
     * Un departamento que resuelve todo solo no necesita el modelo más caro;
     * uno que escala la mitad de los casos sí necesita más.
     */
    _proponerTiers(e) {
        const props = [];

        // Veto global. Un departamento no puede estar "resolviéndolo todo solo"
        // mientras el sistema entero escala o falla a mansalva: si los números
        // por departamento dicen eso, lo que está roto es la medición, no el
        // departamento. Bajar el modelo con esa lectura empeora justo lo que ya
        // iba mal, así que ante la contradicción no se toca nada a la baja.
        const escaladoGlobal = e.tasks ? e.escalations / e.tasks : 0;
        const falloGlobal = e.tasks ? e.failures / e.tasks : 0;
        const puedeBajar = escaladoGlobal < this.t.escalationCeiling &&
                           falloGlobal < this.t.urgentFailureRate;

        for (const [dept, d] of Object.entries(e.byDepartment)) {
            if (d.tasks < this.t.minPerDept) continue;
            const escalado = d.escalations / d.tasks;
            const fallo = d.failures / d.tasks;
            const actual = this._tierDe(dept);
            if (!actual) continue;

            // Resuelve solo y sin fallos → se puede bajar de modelo y ahorrar.
            if (puedeBajar && escalado < 0.1 && fallo < 0.05) {
                const siguiente = TIERS[Math.min(TIERS.indexOf(actual) + 1, TIERS.length - 1)];
                if (siguiente !== actual) {
                    props.push({
                        id: `tier:down:${dept}`,
                        kind: 'tier',
                        // Bajar el modelo de un departamento cuya salida lee un
                        // cliente no se decide solo por una métrica interna.
                        risk: CARA_AL_CLIENTE.has(dept) ? 'review' : 'safe',
                        department: dept,
                        from: actual, to: siguiente,
                        metric: 'escalationRate',
                        before: +escalado.toFixed(3),
                        reason: `${dept} resolvió ${d.tasks} tareas con ${Math.round(escalado * 100)}% de ` +
                            `escalado y ${Math.round(fallo * 100)}% de fallo. Baja de ${actual} a ${siguiente}.`,
                    });
                }
            }

            // Escala demasiado → el modelo se le queda corto.
            if (escalado > this.t.escalationCeiling) {
                const anterior = TIERS[Math.max(TIERS.indexOf(actual) - 1, 0)];
                if (anterior !== actual) {
                    props.push({
                        id: `tier:up:${dept}`,
                        kind: 'tier',
                        risk: 'review',   // sube el coste por tarea que paga el cliente
                        department: dept,
                        from: actual, to: anterior,
                        metric: 'escalationRate',
                        before: +escalado.toFixed(3),
                        reason: `${dept} escaló el ${Math.round(escalado * 100)}% de ${d.tasks} tareas. ` +
                            `Subir de ${actual} a ${anterior} debería reducirlo, a más coste por tarea.`,
                    });
                }
            }
        }
        return props;
    }

    /** El ratio de aprobaciones dice si sobra fricción o falta supervisión. */
    _proponerAutonomia(e) {
        const props = [];
        const total = e.hitlApproved + e.hitlRejected;
        if (total < this.t.minPerDept) return props;
        const tasaOk = e.hitlApproved / total;

        if (tasaOk >= this.t.approvalFloor) {
            props.push({
                id: 'autonomy:raise',
                kind: 'autonomy',
                risk: 'review',   // menos supervisión: decisión de negocio, no métrica
                reason: `De ${total} aprobaciones, se aprobó el ${Math.round(tasaOk * 100)}%. ` +
                    `La cola humana está haciendo de sello de goma: se propone subir el dial.`,
                approvalRate: +tasaOk.toFixed(3),
            });
        }
        if (1 - tasaOk >= this.t.rejectionCeiling) {
            props.push({
                id: 'autonomy:lower',
                kind: 'autonomy',
                risk: 'safe',     // más supervisión nunca hace daño
                reason: `Se rechazó el ${Math.round((1 - tasaOk) * 100)}% de ${total} aprobaciones. ` +
                    `Los agentes proponen cosas que no convencen: baja el dial hasta que mejore.`,
                rejectionRate: +(1 - tasaOk).toFixed(3),
            });
        }
        return props;
    }

    // ── Aplicación ───────────────────────────────────────────────────────────

    async _aplicar(p, evidencia) {
        try {
            switch (p.kind) {
                case 'routing': {
                    if (!this.orchestrator) return { applied: false, why: 'sin orquestador' };
                    const reglas = await this._extraerReglas(p.samples || []);
                    let n = 0;
                    for (const r of reglas) {
                        if (await this.orchestrator.learnRoute({ ...r, source: 'optimizer' })) n++;
                    }
                    // Además se re-destilan los playbooks: los casos nuevos son
                    // material de aprendizaje aunque no den una regla limpia.
                    if (this.learning) {
                        await this.learning.learnAll(this.orchestrator.agentIds()).catch(() => {});
                    }
                    return n > 0
                        ? { applied: true, detail: `${n} regla(s) de enrutado nuevas: ` + reglas.map((r) => `"${r.keyword}"→${r.department}`).join(', '), rules: reglas }
                        : { applied: false, why: 'ningún patrón inequívoco en los casos nuevos' };
                }
                case 'tier': {
                    const n = this._fijarTier(p.department, p.to);
                    if (!n) return { applied: false, why: 'departamento no encontrado' };
                    this._registrarCambio(p, evidencia);
                    return { applied: true, detail: `${n} agente(s) de ${p.department} → ${p.to}` };
                }
                case 'autonomy': {
                    if (!this.autonomy) return { applied: false, why: 'sin dial de autonomía' };
                    const actual = this.autonomy.level;
                    const orden = ['manual', 'assist', 'full_auto'];
                    const i = orden.indexOf(actual);
                    const destino = p.id === 'autonomy:lower' ? orden[Math.max(i - 1, 0)] : orden[Math.min(i + 1, 2)];
                    if (destino === actual) return { applied: false, why: `ya está en ${actual}` };
                    this.autonomy.set(destino, 'system-optimizer');
                    return { applied: true, detail: `autonomía ${actual} → ${destino}` };
                }
                case 'revert': {
                    const c = p.revertOf;
                    if (c.kind !== 'tier') return { applied: false, why: 'solo se revierten cambios de tier' };
                    const n = this._fijarTier(c.department, c.from);
                    return n
                        ? { applied: true, detail: `${c.department} devuelto a ${c.from}` }
                        : { applied: false, why: 'departamento no encontrado' };
                }
                default:
                    return { applied: false, why: `tipo desconocido: ${p.kind}` };
            }
        } catch (err) {
            // Un fallo aplicando NO puede tumbar el ciclo: el resto de
            // propuestas siguen siendo válidas.
            return { applied: false, why: err.message };
        }
    }

    /** Cambia el tier del manager y sus especialistas, en vivo y persistido. */
    _fijarTier(dept, tier) {
        const manager = this.orchestrator?.departments?.get(dept);
        if (!manager) return 0;
        let n = 0;
        if (manager.modelTier !== undefined) { manager.modelTier = tier; n++; }
        for (const esp of manager.specialists?.values() || []) { esp.modelTier = tier; n++; }
        // Persistido aparte para que sobreviva a un reinicio: los agentes se
        // reconstruyen al arrancar y volverían a su tier de fábrica.
        this.memory?.setFact?.(`optimizer:tier:${dept}`, tier).catch(() => {});
        return n;
    }

    _tierDe(dept) {
        const manager = this.orchestrator?.departments?.get(dept);
        if (!manager) return null;
        return manager.modelTier || manager.specialists?.values().next().value?.modelTier || null;
    }

    _registrarCambio(p, e) {
        const d = e.byDepartment[p.department] || deptVacio();
        this._applied.push({
            id: p.id, kind: p.kind, department: p.department,
            from: p.from, to: p.to,
            metric: p.metric || 'escalationRate',
            before: p.before ?? (d.tasks ? +(d.escalations / d.tasks).toFixed(3) : 0),
            at: new Date(this.now()).toISOString(),
            verified: false,
        });
    }

    /** Las propuestas de riesgo van a la misma cola humana que todo lo demás. */
    async _pedirAprobacion(p) {
        this.audit?.log({
            tenantId: this.tenantId, event: 'optimizer:proposal',
            proposal: p.id, risk: p.risk, reason: p.reason,
        });
        if (!this.hitl?.request) return false;
        // Sin await: la cola resuelve cuando un humano decide, y el ciclo no se
        // queda colgado esperando a que alguien mire el panel.
        this.hitl.request({
            tenantId: this.tenantId,
            agentId: 'cognition.optimizer',
            category: 'system_change',
            action: { tool: 'optimizer', method: 'apply', args: { proposalId: p.id } },
            reason: p.reason,
        }).then((decision) => {
            if (decision?.approved) return this._aplicar(p, this.evidence);
        }).catch(() => {});
        return true;
    }

    /** Lectura en lenguaje llano de lo observado. Acompaña, no decide. */
    async _interpretar(e, propuestas, r) {
        if (!this.model) return null;
        try {
            const out = await this.model.complete({
                tier: 'fast',
                system: 'Eres el ingeniero de fiabilidad de una plataforma de agentes IA. ' +
                    'Explicas en 3-4 líneas qué está pasando y por qué, sin adornos. ' +
                    'No propongas cambios: los cambios ya están decididos por umbrales.',
                messages: [{
                    role: 'user',
                    content:
                        `Señal del periodo: ${JSON.stringify(r.signal)}\n` +
                        `Por departamento: ${JSON.stringify(e.byDepartment)}\n` +
                        `Cambios que se van a hacer: ${propuestas.map((p) => p.id).join(', ') || '(ninguno)'}\n\n` +
                        `Resume el estado del sistema y qué habría que vigilar en el próximo ciclo.`,
                }],
                maxTokens: 300,
                meta: { tenantId: this.tenantId, agentId: 'cognition.optimizer' },
            });
            return out.text;
        } catch {
            return null;   // el ciclo vale igual sin la narración
        }
    }

    /** Estado para el panel y para el puente con BeZhas. */
    snapshot() {
        const r = this.readiness();
        return {
            tenantId: this.tenantId,
            readiness: r,
            thresholds: this.t,
            lastCycleAt: this.lastCycleAt,
            lastCycle: this.lastCycle,
            appliedChanges: this._applied.slice(-20),
            knownSignatures: this._seen.size,
        };
    }
}

module.exports = SystemOptimizer;
