'use strict';

// `pg` es dependencia opcional: solo se carga si hay DATABASE_URL.
// Si no está instalado, createStore captura el error y cae a InMemoryStore.
const { Pool } = require('pg');

// Dimensión de los vectores de memoria. Debe coincidir con el modelo de
// embeddings en uso (nomic-embed-text → 768) y con el tipo de la columna
// interactions.embedding. connect() lo verifica al arrancar.
const DEFAULT_EMBEDDING_DIMS = 768;

/**
 * PostgresStore — adaptador de producción del contrato Store.
 *
 * Implementa el contrato COMPLETO (el mismo que InMemoryStore y SqliteStore):
 * auditoría, memoria episódica, hechos, tenants, claves de API, tareas y
 * aprobaciones HITL. Que estuviera a medias era peor que no existir: las
 * llamadas están guardadas con `typeof store.X === 'function'`, así que un
 * método ausente no rompía nada — simplemente dejaba de persistir en silencio
 * justo en el despliegue que más lo necesita. Cualquier método nuevo del
 * contrato debe añadirse a los TRES adaptadores; `test/store-contract.test.js`
 * falla si uno se queda atrás.
 *
 * Aísla cada tenant con Row-Level Security: todo lo que toca el plano de datos
 * pasa por `_withTenant`, que fija `app.tenant_id` dentro de la transacción
 * (ver db/migrations/001_init.sql). El plano de control (tenants, api_keys) se
 * lee sin contexto de tenant a propósito: el proceso necesita el inventario
 * completo al arrancar, antes de saber a quién sirve.
 *
 * Requiere ejecutar las migraciones (000→004): `npm run db:migrate` sobre una
 * base existente, o `npm run db:up`, que las aplica en el primer arranque.
 */
class PostgresStore {
  constructor({ connectionString, embeddingDims } = {}) {
    this.connectionString = connectionString;
    this.embeddingDims = Number(embeddingDims || process.env.EMBEDDING_DIMS || DEFAULT_EMBEDDING_DIMS);
    this.pool = null;
    this._warnedDims = false;
    // Cola de escritura de la auditoría: preserva el orden de la cadena de
    // hashes aunque quien llama no espere el resultado (ver appendAudit).
    this._auditQueue = Promise.resolve();
  }

  async connect() {
    if (this.pool) return true;            // idempotente: pool compartido entre tenants
    this.pool = new Pool({ connectionString: this.connectionString });
    await this.pool.query('SELECT 1');     // valida la conexión cuanto antes
    await this._assertSchema();
    return true;
  }

  /**
   * Comprobación de arranque: el esquema tiene que estar migrado y la columna
   * de embeddings tiene que coincidir con el modelo configurado.
   *
   * Se hace aquí, una vez, y no en cada escritura: un desajuste de dimensión
   * no se manifiesta al desplegar sino en la primera vez que un agente guarda
   * memoria — un fallo tardío, intermitente y difícil de leer. Mejor no
   * arrancar y decir exactamente qué ALTER hace falta.
   */
  async _assertSchema() {
    const { rows } = await this.pool.query(
      `SELECT to_regclass('public.approvals')  IS NOT NULL AS has_approvals,
              to_regclass('public.api_keys')   IS NOT NULL AS has_api_keys,
              (SELECT format_type(atttypid, atttypmod)
                 FROM pg_attribute
                WHERE attrelid = to_regclass('public.interactions')
                  AND attname = 'embedding' AND NOT attisdropped) AS embedding_type,
              (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypasses_rls,
              current_user AS role_name`
    );
    const {
      has_approvals: hasApprovals, has_api_keys: hasApiKeys,
      embedding_type: embeddingType, bypasses_rls: bypassesRls, role_name: roleName,
    } = rows[0];

    // Un superusuario (o un rol con BYPASSRLS) ignora TODAS las políticas de
    // seguridad por fila. Conectado así, el aislamiento entre empresas cliente
    // no existe aunque el esquema esté perfecto, y no hay ninguna señal de que
    // algo vaya mal: las consultas funcionan, simplemente ven de más. Es el
    // fallo más grave posible en una plataforma multi-tenant, así que no se
    // arranca. El rol POSTGRES_USER de la imagen de Docker es superusuario.
    if (bypassesRls) {
      throw new Error(
        `PostgresStore: la aplicación está conectada como "${roleName}", un rol que se salta la ` +
        'Row-Level Security — con él NO hay aislamiento entre tenants.\n' +
        '  · Aplica las migraciones con el rol dueño: `npm run db:migrate` (crea operant_app).\n' +
        '  · Arranca la aplicación con ese rol: DATABASE_URL=postgres://operant_app:...@host/operant'
      );
    }

    if (!hasApprovals || !hasApiKeys) {
      throw new Error(
        'PostgresStore: faltan tablas del esquema (approvals/api_keys). ' +
        'Aplica las migraciones con `npm run db:migrate`.'
      );
    }

    const expected = `vector(${this.embeddingDims})`;
    if (embeddingType && embeddingType !== expected) {
      throw new Error(
        `PostgresStore: interactions.embedding es ${embeddingType} pero el modelo de embeddings ` +
        `produce ${this.embeddingDims} dimensiones. Corrige una de las dos cosas:\n` +
        `  · ALTER TABLE interactions ALTER COLUMN embedding TYPE ${expected};\n` +
        `  · o fija EMBEDDING_DIMS al valor real del modelo.`
      );
    }
    return true;
  }

  async disconnect() {
    if (this.pool) await this.pool.end();
    this.pool = null;
    return true;
  }

  _ready() {
    if (!this.pool) throw new Error('PostgresStore: llama a connect() primero');
  }

  /**
   * Ejecuta fn dentro de una transacción con app.tenant_id fijado (para RLS).
   *
   * Cuesta un par de idas y vueltas más que una consulta suelta. Se paga a
   * propósito: es lo que hace que el aislamiento lo garantice la base de datos
   * y no la disciplina de quien escribe cada WHERE.
   */
  async _withTenant(tenantId, fn) {
    this._ready();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [String(tenantId)]);
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Auditoría (append-only, con RLS por tenant) ──

  /**
   * Añade un registro a la auditoría, EN ORDEN.
   *
   * El orden no es un detalle estético: `AuditLog` encadena cada registro con
   * el hash del anterior, y `verifyChain()` recorre las filas por id. Quien
   * llama lo hace sin esperar (`appendAudit(...).catch(...)`), así que con un
   * pool de conexiones dos inserciones pueden confirmarse en orden distinto al
   * que se emitieron: las filas quedan barajadas y la cadena aparece ROTA
   * siendo correcta. Es la peor forma de fallar posible para la pieza cuyo
   * único cometido es que un auditor pueda fiarse de ella.
   *
   * Con SQLite no pasaba (escribe de forma síncrona). Aquí se serializan las
   * escrituras encadenándolas: siguen sin bloquear a quien llama, pero entran
   * en la base en el mismo orden en que se calcularon los hashes.
   *
   * Límite conocido: esto ordena las escrituras de ESTE proceso. Con varios
   * nodos escribiendo la auditoría del mismo tenant haría falta que la cadena
   * se calculara en la base (o un solo escritor por tenant) — hoy el hash lo
   * calcula cada instancia de AuditLog en memoria, así que el multi-nodo ya
   * queda fuera del alcance de esta garantía.
   */
  async appendAudit(record) {
    const { tenantId, event, ts, ...rest } = record;
    const escritura = this._auditQueue.then(() =>
      this._withTenant(tenantId, (c) =>
        c.query(
          `INSERT INTO audit_log (tenant_id, event, data, ts)
           VALUES ($1, $2, $3::jsonb, COALESCE($4::timestamptz, now()))`,
          [tenantId, event, JSON.stringify(rest), ts || null]
        )
      )
    );
    // La cola nunca se rompe por un fallo suelto: un error no puede dejar de
    // persistir TODO lo que venga detrás.
    this._auditQueue = escritura.catch(() => {});
    await escritura;
    return true;
  }

  /** Historial completo de auditoría de un tenant, en orden — usado por
   *  AuditLog.hydrate()/verifyChain() para continuar y verificar la cadena de hashes. */
  async auditFor(tenantId) {
    const res = await this._withTenant(tenantId, (c) =>
      c.query(
        `SELECT tenant_id AS "tenantId", event, data, ts
           FROM audit_log
          WHERE tenant_id = $1
          ORDER BY id`,
        [tenantId]
      )
    );
    // node-postgres ya deserializa jsonb a objeto JS, pero devuelve timestamptz
    // como Date. El `ts` forma parte de lo que se hashea (AuditLog._hash sobre
    // el registro completo), así que tiene que volver EXACTAMENTE con la misma
    // forma con la que se escribió — una cadena ISO. Devolviendo el Date, el
    // hash recalculado no cuadraba y `verifyChain()` daba la cadena por rota en
    // cuanto la auditoría pasaba por Postgres: una alarma falsa en la única
    // pieza cuyo valor es que nadie dude de ella.
    return res.rows.map((r) => ({
      tenantId: r.tenantId,
      event: r.event,
      ts: r.ts instanceof Date ? r.ts.toISOString() : r.ts,
      ...r.data,
    }));
  }

  // ── Memoria episódica (con RLS) ──
  async saveInteraction({ tenantId, agentId, summary, outcome, embedding = null }) {
    const vector = this._vectorLiteral(embedding);
    await this._withTenant(tenantId, (c) =>
      c.query(
        `INSERT INTO interactions (tenant_id, agent_id, summary, outcome, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [tenantId, agentId ?? null, summary ?? null, outcome ?? null, vector]
      )
    );
    return true;
  }

  /**
   * Serializa un embedding al literal de pgvector, descartándolo si no encaja
   * en la columna. Guardar la interacción SIN vector conserva el recuerdo (la
   * búsqueda cronológica sigue funcionando y el vector se recalcula al
   * rehidratar); dejar que la inserción falle perdería el recuerdo entero por
   * un problema de configuración. Se avisa una vez, no en cada escritura.
   */
  _vectorLiteral(embedding) {
    if (!embedding || !embedding.length) return null;
    if (embedding.length !== this.embeddingDims) {
      if (!this._warnedDims) {
        this._warnedDims = true;
        console.warn(
          `[store] embedding de ${embedding.length} dimensiones descartado: la columna espera ` +
          `${this.embeddingDims}. La memoria se guarda sin vector (recall cronológico, sin RAG).`
        );
      }
      return null;
    }
    return `[${embedding.join(',')}]`;
  }

  async recallInteractions({ tenantId, agentId, embedding = null, k = 5 }) {
    const vector = this._vectorLiteral(embedding);

    // `<=>` es distancia coseno en pgvector; la similitud que devuelven los
    // otros adaptadores es 1 - distancia. Se expone como `score` para que el
    // contrato sea el mismo en los tres.
    const rows = await this._withTenant(tenantId, async (c) => {
      if (vector) {
        const semantic = await c.query(
          `SELECT tenant_id AS "tenantId", agent_id AS "agentId", summary, outcome,
                  created_at AS "createdAt",
                  1 - (embedding <=> $4::vector) AS score
             FROM interactions
            WHERE tenant_id = $1
              AND ($2::text IS NULL OR agent_id = $2)
              AND embedding IS NOT NULL
            ORDER BY embedding <=> $4::vector ASC
            LIMIT $3`,
          [tenantId, agentId || null, k, vector]
        );
        // Si todavía no hay ningún vector guardado, no se devuelve vacío: se
        // cae a lo cronológico, igual que InMemoryStore y SqliteStore.
        if (semantic.rows.length) return semantic.rows;
      }
      const chrono = await c.query(
        // id DESC como desempate: created_at puede empatar en inserciones
        // rápidas seguidas (mismo timestamp), el id serial no.
        `SELECT tenant_id AS "tenantId", agent_id AS "agentId", summary, outcome,
                created_at AS "createdAt"
           FROM interactions
          WHERE tenant_id = $1 AND ($2::text IS NULL OR agent_id = $2)
          ORDER BY created_at DESC, id DESC
          LIMIT $3`,
        [tenantId, agentId || null, k]
      );
      return chrono.rows;
    });

    // `at` en epoch ms es lo que exponen los otros dos adaptadores.
    return rows.map((r) => ({
      ...r,
      score: r.score === undefined ? undefined : Number(r.score),
      at: r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt,
    }));
  }

  // ── Memoria semántica (hechos/perfiles) ──
  async setFact({ tenantId, key, value }) {
    await this._withTenant(tenantId, (c) =>
      c.query(
        `INSERT INTO facts (tenant_id, key, value) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [tenantId, key, JSON.stringify(value)]
      )
    );
    return true;
  }

  async getFact({ tenantId, key }) {
    const res = await this._withTenant(tenantId, (c) =>
      c.query('SELECT value FROM facts WHERE tenant_id = $1 AND key = $2', [tenantId, key])
    );
    return res.rows[0] ? res.rows[0].value : null;
  }

  // ── Plano de control: tenants aprovisionados (para rehidratar al arrancar) ──
  async upsertTenant({ tenantId, plan, departments = [], businessId = null }) {
    this._ready();
    await this.pool.query(
      `INSERT INTO tenants (id, plan, departments, business_id) VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (id) DO UPDATE SET
         plan = EXCLUDED.plan,
         departments = EXCLUDED.departments,
         business_id = COALESCE(EXCLUDED.business_id, tenants.business_id)`,
      [tenantId, plan, JSON.stringify(departments), businessId]
    );
    return true;
  }

  async listTenants() {
    this._ready();
    const res = await this.pool.query(
      `SELECT id AS "tenantId", plan, departments, business_id AS "businessId"
         FROM tenants ORDER BY created_at, id`
    );
    return res.rows.map((r) => ({ ...r, departments: r.departments || [] }));
  }

  /**
   * Baja de un tenant: inventario y credencial. NO borra tareas, memoria ni
   * auditoría — misma decisión que SqliteStore. El registro de auditoría es
   * append-only y encadenado por hash: borrarlo rompería la prueba de
   * integridad que sostiene todo el argumento de cumplimiento.
   */
  async deleteTenant(tenantId) {
    this._ready();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
      await client.query('DELETE FROM api_keys WHERE tenant_id = $1', [tenantId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return true;
  }

  // ── Plano de control: hashes de claves de API (nunca la clave en claro) ──
  async setApiKeyHash({ tenantId, hash }) {
    this._ready();
    await this.pool.query(
      `INSERT INTO api_keys (tenant_id, key_hash) VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE SET key_hash = EXCLUDED.key_hash`,
      [tenantId, hash]
    );
    return true;
  }

  async listApiKeyHashes() {
    this._ready();
    const res = await this.pool.query('SELECT tenant_id AS "tenantId", key_hash AS hash FROM api_keys');
    return res.rows;
  }

  // ── Plano de datos: tareas (durabilidad de la cola) ──
  async upsertTask(task) {
    await this._withTenant(task.tenantId, (c) =>
      c.query(
        `INSERT INTO tasks (id, tenant_id, type, department, payload, status, error, result, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, COALESCE($9::timestamptz, now()), now())
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status, error = EXCLUDED.error, result = EXCLUDED.result,
           updated_at = now()`,
        [
          task.id, task.tenantId, task.type ?? null, task.department ?? null,
          JSON.stringify(task.payload ?? {}), task.status,
          task.error ?? null,
          task.result !== undefined ? JSON.stringify(task.result) : null,
          task.createdAt ?? null,
        ]
      )
    );
    return true;
  }

  /** Una tarea por id (para consultarla aunque ya no esté en la ventana caliente). */
  async getTask({ tenantId, taskId }) {
    const res = await this._withTenant(tenantId, (c) =>
      c.query(
        `SELECT id, tenant_id AS "tenantId", type, department, payload, status, error, result,
                created_at AS "createdAt"
           FROM tasks WHERE tenant_id = $1 AND id = $2`,
        [tenantId, taskId]
      )
    );
    return res.rows[0] ? PostgresStore._task(res.rows[0]) : null;
  }

  async listTasks({ tenantId, statuses = null, limit = 50 } = {}) {
    const res = await this._withTenant(tenantId, (c) =>
      c.query(
        `SELECT id, tenant_id AS "tenantId", type, department, payload, status, error, result,
                created_at AS "createdAt"
           FROM tasks WHERE tenant_id = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2`,
        [tenantId, limit]
      )
    );
    // El filtro por estado se aplica después del LIMIT, igual que en
    // SqliteStore: "las N últimas tareas, de las cuales estas están en X".
    return res.rows
      .filter((r) => !statuses || statuses.includes(r.status))
      .map(PostgresStore._task);
  }

  static _task(r) {
    return {
      ...r,
      payload: r.payload || {},
      result: r.result === null ? undefined : r.result,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    };
  }

  // ── Plano de datos: aprobaciones HITL (la decisión humana no se pierde) ──
  async upsertApproval(a) {
    await this._withTenant(a.tenantId, (c) =>
      c.query(
        `INSERT INTO approvals (approval_id, tenant_id, agent_id, action, reason, status, note, resolved_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::timestamptz)
         ON CONFLICT (approval_id) DO UPDATE SET
           status = EXCLUDED.status, note = EXCLUDED.note, resolved_at = EXCLUDED.resolved_at`,
        [
          a.approvalId, a.tenantId, a.agentId ?? null, JSON.stringify(a.action ?? {}),
          a.reason ?? null, a.status || 'pending', a.note ?? null, a.resolvedAt ?? null,
        ]
      )
    );
    return true;
  }

  async listApprovals({ tenantId, status = null } = {}) {
    const res = await this._withTenant(tenantId, (c) =>
      c.query(
        `SELECT approval_id AS "approvalId", tenant_id AS "tenantId", agent_id AS "agentId",
                action, reason, status, note, created_at AS "createdAt", resolved_at AS "resolvedAt"
           FROM approvals
          WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2)
          ORDER BY created_at`,
        [tenantId, status]
      )
    );
    return res.rows.map((r) => ({
      ...r,
      action: r.action || {},
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      resolvedAt: r.resolvedAt instanceof Date ? r.resolvedAt.toISOString() : r.resolvedAt,
    }));
  }
}

module.exports = PostgresStore;
