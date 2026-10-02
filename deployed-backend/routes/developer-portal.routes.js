const express = require('express');
const router = express.Router();
const { generateApiKey, getAllApiKeys, addApiKey } = require('../middleware/apiKeyAuth');

/**
 * @swagger
 * /developers/register:
 *   get:
 *     summary: Portal de registro para desarrolladores
 *     description: Información sobre cómo registrarse y obtener una API Key
 *     tags: [Developer]
 *     responses:
 *       200:
 *         description: Información de registro
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 steps:
 *                   type: array
 *                   items:
 *                     type: string
 *                 demoKeys:
 *                   type: object
 *                   properties:
 *                     free:
 *                       type: string
 *                     pro:
 *                       type: string
 */
router.get('/register', (req, res) => {
    res.json({
        message: 'BeZhas Developer Portal - API Key Registration',
        steps: [
            '1. Crea una cuenta en https://bezhas.com',
            '2. Ve a Settings > Developer',
            '3. Genera tu API Key',
            '4. Lee la documentación en /api-docs',
            '5. Prueba tus integraciones en el Playground'
        ],
        demoKeys: {
            free: 'bzh_dev_1234567890abcdef',
            pro: 'bzh_pro_abcdef1234567890'
        },
        pricing: {
            free: {
                rateLimit: '100 req/hour',
                features: ['Endpoints básicos', 'Documentación completa', 'Soporte por email'],
                price: '$0/mes'
            },
            pro: {
                rateLimit: '1000 req/hour',
                features: ['Todos los endpoints', 'Webhooks', 'Soporte prioritario', 'Dashboard de métricas'],
                price: '$49/mes'
            },
            enterprise: {
                rateLimit: 'Sin límite',
                features: ['API personalizada', 'SLA 99.9%', 'Soporte 24/7', 'Onboarding dedicado', 'White-label'],
                price: 'Contactar ventas'
            }
        },
        documentation: 'http://localhost:3000/api-docs',
        support: 'dev@bezhas.com'
    });
});

/**
 * @swagger
 * /developers/keys:
 *   get:
 *     summary: Listar API Keys disponibles (Demo)
 *     description: Muestra las API Keys de demostración disponibles para testing
 *     tags: [Developer]
 *     responses:
 *       200:
 *         description: Lista de API Keys demo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                       tier:
 *                         type: string
 *                       name:
 *                         type: string
 */
router.get('/keys', (req, res) => {
    const keys = getAllApiKeys();
    res.json({
        message: 'Demo API Keys disponibles para testing',
        warning: 'Estas keys son solo para desarrollo. No usar en producción.',
        keys: keys
    });
});

/**
 * @swagger
 * /developers/generate:
 *   post:
 *     summary: Generar nueva API Key (Demo)
 *     description: Genera una API Key temporal para testing (solo desarrollo)
 *     tags: [Developer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tier
 *               - name
 *             properties:
 *               tier:
 *                 type: string
 *                 enum: [free, pro, enterprise]
 *                 example: free
 *               name:
 *                 type: string
 *                 example: "Mi App de Prueba"
 *     responses:
 *       201:
 *         description: API Key generada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 apiKey:
 *                   type: string
 *                 tier:
 *                   type: string
 *                 rateLimit:
 *                   type: integer
 */
router.post('/generate', (req, res) => {
    const { tier = 'free', name = 'Unnamed Key' } = req.body;

    if (!['free', 'pro', 'enterprise'].includes(tier)) {
        return res.status(400).json({
            error: 'Invalid tier',
            message: 'Tier debe ser: free, pro o enterprise'
        });
    }

    const newKey = generateApiKey(tier);
    const rateLimits = { free: 100, pro: 1000, enterprise: null };

    addApiKey(newKey, {
        tier: tier,
        rateLimit: rateLimits[tier],
        name: name
    });

    res.status(201).json({
        message: 'API Key generada exitosamente (solo desarrollo)',
        apiKey: newKey,
        tier: tier,
        rateLimit: rateLimits[tier],
        warning: 'Esta key es temporal y solo funciona en desarrollo',
        usage: {
            header: 'X-API-Key',
            example: `curl -H "X-API-Key: ${newKey}" http://localhost:3000/api/escrow/1`
        }
    });
});

/**
 * @swagger
 * /developers/playground:
 *   get:
 *     summary: API Playground
 *     description: Herramienta interactiva para probar la API
 *     tags: [Developer]
 *     responses:
 *       200:
 *         description: Información del playground
 */
router.get('/playground', (req, res) => {
    res.json({
        message: 'BeZhas API Playground',
        description: 'Prueba la API directamente desde tu navegador',
        endpoints: [
            {
                method: 'GET',
                path: '/api/escrow/1',
                description: 'Obtener detalles de un servicio',
                try: 'http://localhost:3000/api/escrow/1'
            },
            {
                method: 'POST',
                path: '/api/escrow/create',
                description: 'Crear nuevo servicio',
                body: {
                    clientWallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
                    amount: '1000000000000000000',
                    initialQuality: 95
                }
            }
        ],
        tools: [
            'Swagger UI: http://localhost:3000/api-docs',
            'Postman Collection: https://bezhas.com/postman',
            'SDK JavaScript: npm install @bezhas/sdk'
        ]
    });
});

module.exports = router;
