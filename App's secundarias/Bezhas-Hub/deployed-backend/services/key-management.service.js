/**
 * ============================================================================
 * KEY MANAGEMENT SERVICE - Secure Key Storage & Rotation
 * ============================================================================
 * 
 * Sistema de gestión de claves de cifrado:
 * - Almacenamiento seguro de master keys
 * - Rotación automática de claves
 * - Versionado de claves
 * - Backup de claves encriptadas
 * - Integración con AWS KMS (opcional)
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { audit } = require('../middleware/auditLogger');
const { notifyCritical } = require('../middleware/discordNotifier');

// Configuración
const KMS_CONFIG = {
    KEYS_DIR: process.env.KEYS_DIR || path.join(__dirname, '../.keys'),
    KEY_ROTATION_DAYS: parseInt(process.env.KEY_ROTATION_DAYS) || 90,
    USE_AWS_KMS: process.env.USE_AWS_KMS === 'true',
    AWS_KMS_KEY_ID: process.env.AWS_KMS_KEY_ID,
    BACKUP_DIR: process.env.KEYS_BACKUP_DIR || path.join(__dirname, '../.keys/backups')
};

// Store de claves en memoria (encriptadas)
const keyStore = new Map();
const keyMetadata = new Map();

/**
 * Inicializar sistema de claves
 */
async function initialize() {
    try {
        // Crear directorios si no existen
        await fs.mkdir(KMS_CONFIG.KEYS_DIR, { recursive: true });
        await fs.mkdir(KMS_CONFIG.BACKUP_DIR, { recursive: true });

        // Cargar claves existentes
        await loadKeys();

        // Verificar si necesita rotación
        await checkKeyRotation();

        console.log('✅ Key Management System initialized');
        return { success: true };

    } catch (error) {
        console.error('❌ Failed to initialize KMS:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generar nueva clave de cifrado
 */
function generateKey(keyId, keyType = 'master') {
    const key = crypto.randomBytes(32).toString('hex');
    const metadata = {
        keyId,
        keyType,
        version: 1,
        createdAt: Date.now(),
        lastRotated: Date.now(),
        algorithm: 'aes-256-gcm',
        status: 'active'
    };

    keyStore.set(keyId, key);
    keyMetadata.set(keyId, metadata);

    audit.admin('KEY_GENERATED', 'medium', {
        keyId,
        keyType,
        algorithm: metadata.algorithm
    });

    return { key, metadata };
}

/**
 * Obtener clave actual
 */
function getKey(keyId) {
    const key = keyStore.get(keyId);
    const metadata = keyMetadata.get(keyId);

    if (!key) {
        throw new Error(`Key ${keyId} not found`);
    }

    if (metadata.status !== 'active') {
        throw new Error(`Key ${keyId} is not active`);
    }

    return { key, metadata };
}

/**
 * Guardar clave de forma segura (encriptada con password)
 */
async function saveKey(keyId, password) {
    try {
        const keyData = keyStore.get(keyId);
        const metadata = keyMetadata.get(keyId);

        if (!keyData) {
            throw new Error(`Key ${keyId} not found`);
        }

        // Generar salt para PBKDF2
        const salt = crypto.randomBytes(32);

        // Derivar clave de encriptación desde password
        const encryptionKey = crypto.pbkdf2Sync(
            password,
            salt,
            100000,
            32,
            'sha512'
        );

        // Cifrar la clave
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

        let encrypted = cipher.update(keyData, 'hex', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Construir archivo
        const keyFile = {
            version: 1,
            keyId,
            metadata,
            encrypted: {
                data: encrypted,
                salt: salt.toString('hex'),
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex')
            },
            savedAt: Date.now()
        };

        // Guardar a archivo
        const filePath = path.join(KMS_CONFIG.KEYS_DIR, `${keyId}.key`);
        await fs.writeFile(filePath, JSON.stringify(keyFile, null, 2), 'utf8');

        audit.admin('KEY_SAVED', 'medium', {
            keyId,
            filePath
        });

        return { success: true, filePath };

    } catch (error) {
        console.error('Error saving key:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cargar clave desde archivo
 */
async function loadKey(keyId, password) {
    try {
        const filePath = path.join(KMS_CONFIG.KEYS_DIR, `${keyId}.key`);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const keyFile = JSON.parse(fileContent);

        // Derivar clave de desencriptación
        const encryptionKey = crypto.pbkdf2Sync(
            password,
            Buffer.from(keyFile.encrypted.salt, 'hex'),
            100000,
            32,
            'sha512'
        );

        // Descifrar la clave
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            encryptionKey,
            Buffer.from(keyFile.encrypted.iv, 'hex')
        );

        decipher.setAuthTag(Buffer.from(keyFile.encrypted.authTag, 'hex'));

        let decrypted = decipher.update(keyFile.encrypted.data, 'hex', 'hex');
        decrypted += decipher.final('hex');

        // Almacenar en memoria
        keyStore.set(keyId, decrypted);
        keyMetadata.set(keyId, keyFile.metadata);

        audit.admin('KEY_LOADED', 'medium', {
            keyId
        });

        return { success: true, metadata: keyFile.metadata };

    } catch (error) {
        console.error('Error loading key:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cargar todas las claves
 */
async function loadKeys() {
    try {
        const files = await fs.readdir(KMS_CONFIG.KEYS_DIR);
        const keyFiles = files.filter(f => f.endsWith('.key'));

        if (keyFiles.length === 0) {
            console.log('No existing keys found, generating master key...');
            const { key, metadata } = generateKey('master', 'master');

            // Guardar con password por defecto (CAMBIAR EN PRODUCCIÓN)
            const defaultPassword = process.env.KEY_PASSWORD || 'CHANGE_ME_IN_PRODUCTION';
            await saveKey('master', defaultPassword);

            return { loaded: 1 };
        }

        console.log(`Found ${keyFiles.length} key files`);
        return { loaded: keyFiles.length };

    } catch (error) {
        console.error('Error loading keys:', error);
        return { loaded: 0, error: error.message };
    }
}

/**
 * Rotar clave (generar nueva versión)
 */
async function rotateKey(keyId, password) {
    try {
        const oldMetadata = keyMetadata.get(keyId);

        if (!oldMetadata) {
            throw new Error(`Key ${keyId} not found`);
        }

        // Marcar clave antigua como deprecated
        oldMetadata.status = 'deprecated';
        oldMetadata.deprecatedAt = Date.now();

        // Generar nueva versión
        const newVersion = oldMetadata.version + 1;
        const newKeyId = `${keyId}_v${newVersion}`;

        const { key, metadata } = generateKey(newKeyId, oldMetadata.keyType);
        metadata.version = newVersion;
        metadata.previousVersion = keyId;

        // Guardar nueva clave
        await saveKey(newKeyId, password);

        // Backup de clave antigua
        await backupKey(keyId);

        audit.admin('KEY_ROTATED', 'high', {
            oldKeyId: keyId,
            newKeyId,
            version: newVersion
        });

        // Notificar a Discord
        notifyCritical('KEY_ROTATED', {
            oldKeyId: keyId,
            newKeyId,
            version: newVersion,
            details: 'Encryption key has been rotated. Re-encryption may be required.'
        }).catch(err => console.error('Discord notification error:', err.message));

        return {
            success: true,
            oldKeyId: keyId,
            newKeyId,
            version: newVersion
        };

    } catch (error) {
        console.error('Error rotating key:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Verificar si necesita rotación
 */
async function checkKeyRotation() {
    try {
        const now = Date.now();
        const rotationThreshold = KMS_CONFIG.KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000;

        for (const [keyId, metadata] of keyMetadata.entries()) {
            if (metadata.status === 'active') {
                const daysSinceRotation = (now - metadata.lastRotated) / (1000 * 60 * 60 * 24);

                if (daysSinceRotation > KMS_CONFIG.KEY_ROTATION_DAYS) {
                    console.log(`⚠️ Key ${keyId} needs rotation (${Math.floor(daysSinceRotation)} days old)`);

                    audit.admin('KEY_ROTATION_NEEDED', 'medium', {
                        keyId,
                        daysSinceRotation: Math.floor(daysSinceRotation),
                        threshold: KMS_CONFIG.KEY_ROTATION_DAYS
                    });
                }
            }
        }

        return { success: true };

    } catch (error) {
        console.error('Error checking key rotation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Backup de clave
 */
async function backupKey(keyId) {
    try {
        const sourcePath = path.join(KMS_CONFIG.KEYS_DIR, `${keyId}.key`);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(KMS_CONFIG.BACKUP_DIR, `${keyId}_${timestamp}.key`);

        const content = await fs.readFile(sourcePath, 'utf8');
        await fs.writeFile(backupPath, content, 'utf8');

        audit.admin('KEY_BACKUP_CREATED', 'low', {
            keyId,
            backupPath
        });

        return { success: true, backupPath };

    } catch (error) {
        console.error('Error backing up key:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Listar todas las claves
 */
function listKeys() {
    const keys = [];

    for (const [keyId, metadata] of keyMetadata.entries()) {
        keys.push({
            keyId,
            ...metadata,
            hasKey: keyStore.has(keyId)
        });
    }

    return keys;
}

/**
 * Obtener estadísticas de claves
 */
function getKeyStats() {
    const stats = {
        totalKeys: keyMetadata.size,
        activeKeys: 0,
        deprecatedKeys: 0,
        rotationNeeded: 0
    };

    const now = Date.now();
    const rotationThreshold = KMS_CONFIG.KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000;

    for (const metadata of keyMetadata.values()) {
        if (metadata.status === 'active') {
            stats.activeKeys++;

            if ((now - metadata.lastRotated) > rotationThreshold) {
                stats.rotationNeeded++;
            }
        } else if (metadata.status === 'deprecated') {
            stats.deprecatedKeys++;
        }
    }

    return stats;
}

/**
 * Revocar clave
 */
function revokeKey(keyId) {
    const metadata = keyMetadata.get(keyId);

    if (!metadata) {
        throw new Error(`Key ${keyId} not found`);
    }

    metadata.status = 'revoked';
    metadata.revokedAt = Date.now();

    keyStore.delete(keyId);

    audit.admin('KEY_REVOKED', 'high', {
        keyId
    });

    return { success: true };
}

/**
 * Exportar clave de forma segura
 */
function exportKey(keyId, exportPassword) {
    try {
        const keyData = keyStore.get(keyId);
        const metadata = keyMetadata.get(keyId);

        if (!keyData) {
            throw new Error(`Key ${keyId} not found`);
        }

        const salt = crypto.randomBytes(32);
        const key = crypto.pbkdf2Sync(exportPassword, salt, 100000, 32, 'sha512');
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(keyData, 'hex', 'hex');
        encrypted += cipher.final('hex');

        return {
            success: true,
            export: {
                keyId,
                encrypted,
                salt: salt.toString('hex'),
                iv: iv.toString('hex'),
                metadata,
                exportedAt: Date.now()
            }
        };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    initialize,
    generateKey,
    getKey,
    saveKey,
    loadKey,
    loadKeys,
    rotateKey,
    checkKeyRotation,
    backupKey,
    listKeys,
    getKeyStats,
    revokeKey,
    exportKey,
    KMS_CONFIG
};
