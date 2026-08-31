'use strict';

/**
 * OtlpExporter — empuja las métricas de `Telemetry` a un backend OpenTelemetry
 * (SigNoz, Grafana Alloy, OTel Collector, Jaeger…) por OTLP/HTTP+JSON.
 *
 * Por qué JSON y no protobuf: OTLP/HTTP acepta ambos y el JSON no necesita
 * ninguna dependencia. Este proyecto ya evita dependencias en las piezas de
 * infraestructura (ver bezhas-wallet-auth, SqliteStore con node:sqlite), y un
 * exportador que arrastre `@opentelemetry/*` entero para mandar cuatro
 * contadores no compensa.
 *
 * Modelo push, no pull: `/metrics` (Prometheus) sigue existiendo para quien
 * prefiera scrapear. Esto es para el caso contrario — un colector central al
 * que varios nodos empujan.
 *
 * Sin `OTEL_EXPORTER_OTLP_ENDPOINT` no hace nada (igual que el resto de
 * conectores sin credenciales): no arranca temporizador ni intenta red.
 */

// Mismos buckets que Telemetry (LAT_BUCKETS). Si allí cambian, aquí también.
const LAT_BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000];

class OtlpExporter {
  /**
   * @param {object} opts
   * @param {object} opts.telemetry     - instancia de Telemetry (fuente)
   * @param {string} opts.endpoint      - p.ej. http://localhost:4318 (sin la ruta)
   * @param {object} opts.headers       - cabeceras extra (API key del backend)
   * @param {string} opts.serviceName   - service.name del recurso
   * @param {number} opts.intervalMs    - cada cuánto se empuja (def. 60s)
   * @param {function} opts.fetch       - inyectable para tests
   */
  constructor({
    telemetry,
    endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '',
    headers = {},
    serviceName = process.env.OTEL_SERVICE_NAME || 'operant',
    intervalMs = Number(process.env.OTEL_EXPORT_INTERVAL_MS || 60_000),
    fetch: fetchImpl,
    clock = () => Date.now(),
  } = {}) {
    this.telemetry = telemetry;
    this.endpoint = String(endpoint).replace(/\/$/, '');
    this.headers = { ...OtlpExporter._headersFromEnv(), ...headers };
    this.serviceName = serviceName;
    this.intervalMs = intervalMs;
    this._fetch = fetchImpl || globalThis.fetch;
    this.clock = clock;
    this._timer = null;
    this._startTime = clock();
    this.enabled = Boolean(this.endpoint);
    this.lastError = null;
    this.exports = 0;
  }

  /** OTEL_EXPORTER_OTLP_HEADERS="key1=val1,key2=val2" (convención OTel). */
  static _headersFromEnv(env = process.env) {
    const raw = env.OTEL_EXPORTER_OTLP_HEADERS;
    if (!raw) return {};
    return Object.fromEntries(
      String(raw).split(',').map((p) => p.split('=')).filter((kv) => kv.length === 2)
        .map(([k, v]) => [k.trim(), v.trim()])
    );
  }

  /** Arranca el empuje periódico. Idempotente; sin endpoint no hace nada. */
  start() {
    if (!this.enabled || this._timer) return false;
    this._timer = setInterval(() => { this.export().catch(() => {}); }, this.intervalMs);
    if (this._timer.unref) this._timer.unref();   // no mantiene vivo el proceso
    return true;
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  /** Un empuje. Devuelve { sent, reason? } — nunca lanza: la observabilidad no puede tumbar el servicio. */
  async export() {
    if (!this.enabled) return { sent: false, reason: 'sin OTEL_EXPORTER_OTLP_ENDPOINT' };
    const payload = this.buildPayload();
    if (!payload.resourceMetrics[0].scopeMetrics[0].metrics.length) {
      return { sent: false, reason: 'sin métricas que enviar' };
    }
    try {
      const res = await this._fetch(`${this.endpoint}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.headers },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.exports++;
      this.lastError = null;
      return { sent: true };
    } catch (err) {
      // Que el backend de métricas esté caído no puede romper el producto.
      this.lastError = err.message;
      console.warn(`[otlp] no se pudieron exportar métricas: ${err.message}`);
      return { sent: false, reason: err.message };
    }
  }

  /** Construye el cuerpo OTLP a partir del estado actual de Telemetry. */
  buildPayload() {
    const now = String(this.clock() * 1e6);          // OTLP usa nanosegundos
    const start = String(this._startTime * 1e6);
    const metrics = [];

    // Contadores → Sum monotónico acumulado.
    const byName = new Map();
    for (const [key, value] of this.telemetry._counters) {
      const { name, attributes } = OtlpExporter.parseKey(key);
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push({
        attributes,
        startTimeUnixNano: start,
        timeUnixNano: now,
        asInt: String(value),
      });
    }
    for (const [name, dataPoints] of byName) {
      metrics.push({
        name,
        unit: '1',
        sum: { dataPoints, aggregationTemporality: 2, isMonotonic: true },   // 2 = CUMULATIVE
      });
    }

    // Histogramas → Histogram con buckets NO acumulados (OTLP los quiere así,
    // al revés que Prometheus; convertir mal aquí infla las cuentas).
    for (const [name, h] of this.telemetry._hist) {
      if (!h.count) continue;
      metrics.push({
        name,
        unit: 'ms',
        histogram: {
          aggregationTemporality: 2,
          dataPoints: [{
            attributes: [],
            startTimeUnixNano: start,
            timeUnixNano: now,
            count: String(h.count),
            sum: h.sum,
            min: h.min,
            max: h.max,
            explicitBounds: LAT_BUCKETS,
            bucketCounts: OtlpExporter.toBucketCounts(h),
          }],
        },
      });
    }

    return {
      resourceMetrics: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.serviceName } },
          ],
        },
        scopeMetrics: [{ scope: { name: 'operant' }, metrics }],
      }],
    };
  }

  /**
   * Telemetry guarda cuentas ACUMULADAS por bucket (valores <= le, como
   * Prometheus). OTLP espera la cuenta de CADA bucket por separado, más un
   * último bucket para +Inf. Sin esta conversión, un backend OTel leería
   * totales inflados.
   */
  static toBucketCounts(h) {
    const counts = [];
    let prev = 0;
    for (const le of LAT_BUCKETS) {
      const cum = h.buckets[le] || prev;    // Telemetry no rellena huecos: hereda el anterior
      counts.push(String(Math.max(0, cum - prev)));
      prev = cum;
    }
    counts.push(String(Math.max(0, h.count - prev)));   // +Inf
    return counts;
  }

  /** `name{k="v",k2="v2"}` → { name, attributes: [{key, value:{stringValue}}] }. */
  static parseKey(key) {
    const i = key.indexOf('{');
    if (i === -1) return { name: key, attributes: [] };
    const name = key.slice(0, i);
    const attributes = key.slice(i + 1, key.lastIndexOf('}'))
      .split(',')
      .filter(Boolean)
      .map((pair) => {
        const eq = pair.indexOf('=');
        return {
          key: pair.slice(0, eq),
          value: { stringValue: pair.slice(eq + 1).replace(/^"|"$/g, '') },
        };
      });
    return { name, attributes };
  }

  status() {
    return {
      enabled: this.enabled,
      endpoint: this.endpoint || null,
      intervalMs: this.intervalMs,
      exports: this.exports,
      lastError: this.lastError,
    };
  }
}

OtlpExporter.LAT_BUCKETS = LAT_BUCKETS;
module.exports = OtlpExporter;
