/**
 * ============================================================================
 * FIELD-LEVEL ENCRYPTION - MongoDB Data Protection
 * ============================================================================
 * 
 * Sistema de cifrado a nivel de campo para proteger datos sensibles:
 * - PII (Personally Identifiable Information)
 * - Información financiera
 * - Datos de contacto
 * - Configuraciones privadas
 */

const crypto = require('crypto');

// Configuración de cifrado
const ENCRYPTION_CONFIG = {
    ALGORITHM: 'aes-256-gcm',
    KEY_LENGTH: 32,  // 256 bits
    IV_LENGTH: 16,   // 128 bits
    AUTH_TAG_LENGTH: 16, // 128 bits
    SALT_LENGTH: 32,
    ITERATIONS: 100000,
    DIGEST: 'sha512'
};

// Master key (debe estar en variable de entorno)
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || crypto.randomBytes(32).toString('hex');

// Derivar clave de cifrado desde master key
function deriveKey(salt) {
    return crypto.pbkdf2Sync(
        Buffer.from(MASTER_KEY, 'hex'),
        salt,
        ENCRYPTION_CONFIG.ITERATIONS,
        ENCRYPTION_CONFIG.KEY_LENGTH,
        ENCRYPTION_CONFIG.DIGEST
    );
}

/**
 * Cifrar dato sensible
 */
function encryptField(plaintext) {
    if (!plaintext) {
        return null;
    }

    try {
        // Generar salt único para este campo
        const salt = crypto.randomBytes(ENCRYPTION_CONFIG.SALT_LENGTH);

        // Derivar clave de cifrado
        const key = deriveKey(salt);

        // Generar IV aleatorio
        const iv = crypto.randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);

        // Crear cipher
        const cipher = crypto.createCipheriv(
            ENCRYPTION_CONFIG.ALGORITHM,
            key,
            iv
        );

        // Cifrar
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Obtener auth tag
        const authTag = cipher.getAuthTag();

        // Construir resultado: version:salt:iv:authTag:encrypted
        const result = [
            '1', // Version del esquema de cifrado
            salt.toString('hex'),
            iv.toString('hex'),
            authTag.toString('hex'),
            encrypted
        ].join(':');

        return result;

    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt field');
    }
}

/**
 * Descifrar dato sensible
 */
function decryptField(ciphertext) {
    if (!ciphertext) {
        return null;
    }

    try {
        // Parsear componentes
        const parts = ciphertext.split(':');

        if (parts.length !== 5) {
            throw new Error('Invalid encrypted field format');
        }

        const [version, saltHex, ivHex, authTagHex, encrypted] = parts;

        // Verificar versión
        if (version !== '1') {
            throw new Error('Unsupported encryption version');
        }

        // Convertir de hex a Buffer
        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        // Derivar clave
        const key = deriveKey(salt);

        // Crear decipher
        const decipher = crypto.createDecipheriv(
            ENCRYPTION_CONFIG.ALGORITHM,
            key,
            iv
        );

        // Establecer auth tag
        decipher.setAuthTag(authTag);

        // Descifrar
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;

    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt field');
    }
}

/**
 * Hash irreversible para campos que no necesitan descifrarse
 */
function hashField(data, salt = null) {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHmac('sha256', MASTER_KEY)
        .update(data + useSalt)
        .digest('hex');

    return `${hash}:${useSalt}`;
}

/**
 * Verificar hash
 */
function verifyHash(data, hashedValue) {
    const [hash, salt] = hashedValue.split(':');
    const newHash = hashField(data, salt).split(':')[0];
    return hash === newHash;
}

/**
 * Cifrar objeto completo (múltiples campos)
 */
function encryptObject(obj, fieldsToEncrypt) {
    const encrypted = { ...obj };

    for (const field of fieldsToEncrypt) {
        if (obj[field]) {
            encrypted[field] = encryptField(String(obj[field]));
        }
    }

    return encrypted;
}

/**
 * Descifrar objeto completo
 */
function decryptObject(obj, fieldsToDecrypt) {
    const decrypted = { ...obj };

    for (const field of fieldsToDecrypt) {
        if (obj[field]) {
            try {
                decrypted[field] = decryptField(obj[field]);
            } catch (error) {
                console.error(`Failed to decrypt field ${field}:`, error.message);
                decrypted[field] = null;
            }
        }
    }

    return decrypted;
}

/**
 * Middleware para cifrar automáticamente antes de guardar
 */
function createEncryptionMiddleware(schema, fieldsToEncrypt) {
    // Pre-save hook
    schema.pre('save', function (next) {
        for (const field of fieldsToEncrypt) {
            if (this[field] && !this[field].includes(':')) {
                // Solo cifrar si no está ya cifrado
                this[field] = encryptField(String(this[field]));
            }
        }
        next();
    });

    // Post-find hook
    schema.post('find', function (docs) {
        if (Array.isArray(docs)) {
            docs.forEach(doc => {
                for (const field of fieldsToEncrypt) {
                    if (doc[field]) {
                        try {
                            doc[field] = decryptField(doc[field]);
                        } catch (error) {
                            console.error(`Decryption error for ${field}:`, error.message);
                        }
                    }
                }
            });
        }
    });

    // Post-findOne hook
    schema.post('findOne', function (doc) {
        if (doc) {
            for (const field of fieldsToEncrypt) {
                if (doc[field]) {
                    try {
                        doc[field] = decryptField(doc[field]);
                    } catch (error) {
                        console.error(`Decryption error for ${field}:`, error.message);
                    }
                }
            }
        }
    });
}

/**
 * Rotar clave de cifrado (re-encrypt todos los datos)
 */
async function rotateEncryptionKey(model, fieldsToRotate, newMasterKey) {
    try {
        console.log('🔄 Starting encryption key rotation...');

        // Obtener todos los documentos
        const documents = await model.find({});
        let rotatedCount = 0;

        for (const doc of documents) {
            let needsUpdate = false;

            for (const field of fieldsToRotate) {
                if (doc[field]) {
                    try {
                        // Descifrar con clave antigua
                        const decrypted = decryptField(doc[field]);

                        // Re-cifrar con clave nueva
                        const oldKey = MASTER_KEY;
                        MASTER_KEY = newMasterKey;
                        doc[field] = encryptField(decrypted);
                        MASTER_KEY = oldKey;

                        needsUpdate = true;
                    } catch (error) {
                        console.error(`Failed to rotate key for ${field} in doc ${doc._id}:`, error.message);
                    }
                }
            }

            if (needsUpdate) {
                await doc.save();
                rotatedCount++;
            }
        }

        console.log(`✅ Key rotation complete: ${rotatedCount} documents updated`);
        return { success: true, rotatedCount };

    } catch (error) {
        console.error('Key rotation error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generar nueva master key
 */
function generateMasterKey() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Exportar master key de forma segura (encrypted)
 */
function exportMasterKey(password) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(MASTER_KEY, 'hex', 'hex');
    encrypted += cipher.final('hex');

    return {
        encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex')
    };
}

/**
 * Importar master key
 */
function importMasterKey(encryptedData, password) {
    const { encrypted, salt, iv } = encryptedData;

    const key = crypto.pbkdf2Sync(
        password,
        Buffer.from(salt, 'hex'),
        100000,
        32,
        'sha512'
    );

    const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        key,
        Buffer.from(iv, 'hex')
    );

    let decrypted = decipher.update(encrypted, 'hex', 'hex');
    decrypted += decipher.final('hex');

    return decrypted;
}

/**
 * Sanitizar datos para logs (remover info sensible)
 */
function sanitizeForLog(obj, sensitiveFields = ['email', 'phone', 'ssn', 'password']) {
    const sanitized = { ...obj };

    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '***REDACTED***';
        }
    }

    return sanitized;
}

/**
 * Verificar integridad de datos cifrados
 */
function verifyIntegrity(ciphertext) {
    try {
        const parts = ciphertext.split(':');
        if (parts.length !== 5) {
            return false;
        }

        // Intentar descifrar
        decryptField(ciphertext);
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    encryptField,
    decryptField,
    hashField,
    verifyHash,
    encryptObject,
    decryptObject,
    createEncryptionMiddleware,
    rotateEncryptionKey,
    generateMasterKey,
    exportMasterKey,
    importMasterKey,
    sanitizeForLog,
    verifyIntegrity,
    ENCRYPTION_CONFIG
};
