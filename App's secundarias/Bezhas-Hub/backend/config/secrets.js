/**
 * Configuración de secretos para Google Cloud Secret Manager
 * En producción, los secretos se cargan desde GCP Secret Manager
 * En desarrollo, se usan variables de entorno locales
 */

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

class SecretsManager {
    constructor() {
        this.client = null;
        this.projectId = process.env.GCP_PROJECT_ID || 'bezhas-web3';
        this.cache = new Map();
        this.isProduction = process.env.NODE_ENV === 'production';
    }

    /**
     * Inicializa el cliente de Secret Manager (solo en producción)
     */
    async initialize() {
        if (this.isProduction) {
            try {
                this.client = new SecretManagerServiceClient();
                console.log('✅ Secret Manager inicializado');
            } catch (error) {
                console.error('❌ Error inicializando Secret Manager:', error.message);
                throw error;
            }
        } else {
            console.log('ℹ️  Modo desarrollo: usando variables de entorno locales');
        }
    }

    /**
     * Obtiene un secreto por nombre
     * @param {string} secretName - Nombre del secreto
     * @returns {Promise<string>} - Valor del secreto
     */
    async getSecret(secretName) {
        // En desarrollo, usar variables de entorno locales
        if (!this.isProduction) {
            return process.env[secretName] || '';
        }

        // Si el secreto ya está en variables de entorno (inyectado por Cloud Run)
        if (process.env[secretName]) {
            return process.env[secretName];
        }

        // Verificar cache
        if (this.cache.has(secretName)) {
            return this.cache.get(secretName);
        }

        try {
            const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
            const [version] = await this.client.accessSecretVersion({ name });
            const value = version.payload.data.toString('utf8');

            // Cachear por 5 minutos
            this.cache.set(secretName, value);
            setTimeout(() => this.cache.delete(secretName), 5 * 60 * 1000);

            return value;
        } catch (error) {
            console.error(`❌ Error accediendo secreto ${secretName}:`, error.message);
            // Intentar usar variable de entorno como fallback
            return process.env[secretName] || '';
        }
    }

    /**
     * Carga todos los secretos necesarios para la aplicación
     * @returns {Promise<Object>} - Objeto con todos los secretos
     */
    async loadAllSecrets() {
        console.log('📦 Cargando secretos...');

        const secretNames = [
            // Stripe
            'STRIPE_SECRET_KEY',
            'STRIPE_PUBLISHABLE_KEY',
            'STRIPE_WEBHOOK_SECRET',

            // Auth
            'JWT_SECRET',
            'SESSION_SECRET',

            // Database
            'MONGODB_URI',
            'REDIS_URL',

            // OAuth
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'GITHUB_CLIENT_ID',
            'GITHUB_CLIENT_SECRET',
            'FACEBOOK_APP_ID',
            'FACEBOOK_APP_SECRET',

            // Blockchain
            'RELAYER_PRIVATE_KEY',
            'POLYGON_RPC_URL',
            'POLYGON_MAINNET_RPC_URL',

            // AI Services
            'GEMINI_API_KEY',
            'OPENAI_API_KEY',

            // IPFS
            'PINATA_API_KEY',
            'PINATA_SECRET_KEY',
            'PINATA_JWT',

            // Email
            'SENDGRID_API_KEY',
            'SMTP_PASSWORD',
        ];

        const secrets = {};

        for (const name of secretNames) {
            secrets[name] = await this.getSecret(name);
        }

        console.log(`✅ ${Object.keys(secrets).filter(k => secrets[k]).length} secretos cargados`);
        return secrets;
    }

    /**
     * Aplica los secretos a process.env
     * @param {Object} secrets - Objeto con los secretos
     */
    applyToEnv(secrets) {
        for (const [key, value] of Object.entries(secrets)) {
            if (value && !process.env[key]) {
                process.env[key] = value;
            }
        }
    }

    /**
     * Limpia el cache de secretos
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️  Cache de secretos limpiado');
    }
}

// Singleton
const secretsManager = new SecretsManager();

module.exports = secretsManager;
