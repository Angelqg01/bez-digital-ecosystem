'use strict';

const crypto = require('node:crypto');

/**
 * auditMerkle — consolida un tramo de la cadena de auditoría en una raíz merkle
 * anclable en BeZhas L2.
 *
 * ── Por qué hace falta si el log ya está encadenado ─────────────────────────
 * `AuditLog` encadena cada registro con el hash del anterior, lo que hace
 * DETECTABLE cualquier alteración... para quien tenga la cadena entera, que es
 * el propio proveedor. Ante un cliente, un auditor o una due diligence, "mi log
 * dice que no lo he tocado" es exactamente lo que diría alguien que sí lo tocó.
 *
 * Anclar la raíz merkle del tramo en una cadena pública mueve la prueba fuera
 * del alcance de quien podría querer reescribirla, y con fecha. Y a diferencia
 * de anclar el último hash, la raíz merkle permite demostrar UN registro suelto
 * con una prueba de inclusión de tamaño logarítmico, sin publicar el resto — que
 * suele contener datos de clientes.
 *
 * ── Esquema ────────────────────────────────────────────────────────────────
 * sha256 con pares ORDENADOS, idéntico a `api/services/operantAnchor.js` y a
 * `TelemetryAnchor.verify()` en Solidity. Si este esquema cambia aquí y no
 * allí, las pruebas dejan de validar on-chain sin previo aviso: los tres sitios
 * se cambian a la vez o no se cambia ninguno.
 */

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest();

/** Par ordenado: el orden de los hermanos no puede alterar el resultado. */
function hashPair(a, b) {
  return Buffer.compare(a, b) <= 0
    ? sha256(Buffer.concat([a, b]))
    : sha256(Buffer.concat([b, a]));
}

/** Hoja = el hash del propio registro de auditoría (hex de 64) → Buffer. */
function toLeaf(hash) {
  const clean = String(hash).replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/i.test(clean)) throw new Error(`hash de auditoría inválido: ${hash}`);
  return Buffer.from(clean, 'hex');
}

/** Raíz merkle sha256 (pares ordenados). `null` si el tramo está vacío. */
function merkleRoot(leaves) {
  if (!leaves.length) return null;
  let level = leaves.slice();
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(hashPair(left, right));
    }
    level = next;
  }
  return level[0];
}

/**
 * Selecciona el tramo de auditoría de un tenant.
 *
 * @param {object[]} records  Registros tal cual los devuelve `store.auditFor`.
 * @param {{since?:string, until?:string, max?:number}} [range]
 *   `since` es EXCLUSIVO (es el `period_end` del último tramo anclado: incluirlo
 *   solaparía tramos y el mismo registro contaría dos veces).
 * @returns {{leaves:string[], from:string|null, to:string|null, count:number, truncated:boolean}}
 */
function selectBatch(records, { since = null, until = null, max = 10_000 } = {}) {
  const inRange = records.filter((r) => {
    if (!r.hash || !r.ts) return false;
    if (since && r.ts <= since) return false;
    if (until && r.ts > until) return false;
    return true;
  });

  // Un tramo enorme (primer anclaje de un tenant con meses de historia) se corta
  // y se ancla en varias pasadas: es preferible a una petición que nunca acaba.
  const truncated = inRange.length > max;
  const slice = truncated ? inRange.slice(0, max) : inRange;

  return {
    leaves: slice.map((r) => r.hash),
    from: slice.length ? slice[0].ts : null,
    to: slice.length ? slice[slice.length - 1].ts : null,
    count: slice.length,
    truncated,
    remaining: truncated ? inRange.length - max : 0,
  };
}

/** Raíz del tramo en hex `0x…`, para comparar con la anclada por BeZhas. */
function rootOf(hashes) {
  const root = merkleRoot(hashes.map(toLeaf));
  return root ? '0x' + root.toString('hex') : null;
}

module.exports = { merkleRoot, hashPair, toLeaf, selectBatch, rootOf };
