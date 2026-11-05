/**
 * routes/marketplace.js — API Marketplace, paso 1 (docs/API_MARKETPLACE_DISENO.md).
 *
 * Paso 1: proveedores y listings en borrador, catálogo de listings en `live` y
 * revisión manual.
 * Paso 2: proxy de sólo lectura (`/call/:slug/*`) con el OpenAPI como contrato
 * en los dos sentidos, registro de llamadas y recibos firmados. Hasta el paso 3
 * (Stripe Connect) no se cobra: sólo llaman los consumidores con acceso piloto
 * concedido por un admin, y cada llamada se apunta con importe 0. El proxy está
 * apagado salvo MARKETPLACE_PROXY_ENABLED=true.
 *
 * Montado en /api/gateway/v1/marketplace, ANTES del router general del gateway.
 *
 *   Proveedor (api-key + marketplace:publish)
 *     POST /providers                     alta del proveedor (la app llamante)
 *     GET  /providers/me                  estado y requisitos pendientes
 *     PATCH /providers/me                 nombre legal y dirección de cobro on-chain
 *     POST /listings                      crea un borrador; devuelve el secreto UNA vez
 *     GET  /listings                      los listings propios
 *     GET  /listings/:id                  uno propio
 *     PUT  /listings/:id                  edita (draft o review; review vuelve a draft)
 *     POST /listings/:id/submit           draft → review, si se cumplen los requisitos
 *     POST /listings/:id/rotate-secret    nuevo secreto de firma; devuelve el nuevo UNA vez
 *
 *   Consumidor (api-key + marketplace:read | marketplace:consume)
 *     GET  /catalog                       listings en live
 *     GET  /catalog/:slug                 uno, con su OpenAPI apuntando al proxy
 *     GET|HEAD /call/:slug/*              el proxy (marketplace:consume)
 *     GET  /receipts/:callId              recibo firmado (consumidor o proveedor de la llamada)
 *     GET  /receipts/keys                 JWKS para verificar recibos (sin auth)
 *
 *   Admin (sesión SuperAdmin, no api-key)
 *     GET  /admin/listings?status=review  cola de revisión
 *     POST /admin/listings/:id/approve    review → live (vuelve a comprobar requisitos)
 *     POST /admin/listings/:id/suspend    review|live → suspended
 *     POST /admin/listings/:id/grants     acceso piloto de un consumidor
 *     DELETE /admin/listings/:id/grants/:appId  lo retira
 *     GET  /admin/anchor                  redes activas y anclas pendientes
 *     POST /admin/anchor/run              cierra lotes y ancla en Polygon (y la L2 si hay nodo)
 *
 * BOLA: cada consulta de proveedor lleva `provider_app_id = <app llamante>` en
 * el WHERE. Un id ajeno devuelve 404, igual que uno que no existe.
 *
 * Fuera de este paso, a propósito: KYB (Didit), cuenta Stripe Connect y firma
 * del DPA. Sus columnas existen y `submit` las exige, pero las rellenan los
 * flujos de los pasos siguientes, nunca el propio proveedor por esta API.
 */

'use strict';

const crypto = require('crypto');
const { Router } = require('express');

const { authenticateApp, requireScope } = require('../middleware/gateway-auth');
const { requireSuperAdmin } = require('../middleware/admin-auth');
const { query } = require('../db/pool');
const { validarDestinoPublico, safeFetch } = require('../utils/safeFetch');
const { checkRateLimit } = require('../cache/redis');
const { contratoDe, ContratoIncumplido } = require('../services/marketplace/openapiContract');
const breaker = require('../services/marketplace/circuitBreaker');
const receipts = require('../services/marketplace/receipts');
const anchor = require('../services/marketplace/anchor');
const { encryptSecret, decryptSecret } = require('../services/secretVault');
const {
    SCOPES, EDITABLE_STATUS, ADDRESS_RE,
    ListingInvalido, normalizarListing, requisitosPendientes, tieneCategoriasEspeciales, declaraEscritura,
} = require('../config/marketplace');
const logger = require('pino')({ level: 'info', name: 'marketplace' });

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROXY_BASE = '/api/gateway/v1/marketplace/call';
const SIGNATURE_HEADER = 'X-BeZhas-Signature';
const UPSTREAM_TIMEOUT_MS = 10_000;
const UPSTREAM_MAX_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT_PER_MIN = () => Math.max(parseInt(process.env.MARKETPLACE_RATE_LIMIT_PER_MIN, 10) || 60, 1);

// Columnas que ve el proveedor. upstream_secret NUNCA sale de la base.
const COLS_PROVEEDOR = `id, slug, title, summary, version, upstream_url, openapi, pricing,
    data_categories, writes, status, review_note, reviewed_at,
    upstream_secret_rotated_at, created_at, updated_at`;

function nuevoSecreto() {
    return `mkts_${crypto.randomBytes(24).toString('hex')}`;
}

function idValido(req, res) {
    if (UUID_RE.test(req.params.id)) return true;
    res.status(404).json({ error: 'Listing no encontrado', code: 'LISTING_NOT_FOUND' });
    return false;
}

function responderError(res, err, contexto) {
    if (err instanceof ListingInvalido) {
        return res.status(400).json({ error: 'Listing no válido', code: err.code, details: err.errores });
    }
    if (err?.code === 'DESTINATION_NOT_ALLOWED') {
        return res.status(400).json({ error: err.message, code: err.code, field: 'upstream_url' });
    }
    if (err?.code === '23505') {
        return res.status(409).json({ error: 'Ese slug ya está en uso', code: 'SLUG_TAKEN' });
    }
    logger.error({ err: err?.message, contexto }, 'marketplace: error');
    return res.status(500).json({ error: 'Error interno del marketplace' });
}

async function cargarProveedor(appId) {
    const { rows } = await query(
        `SELECT app_id, legal_name, kyb_status, stripe_account_id, payout_address,
                dpa_signed_at, status, created_at, updated_at
         FROM marketplace_providers WHERE app_id = $1`,
        [appId],
    );
    return rows[0] || null;
}

function vistaProveedor(p) {
    return {
        appId: p.app_id,
        legalName: p.legal_name,
        status: p.status,
        kybStatus: p.kyb_status,
        stripeConnected: Boolean(p.stripe_account_id),
        payoutAddress: p.payout_address,
        dpaSigned: Boolean(p.dpa_signed_at),
        createdAt: p.created_at,
    };
}

/** OpenAPI tal como lo ve el consumidor: el servidor es el proxy, nunca el upstream. */
function openapiPublico(openapi, slug) {
    return { ...openapi, servers: [{ url: `${PROXY_BASE}/${slug}` }] };
}

function vistaCatalogo(l, { conOpenapi = false } = {}) {
    const v = {
        slug: l.slug,
        title: l.title,
        summary: l.summary,
        version: l.version,
        provider: l.provider_name,
        pricing: l.pricing,
        dataCategories: l.data_categories,
        writes: l.writes,
        endpoint: `${PROXY_BASE}/${l.slug}`,
    };
    if (conOpenapi) v.openapi = openapiPublico(l.openapi, l.slug);
    return v;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Admin — va primero y con su propia auth: el api-key de una app no abre esto.
// ═══════════════════════════════════════════════════════════════════════════

const admin = Router();
admin.use(requireSuperAdmin);

admin.get('/listings', async (req, res) => {
    const status = String(req.query.status || 'review');
    if (!['draft', 'review', 'live', 'suspended'].includes(status)) {
        return res.status(400).json({ error: 'status no válido' });
    }
    try {
        const { rows } = await query(
            `SELECT l.id, l.slug, l.title, l.version, l.status, l.pricing, l.data_categories,
                    l.writes, l.updated_at, p.legal_name, p.kyb_status,
                    p.stripe_account_id IS NOT NULL AS stripe_connected,
                    p.dpa_signed_at IS NOT NULL AS dpa_signed, p.status AS provider_status
             FROM marketplace_listings l
             JOIN marketplace_providers p ON p.app_id = l.provider_app_id
             WHERE l.status = $1
             ORDER BY l.updated_at ASC
             LIMIT 200`,
            [status],
        );
        res.json({
            listings: rows.map((r) => ({
                ...r,
                specialCategories: tieneCategoriasEspeciales(r.data_categories),
            })),
        });
    } catch (err) {
        responderError(res, err, 'admin.list');
    }
});

admin.post('/listings/:id/approve', async (req, res) => {
    if (!idValido(req, res)) return;
    try {
        const { rows } = await query(
            `SELECT l.id, l.status, l.data_categories, l.provider_app_id
             FROM marketplace_listings l WHERE l.id = $1`,
            [req.params.id],
        );
        const listing = rows[0];
        if (!listing) return res.status(404).json({ error: 'Listing no encontrado', code: 'LISTING_NOT_FOUND' });
        if (listing.status !== 'review') {
            return res.status(409).json({ error: `Sólo se aprueba desde review (está en ${listing.status})`, code: 'INVALID_STATUS' });
        }
        // Entre el submit y la aprobación el proveedor puede haber perdido el
        // KYB o la cuenta Connect: se vuelve a mirar, no se fía del submit.
        const faltan = requisitosPendientes(await cargarProveedor(listing.provider_app_id), listing);
        if (faltan.length) {
            return res.status(409).json({ error: 'El proveedor no cumple los requisitos', code: 'REQUIREMENTS_MISSING', missing: faltan });
        }
        const nota = typeof req.body?.note === 'string' ? req.body.note.slice(0, 1000) : null;
        const upd = await query(
            `UPDATE marketplace_listings
             SET status = 'live', review_note = $2, reviewed_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND status = 'review'
             RETURNING id, slug, status, reviewed_at`,
            [listing.id, nota],
        );
        if (!upd.rows[0]) return res.status(409).json({ error: 'El listing cambió durante la revisión', code: 'INVALID_STATUS' });
        logger.info({ listingId: listing.id, admin: req.admin?.sub || req.admin?.email }, 'marketplace: listing aprobado');
        res.json({ listing: upd.rows[0] });
    } catch (err) {
        responderError(res, err, 'admin.approve');
    }
});

admin.post('/listings/:id/suspend', async (req, res) => {
    if (!idValido(req, res)) return;
    const nota = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';
    if (!nota) return res.status(400).json({ error: 'Indica el motivo en note: lo verá el proveedor.' });
    try {
        const upd = await query(
            `UPDATE marketplace_listings
             SET status = 'suspended', review_note = $2, reviewed_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND status IN ('review', 'live')
             RETURNING id, slug, status, reviewed_at`,
            [req.params.id, nota],
        );
        if (!upd.rows[0]) {
            return res.status(409).json({ error: 'Sólo se suspende un listing en review o live', code: 'INVALID_STATUS' });
        }
        logger.warn({ listingId: req.params.id, admin: req.admin?.sub || req.admin?.email }, 'marketplace: listing suspendido');
        res.json({ listing: upd.rows[0] });
    } catch (err) {
        responderError(res, err, 'admin.suspend');
    }
});

// Acceso piloto (paso 2): sin cobro todavía, un admin decide quién llama a qué.
// En el paso 3 lo sustituye la suscripción o el método de pago en la cuenta
// Connect del proveedor, sobre la misma tabla.
admin.post('/listings/:id/grants', async (req, res) => {
    if (!idValido(req, res)) return;
    const consumer = String(req.body?.consumer_app_id || '');
    if (!UUID_RE.test(consumer)) return res.status(400).json({ error: 'consumer_app_id debe ser el UUID de una app.' });
    try {
        const { rows } = await query(
            `INSERT INTO marketplace_subscriptions (consumer_app_id, listing_id, status)
             VALUES ($1, $2, 'active')
             ON CONFLICT (consumer_app_id, listing_id)
             DO UPDATE SET status = 'active', updated_at = NOW()
             RETURNING consumer_app_id, listing_id, status, updated_at`,
            [consumer, req.params.id],
        );
        logger.info({ listingId: req.params.id, consumer, admin: req.admin?.sub || req.admin?.email }, 'marketplace: acceso piloto concedido');
        res.status(201).json({ grant: rows[0] });
    } catch (err) {
        if (err?.code === '23503') return res.status(404).json({ error: 'Listing o app inexistente' });
        responderError(res, err, 'admin.grant');
    }
});

admin.delete('/listings/:id/grants/:appId', async (req, res) => {
    if (!idValido(req, res)) return;
    if (!UUID_RE.test(req.params.appId)) return res.status(404).json({ error: 'Acceso no encontrado' });
    try {
        const { rows } = await query(
            `UPDATE marketplace_subscriptions SET status = 'canceled', updated_at = NOW()
             WHERE consumer_app_id = $1 AND listing_id = $2 AND status <> 'canceled'
             RETURNING consumer_app_id, listing_id, status`,
            [req.params.appId, req.params.id],
        );
        if (!rows[0]) return res.status(404).json({ error: 'Acceso no encontrado' });
        res.json({ grant: rows[0] });
    } catch (err) {
        responderError(res, err, 'admin.revoke');
    }
});

// Anclaje (paso 4). La pasada también la puede lanzar un job programado con
// anchor.ejecutar(); desde aquí sirve para forzarla y para ver el estado.
admin.get('/anchor', async (_req, res) => {
    try {
        const { rows } = await query(
            `SELECT network, status, COUNT(*)::int AS n FROM marketplace_batch_anchors GROUP BY network, status`,
        );
        const sinLote = await query('SELECT COUNT(*)::int AS n FROM marketplace_calls WHERE batch_id IS NULL');
        res.json({ networks: anchor.redesActivas(), anchors: rows, unbatchedCalls: sinLote.rows[0]?.n ?? 0 });
    } catch (err) {
        responderError(res, err, 'admin.anchor.status');
    }
});

admin.post('/anchor/run', async (req, res) => {
    try {
        const resultado = await anchor.ejecutar();
        logger.info({ admin: req.admin?.sub || req.admin?.email, ...resultado, anclas: resultado.anclas.length }, 'marketplace: pasada de anclaje');
        res.json(resultado);
    } catch (err) {
        responderError(res, err, 'admin.anchor.run');
    }
});

router.use('/admin', admin);

// Clave pública de los recibos: cualquiera debe poder verificar uno sin api-key.
router.get('/receipts/keys', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600').json(receipts.jwks());
});

// ═══════════════════════════════════════════════════════════════════════════
//  A partir de aquí, api-key del gateway.
// ═══════════════════════════════════════════════════════════════════════════

router.use(authenticateApp);

const publica = requireScope(SCOPES.PUBLISH);
const lectura = requireScope(SCOPES.READ, SCOPES.CONSUME);
const consumo = requireScope(SCOPES.CONSUME);
const recibo = requireScope(SCOPES.READ, SCOPES.CONSUME, SCOPES.PUBLISH);

// ── Proveedor ──────────────────────────────────────────────────────────────

router.post('/providers', publica, async (req, res) => {
    const legalName = typeof req.body?.legal_name === 'string' ? req.body.legal_name.trim() : '';
    const payout = req.body?.payout_address ?? null;
    if (legalName.length < 2 || legalName.length > 200) {
        return res.status(400).json({ error: 'legal_name: entre 2 y 200 caracteres.' });
    }
    if (payout !== null && !ADDRESS_RE.test(String(payout))) {
        return res.status(400).json({ error: 'payout_address debe ser una dirección 0x de 40 hex.' });
    }
    try {
        const { rows } = await query(
            `INSERT INTO marketplace_providers (app_id, legal_name, payout_address)
             VALUES ($1, $2, $3)
             ON CONFLICT (app_id) DO NOTHING
             RETURNING app_id, legal_name, kyb_status, stripe_account_id, payout_address,
                       dpa_signed_at, status, created_at, updated_at`,
            [req.registeredApp.id, legalName, payout],
        );
        if (!rows[0]) return res.status(409).json({ error: 'Esta app ya es proveedor', code: 'PROVIDER_EXISTS' });
        const p = rows[0];
        res.status(201).json({
            provider: vistaProveedor(p),
            missing: requisitosPendientes(p, { data_categories: [] }),
        });
    } catch (err) {
        responderError(res, err, 'providers.create');
    }
});

router.get('/providers/me', publica, async (req, res) => {
    try {
        const p = await cargarProveedor(req.registeredApp.id);
        if (!p) return res.status(404).json({ error: 'Esta app aún no es proveedor', code: 'PROVIDER_NOT_FOUND' });
        res.json({ provider: vistaProveedor(p), missing: requisitosPendientes(p, { data_categories: [] }) });
    } catch (err) {
        responderError(res, err, 'providers.me');
    }
});

router.patch('/providers/me', publica, async (req, res) => {
    const sets = [];
    const vals = [req.registeredApp.id];
    if (req.body?.legal_name !== undefined) {
        const n = typeof req.body.legal_name === 'string' ? req.body.legal_name.trim() : '';
        if (n.length < 2 || n.length > 200) return res.status(400).json({ error: 'legal_name: entre 2 y 200 caracteres.' });
        vals.push(n);
        sets.push(`legal_name = $${vals.length}`);
    }
    if (req.body?.payout_address !== undefined) {
        const a = req.body.payout_address;
        if (a !== null && !ADDRESS_RE.test(String(a))) {
            return res.status(400).json({ error: 'payout_address debe ser una dirección 0x de 40 hex.' });
        }
        vals.push(a);
        sets.push(`payout_address = $${vals.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar (legal_name, payout_address).' });
    try {
        const { rows } = await query(
            `UPDATE marketplace_providers SET ${sets.join(', ')}, updated_at = NOW()
             WHERE app_id = $1
             RETURNING app_id, legal_name, kyb_status, stripe_account_id, payout_address,
                       dpa_signed_at, status, created_at, updated_at`,
            vals,
        );
        if (!rows[0]) return res.status(404).json({ error: 'Esta app aún no es proveedor', code: 'PROVIDER_NOT_FOUND' });
        res.json({ provider: vistaProveedor(rows[0]) });
    } catch (err) {
        responderError(res, err, 'providers.patch');
    }
});

router.post('/listings', publica, async (req, res) => {
    try {
        const datos = normalizarListing(req.body);
        const proveedor = await cargarProveedor(req.registeredApp.id);
        if (!proveedor) {
            return res.status(409).json({ error: 'Da de alta la app como proveedor antes (POST /providers)', code: 'PROVIDER_NOT_FOUND' });
        }
        if (proveedor.status === 'suspended') {
            return res.status(403).json({ error: 'Proveedor suspendido', code: 'PROVIDER_SUSPENDED' });
        }
        await validarDestinoPublico(datos.upstream_url);

        const secreto = nuevoSecreto();
        const { rows } = await query(
            `INSERT INTO marketplace_listings
                (provider_app_id, slug, title, summary, version, upstream_url, upstream_secret,
                 openapi, pricing, data_categories, writes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING ${COLS_PROVEEDOR}`,
            [
                req.registeredApp.id, datos.slug, datos.title, datos.summary ?? null, datos.version,
                datos.upstream_url, encryptSecret(secreto), datos.openapi, datos.pricing,
                datos.data_categories, datos.writes,
            ],
        );
        res.status(201).json({
            listing: rows[0],
            // Se muestra una sola vez: con él el proveedor verifica que la
            // llamada viene de BeZhas. Perdido, se rota.
            upstreamSecret: secreto,
            signatureHeader: SIGNATURE_HEADER,
        });
    } catch (err) {
        responderError(res, err, 'listings.create');
    }
});

router.get('/listings', publica, async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT ${COLS_PROVEEDOR} FROM marketplace_listings
             WHERE provider_app_id = $1 ORDER BY created_at DESC`,
            [req.registeredApp.id],
        );
        res.json({ listings: rows });
    } catch (err) {
        responderError(res, err, 'listings.list');
    }
});

router.get('/listings/:id', publica, async (req, res) => {
    if (!idValido(req, res)) return;
    try {
        const { rows } = await query(
            `SELECT ${COLS_PROVEEDOR} FROM marketplace_listings WHERE id = $1 AND provider_app_id = $2`,
            [req.params.id, req.registeredApp.id],
        );
        if (!rows[0]) return res.status(404).json({ error: 'Listing no encontrado', code: 'LISTING_NOT_FOUND' });
        res.json({ listing: rows[0] });
    } catch (err) {
        responderError(res, err, 'listings.get');
    }
});

router.put('/listings/:id', publica, async (req, res) => {
    if (!idValido(req, res)) return;
    try {
        const datos = normalizarListing(req.body, { parcial: true });
        delete datos._metodos;
        const campos = Object.keys(datos);
        if (!campos.length) return res.status(400).json({ error: 'Nada que actualizar.' });

        // Un PUT parcial puede cambiar `writes` sin el OpenAPI, o al revés: la
        // coherencia entre ambos se comprueba contra el listing completo.
        const actual = await query(
            `SELECT status, openapi, writes FROM marketplace_listings WHERE id = $1 AND provider_app_id = $2`,
            [req.params.id, req.registeredApp.id],
        );
        const fila = actual.rows[0];
        if (!fila) return res.status(404).json({ error: 'Listing no encontrado', code: 'LISTING_NOT_FOUND' });
        if (!EDITABLE_STATUS.includes(fila.status)) {
            return res.status(409).json({
                error: `Un listing en ${fila.status} no se edita: publica una versión nueva`,
                code: 'INVALID_STATUS',
            });
        }
        if (!(datos.writes ?? fila.writes) && declaraEscritura(datos.openapi ?? fila.openapi)) {
            throw new ListingInvalido([
                'El OpenAPI declara operaciones de escritura: marca writes=true (exige el scope marketplace:consume:write).',
            ]);
        }
        if (datos.upstream_url) await validarDestinoPublico(datos.upstream_url);

        const vals = [req.params.id, req.registeredApp.id];
        const sets = campos.map((c) => {
            vals.push(datos[c]);
            return `${c} = $${vals.length}`;
        });
        const { rows } = await query(
            `UPDATE marketplace_listings
             SET ${sets.join(', ')}, status = 'draft', updated_at = NOW()
             WHERE id = $1 AND provider_app_id = $2 AND status = ANY($${vals.length + 1})
             RETURNING ${COLS_PROVEEDOR}`,
            [...vals, EDITABLE_STATUS],
        );
        if (!rows[0]) return res.status(409).json({ error: 'El listing cambió de estado', code: 'INVALID_STATUS' });
        res.json({ listing: rows[0], returnedToDraft: fila.status === 'review' });
    } catch (err) {
        responderError(res, err, 'listings.update');
    }
});

router.post('/listings/:id/submit', publica, async (req, res) => {
    if (!idValido(req, res)) return;
    try {
        const { rows } = await query(
            `SELECT id, status, data_categories FROM marketplace_listings WHERE id = $1 AND provider_app_id = $2`,
            [req.params.id, req.registeredApp.id],
        );
        const listing = rows[0];
        if (!listing) return res.status(404).json({ error: 'Listing no encontrado', code: 'LISTING_NOT_FOUND' });
        if (listing.status !== 'draft') {
            return res.status(409).json({ error: `Sólo se envía a revisión un borrador (está en ${listing.status})`, code: 'INVALID_STATUS' });
        }
        const faltan = requisitosPendientes(await cargarProveedor(req.registeredApp.id), listing);
        if (faltan.length) {
            return res.status(409).json({ error: 'Faltan requisitos para enviar a revisión', code: 'REQUIREMENTS_MISSING', missing: faltan });
        }
        const upd = await query(
            `UPDATE marketplace_listings SET status = 'review', updated_at = NOW()
             WHERE id = $1 AND provider_app_id = $2 AND status = 'draft'
             RETURNING ${COLS_PROVEEDOR}`,
            [req.params.id, req.registeredApp.id],
        );
        if (!upd.rows[0]) return res.status(409).json({ error: 'El listing cambió de estado', code: 'INVALID_STATUS' });
        res.json({ listing: upd.rows[0] });
    } catch (err) {
        responderError(res, err, 'listings.submit');
    }
});

router.post('/listings/:id/rotate-secret', publica, async (req, res) => {
    if (!idValido(req, res)) return;
    try {
        const secreto = nuevoSecreto();
        const { rows } = await query(
            `UPDATE marketplace_listings
             SET upstream_secret = $3, upstream_secret_rotated_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND provider_app_id = $2
             RETURNING id, upstream_secret_rotated_at`,
            [req.params.id, req.registeredApp.id, encryptSecret(secreto)],
        );
        if (!rows[0]) return res.status(404).json({ error: 'Listing no encontrado', code: 'LISTING_NOT_FOUND' });
        res.json({ listing: rows[0], upstreamSecret: secreto, signatureHeader: SIGNATURE_HEADER });
    } catch (err) {
        responderError(res, err, 'listings.rotate');
    }
});

// ── Consumidor ─────────────────────────────────────────────────────────────

router.get('/catalog', lectura, async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const model = req.query.model ? String(req.query.model) : null;
    const q = req.query.q ? String(req.query.q).slice(0, 100) : null;
    try {
        const { rows } = await query(
            `SELECT l.slug, l.title, l.summary, l.version, l.pricing, l.data_categories, l.writes,
                    p.legal_name AS provider_name
             FROM marketplace_listings l
             JOIN marketplace_providers p ON p.app_id = l.provider_app_id
             WHERE l.status = 'live' AND p.status <> 'suspended'
               AND ($1::text IS NULL OR l.pricing->>'model' = $1)
               AND ($2::text IS NULL OR l.title ILIKE '%' || $2 || '%' OR l.summary ILIKE '%' || $2 || '%')
             ORDER BY l.title ASC
             LIMIT $3 OFFSET $4`,
            [model, q ? q.replace(/[\\%_]/g, (c) => `\\${c}`) : null, limit, offset],
        );
        res.json({ listings: rows.map((r) => vistaCatalogo(r)), limit, offset });
    } catch (err) {
        responderError(res, err, 'catalog.list');
    }
});

router.get('/catalog/:slug', lectura, async (req, res) => {
    const slug = String(req.params.slug);
    if (!/^[a-z0-9-]{3,50}$/.test(slug)) return res.status(404).json({ error: 'Listing no encontrado', code: 'LISTING_NOT_FOUND' });
    try {
        const { rows } = await query(
            `SELECT l.slug, l.title, l.summary, l.version, l.pricing, l.data_categories, l.writes,
                    l.openapi, p.legal_name AS provider_name
             FROM marketplace_listings l
             JOIN marketplace_providers p ON p.app_id = l.provider_app_id
             WHERE l.slug = $1 AND l.status = 'live' AND p.status <> 'suspended'`,
            [slug],
        );
        if (!rows[0]) return res.status(404).json({ error: 'Listing no encontrado', code: 'LISTING_NOT_FOUND' });
        res.json({ listing: vistaCatalogo(rows[0], { conOpenapi: true }) });
    } catch (err) {
        responderError(res, err, 'catalog.get');
    }
});

// ── Proxy (paso 2: sólo lectura) ───────────────────────────────────────────

function cortar(res, status, code, error, extra = {}) {
    return res.status(status).json({ error, code, ...extra });
}

async function proxy(req, res) {
    if (process.env.MARKETPLACE_PROXY_ENABLED !== 'true') {
        return cortar(res, 503, 'MARKETPLACE_PROXY_DISABLED', 'El proxy del marketplace no está abierto todavía.');
    }
    const metodo = req.method.toUpperCase();
    if (metodo !== 'GET' && metodo !== 'HEAD') {
        res.set('Allow', 'GET, HEAD');
        return cortar(res, 405, 'READ_ONLY', 'El marketplace sólo admite llamadas de lectura por ahora.');
    }
    const slug = String(req.params.slug);
    if (!/^[a-z0-9-]{3,50}$/.test(slug)) return cortar(res, 404, 'LISTING_NOT_FOUND', 'Listing no encontrado');
    const consumerId = req.registeredApp.id;

    try {
        const { rows } = await query(
            `SELECT l.id, l.slug, l.upstream_url, l.upstream_secret, l.openapi, l.pricing, l.writes, l.updated_at
             FROM marketplace_listings l
             JOIN marketplace_providers p ON p.app_id = l.provider_app_id
             WHERE l.slug = $1 AND l.status = 'live' AND p.status <> 'suspended'`,
            [slug],
        );
        const listing = rows[0];
        if (!listing) return cortar(res, 404, 'LISTING_NOT_FOUND', 'Listing no encontrado');
        if (listing.writes) {
            return cortar(res, 403, 'WRITE_LISTINGS_NOT_ENABLED', 'Los listings con escritura aún no están disponibles.');
        }

        const acceso = await query(
            `SELECT 1 FROM marketplace_subscriptions
             WHERE consumer_app_id = $1 AND listing_id = $2 AND status = 'active'`,
            [consumerId, listing.id],
        );
        if (!acceso.rows[0]) return cortar(res, 403, 'NOT_SUBSCRIBED', 'Tu app no tiene acceso a este listing.');

        const limite = RATE_LIMIT_PER_MIN();
        const rl = await checkRateLimit(`mkt:${listing.id}:${consumerId}`, limite, 60);
        if (!rl.allowed) {
            res.set('Retry-After', String(rl.resetInSec || 60));
            return cortar(res, 429, 'RATE_LIMITED', `Máximo ${limite} llamadas por minuto a este listing.`);
        }

        // Ruta en bruto (sin decodificar) tras /call/<slug>.
        const crudaCompleta = req.originalUrl.split('?')[0];
        const prefijo = `${req.baseUrl}/call/${slug}`;
        const rutaCruda = crudaCompleta.startsWith(prefijo) ? crudaCompleta.slice(prefijo.length) || '/' : '/';

        const contrato = contratoDe(listing);
        const peticion = contrato.validarPeticion(metodo, rutaCruda, req.query);

        if (!breaker.permitir(listing.id)) {
            res.set('Retry-After', String(Math.ceil(breaker.ENFRIAMIENTO_MS / 1000)));
            return cortar(res, 503, 'UPSTREAM_CIRCUIT_OPEN', 'El proveedor no responde; reintenta en unos segundos.');
        }

        const rutaFirmada = `${peticion.rutaReenvio}${peticion.query}`;
        const ts = String(Math.floor(Date.now() / 1000));
        const nonce = crypto.randomBytes(16).toString('hex');
        const url = `${listing.upstream_url.replace(/\/+$/, '')}${rutaFirmada}`;

        let respuesta;
        try {
            respuesta = await safeFetch(url, {
                method: metodo,
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'BeZhas-Marketplace/1',
                    'X-BeZhas-Timestamp': ts,
                    'X-BeZhas-Nonce': nonce,
                    'X-BeZhas-Listing': listing.slug,
                    'X-BeZhas-Consumer': receipts.consumidorOpaco(listing.id, consumerId),
                    [SIGNATURE_HEADER]: receipts.firmaUpstream(decryptSecret(listing.upstream_secret), {
                        ts, nonce, metodo, ruta: rutaFirmada,
                    }),
                },
                timeoutMs: UPSTREAM_TIMEOUT_MS,
                maxBytes: UPSTREAM_MAX_BYTES,
            });
        } catch (err) {
            breaker.fallo(listing.id);
            logger.warn({ listingId: listing.id, err: err.message }, 'marketplace: upstream inalcanzable');
            return cortar(res, 502, 'UPSTREAM_UNAVAILABLE', 'No se pudo contactar con el proveedor.');
        }

        if (respuesta.status >= 500) {
            breaker.fallo(listing.id);
            return cortar(res, 502, 'UPSTREAM_ERROR', 'El proveedor devolvió un error.', { upstreamStatus: respuesta.status });
        }
        breaker.exito(listing.id);
        if (respuesta.status >= 300 && respuesta.status < 400) {
            return cortar(res, 502, 'UPSTREAM_REDIRECT', 'El proveedor intentó redirigir; no se siguen redirecciones.');
        }
        if (respuesta.status >= 400) {
            // Ni se factura ni se reenvía el cuerpo: podría llevar detalles
            // internos del proveedor que el contrato no declara.
            return cortar(res, respuesta.status, 'UPSTREAM_REJECTED', 'El proveedor rechazó la petición.');
        }

        let salida = '';
        if (metodo === 'GET') {
            const tipo = String(respuesta.headers?.['content-type'] || '');
            if (!/^application\/(.+\+)?json\b/i.test(tipo)) {
                return cortar(res, 502, 'UPSTREAM_NOT_JSON', 'El proveedor no respondió JSON.');
            }
            let datos;
            try {
                datos = await respuesta.json();
            } catch {
                return cortar(res, 502, 'UPSTREAM_NOT_JSON', 'El proveedor respondió JSON mal formado.');
            }
            const filtrados = contrato.validarRespuesta(peticion.metodoContrato, peticion.plantilla, respuesta.status, datos);
            salida = JSON.stringify(filtrados);
        }

        // La fila se escribe ANTES de responder para que el recibo exista en
        // cuanto el consumidor lo pida. Paso 2: importe 0 (piloto sin cobro).
        const callId = crypto.randomUUID();
        try {
            await query(
                `INSERT INTO marketplace_calls
                    (id, listing_id, consumer_app_id, http_status, req_hash, resp_hash, amount_cents, fee_cents)
                 VALUES ($1, $2, $3, $4, $5, $6, 0, 0)`,
                [callId, listing.id, consumerId, respuesta.status,
                    receipts.sha256(`${metodo} ${rutaFirmada}\n`), receipts.sha256(salida)],
            );
            res.set('X-BeZhas-Receipt', callId);
        } catch (err) {
            // Sin cobro todavía, perder una fila no cuesta dinero: se responde
            // igual, sin recibo. En el paso 3 esto pasa a fallar cerrado.
            logger.error({ listingId: listing.id, err: err.message }, 'marketplace: no se pudo registrar la llamada');
        }

        res.status(respuesta.status).type('application/json');
        return metodo === 'HEAD' ? res.end() : res.send(salida);
    } catch (err) {
        if (err instanceof ContratoIncumplido) {
            return cortar(res, err.status, err.code, err.message, err.detalles ? { details: err.detalles } : {});
        }
        return responderError(res, err, 'proxy');
    }
}

router.get('/call/:slug', consumo, proxy);
router.all('/call/:slug/*', consumo, proxy);

router.get('/receipts/:callId', recibo, async (req, res) => {
    if (!UUID_RE.test(req.params.callId)) return res.status(404).json({ error: 'Recibo no encontrado', code: 'RECEIPT_NOT_FOUND' });
    if (!receipts.recibosDisponibles()) {
        return res.status(503).json({ error: 'La firma de recibos no está configurada', code: 'RECEIPTS_UNAVAILABLE' });
    }
    try {
        // Sólo las dos partes de la llamada: el consumidor o el proveedor del listing.
        const { rows } = await query(
            `SELECT c.id, c.listing_id, c.consumer_app_id, c.at, c.http_status, c.req_hash, c.resp_hash,
                    c.amount_cents, c.fee_cents, c.batch_id, l.slug, l.pricing->>'currency' AS currency
             FROM marketplace_calls c
             JOIN marketplace_listings l ON l.id = c.listing_id
             WHERE c.id = $1 AND (c.consumer_app_id = $2 OR l.provider_app_id = $2)`,
            [req.params.callId, req.registeredApp.id],
        );
        const fila = rows[0];
        if (!fila) return res.status(404).json({ error: 'Recibo no encontrado', code: 'RECEIPT_NOT_FOUND' });
        const contenido = receipts.contenidoRecibo(fila);
        res.json({
            receipt: contenido,
            signature: receipts.firmarRecibo(contenido),
            alg: 'ES256',
            kid: receipts.KID,
            // null mientras la llamada no esté en un lote; con lote, la prueba de
            // inclusión y el ancla en cada red (Polygon y, cuando tenga nodo, la L2).
            anchor: fila.batch_id ? await anchor.pruebaDe(fila.batch_id, fila.id) : null,
        });
    } catch (err) {
        responderError(res, err, 'receipts.get');
    }
});

module.exports = router;
