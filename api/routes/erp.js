'use strict';

/**
 * routes/erp.js — conexiones gestionadas con el ERP del cliente.
 *
 * Todo va detrás de `authenticateApp`: aquí no hay superficie anónima. El alta
 * la abre el agente por MCP, pero quien rellena credenciales es una persona en
 * la pantalla, y quien llama a estas rutas es su api-key.
 *
 * DOS COSAS QUE ESTAS RUTAS NO HACEN, A PROPÓSITO:
 *
 *  · No devuelven credenciales. Ni enmascaradas. Se devuelve qué campos hay
 *    puestos, no su valor.
 *  · No aceptan una ruta, una consulta ni una URL como argumento. El destino y
 *    el conjunto de documentos posibles están decididos en el repositorio: es
 *    la misma razón por la que el MCP no tiene `call_gateway(path)`, con el
 *    agravante de que aquí el destino es un sistema de otro.
 */

const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const { authenticateApp, requireScope } = require('../middleware/gateway-auth');
const erpConnections = require('../services/erpConnections');
const { IDS, describirErp, canonical } = require('../services/erp');
const { ErpHttpError } = require('../services/erp/httpGuard');
const logger = require('../utils/logger');

const router = Router();

/**
 * Límite propio, más estrecho que el del Gateway.
 *
 * Cada petición de aquí se convierte en una petición al ERP del cliente: un
 * agente en bucle no nos satura a nosotros, le satura a él su S/4HANA. El
 * límite protege al cliente de su propio agente.
 */
const erpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.ERP_RATE_LIMIT_MAX, 10) || 60,
    keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
    message: { error: 'Demasiadas llamadas al ERP.', code: 'ERP_RATE_LIMIT' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.use(erpLimiter, authenticateApp, requireScope('contracts', 'wallet'));

/** Traduce los errores del dominio a HTTP sin filtrar detalle interno. */
function fallo(res, err, contexto) {
    if (err instanceof ErpHttpError) {
        const estado = {
            ERP_NO_SOPORTADO: 400, ERP_URL_INVALIDA: 400, ERP_URL_NO_HTTPS: 400,
            ERP_PUERTO_NO_ADMITIDO: 400, ERP_URL_CON_CREDENCIALES: 400,
            ERP_DESTINO_INTERNO: 400, ERP_DNS: 400,
            ERP_CREDENCIALES_INCOMPLETAS: 400, ERP_CREDENCIALES_DESCONOCIDAS: 400,
            ERP_ALCANCE_INVALIDO: 400, ERP_TIPO_DESCONOCIDO: 400,
            ERP_FILTRO_NO_ADMITIDO: 400, ERP_FILTRO_FECHA: 400, ERP_FILTRO_LARGO: 400,
            ERP_FILTRO_CARACTERES: 400, ERP_PAYLOAD_INCOMPLETO: 400,
            ERP_SIN_IDEMPOTENCIA: 400, ERP_IDEMPOTENCIA_REUSADA: 409,
            ERP_SIN_DPA: 412, ERP_ESCRITURA_NO_AUTORIZADA: 403,
            ERP_INACTIVA: 409, ERP_PRUEBA_FALLIDA: 409,
            ERP_CREDENCIALES: 502, ERP_TIMEOUT: 504,
        }[err.code] || 502;
        return res.status(estado).json({ error: err.message, code: err.code });
    }
    logger.error({ error: err.message, contexto }, 'Fallo en rutas ERP');
    return res.status(500).json({ error: 'No se pudo completar la operación con el ERP.' });
}

/** GET /erp/catalogo — qué ERPs hay y qué credenciales pide cada uno. */
router.get('/catalogo', (_req, res) => {
    res.json({
        success: true,
        erps: IDS.map(describirErp),
        tiposDocumento: canonical.NOMBRES.map((t) => ({
            id: t, nombre: canonical.TIPOS[t].nombre, campos: canonical.camposDe(t),
        })),
    });
});

/** GET /erp/connections */
router.get('/connections', async (req, res) => {
    try {
        res.json({ success: true, connections: await erpConnections.listar(req.registeredApp.id) });
    } catch (err) { fallo(res, err, 'listar'); }
});

/** POST /erp/connections — nace desactivada; activarla es otro paso. */
router.post('/connections', async (req, res) => {
    try {
        const { erp, nombre, baseUrl, credenciales, alcanceCampos, modo } = req.body || {};
        if (!erp || !nombre || !baseUrl) {
            return res.status(400).json({ error: 'Faltan erp, nombre o baseUrl.', code: 'ERP_ALTA_INCOMPLETA' });
        }
        const conexion = await erpConnections.crear({
            appId: req.registeredApp.id,
            orgId: req.registeredApp.enterpriseId || null,
            erp, nombre, baseUrl, credenciales: credenciales || {},
            alcanceCampos: alcanceCampos || [], modo: modo || 'gestionado',
        });
        res.status(201).json({ success: true, connection: conexion });
    } catch (err) { fallo(res, err, 'crear'); }
});

router.get('/connections/:id', async (req, res) => {
    try {
        const c = await erpConnections.obtener(req.registeredApp.id, req.params.id);
        if (!c) return res.status(404).json({ error: 'Conexión no encontrada.' });
        res.json({ success: true, connection: c });
    } catch (err) { fallo(res, err, 'obtener'); }
});

/** POST /erp/connections/:id/test */
router.post('/connections/:id/test', async (req, res) => {
    try {
        res.json({ success: true, prueba: await erpConnections.probar(req.registeredApp.id, req.params.id) });
    } catch (err) { fallo(res, err, 'probar'); }
});

/**
 * POST /erp/connections/:id/activate
 *
 * `dpaFirmadoAt` lo pone la pantalla cuando el DPA está firmado. No lo puede
 * poner el agente por su cuenta: llega por esta ruta con la api-key del cliente
 * y queda registrado con fecha.
 */
router.post('/connections/:id/activate', async (req, res) => {
    try {
        const c = await erpConnections.activar(req.registeredApp.id, req.params.id, {
            dpaFirmadoAt: req.body?.dpaFirmadoAt || null,
        });
        if (!c) return res.status(404).json({ error: 'Conexión no encontrada.' });
        res.json({ success: true, connection: c });
    } catch (err) { fallo(res, err, 'activar'); }
});

router.post('/connections/:id/deactivate', async (req, res) => {
    try {
        const c = await erpConnections.desactivar(req.registeredApp.id, req.params.id);
        if (!c) return res.status(404).json({ error: 'Conexión no encontrada.' });
        res.json({ success: true, connection: c });
    } catch (err) { fallo(res, err, 'desactivar'); }
});

router.delete('/connections/:id', async (req, res) => {
    try {
        const borrada = await erpConnections.borrar(req.registeredApp.id, req.params.id);
        if (!borrada) return res.status(404).json({ error: 'Conexión no encontrada.' });
        res.json({ success: true });
    } catch (err) { fallo(res, err, 'borrar'); }
});

/** POST /erp/connections/:id/write-scope — qué tipos se pueden escribir. */
router.post('/connections/:id/write-scope', async (req, res) => {
    try {
        const c = await erpConnections.autorizarEscritura(
            req.registeredApp.id, req.params.id, req.body?.tipos || []
        );
        if (!c) return res.status(404).json({ error: 'Conexión no encontrada.' });
        res.json({ success: true, connection: c });
    } catch (err) { fallo(res, err, 'autorizar escritura'); }
});

/** GET /erp/connections/:id/schema/:tipo */
router.get('/connections/:id/schema/:tipo', async (req, res) => {
    try {
        const esquema = await erpConnections.describirEsquema(
            req.registeredApp.id, req.params.id, req.params.tipo
        );
        if (!esquema) return res.status(404).json({ error: 'Conexión no encontrada.' });
        res.json({ success: true, esquema });
    } catch (err) { fallo(res, err, 'esquema'); }
});

/**
 * GET /erp/connections/:id/documents/:tipo
 *
 * El filtro llega por query y lo acota `normalizarFiltro` del adaptador: sólo
 * seis claves, todas tipadas. Lo que no está en esa lista se rechaza en vez de
 * ignorarse — ignorarlo devolvería un resultado que no es el que se pidió.
 */
router.get('/connections/:id/documents/:tipo', async (req, res) => {
    try {
        const { desde, hasta, estado, numero, contraparte, limite } = req.query;
        const filtro = {};
        if (desde) filtro.desde = desde;
        if (hasta) filtro.hasta = hasta;
        if (estado) filtro.estado = estado;
        if (numero) filtro.numero = numero;
        if (contraparte) filtro.contraparte = contraparte;
        if (limite) filtro.limite = limite;

        const r = await erpConnections.listarDocumentos(
            req.registeredApp.id, req.params.id, req.params.tipo, filtro
        );
        if (!r) return res.status(404).json({ error: 'Conexión no encontrada.' });
        res.json({ success: true, ...r });
    } catch (err) { fallo(res, err, 'listar documentos'); }
});

router.get('/connections/:id/documents/:tipo/:docId', async (req, res) => {
    try {
        const doc = await erpConnections.obtenerDocumento(
            req.registeredApp.id, req.params.id, req.params.tipo, req.params.docId
        );
        if (doc === null) return res.status(404).json({ error: 'Documento no encontrado.' });
        res.json({ success: true, documento: doc });
    } catch (err) { fallo(res, err, 'obtener documento'); }
});

/**
 * POST /erp/connections/:id/documents/:tipo — escritura.
 *
 * Exige `Idempotency-Key`. No se genera uno por defecto: un valor generado aquí
 * sería distinto en cada intento, que es exactamente lo contrario de lo que
 * hace falta cuando el que reintenta es un agente.
 */
router.post('/connections/:id/documents/:tipo', async (req, res) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'] || req.body?.idempotencyKey;
        if (!idempotencyKey) {
            return res.status(400).json({
                error: 'Falta la cabecera Idempotency-Key. Sin ella, un reintento duplicaría el documento en tu ERP.',
                code: 'ERP_SIN_IDEMPOTENCIA',
            });
        }
        const r = await erpConnections.escribirDocumento(req.registeredApp.id, req.params.id, {
            tipo: req.params.tipo,
            payload: req.body?.documento || {},
            idempotencyKey: String(idempotencyKey).slice(0, 200),
            approvalId: req.body?.approvalId || null,
        });
        if (!r) return res.status(404).json({ error: 'Conexión no encontrada.' });
        res.status(r.reintento ? 200 : 201).json({ success: true, resultado: r });
    } catch (err) { fallo(res, err, 'escribir documento'); }
});

module.exports = router;
