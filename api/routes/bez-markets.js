/**
 * routes/bez-markets.js — tokenización RWA, mercado de fracciones y swap de BEZ
 * por el Gateway (/api/gateway/v1). Mismas operaciones que las herramientas MCP
 * bezhas_tokenize_prepare, bezhas_rwa_* y bezhas_bez_swap_*: las dos puertas
 * llaman a los mismos servicios.
 *
 * Nada aquí firma ni mueve fondos: todo devuelve transacciones sin firmar para
 * la wallet del cliente. La compra de BEZ a BeZhas (fase semilla) sigue en
 * /payments/buy y bezhas_checkout_prepare (BEZ-Pay).
 *
 *   GET  /bez/swap/status                      ¿hay mercado de BEZ abierto?
 *   GET  /bez/swap/quote?lado=&importe=        cotización del pool
 *   POST /bez/swap/prepare                     approve + swap sin firmar
 *   POST /rwa/tokenize/prepare                 approve comisión + tokenizeAsset
 *   GET  /rwa/:fabrica/assets/:assetId         ficha del activo
 *   GET  /rwa/:fabrica/creators/:address       activos de un creador (titularidad)
 *   POST /rwa/transfer/prepare                 transferir fracciones
 *   GET  /rwa/:fabrica/sale/listings/:id       oferta de venta primaria
 *   POST /rwa/sale/list/prepare                abrir venta primaria (creador)
 *   POST /rwa/sale/buy/prepare                 comprar fracciones (titularidad)
 */
const { Router } = require('express');
const { body, param, query: qv, validationResult } = require('express-validator');
const { requireScope } = require('../middleware/gateway-auth');
const { requireAddressAccess, exigirTitularidadEnCuerpo } = require('../middleware/address-access');
const { autenticarConPlan } = require('../middleware/plan-limits');
const { meterUsage } = require('../middleware/gateway-metering');
const bezSwap = require('../services/bezSwap');
const rwaTokenization = require('../services/rwaTokenization');
const rwaMarket = require('../services/rwaMarket');
const logger = require('../utils/logger');

const router = Router();
router.use(meterUsage('api_call'));

const FABRICAS = Object.keys(rwaTokenization.FABRICAS);
const BEZ_DECIMAL = /^\d{1,15}(\.\d{1,18})?$/;

function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return false;
    }
    return true;
}

/** Los errores de los servicios ya traen código y estado pensados para el cliente. */
function responderError(res, err, contexto) {
    if (err instanceof bezSwap.SwapError || err instanceof rwaTokenization.TokenizationError
        || err instanceof rwaMarket.RwaMarketError) {
        return res.status(err.status || 400).json({ error: err.message, code: err.code });
    }
    logger.error({ err: err.message }, contexto);
    return res.status(500).json({ error: 'Error interno', code: 'INTERNAL' });
}

const ruta = (contexto, fn) => async (req, res) => {
    if (!validate(req, res)) return;
    try {
        res.json({ success: true, ...(await fn(req, res)) });
    } catch (err) {
        if (!res.headersSent) responderError(res, err, contexto);
    }
};

// ── Swap de BEZ (no custodio) ────────────────────────────────────────────────

router.get('/bez/swap/status', autenticarConPlan, requireScope('contracts'),
    ruta('bez swap status', async () => bezSwap.estado()));

router.get('/bez/swap/quote', autenticarConPlan, requireScope('contracts'), [
    qv('lado').isIn(['compra', 'venta']),
    qv('importe').matches(BEZ_DECIMAL),
], ruta('bez swap quote', async (req) => bezSwap.cotizar({ lado: req.query.lado, importe: req.query.importe })));

router.post('/bez/swap/prepare', autenticarConPlan, requireScope('contracts'), [
    body('lado').isIn(['compra', 'venta']),
    body('importe').matches(BEZ_DECIMAL),
    body('wallet').isEthereumAddress(),
    body('deslizamientoBps').optional().isInt({ min: 1, max: bezSwap.DESLIZAMIENTO_MAX_BPS }),
    body('plazoMin').optional().isInt({ min: 1, max: 60 }),
], ruta('bez swap prepare', async (req) => bezSwap.prepararSwap({
    lado: req.body.lado, importe: req.body.importe, wallet: req.body.wallet,
    deslizamientoBps: req.body.deslizamientoBps, plazoMin: req.body.plazoMin,
})));

// ── Tokenización RWA ─────────────────────────────────────────────────────────

router.post('/rwa/tokenize/prepare', autenticarConPlan, requireScope('contracts'), [
    body('fabrica').optional().isIn(FABRICAS),
    body('nombre').isString().isLength({ min: 3, max: 120 }),
    body('categoria').isIn(rwaTokenization.CATEGORIAS),
    body('cidDocumentacion').isString(),
    body('cidImagenes').optional().isString(),
    body('fracciones').isInt({ min: 1, max: 1_000_000_000 }),
    body('valoracionUsd').isInt({ min: 1 }),
    body('precioFraccionBez').matches(BEZ_DECIMAL),
    body('rendimientoAnualPct').isFloat({ min: 0, max: 100 }),
    body('ubicacion').isString().isLength({ min: 2, max: 200 }),
], ruta('rwa tokenize prepare', async (req) => rwaTokenization.prepararTokenizacion({
    fabrica: req.body.fabrica || 'activos',
    nombre: req.body.nombre,
    categoria: req.body.categoria,
    cidDocumentacion: req.body.cidDocumentacion,
    cidImagenes: req.body.cidImagenes,
    fracciones: Number(req.body.fracciones),
    valoracionUsd: Number(req.body.valoracionUsd),
    precioFraccionBez: String(req.body.precioFraccionBez),
    rendimientoAnualPct: Number(req.body.rendimientoAnualPct),
    ubicacion: req.body.ubicacion,
})));

// ── Activos y transferencias ─────────────────────────────────────────────────

router.get('/rwa/:fabrica/assets/:assetId', autenticarConPlan, requireScope('contracts'), [
    param('fabrica').isIn(FABRICAS),
    param('assetId').isInt({ min: 1 }),
], ruta('rwa asset', async (req) => ({
    activo: await rwaMarket.leerActivo({ fabrica: req.params.fabrica, assetId: req.params.assetId }),
})));

router.get('/rwa/:fabrica/creators/:address', autenticarConPlan, requireScope('contracts'),
    requireAddressAccess(), [
        param('fabrica').isIn(FABRICAS),
        param('address').isEthereumAddress(),
    ], ruta('rwa creator assets', async (req) => rwaMarket.activosDeCreador({
        fabrica: req.params.fabrica, creador: req.params.address,
    })));

router.post('/rwa/transfer/prepare', autenticarConPlan, requireScope('contracts'), [
    body('fabrica').optional().isIn(FABRICAS),
    body('assetId').isInt({ min: 1 }),
    body('desde').isEthereumAddress(),
    body('hacia').isEthereumAddress(),
    body('cantidad').isInt({ min: 1 }),
], ruta('rwa transfer prepare', async (req) => rwaMarket.prepararTransferencia({
    fabrica: req.body.fabrica || 'activos', assetId: req.body.assetId,
    desde: req.body.desde, hacia: req.body.hacia, cantidad: req.body.cantidad,
})));

// ── Venta primaria de fracciones ─────────────────────────────────────────────

router.get('/rwa/:fabrica/sale/listings/:listingId', autenticarConPlan, requireScope('contracts'), [
    param('fabrica').isIn(FABRICAS),
    param('listingId').isInt({ min: 1 }),
], ruta('rwa listing', async (req) => ({
    oferta: await rwaMarket.leerOferta({ fabrica: req.params.fabrica, listingId: req.params.listingId }),
})));

router.post('/rwa/sale/list/prepare', autenticarConPlan, requireScope('contracts'), [
    body('fabrica').optional().isIn(FABRICAS),
    body('assetId').isInt({ min: 1 }),
    body('cantidad').isInt({ min: 1 }),
    body('precioFraccionBez').matches(BEZ_DECIMAL),
    body('vendedor').isEthereumAddress(),
], ruta('rwa sale list prepare', async (req) => rwaMarket.prepararOferta({
    fabrica: req.body.fabrica || 'activos', assetId: req.body.assetId, cantidad: req.body.cantidad,
    precioFraccionBez: req.body.precioFraccionBez, vendedor: req.body.vendedor,
})));

router.post('/rwa/sale/buy/prepare', autenticarConPlan, requireScope('contracts'), [
    body('fabrica').optional().isIn(FABRICAS),
    body('listingId').isInt({ min: 1 }),
    body('cantidad').isInt({ min: 1 }),
    body('comprador').isEthereumAddress(),
], async (req, res, next) => {
    // Se lee el estado KYC del comprador: sólo para wallets que la clave puede representar.
    if (!validate(req, res)) return;
    if (!(await exigirTitularidadEnCuerpo(req, res, req.body.comprador))) return;
    next();
}, ruta('rwa sale buy prepare', async (req) => rwaMarket.prepararCompra({
    fabrica: req.body.fabrica || 'activos', listingId: req.body.listingId,
    cantidad: req.body.cantidad, comprador: req.body.comprador,
})));

module.exports = router;
