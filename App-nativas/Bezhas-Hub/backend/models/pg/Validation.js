const pool = require('../../db/pool');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIPOS = ['post', 'comment', 'content', 'document', 'reel', 'article'];
const ESTADOS = ['pending', 'processing', 'confirmed', 'failed'];
const METODOS = ['crypto', 'fiat'];

const txt = (v, max) => (v == null || v === '' ? null : String(v).slice(0, max));
const metadatos = (m) => (m && typeof m === 'object' && !Array.isArray(m) ? m : {});

/** Campos por los que se puede filtrar (lista blanca): el filtro de Mongo aceptaba cualquier clave. */
const COLUMNA = {
    contentHash: 'content_hash', authorAddress: 'author_address', transactionHash: 'transaction_hash', status: 'status',
    paymentSessionId: 'payment_session_id', paymentMethod: 'payment_method', validationType: 'validation_type',
};

/**
 * Registros de validación de contenido (tabla `validation_records`, migración 026). Sustituye a models/validation.model.js
 * (Mongoose con almacén en memoria de reserva): aquí no hay reserva en memoria, si la base falla se lanza el error.
 */
class ValidationPG {
    static isValidId(id) { return typeof id === 'string' && UUID.test(id); }

    static hydrate(r) {
        if (!r) return null;
        return {
            _id: r.id, id: r.id, contentHash: r.content_hash, authorAddress: r.author_address, transactionHash: r.transaction_hash,
            blockNumber: r.block_number == null ? null : Number(r.block_number), paymentMethod: r.payment_method,
            paymentSessionId: r.payment_session_id, paymentAmount: r.payment_amount == null ? null : Number(r.payment_amount),
            paymentCurrency: r.payment_currency, status: r.status, validationType: r.validation_type, contentUri: r.content_uri,
            validatedBy: r.validated_by, metadata: r.metadata || {}, gasUsed: r.gas_used, confirmedAt: r.confirmed_at,
            errorMessage: r.error_message, createdAt: r.created_at, updatedAt: r.updated_at,
        };
    }

    /**
     * Crea el registro. Si ya existe uno con la misma sesión de pago o la misma transacción en cadena devuelve ESE (con `duplicate: true`)
     * en vez de duplicar: un job reintentado tras confirmarse en cadena no registra dos veces el mismo pago.
     * `contentType` (lo que envía la cola) se admite como alias de `validationType`; un tipo desconocido se guarda como `content`.
     */
    static async create(d) {
        if (!d || !d.contentHash || !d.authorAddress) throw new Error('contentHash y authorAddress son obligatorios');
        const tipoBruto = d.validationType || d.contentType;
        const tipo = TIPOS.includes(tipoBruto) ? tipoBruto : (tipoBruto ? 'content' : 'post');
        const estado = ESTADOS.includes(d.status) ? d.status : 'pending';
        const metodo = METODOS.includes(d.paymentMethod) ? d.paymentMethod : 'crypto';
        const params = [
            txt(d.contentHash, 66), txt(d.authorAddress, 42), txt(d.transactionHash, 66), d.blockNumber == null ? null : Number(d.blockNumber), metodo,
            txt(d.paymentSessionId, 255), d.paymentAmount == null ? null : Number(d.paymentAmount), txt(d.paymentCurrency, 8), estado, tipo,
            txt(d.contentUri, 2000), txt(d.validatedBy, 40), JSON.stringify(metadatos(d.metadata)), txt(d.gasUsed, 40), d.confirmedAt || null, txt(d.errorMessage, 2000),
        ];
        try {
            const { rows } = await pool.query(
                `INSERT INTO validation_records (content_hash, author_address, transaction_hash, block_number, payment_method, payment_session_id, payment_amount,
                        payment_currency, status, validation_type, content_uri, validated_by, metadata, gas_used, confirmed_at, error_message)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16) RETURNING *`, params);
            return ValidationPG.hydrate(rows[0]);
        } catch (err) {
            if (err.code !== '23505') throw err;
            const { rows } = await pool.query(
                `SELECT * FROM validation_records WHERE ($1::text IS NOT NULL AND payment_session_id = $1) OR ($2::text IS NOT NULL AND LOWER(transaction_hash) = LOWER($2)) LIMIT 1`,
                [params[5], params[2]]);
            if (!rows[0]) throw err;
            return { ...ValidationPG.hydrate(rows[0]), duplicate: true };
        }
    }

    static async findById(id) {
        if (!ValidationPG.isValidId(id)) return null;
        const { rows } = await pool.query('SELECT * FROM validation_records WHERE id = $1', [id]);
        return ValidationPG.hydrate(rows[0]);
    }

    static _where(query) {
        const params = []; const where = [];
        for (const [k, v] of Object.entries(query || {})) {
            if (!COLUMNA[k]) throw new Error(`Filtro no permitido: ${k}`);
            params.push(v);
            where.push(`${COLUMNA[k]} = $${params.length}`);
        }
        return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
    }

    static async findOne(query) {
        const { where, params } = ValidationPG._where(query);
        const { rows } = await pool.query(`SELECT * FROM validation_records ${where} ORDER BY created_at DESC LIMIT 1`, params);
        return ValidationPG.hydrate(rows[0]);
    }

    /** `options.sort` admite { createdAt: -1 } (por defecto, el más reciente primero), `limit` y `skip`. */
    static async find(query = {}, options = {}) {
        const { where, params } = ValidationPG._where(query);
        const asc = options.sort && Object.values(options.sort)[0] === 1;
        params.push(Math.min(Math.max(parseInt(options.limit, 10) || 100, 1), 1000), Math.max(parseInt(options.skip, 10) || 0, 0));
        const { rows } = await pool.query(
            `SELECT * FROM validation_records ${where} ORDER BY created_at ${asc ? 'ASC' : 'DESC'}, id LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return rows.map(ValidationPG.hydrate);
    }

    static findByAuthor(authorAddress, options) { return ValidationPG.find({ authorAddress }, options); }

    static findByStatus(status, options) { return ValidationPG.find({ status }, options); }

    static async countDocuments(query = {}) {
        const { where, params } = ValidationPG._where(query);
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM validation_records ${where}`, params);
        return rows[0].n;
    }

    /**
     * Cambia el estado y, opcionalmente, datos de la confirmación. Un registro ya `confirmed` no vuelve atrás (un reintento tardío o
     * un fallo no puede degradar una validación pagada y confirmada en cadena).
     */
    static async updateStatus(id, status, extra = {}) {
        if (!ValidationPG.isValidId(id) || !ESTADOS.includes(status)) return null;
        const { rows } = await pool.query(
            `UPDATE validation_records SET status = $2,
                    transaction_hash = COALESCE($3, transaction_hash), block_number = COALESCE($4, block_number), gas_used = COALESCE($5, gas_used),
                    confirmed_at = CASE WHEN $2 = 'confirmed' THEN COALESCE($6::timestamptz, NOW()) ELSE confirmed_at END,
                    error_message = $7, updated_at = NOW()
              WHERE id = $1 AND (status <> 'confirmed' OR $2 = 'confirmed') RETURNING *`,
            [id, status, txt(extra.transactionHash, 66), extra.blockNumber == null ? null : Number(extra.blockNumber), txt(extra.gasUsed, 40),
                extra.confirmedAt || null, txt(extra.errorMessage, 2000)]);
        return ValidationPG.hydrate(rows[0]);
    }
}

module.exports = ValidationPG;
