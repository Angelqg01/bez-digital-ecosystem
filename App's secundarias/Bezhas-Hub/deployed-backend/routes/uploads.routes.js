const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// In-memory storage for IPFS uploads and file management
let uploads = [];
let uploadIdCounter = 1;

// Simple file upload endpoint (mock IPFS)
router.post('/upload-ipfs',
    [
        body('fileName').isString().withMessage('File name is required'),
        body('fileSize').isNumeric().withMessage('File size must be numeric'),
        body('fileType').isString().withMessage('File type is required'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { fileName, fileSize, fileType } = req.body;

        // Generate mock IPFS hash
        const hash = `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

        const upload = {
            id: uploadIdCounter++,
            hash,
            fileName,
            fileSize: parseInt(fileSize),
            fileType,
            uploadedAt: new Date().toISOString(),
            url: `https://ipfs.io/ipfs/${hash}`
        };

        uploads.push(upload);

        res.json({
            success: true,
            hash,
            url: upload.url,
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