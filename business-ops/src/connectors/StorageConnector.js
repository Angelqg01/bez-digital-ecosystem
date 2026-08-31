'use strict';
const BaseConnector = require('./BaseConnector');

/**
 * StorageConnector — almacén de objetos propio (MinIO, S3-compatible, auto-alojado).
 * Guarda CVs, facturas PDF, adjuntos de soporte, artículos de KB, etc., aislados por tenant.
 *
 * Con MINIO_ENDPOINT + 'minio' SDK instalado → real. Sin ello → modo simulado en RAM,
 * para poder probar el flujo sin levantar el contenedor.
 *
 *   npm i minio
 *   MINIO_ENDPOINT=localhost  MINIO_PORT=9000  MINIO_ACCESS_KEY=...  MINIO_SECRET_KEY=...
 *
 * Las claves se prefijan con el tenantId → aislamiento multi-tenant en un solo bucket.
 */
class StorageConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'storage';
    this.bucket = config.bucket || process.env.MINIO_BUCKET || 'operant';
    this.endpoint = config.endpoint || process.env.MINIO_ENDPOINT || '';
    this.simulated = !this.endpoint;
    this._sim = new Map(); // key -> Buffer (modo simulado)
    this._client = null;
    this._bucketReady = false;
  }

  _key(name) { return `${this.tenantId || 'shared'}/${name.replace(/^\/+/, '')}`; }

  _getClient() {
    if (this._client) return this._client;
    let Minio;
    try { Minio = require('minio'); } catch { return null; }
    this._client = new Minio.Client({
      endPoint: this.endpoint,
      port: Number(this.config.port || process.env.MINIO_PORT || 9000),
      useSSL: (process.env.MINIO_USE_SSL || 'false') === 'true',
      accessKey: this.config.accessKey || process.env.MINIO_ACCESS_KEY,
      secretKey: this.config.secretKey || process.env.MINIO_SECRET_KEY,
    });
    return this._client;
  }

  async execute(method, args = {}) {
    switch (method) {
      case 'put': return this.put(args);
      case 'get': return this.get(args);
      case 'list': return this.list(args);
      case 'remove': return this.remove(args);
      default: throw new Error(`storage: método desconocido ${method}`);
    }
  }

  /**
   * Crea el bucket si no existe, una sola vez por instancia.
   *
   * Sin esto, la primera escritura contra un MinIO recién levantado falla con
   * "The specified bucket does not exist" — un mensaje que no dice qué hacer y
   * que convierte el arranque del stack soberano en una carrera de obstáculos.
   * El bucket es uno solo para toda la plataforma y las claves van prefijadas
   * por tenant, así que crearlo no es una decisión de negocio: es parte de
   * estar configurado.
   */
  async _ensureBucket(client) {
    if (this._bucketReady) return;
    if (!(await client.bucketExists(this.bucket))) {
      try {
        await client.makeBucket(this.bucket);
      } catch (err) {
        // Otra instancia (u otro tenant) pudo crearlo entre la comprobación y
        // aquí: que exista es exactamente lo que queríamos.
        if (!/already (own|exist)/i.test(err.message || '')) throw err;
      }
    }
    this._bucketReady = true;
  }

  async put({ name, data, contentType = 'application/octet-stream' } = {}) {
    const key = this._key(name);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data ?? ''));
    const client = this.simulated ? null : this._getClient();
    if (!client) { this._sim.set(key, buf); return { key, size: buf.length, simulated: true }; }
    await this._ensureBucket(client);
    await client.putObject(this.bucket, key, buf, buf.length, { 'Content-Type': contentType });
    return { key, size: buf.length, simulated: false };
  }

  async get({ name } = {}) {
    const key = this._key(name);
    const client = this.simulated ? null : this._getClient();
    if (!client) {
      const buf = this._sim.get(key);
      if (!buf) throw new Error(`storage: no existe ${key}`);
      return { key, data: buf };
    }
    const stream = await client.getObject(this.bucket, key);
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    return { key, data: Buffer.concat(chunks) };
  }

  async list({ prefix = '' } = {}) {
    const full = this._key(prefix);
    const client = this.simulated ? null : this._getClient();
    if (!client) return [...this._sim.keys()].filter((k) => k.startsWith(full)).map((key) => ({ key }));
    const out = [];
    const stream = client.listObjectsV2(this.bucket, full, true);
    for await (const obj of stream) out.push({ key: obj.name, size: obj.size });
    return out;
  }

  async remove({ name } = {}) {
    const key = this._key(name);
    const client = this.simulated ? null : this._getClient();
    if (!client) return { key, removed: this._sim.delete(key), simulated: true };
    await client.removeObject(this.bucket, key);
    return { key, removed: true, simulated: false };
  }
}

module.exports = StorageConnector;
