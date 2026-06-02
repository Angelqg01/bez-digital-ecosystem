/**
 * ============================================================================
 * SECURE STORAGE - Encrypted localStorage/sessionStorage
 * ============================================================================
 * 
 * Proporciona encriptación AES-256 para datos sensibles en localStorage
 * Previene acceso a datos sin encriptación
 */

import CryptoJS from 'crypto-js';

// Generar key única por sesión (en producción debe venir del backend)
const ENCRYPTION_KEY = process.env.VITE_STORAGE_ENCRYPTION_KEY ||
    'bezhas_default_key_change_in_production';

/**
 * Encripta datos con AES-256
 */
function encrypt(data) {
    try {
        const jsonString = JSON.stringify(data);
        return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

/**
 * Desencripta datos AES-256
 */
function decrypt(encryptedData) {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
        const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decryptedString);
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

/**
 * Secure localStorage wrapper
 */
export const secureStorage = {
    /**
     * Guardar dato encriptado
     */
    setItem(key, value) {
        if (typeof window === 'undefined') return false;

        try {
            const encrypted = encrypt(value);
            if (!encrypted) return false;

            localStorage.setItem(`secure_${key}`, encrypted);
            return true;
        } catch (error) {
            console.error('SecureStorage.setItem error:', error);
            return false;
        }
    },

    /**
     * Obtener dato desencriptado
     */
    getItem(key) {
        if (typeof window === 'undefined') return null;

        try {
            const encrypted = localStorage.getItem(`secure_${key}`);
            if (!encrypted) return null;

            return decrypt(encrypted);
        } catch (error) {
            console.error('SecureStorage.getItem error:', error);
            return null;
        }
    },

    /**
     * Eliminar dato
     */
    removeItem(key) {
        if (typeof window === 'undefined') return false;

        try {
            localStorage.removeItem(`secure_${key}`);
            return true;
        } catch (error) {
            console.error('SecureStorage.removeItem error:', error);
            return false;
        }
    },

    /**
     * Limpiar todo el almacenamiento seguro
     */
    clear() {
        if (typeof window === 'undefined') return false;

        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('secure_')) {
                    keys.push(key);
                }
            }

            keys.forEach(key => localStorage.removeItem(key));
            return true;
        } catch (error) {
            console.error('SecureStorage.clear error:', error);
            return false;
        }
    },

    /**
     * Verificar si existe un item
     */
    hasItem(key) {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem(`secure_${key}`) !== null;
    }
};

/**
 * Secure sessionStorage wrapper
 */
export const secureSessionStorage = {
    setItem(key, value) {
        if (typeof window === 'undefined') return false;

        try {
            const encrypted = encrypt(value);
            if (!encrypted) return false;

            sessionStorage.setItem(`secure_${key}`, encrypted);
            return true;
        } catch (error) {
            console.error('SecureSessionStorage.setItem error:', error);
            return false;
        }
    },

    getItem(key) {
        if (typeof window === 'undefined') return null;

        try {
            const encrypted = sessionStorage.getItem(`secure_${key}`);
            if (!encrypted) return null;

            return decrypt(encrypted);
        } catch (error) {
            console.error('SecureSessionStorage.getItem error:', error);
            return null;
        }
    },

    removeItem(key) {
        if (typeof window === 'undefined') return false;

        try {
            sessionStorage.removeItem(`secure_${key}`);
            return true;
        } catch (error) {
            console.error('SecureSessionStorage.removeItem error:', error);
            return false;
        }
    },

    clear() {
        if (typeof window === 'undefined') return false;

        try {
            const keys = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key?.startsWith('secure_')) {
                    keys.push(key);
                }
            }

            keys.forEach(key => sessionStorage.removeItem(key));
            return true;
        } catch (error) {
            console.error('SecureSessionStorage.clear error:', error);
            return false;
        }
    }
};

/**
 * Migrar datos existentes a formato encriptado
 */
export function migrateToSecureStorage(keys) {
    if (typeof window === 'undefined') return;

    keys.forEach(key => {
        try {
            const value = localStorage.getItem(key);
            if (value) {
                // Guardar encriptado
                secureStorage.setItem(key, value);
                // Eliminar versión no encriptada
                localStorage.removeItem(key);
                console.log(`Migrated ${key} to secure storage`);
            }
        } catch (error) {
            console.error(`Error migrating ${key}:`, error);
        }
    });
}

export default secureStorage;
