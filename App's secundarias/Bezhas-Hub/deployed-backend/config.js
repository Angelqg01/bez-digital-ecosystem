const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { z } = require('zod');

// Development mode - simplified environment requirements
const EnvSchema = z.object({
    PORT: z.string().optional().default('3001'),
    NODE_ENV: z.string().optional().default('development'),
    ALLOWED_ORIGINS: z.string().optional().default('http://localhost:5173,http://127.0.0.1:5173'),
    ADMIN_TOKEN: z.string().optional().default('dev-admin-token-12345-very-secure-token'),
    GEMINI_API_KEY: z.string().optional(),
    LOG_LEVEL: z.string().optional().default('info'),
    JWT_SECRET: z.string().optional().default('dev-jwt-secret-key-for-bezhas-platform-2024-very-long-and-secure'),
    CONTACT_ENCRYPTION_KEY: z.string().optional().default('dev-contact-encryption-key-32-characters-long-string'),
    AUTH_BYPASS_ENABLED: z.string().optional().default('true'),
    FRONTEND_URL: z.string().optional().default('http://localhost:5173'),
    // Feature flags (default disabled for local dev)
    DISABLE_QUEUE_WORKER: z.string().optional().default('true'),
    DISABLE_BLOCKCHAIN_LISTENER: z.string().optional().default('true'),
    // Optional for in-memory development
    MONGODB_URI: z.string().optional(),
    REDIS_URL: z.string().optional(),
    REWARDS_SERVICE_URL: z.string().url().optional(),
    REWARDS_SERVICE_API_KEY: z.string().optional()
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    // In development mode, just log warnings instead of exiting
    console.warn('⚠️ Some environment variables have issues (using defaults):');
    const formatted = parsed.error.format();
    for (const key of Object.keys(formatted)) {
        if (key === '_errors') continue;
        const v = formatted[key];
        if (v && Array.isArray(v._errors) && v._errors.length) {
            console.warn(` - ${key}: ${v._errors.join('; ')}`);
        }
    }
    console.log('🚀 Continuing with default values for development...\n');

    // Use defaults for development
    const devDefaults = {
        PORT: '3001',
        NODE_ENV: 'development',
        ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
        ADMIN_TOKEN: 'dev-admin-token-12345-very-secure-token',
        LOG_LEVEL: 'info',
        JWT_SECRET: 'dev-jwt-secret-key-for-bezhas-platform-2024-very-long-and-secure',
        CONTACT_ENCRYPTION_KEY: 'dev-contact-encryption-key-32-characters-long-string',
        AUTH_BYPASS_ENABLED: 'true',
        FRONTEND_URL: 'http://localhost:5173',
        DISABLE_QUEUE_WORKER: 'true',
        DISABLE_BLOCKCHAIN_LISTENER: 'true'
    };
    // Propagar a process.env si faltan
    for (const [k, v] of Object.entries(devDefaults)) {
        if (!process.env[k]) process.env[k] = v;
    }
    module.exports = devDefaults;
} else {
    // Export parsed data y propagar a process.env
    for (const [k, v] of Object.entries(parsed.data)) {
        if (!process.env[k]) process.env[k] = v;
    }
    module.exports = parsed.data;
}
