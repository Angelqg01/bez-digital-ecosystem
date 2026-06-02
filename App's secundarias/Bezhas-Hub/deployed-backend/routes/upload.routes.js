const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { uploadToIPFS, isPinataConfigured } = require('../services/ipfs.service');
const { protect } = require('../middleware/auth.middleware');

// Configurar almacenamiento de multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads');

        // Crear directorio si no existe
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generar nombre único con timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
    }
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
    // Tipos permitidos
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/ogg',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
    }
};

// Configurar multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB máximo por archivo
    }
});

// Configurar multer para memoria (IPFS uploads) con límites más altos
const uploadMemory = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        // Tipos permitidos para NFTs multimedia
        const allowedTypes = [
            // Imágenes
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
            // Videos
            'video/mp4',
            'video/webm',
            'video/quicktime',
            'video/x-msvideo',
            'video/mpeg',
            // Audio
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/ogg',
            'audio/webm',
            'audio/aac',
            'audio/flac',
            // Documentos
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'application/json'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de archivo no soportado: ${file.mimetype}`), false);
        }
    },
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB máximo (para videos)
    }
});

// Rate limiter para uploads a IPFS
const ipfsUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'production' ? 10 : 100, // 10 uploads por IP en producción
    message: 'Demasiadas subidas. Intenta de nuevo más tarde.'
});

/**
 * POST /api/upload/ipfs
 * Sube archivos multimedia a IPFS para crear NFT
 * Soporta: Imágenes, Videos, Audio, Documentos
 * Requiere autenticación
 */
router.post('/ipfs', protect, ipfsUploadLimiter, uploadMemory.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se recibió ningún archivo'
            });
        }

        // Determinar categoría del archivo
        const fileCategory = getFileCategory(req.file.mimetype);
        const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);

        // Log del usuario que sube
        console.log(`📤 Usuario ${req.user?.id || 'anónimo'} subiendo ${fileCategory}: ${req.file.originalname} (${fileSizeMB} MB)`);

        // Validar categoría de archivo
        if (!fileCategory) {
            return res.status(400).json({
                success: false,
                error: 'Tipo de archivo no soportado para NFT'
            });
        }

        // Validar tamaño según tipo
        const maxSizes = {
            image: 10 * 1024 * 1024,      // 10MB para imágenes
            video: 100 * 1024 * 1024,     // 100MB para videos
            audio: 50 * 1024 * 1024,      // 50MB para audio
            document: 10 * 1024 * 1024    // 10MB para documentos
        };

        if (req.file.size > maxSizes[fileCategory]) {
            return res.status(400).json({
                success: false,
                error: `Archivo ${fileCategory} demasiado grande. Máximo: ${maxSizes[fileCategory] / (1024 * 1024)}MB`
            });
        }

        // Subir a IPFS
        const ipfsResult = await uploadToIPFS(
            req.file.buffer,
            req.file.originalname,
            {
                userId: req.user?.id,
                fileType: fileCategory,
                mimeType: req.file.mimetype,
                purpose: `nft-${fileCategory}`
            }
        );

        // Respuesta exitosa
        res.json({
            success: true,
            url: ipfsResult.ipfsUrl,
            ipfsHash: ipfsResult.ipfsHash,
            gatewayUrl: ipfsResult.gatewayUrl,
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            category: fileCategory,
            timestamp: ipfsResult.timestamp,
            mock: ipfsResult.mock || false,
            message: ipfsResult.mock ?
                '⚠️ Subida simulada - Configura PINATA_API_KEY y PINATA_SECRET_KEY para subidas reales' :
                `${getCategoryEmoji(fileCategory)} Archivo ${fileCategory} subido a IPFS exitosamente`
        });

    } catch (error) {
        console.error('❌ Error uploading to IPFS:', error);
        res.status(500).json({
            success: false,
            error: 'Error al subir el archivo a IPFS',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

/**
 * GET /api/upload/ipfs/status
 * Verifica el estado de la configuración de IPFS
 */
router.get('/ipfs/status', (req, res) => {
    const configured = isPinataConfigured();

    res.json({
        success: true,
        ipfsConfigured: configured,
        provider: configured ? 'Pinata' : 'Mock (desarrollo)',
        message: configured ?
            'IPFS configurado y listo para subidas reales' :
            'Usando IPFS mock - Configura PINATA_API_KEY y PINATA_SECRET_KEY para subidas reales',
        maxFileSizes: {
            image: '10MB',
            video: '100MB',
            audio: '50MB',
            document: '10MB'
        },
        supportedFormats: {
            images: ['JPEG', 'PNG', 'GIF', 'WebP', 'SVG'],
            videos: ['MP4', 'WebM', 'MOV', 'AVI'],
            audio: ['MP3', 'WAV', 'OGG', 'AAC', 'FLAC'],
            documents: ['PDF', 'Word', 'Excel', 'TXT', 'JSON']
        }
    });
});

/**
 * Determina la categoría del archivo basado en mimetype
 */
function getFileCategory(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.startsWith('application/') || mimetype.startsWith('text/')) return 'document';
    return null;
}

/**
 * Retorna emoji según la categoría
 */
function getCategoryEmoji(category) {
    const emojis = {
        image: '🖼️',
        video: '🎬',
        audio: '🎵',
        document: '📄'
    };
    return emojis[category] || '📦';
}

/**
 * POST /api/upload
 * Sube uno o múltiples archivos
 */
router.post('/upload', upload.array('files', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No se subieron archivos' });
        }

        // Mapear información de archivos subidos
        const uploadedFiles = req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            url: `/uploads/${file.filename}`,
            type: getFileType(file.mimetype)
        }));

        res.json({
            success: true,
            files: uploadedFiles,
            count: uploadedFiles.length
        });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: 'Error al subir archivos' });
    }
});

/**
 * DELETE /api/upload/:filename
 * Elimina un archivo subido
 */
router.delete('/upload/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, '../../uploads', filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'Archivo eliminado' });
        } else {
            res.status(404).json({ error: 'Archivo no encontrado' });
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Error al eliminar archivo' });
    }
});

/**
 * Determina el tipo de archivo basado en mimetype
 */
function getFileType(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype === 'application/pdf') return 'pdf';
    return 'document';
}

module.exports = router;
