'use strict';

/**
 * Telemetry — observabilidad en proceso, con forma OpenTelemetry (para exportar
 * a OTel/SigNoz más adelante sin cambiar quién la alimenta).
 *
 * Tres señales:
 *   - CONTADORES: tareas por estado/departamento, llamadas al modelo por tier,
 *     tokens, HITL (pendientes/aprobadas/rechazadas), errores.
 *   - HISTOGRAMA de latencia (tarea y modelo): count/sum/min/max + buckets.
 *   - TRAZAS: ring buffer de las últimas tareas con su duración por tenant.
 *
 * Observación pasiva: se suscribe al bus de cada tenant y a onUsage del gateway;
 * nunca toca el flujo. Se expone en formato Prometheus (/metrics) y como snapshot.
 */
const LAT_BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000];

class Telemetry {
  constructor({ clock = () => Date.now(), maxTraces = 200 } = {}) {
    this.clock = clock;
    this.maxTraces = maxTraces;
    this._counters = new Map();       // "name{labels}" -> number
    this._gauges = new Map();         // "name{labels}" -> number (puede bajar)
    this._hist = new Map();           // name -> { count, sum, min, max, buckets:{le->n} }
    this._traces = [];                // [{ tenantId, taskId, department, type, status, ms, at }]
    // taskId -> waitedMs ya observado. Acotado para que una instancia larga no
    // acumule una entrada por cada tarea que haya pasado por HITL.
    this._hitlSeen = new Map();
    this._startedAt = clock();
  }

  // ── Primitivas ────────────────────────────────────────────────
  inc(name, labels = {}, by = 1) {
    const key = Telemetry._key(name, labels);
    this._counters.set(key, (this._counters.get(key) || 0) + by);
  }

  /**
   * Gauge: a diferencia de un contador, puede bajar. Necesario para "cuántas
   * aprobaciones hay ahora mismo en la bandeja", que es la señal de si la
   * supervisión humana se está convirtiendo en el cuello de botella.
   */
  _gauge(name, labels = {}, by = 1) {
    const key = Telemetry._key(name, labels);
    const next = Math.max(0, (this._gauges.get(key) || 0) + by);
    this._gauges.set(key, next);
    if (this._hitlSeen.size > 5000) this._hitlSeen.clear();
  }

  observe(name, value) {
    let h = this._hist.get(name);
    if (!h) { h = { count: 0, sum: 0, min: Infinity, max: -Infinity, buckets: {} }; this._hist.set(name, h); }
    h.count++; h.sum += value;
    h.min = Math.min(h.min, value); h.max = Math.max(h.max, value);
    for (const le of LAT_BUCKETS) if (value <= le) h.buckets[le] = (h.buckets[le] || 0) + 1;
  }

  // ── Fuentes de datos ──────────────────────────────────────────

  /** Suscribe la telemetría al bus de un tenant (en el aprovisionamiento). */
  attach(bus, tenantId) {
    if (!bus) return;
    bus.on('task:queued', () => this.inc('operant_tasks_total', { tenant: tenantId, status: 'queued' }));
    bus.on('task:completed', (t) => this._onTask(tenantId, t, 'completed'));
    bus.on('task:failed', (t) => this._onTask(tenantId, t, 'failed'));
    bus.on('hitl:pending', () => this.inc('operant_hitl_total', { tenant: tenantId, state: 'pending' }));
    bus.on('hitl:resolved', (e) => this.inc('operant_hitl_total', { tenant: tenantId, state: e?.approved ? 'approved' : 'rejected' }));

    // ── Coste de la supervisión humana ──────────────────────────
    //
    // `operant_task_duration_ms` mide el trabajo del AGENTE: descuenta a
    // propósito el tiempo que la tarea pasó esperando a una persona
    // (Orchestrator.elapsed()). Eso está bien para medir rendimiento, pero
    // deja fuera el término que decide si la automatización sale a cuenta:
    //
    //     ahorro_neto = ahorro_bruto − coste_supervisión_humana
    //     coste_supervisión = nº aprobaciones × minutos por decisión × coste/hora
    //
    // Sin estas series ese término no se puede calcular y todo cálculo de
    // retorno queda en bruto. Vivían sólo en memoria y se perdían al
    // reiniciar; aquí pasan a ser observables.
    bus.on('task:awaiting_approval', () => {
      this.inc('operant_hitl_requests_total', { tenant: tenantId });
      this._gauge('operant_hitl_in_flight', { tenant: tenantId }, +1);
    });

    bus.on('task:resumed', (t) => {
      this._gauge('operant_hitl_in_flight', { tenant: tenantId }, -1);
      // Espera de ESTE tramo: waitedMs es acumulado, así que se resta lo ya
      // observado para no contar dos veces una tarea aprobada varias veces.
      const total = typeof t?.waitedMs === 'number' ? t.waitedMs : null;
      if (total != null) {
        const seen = this._hitlSeen.get(t.id) || 0;
        const delta = Math.max(0, total - seen);
        this._hitlSeen.set(t.id, total);
        this.observe('operant_hitl_wait_ms', delta);
      }
    });

    // Reintentos: hasta ahora sólo quedaban en el log de auditoría, así que
    // no había forma de saber si el sistema reintenta mucho sin leer texto.
    bus.on('task:retrying', (t) => {
      this.inc('operant_task_retries_total', {
        tenant: tenantId,
        department: t?.department || 'unknown',
      });
    });

    // Dead-letter: una tarea que agotó sus reintentos. AlertRules ya la
    // contaba recorriendo la ventana caliente en RAM; como contador
    // monotónico sobrevive a la poda y al reinicio.
    bus.on('task:failed', (t) => {
      if (t?.deadLetter) {
        this.inc('operant_dead_letter_total', {
          tenant: tenantId,
          department: t?.department || 'unknown',
        });
      }
    });
    bus.on('support:escalated', () => this.inc('operant_support_escalations_total', { tenant: tenantId }));
    bus.on('agent:tool-call', (e) => this.inc('operant_tool_calls_total', { tenant: tenantId, tool: e?.tool || 'unknown', status: e?.status || 'executed' }));
  }

  _onTask(tenantId, task, status) {
    const dept = task?.department || 'unknown';
    this.inc('operant_tasks_total', { tenant: tenantId, status, department: dept });
    if (status === 'failed') this.inc('operant_errors_total', { tenant: tenantId, department: dept });
    const ms = typeof task?.ms === 'number' ? task.ms : this._latency(task);
    if (ms != null) {
      this.observe('operant_task_duration_ms', ms);
      this._pushTrace({ tenantId, taskId: task.id, department: dept, type: task.type, status, ms, at: new Date(this.clock()).toISOString() });
    }
  }

  /** Alimenta métricas del modelo desde ModelGateway.onUsage. */
  recordModel(u = {}) {
    const tenant = u.meta?.tenantId || 'unknown';
    this.inc('operant_model_calls_total', { tenant, tier: u.tier || 'unknown', simulated: String(!!u.simulated) });
    const inTok = u.usage?.inputTokens || 0, outTok = u.usage?.outputTokens || 0;
    if (inTok) this.inc('operant_model_input_tokens_total', { tenant, tier: u.tier || 'unknown' }, inTok);
    if (outTok) this.inc('operant_model_output_tokens_total', { tenant, tier: u.tier || 'unknown' }, outTok);
    if (typeof u.latencyMs === 'number') this.observe('operant_model_latency_ms', u.latencyMs);
    if (u.fallback) this.inc('operant_model_fallback_total', { tenant, tier: u.tier || 'unknown' });
  }

  _latency(task) {
    const start = task?.startedAt || (task?.createdAt && Date.parse(task.createdAt));
    return start && !Number.isNaN(start) ? Math.max(0, this.clock() - start) : null;
  }

  _pushTrace(trace) {
    this._traces.push(trace);
    if (this._traces.length > this.maxTraces) this._traces.shift();
  }

  /** Últimas trazas de un tenant (más reciente primero). */
  traces(tenantId, n = 25) {
    return this._traces.filter((t) => t.tenantId === tenantId).slice(-n).reverse();
  }

  // ── Exposición ────────────────────────────────────────────────

  /** Snapshot JSON (para el panel/admin). */
  snapshot() {
    const counters = {};
    for (const [k, v] of this._counters) counters[k] = v;
    const histograms = {};
    for (const [k, h] of this._hist) {
      histograms[k] = { count: h.count, avg: h.count ? Math.round(h.sum / h.count) : 0, min: h.count ? h.min : 0, max: h.count ? h.max : 0 };
    }
    const gauges = {};
    for (const [k, v] of this._gauges) gauges[k] = v;
    return { uptimeMs: this.clock() - this._startedAt, counters, gauges, histograms };
  }

  /** Texto en formato Prometheus (GET /metrics). */
  prometheus() {
    const lines = [];
    const byName = new Map();
    for (const [key, val] of this._counters) {
      const name = key.split('{')[0];
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push([key, val]);
    }
    for (const [name, series] of byName) {
      lines.push(`# TYPE ${name} counter`);
      for (const [key, val] of series) lines.push(`${key} ${val}`);
    }
    const gaugesByName = new Map();
    for (const [key, val] of this._gauges) {
      const name = key.split('{')[0];
      if (!gaugesByName.has(name)) gaugesByName.set(name, []);
      gaugesByName.get(name).push([key, val]);
    }
    for (const [name, series] of gaugesByName) {
      lines.push(`# TYPE ${name} gauge`);
      for (const [key, val] of series) lines.push(`${key} ${val}`);
    }
    for (const [name, h] of this._hist) {
      lines.push(`# TYPE ${name} histogram`);
      let cum = 0;
      for (const le of LAT_BUCKETS) { cum = h.buckets[le] || cum; lines.push(`${name}_bucket{le="${le}"} ${cum}`); }
      lines.push(`${name}_bucket{le="+Inf"} ${h.count}`);
      lines.push(`${name}_sum ${h.sum}`);
      lines.push(`${name}_count ${h.count}`);
    }
    return lines.join('\n') + '\n';
  }

  static _key(name, labels) {
    const l = Object.entries(labels).map(([k, v]) => `${k}="${String(v).replace(/"/g, '')}"`).join(',');
    return l ? `${name}{${l}}` : name;
  }
}

module.exports = Telemetry;
