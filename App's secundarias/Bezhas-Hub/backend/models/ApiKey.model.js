const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
    // Información básica
    name: {
        type: String,
        required: [true, 'Por favor proporciona un nombre para la aplicación'],
        trim: true,
        maxlength: [100, 'El nombre no puede superar 100 caracteres']
    },

    description: {
        type: String,
        maxlength: [500, 'La descripción no puede superar 500 caracteres']
    },

    // Clave de API
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Hash de la clave (para validación segura)
    keyHash: {
        type: String,
        required: true
    },

    // Usuario propietario
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Sector/Industria
    sector: {
        type: String,
        enum: [
            'ecommerce',
            'logistics',
            'services',
            'realestate',
            'finance',
            'healthcare',
            'automotive',
            'manufacturing',
            'energy',
            'agriculture',
            'education',
            'insurance',
            'entertainment',
            'legal',
            'supply_chain',
            'government',
            'carbon',
            'other'
        ],
        required: true
    },

    // Permisos granulares (Arquitectura Modular)
    permissions: [{
        type: String,
        enum: [
            // Marketplace
            'marketplace:read',
            'marketplace:write',
            'marketplace:delete',

            // Logistics
            'logistics:read',
            'logistics:write',
            'logistics:fleet',

            // Payments & Escrow
            'payments:read',
            'payments:escrow:create',
            'payments:escrow:release',
            'payments:swap',

            // AI/Moderation
            'ai:moderate',
            'ai:translate',
            'ai:analyze',

            // Identity/KYC
            'identity:read',
            'identity:verify',

            // Analytics
            'analytics:read',

            // IoT (para sensores)
            'iot:read',
            'iot:write',

            // Real Estate
            'realestate:tokenize',
            'realestate:fractionate',
            'realestate:manage',
            'realestate:rent:collect',

            // Healthcare
            'healthcare:prescriptions:verify',
            'healthcare:supply:track',
            'healthcare:records:read',
            'healthcare:records:write',
            'healthcare:compliance:audit',

            // Automotive
            'automotive:vehicle:tokenize',
            'automotive:parts:sync',
            'automotive:maintenance:log',
            'automotive:history:read',
            'automotive:ownership:transfer',

            // Manufacturing
            'manufacturing:iot:read',
            'manufacturing:quality:certify',
            'manufacturing:supply:track',
            'manufacturing:twin:create',
            'manufacturing:compliance:verify',

            // Energy
            'energy:credits:trade',
            'energy:consumption:track',
            'energy:grid:balance',
            'energy:renewable:certify',
            'energy:meters:read',

            // Agriculture
            'agriculture:harvest:certify',
            'agriculture:supply:track',
            'agriculture:land:tokenize',
            'agriculture:organic:verify',
            'agriculture:iot:sensors',

            // Education
            'education:credentials:issue',
            'education:credentials:verify',
            'education:courses:manage',
            'education:enrollment:track',
            'education:certificates:mint',

            // Insurance
            'insurance:policy:create',
            'insurance:claim:process',
            'insurance:claim:verify',
            'insurance:oracle:trigger',
            'insurance:premium:calculate',

            // Entertainment
            'entertainment:nft:mint',
            'entertainment:royalties:distribute',
            'entertainment:rights:manage',
            'entertainment:tickets:issue',
            'entertainment:streaming:track',

            // Legal
            'legal:contract:deploy',
            'legal:notarize',
            'legal:dispute:arbitrate',
            'legal:documents:verify',
            'legal:signatures:collect',

            // Supply Chain
            'supply:provenance:track',
            'supply:compliance:verify',
            'supply:carbon:offset',
            'supply:customs:clear',
            'supply:warehouse:manage',

            // Government
            'gov:identity:issue',
            'gov:identity:verify',
            'gov:vote:cast',
            'gov:records:certify',
            'gov:licenses:issue',

            // Carbon Credits
            'carbon:credits:issue',
            'carbon:credits:trade',
            'carbon:offset:verify',
            'carbon:projects:certify',
            'carbon:compliance:report'
        ]
    }],

    // Estado
    status: {
        type: String,
        enum: ['active', 'suspended', 'revoked'],
        default: 'active',
        index: true
    },

    // Rate Limiting
    rateLimit: {
        requestsPerMinute: {
            type: Number,
            default: 60
        },
        requestsPerDay: {
            type: Number,
            default: 10000
        }
    },

    // Métricas de Uso
    usage: {
        totalRequests: {
            type: Number,
            default: 0
        },
        lastUsed: Date,
        requestsToday: {
            type: Number,
            default: 0
        },
        requestsThisMonth: {
            type: Number,
            default: 0
        },
        smartContractCalls: {
            type: Number,
            default: 0
        },
        identityValidations: {
            type: Number,
            default: 0
        }
    },

    // Achievements (Gamification)
    achievements: [{
        id: String,
        name: String,
        unlockedAt: {
            type: Date,
            default: Date.now
        },
        rewardClaimed: {
            type: Boolean,
            default: false
        }
    }],

    // Configuración de entorno
    environment: {
        type: String,
        enum: ['development', 'production'],
        default: 'development'
    },

    // Whitelist de IPs (opcional)
    ipWhitelist: [String],

    // Webhooks
    webhooks: [{
        url: String,
        events: [String],
        secret: String,
        active: {
            type: Boolean,
            default: true
        }
    }],

    // Metadata adicional
    metadata: {
        type: Map,
        of: String
    },

    // Timestamps
    lastRotated: Date,
    expiresAt: Date

}, {
    timestamps: true
});

// Índices compuestos para búsquedas eficientes
apiKeySchema.index({ user: 1, status: 1 });
apiKeySchema.index({ sector: 1, status: 1 });
apiKeySchema.index({ createdAt: -1 });

// Métodos estáticos

// Generar nueva API Key
apiKeySchema.statics.generateKey = function (userId, sector, environment = 'development') {
    const prefix = environment === 'production' ? 'bzh_live' : 'bzh_test';
    const randomPart = crypto.randomBytes(24).toString('hex');
    return `${prefix}_${sector}_${randomPart}`;
};

// Hashear la clave
apiKeySchema.statics.hashKey = function (key) {
    return crypto.createHash('sha256').update(key).digest('hex');
};

// Verificar clave
apiKeySchema.methods.verifyKey = function (key) {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return this.keyHash === hash;
};

// Verificar permiso específico
apiKeySchema.methods.hasPermission = function (permission) {
    return this.permissions.includes(permission);
};

// Incrementar contador de uso
apiKeySchema.methods.incrementUsage = async function () {
    this.usage.totalRequests += 1;
    this.usage.requestsToday += 1;
    this.usage.requestsThisMonth += 1;
    this.usage.lastUsed = new Date();
    await this.save();
};

// Verificar rate limit
apiKeySchema.methods.checkRateLimit = function (requestsInLastMinute, requestsToday) {
    if (requestsInLastMinute > this.rateLimit.requestsPerMinute) {
        return { allowed: false, reason: 'Rate limit per minute exceeded' };
    }
    if (requestsToday > this.rateLimit.requestsPerDay) {
        return { allowed: false, reason: 'Daily rate limit exceeded' };
    }
    return { allowed: true };
};

// Rotar clave (generar nueva)
apiKeySchema.methods.rotateKey = async function () {
    const newKey = this.constructor.generateKey(this.user, this.sector, this.environment);
    this.key = newKey;
    this.keyHash = this.constructor.hashKey(newKey);
    this.lastRotated = new Date();
    await this.save();
    return newKey;
};

// Middleware: Antes de guardar, asegurarse de que el hash existe
apiKeySchema.pre('save', function (next) {
    if (this.isModified('key') && !this.keyHash) {
        this.keyHash = this.constructor.hashKey(this.key);
    }
    next();
});

// Método para ocultar información sensible en respuestas JSON
apiKeySchema.methods.toJSON = function () {
    const obj = this.toObject();
    // Ocultar el hash completo
    delete obj.keyHash;
    // Mostrar solo últimos 8 caracteres de la clave
    if (obj.key) {
        obj.keyPreview = `...${obj.key.slice(-8)}`;
        delete obj.key;
    }
    return obj;
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
