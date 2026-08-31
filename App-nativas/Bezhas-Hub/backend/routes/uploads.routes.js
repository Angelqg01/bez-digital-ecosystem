const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const ipfsService = require('../services/ipfs.service');

// In-memory storage for IPFS uploads and file management
let uploads = [];
let uploadIdCounter = 1;

// Hash determinista (reproducible) para el caso sin contenido — sustituye al
// antiguo Math.random(), que generaba hashes ficticios distintos en cada llamada.
function deterministicCid(fileName, fileSize, fileType) {
    const digest = crypto.createHash('sha256')
        .update(`${fileName}|${fileSize}|${fileType}`)
        .digest('hex');
    return `Qm${digest.substring(0, 44)}`;
}

// IPFS upload endpoint.
// - Si llega `content` (base64) → subida REAL vía ipfs.service (Pinata si está
//   configurado; el propio servicio cae a mock honesto si no lo está).
// - Sin `content` → CID determinista + mock:true (no fabricamos hashes aleatorios).
router.post('/upload-ipfs',
    [
        body('fileName').isString().withMessage('File name is required'),
        body('fileSize').isNumeric().withMessage('File size must be numeric'),
        body('fileType').isString().withMessage('File type is required'),
        body('content').optional().isString().withMessage('content must be base64 string'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { fileName, fileSize, fileType, content } = req.body;

        let hash, url, isMock, size;
        try {
            if (content) {
                // Subida real (o mock honesto del servicio si Pinata no está configurado).
                const buffer = Buffer.from(content, 'base64');
                const result = await ipfsService.uploadToIPFS(buffer, fileName, { fileType });
                hash = result.ipfsHash;
                url = result.gatewayUrl;
                size = result.size;
                isMock = Boolean(result.mock);
            } else {
                // Sin contenido no hay CID real posible → placeholder determinista y honesto.
                hash = deterministicCid(fileName, fileSize, fileType);
                url = `https://ipfs.io/ipfs/${hash}`;
                size = parseInt(fileSize);
                isMock = true;
            }
        } catch (e) {
            return res.status(502).json({ success: false, error: `IPFS upload failed: ${e.message}` });
        }

        const upload = {
            id: uploadIdCounter++,
            hash,
            fileName,
            fileSize: parseInt(fileSize),
            fileType,
            size,
            uploadedAt: new Date().toISOString(),
            url,
            mock: isMock
        };

        uploads.push(upload);

        res.json({
            success: true,
            hash,
            url,
            mock: isMock,
            upload
        });
    });

// Get file info by hash
router.get('/file/:hash', (req, res) => {
    const { hash } = req.params;

    const upload = uploads.find(u => u.hash === hash);
    if (!upload) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.json(upload);
});

// List recent uploads
router.get('/uploads', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const paginatedUploads = uploads
        .slice()
        .reverse()
        .slice(offset, offset + limit);

    res.json({
        uploads: paginatedUploads,
        total: uploads.length,
        limit,
        offset
    });
});

module.exports = router;