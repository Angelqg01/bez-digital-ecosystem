'use strict';

/**
 * Subida de archivos para convertirlos en NFT (imagen, vídeo, audio o PDF del activo).
 *
 *   - Sólo con sesión Y plan suscrito (principal.plan !== 'none'); sin plan → 402.
 *   - Prohibidos los ejecutables y todo lo que no sea imagen/vídeo/audio/PDF por firma real (utils/uploadGuard.js).
 *   - El archivo se anexa a IPFS TAL CUAL: no se lee, no se parsea, no se indexa en el RAG ni se envía a un modelo.
 *     Por eso este módulo no importa nada de services/knowledge ni de services/ai-workspace (salvo la resolución del
 *     principal) y hay un test que lo vigila.
 *   - Cuerpo binario crudo (sin multipart): el Content-Type debe ser el del archivo.
 *
 * POST /api/nft-assets   Content-Type: image/png | video/mp4 | …   cabecera opcional x-file-name
 */
const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/security');
const { resolverPrincipal } = require('../services/ai-workspace/principal');
const { inspeccionarArchivo, nombreSeguro, MIMES_PERMITIDOS, MAX_BYTES } = require('../utils/uploadGuard');
const ipfs = require('../services/ipfsService');
const logger = require('../utils/logger');

const router = express.Router();

const porUsuario = (req) => String(req.user?.userId || req.user?.id || 'anon');
const limiter = rateLimit({
    windowMs: 15 * 60_000, max: Number(process.env.NFT_UPLOAD_RATE_LIMIT || 20), keyGenerator: porUsuario,
    standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiadas subidas, inténtalo más tarde.' },
});

router.use((req, res, next) => (process.env.NFT_UPLOADS_ENABLED === 'false' ? res.status(503).json({ error: 'Las subidas están desactivadas.', code: 'DISABLED' }) : next()));
router.use(authenticateToken);

// Plan ANTES de leer el cuerpo: un usuario sin plan no consume ancho de banda ni memoria.
router.use(async (req, res, next) => {
    try {
        const principal = await resolverPrincipal(req.user);
        if (!principal) return res.status(401).json({ error: 'Sesión inválida' });
        if (!principal.plan || principal.plan === 'none') {
            return res.status(402).json({ error: 'Para subir archivos necesitas un plan de BeZhas activo.', code: 'PLAN_REQUIRED' });
        }
        req.principal = principal;
        next();
    } catch (err) {
        logger.error({ error: err.message }, 'nft-assets: no se pudo resolver el plan');
        res.status(500).json({ error: 'No se pudo comprobar el plan' });
    }
});
router.use(limiter);

// Sólo cuerpos binarios de los tipos permitidos; JSON, texto, multipart, etc. quedan sin parsear y se rechazan abajo.
router.post('/', express.raw({ type: MIMES_PERMITIDOS, limit: MAX_BYTES }), async (req, res) => {
    const principal = req.principal;
    try {
        if (!Buffer.isBuffer(req.body)) {
            return res.status(415).json({ error: 'Content-Type no permitido. Envía el archivo como cuerpo binario con su tipo (image/png, video/mp4, audio/mpeg, application/pdf…).', code: 'UNSUPPORTED_TYPE' });
        }
        const info = inspeccionarArchivo(req.body, req.headers['content-type']);
        const nombre = nombreSeguro(req.headers['x-file-name']);
        const sha256 = crypto.createHash('sha256').update(req.body).digest('hex');
        const r = await ipfs.pinFile(req.body, nombre);
        logger.info({ userId: principal.userId, tenant: principal.tenantId, kind: info.kind, size: info.size, cid: r.ipfsHash }, 'nft-assets: archivo subido');
        res.status(201).json({ cid: r.ipfsHash, ipfsUri: r.ipfsUri, gatewayUrl: r.gatewayUrl, sha256: `0x${sha256}`, kind: info.kind, mime: info.mime, size: info.size, fileName: nombre });
    } catch (err) {
        if (err.status) {
            logger.warn({ userId: principal.userId, code: err.code }, 'nft-assets: archivo rechazado');
            return res.status(err.status).json({ error: err.message, code: err.code });
        }
        if (/No Pinata credentials/i.test(err.message)) return res.status(503).json({ error: 'El almacenamiento IPFS no está configurado.', code: 'IPFS_NOT_CONFIGURED' });
        logger.error({ error: err.message }, 'nft-assets: fallo al anexar a IPFS');
        res.status(502).json({ error: 'No se pudo subir el archivo a IPFS', code: 'IPFS_ERROR' });
    }
});

// Cualquier otro tipo de cuerpo (JSON, multipart, texto, ejecutables…) llega sin parsear.
router.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: `El archivo supera el máximo permitido (${MAX_BYTES / 1048576} MB).`, code: 'TOO_LARGE' });
    return next(err);
});

module.exports = router;
