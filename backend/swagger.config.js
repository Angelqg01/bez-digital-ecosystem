const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'BeZhas API - Developer Documentation',
            version: '2.0.0',
            description: `
# BeZhas Public API

API RESTful para integrar BeZhas Quality Oracle en tu aplicación.

## 🔐 Autenticación
Todas las peticiones requieren un API Key:
\`\`\`
X-API-Key: YOUR_API_KEY
\`\`\`

## 📊 Rate Limits
- **Free Tier**: 100 req/hour
- **Pro Tier**: 1000 req/hour  
- **Enterprise**: Sin límite

## 🌐 Endpoints Públicos
Solo se documentan endpoints seguros para desarrolladores externos.

## 📝 Cómo obtener tu API Key
1. Visita https://bezhas.com/developers
2. Crea una cuenta o inicia sesión
3. Ve a Settings > Developer
4. Genera tu API Key
            `,
            contact: {
                name: 'BeZhas Developer Support',
                email: 'dev@bezhas.com',
                url: 'https://bezhas.com/developers'
            },
            license: {
                name: 'Proprietary',
                url: 'https://bezhas.com/terms'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000/api',
                description: 'Development Server'
            },
            {
                url: 'https://api.bezhas.com',
                description: 'Production Server'
            }
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key',
                    description: 'API Key obtenido desde el Developer Portal'
                },
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Token JWT para autenticación de usuarios'
                }
            },
            schemas: {
                Service: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        businessWallet: { type: 'string', example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' },
                        clientWallet: { type: 'string', example: '0x456d35Cc6634C0532925a3b844Bc9e7595f0aaa' },
                        collateralAmount: { type: 'string', example: '1000000000000000000' },
                        initialQuality: { type: 'integer', example: 95, minimum: 1, maximum: 100 },
                        status: {
                            type: 'string',
                            enum: ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'CANCELLED'],
                            example: 'IN_PROGRESS'
                        },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                Balance: {
                    type: 'object',
                    properties: {
                        address: { type: 'string', example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' },
                        balance: { type: 'string', example: '1000000000000000000' },
                        balanceFormatted: { type: 'string', example: '1.0 BEZ' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string', example: 'Invalid API Key' },
                        message: { type: 'string', example: 'La API Key proporcionada no es válida' },
                        code: { type: 'integer', example: 403 }
                    }
                },
                HealthStatus: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'healthy' },
                        timestamp: { type: 'string', format: 'date-time' },
                        version: { type: 'string', example: '2.0.0' },
                        uptime: { type: 'number', example: 86400 }
                    }
                }
            },
            responses: {
                Unauthorized: {
                    description: 'API Key faltante o inválida',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                },
                RateLimitExceeded: {
                    description: 'Límite de rate excedido',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    error: { type: 'string', example: 'Rate limit exceeded' },
                                    retryAfter: { type: 'integer', example: 3600 }
                                }
                            }
                        }
                    }
                }
            }
        },
        security: [{ ApiKeyAuth: [] }],
        tags: [
            {
                name: 'Quality Oracle',
                description: 'Endpoints para gestionar servicios con garantía de calidad',
                externalDocs: {
                    description: 'Ver Whitepaper',
                    url: 'https://bezhas.com/whitepaper'
                }
            },
            {
                name: 'BezCoin',
                description: 'Consultas de balance y transacciones (solo lectura)'
            },
            {
                name: 'Health',
                description: 'Estado del sistema y métricas públicas'
            },
            {
                name: 'Developer',
                description: 'Gestión de API Keys y portal de desarrolladores'
            }
        ]
    },
    apis: ['./routes/escrow.routes.js', './routes/bezcoin.routes.js', './routes/health.routes.js', './routes/developer-portal.routes.js']
};

module.exports = swaggerJsdoc(options);
