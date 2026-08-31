const { Pool } = require('pg');

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const hasDiscretePgConfig = Boolean(
    process.env.PGHOST ||
    process.env.PGPORT ||
    process.env.PGUSER ||
    process.env.PGPASSWORD ||
    process.env.PGDATABASE
);

if (!hasDatabaseUrl && !hasDiscretePgConfig) {
    console.warn('[DB] No DATABASE_URL/PG* variables found. PostgreSQL connection may fail.');
}

const poolConfig = {
    max: Number(process.env.PG_POOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 5000),
};

if (hasDatabaseUrl) {
    poolConfig.connectionString = process.env.DATABASE_URL;
} else {
    poolConfig.host = process.env.PGHOST || 'localhost';
    poolConfig.port = Number(process.env.PGPORT || 5432);
    if (process.env.PGUSER) poolConfig.user = process.env.PGUSER;
    if (process.env.PGPASSWORD) poolConfig.password = process.env.PGPASSWORD;
    if (process.env.PGDATABASE) poolConfig.database = process.env.PGDATABASE;
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
});

pool.on('connect', () => {
    console.log('[DB] New client connected to PostgreSQL');
});

/**
 * Execute a parameterized query.
 * @param {string} text SQL query with $1, $2... placeholders
 * @param {Array} params Parameter values
 */
async function query(text, params = []) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 200) {
            console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 80));
        }
        return result;
    } catch (err) {
        // El mock-fallback sólo vale para `test`, y sólo si se pide a
        // propósito con DB_MOCK_FALLBACK=true.
        //
        // Antes se activaba también en `development` Y con NODE_ENV vacío —es
        // decir, por defecto para cualquiera que arrancara el proceso sin
        // configurar entorno—. El efecto era que un INSERT fallido devolvía un
        // objeto inventado y la API respondía 201 sobre algo que nunca se
        // guardó: medido en el Run 02 con POST /p2p/offer, que devolvió un
        // offer_id de una fila inexistente. Un servicio que dice "hecho" sobre
        // una escritura perdida es peor que uno que falla.
        const mockAllowed = process.env.NODE_ENV === 'test'
            && process.env.DB_MOCK_FALLBACK === 'true';
        if (mockAllowed) {
            console.warn(`[DB][MOCK-FALLBACK] Query failed: "${err.message}". Using local mock.`);
            if (text.includes('INSERT INTO transactions')) {
                return {
                    rows: [{
                        tx_hash: params[0] || '0xmocktxhash',
                        from_address: params[1] || '0xmockfrom',
                        to_address: params[2] || '0xmockto',
                        value_wei: params[3] || '0',
                        contract_name: params[4] || null,
                        method_name: params[5] || null,
                        status: params[6] || 'confirmed',
                        chain_id: params[7] || 2708,
                        block_number: params[8] || 1,
                        gas_used: params[9] || '21000'
                    }],
                    rowCount: 1
                };
            }
            return { rows: [{}], rowCount: 1 };
        }
        throw err;
    }
}

/**
 * Get a client for transactions.
 * MUST call client.release() when done.
 */
async function getClient() {
    try {
        return await pool.connect();
    } catch (err) {
        const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !process.env.NODE_ENV;
        if (isDevOrTest) {
            console.warn(`[DB][MOCK-FALLBACK] Connection failed: "${err.message}". Using transaction mock client.`);
            return {
                query: async (text, params) => query(text, params),
                release: () => {}
            };
        }
        throw err;
    }
}

module.exports = { pool, query, getClient };
