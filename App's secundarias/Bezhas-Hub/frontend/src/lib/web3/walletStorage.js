/**
 * Utility functions for managing Wagmi wallet storage
 * 🔐 SEGURIDAD: Funciones para manejo seguro de conexiones de wallet
 */

/**
 * Clears all Wagmi-related data from localStorage to prevent auto-reconnect
 * 🔐 SEGURIDAD: Limpia completamente todas las trazas de conexión
 */
export function clearWalletStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }

    // Find all keys related to Wagmi and WalletConnect
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
            key.startsWith('wagmi') ||
            key.startsWith('wc@2') ||
            key.startsWith('WALLETCONNECT') ||
            key.startsWith('bezhas.wagmi') ||
            key.startsWith('@w3m') ||
            key.startsWith('W3M') ||
            key === 'recentConnectorId' ||
            key === 'wallet' ||
            key === 'connected'
        )) {
            keysToRemove.push(key);
        }
    }

    // Remove all found keys
    keysToRemove.forEach(key => {
        try {
            localStorage.removeItem(key);
            if (import.meta.env.DEV) {
                console.log(`✅ Cleared storage key: ${key}`);
            }
        } catch (error) {
            console.error(`❌ Error clearing key ${key}:`, error);
        }
    });

    // También limpiar sessionStorage
    if (window.sessionStorage) {
        const sessionKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (
                key.startsWith('wagmi') ||
                key.startsWith('wc@2') ||
                key.startsWith('@w3m')
            )) {
                sessionKeysToRemove.push(key);
            }
        }

        sessionKeysToRemove.forEach(key => {
            try {
                sessionStorage.removeItem(key);
                if (import.meta.env.DEV) {
                    console.log(`✅ Cleared session key: ${key}`);
                }
            } catch (error) {
                console.error(`❌ Error clearing session key ${key}:`, error);
            }
        });
    }

    if (import.meta.env.DEV) {
        console.log(`🧹 Wallet storage cleared: ${keysToRemove.length} keys removed`);
    }
}

/**
 * 🔐 SEGURIDAD: Verifica si hay datos de conexión persistidos
 * Útil para detectar sesiones anteriores
 */
export function hasPersistedConnection() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return false;
    }

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('wagmi.store') || key.startsWith('bezhas.wagmi'))) {
            return true;
        }
    }

    return false;
}

/**
 * 🔐 SEGURIDAD: Obtiene el tipo de conector almacenado
 * Útil para restaurar la última conexión usada
 */
export function getStoredConnector() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }

    try {
        const stored = localStorage.getItem('bezhas.wagmi.recentConnectorId');
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

/**
 * 🔐 SEGURIDAD: Limpia cookies de sesión relacionadas con la wallet
 * Previene persistencia no deseada
 */
export function clearWalletCookies() {
    if (typeof document === 'undefined') {
        return;
    }

    const cookies = document.cookie.split(";");

    cookies.forEach((cookie) => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

        // Limpiar cookies relacionadas con wallet
        if (name.includes('wallet') || name.includes('wc') || name.includes('wagmi')) {
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
            if (import.meta.env.DEV) {
                console.log(`🍪 Cleared cookie: ${name}`);
            }
        }
    });
}

/**
 * 🔐 SEGURIDAD: Limpieza completa y segura de toda la sesión de wallet
 * Incluye storage, cookies y estado de IndexedDB
 */
export async function secureWalletCleanup() {
    try {
        // 1. Limpiar localStorage y sessionStorage
        clearWalletStorage();

        // 2. Limpiar cookies
        clearWalletCookies();

        // 3. Limpiar IndexedDB si existe
        if (typeof indexedDB !== 'undefined') {
            const databases = ['WALLET_CONNECT_V2_INDEXED_DB', 'wagmi.cache', 'w3m-cache'];

            for (const dbName of databases) {
                try {
                    await new Promise((resolve, reject) => {
                        const request = indexedDB.deleteDatabase(dbName);
                        request.onsuccess = () => {
                            if (import.meta.env.DEV) {
                                console.log(`🗄️ Cleared IndexedDB: ${dbName}`);
                            }
                            resolve();
                        };
                        request.onerror = () => reject(request.error);
                        request.onblocked = () => {
                            console.warn(`⚠️ IndexedDB ${dbName} deletion blocked`);
                            resolve(); // Continue anyway
                        };
                    });
                } catch (error) {
                    if (import.meta.env.DEV) {
                        console.warn(`⚠️ Could not clear IndexedDB ${dbName}:`, error);
                    }
                }
            }
        }

        if (import.meta.env.DEV) {
            console.log('✅ Secure wallet cleanup completed');
        }

        return true;
    } catch (error) {
        console.error('❌ Error in secure wallet cleanup:', error);
        return false;
    }
}

/**
 * 🔐 SEGURIDAD: Valida que una dirección de wallet sea válida
 */
export function isValidAddress(address) {
    if (!address || typeof address !== 'string') {
        return false;
    }

    // Validar formato Ethereum (0x + 40 caracteres hexadecimales)
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 🔐 SEGURIDAD: Sanitiza una dirección antes de almacenarla
 */
export function sanitizeAddress(address) {
    if (!isValidAddress(address)) {
        throw new Error('Invalid Ethereum address');
    }

    return address.toLowerCase();
}
