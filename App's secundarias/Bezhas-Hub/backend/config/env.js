const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
    // Server
    PORT: z.string().default('3001'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Database
    DATABASE_URL: z.string().url(),

    // Security & Web3
    ADMIN_WALLET_ADDRESS: z.string().startsWith('0x'),
    JWT_SECRET: z.string().min(10).default('supersecret_fallback_change_in_prod'),

    // AI Services
    GEMINI_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),

    // GitHub Integration
    GITHUB_TOKEN: z.string().optional(),
});

const processEnv = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    ADMIN_WALLET_ADDRESS: process.env.ADMIN_WALLET_ADDRESS,
    JWT_SECRET: process.env.JWT_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
};

// Validar y parsear
const parsed = envSchema.safeParse(processEnv);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.format());
    // En producción, deberíamos detener el proceso si faltan variables críticas
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
}

const env = parsed.success ? parsed.data : processEnv;
module.exports = { env };
