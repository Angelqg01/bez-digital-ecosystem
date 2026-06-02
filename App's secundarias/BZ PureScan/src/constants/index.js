/**
 * Constantes de BZ PureScan
 */

// API Configuration
export const API_CONFIG = {
    GATEWAY_URL: import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3017/api',
    TIMEOUT: 15000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
}

// Blockchain Configuration
export const BLOCKCHAIN_CONFIG = {
    RPC_URL: import.meta.env.VITE_BLOCKCHAIN_RPC || 'https://polygon-rpc.com',
    NETWORK: import.meta.env.VITE_NETWORK || 'polygon',
    NETWORKS: {
        polygon: {
            id: 137,
            name: 'Polygon',
            rpc: 'https://polygon-rpc.com',
            explorer: 'https://polygonscan.com'
        },
        bsc: {
            id: 56,
            name: 'BSC',
            rpc: 'https://bsc-dataseed.binance.org',
            explorer: 'https://bscscan.com'
        },
        polygonMumbai: {
            id: 80001,
            name: 'Polygon Mumbai',
            rpc: 'https://rpc-mumbai.maticvigil.com',
            explorer: 'https://mumbai.polygonscan.com'
        },
        bscTestnet: {
            id: 97,
            name: 'BSC Testnet',
            rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
            explorer: 'https://testnet.bscscan.com'
        }
    },
    CONTRACT_ADDRESS: import.meta.env.VITE_CONTRACT_ADDRESS || '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
}

// Scanning Phases
export const SCAN_PHASES = {
    IDLE: 'idle',
    EDGE: 'edge',
    GEMINI: 'gemini',
    BLOCKCHAIN: 'blockchain',
    DONE: 'done',
    ERROR: 'error',
}

// Inventory Status
export const INVENTORY_STATUS = {
    VERIFIED: 'verified',
    PENDING: 'pending',
    WARNING: 'warning',
}

// Quality Levels
export const QUALITY_LEVELS = {
    EXCELLENT: 'EXCELLENT',
    GOOD: 'GOOD',
    FAIR: 'FAIR',
    POOR: 'POOR',
}

// Risk Levels
export const RISK_LEVELS = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
}

// Page Routes
export const ROUTES = {
    HOME: '/',
    DASHBOARD: '/',
    SCANNER: '/scan',
    STORAGE: '/storage',
    PROFILE: '/profile',
}

// UI Colors (Tailwind Classes)
export const COLORS = {
    PRIMARY: 'bz-primary',
    PRIMARY_ALT: 'bz-primary-alt',
    PRIMARY_CONTAINER: 'bz-primary-container',
    NEON: 'bz-neon',
    EMERALD: 'bz-emerald',
    AMBER: 'bz-amber',
    ERROR: 'error',
}

// Feature Flags
export const FEATURES = {
    ANALYTICS_ENABLED: import.meta.env.VITE_ENABLE_ANALYTICS !== 'false',
    NOTIFICATIONS_ENABLED: import.meta.env.VITE_ENABLE_NOTIFICATIONS !== 'false',
    EXPORT_ENABLED: import.meta.env.VITE_ENABLE_EXPORT !== 'false',
}

// Cache Durations (ms)
export const CACHE_DURATION = {
    SHORT: 60000,           // 1 min
    MEDIUM: 300000,         // 5 min
    LONG: 1800000,          // 30 min
    VERY_LONG: 86400000,    // 24 hours
}

// Pagination
export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 10,
    MIN_PAGE_SIZE: 1,
    MAX_PAGE_SIZE: 100,
}

// Toast Messages
export const TOAST_MESSAGES = {
    COPY_SUCCESS: '✅ Copiado al portapapeles',
    COPY_ERROR: '❌ Error al copiar',
    SCAN_SUCCESS: '✅ Escaneo completado',
    SCAN_ERROR: '❌ Error en el escaneo',
    UPLOAD_SUCCESS: '✅ Archivo subido',
    UPLOAD_ERROR: '❌ Error al subir archivo',
    NETWORK_ERROR: '❌ Error de conexión',
    SAVE_SUCCESS: '✅ Cambios guardados',
    SAVE_ERROR: '❌ Error al guardar',
}

// LocalStorage Keys
export const STORAGE_KEYS = {
    USER_PREFERENCES: 'bz_purescan_preferences',
    RECENT_SCANS: 'bz_purescan_recent_scans',
    CACHED_DATA: 'bz_purescan_cache',
    AUTH_TOKEN: 'bz_purescan_auth_token',
    THEME: 'bz_purescan_theme',
}

// API Endpoints
export const API_ENDPOINTS = {
    ANALYZE: '/purescan/analyze',
    BLOCKCHAIN_SYNC: '/purescan/blockchain/sync',
    INVENTORY: '/purescan/inventory',
    PROFILE_DID: '/purescan/profile/did',
    SCAN_HISTORY: '/purescan/scans',
    ANALYTICS: '/purescan/analytics',
    FEEDBACK: '/purescan/scans/:id/feedback',
}

// Error Messages
export const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Error de conexión. Por favor, revisa tu internet.',
    TIMEOUT: 'Tiempo de espera agotado. Por favor, intenta de nuevo.',
    INVALID_DATA: 'Los datos proporcionados no son válidos.',
    UNAUTHORIZED: 'No autorizado. Por favor, inicia sesión.',
    NOT_FOUND: 'Recurso no encontrado.',
    SERVER_ERROR: 'Error en el servidor. Por favor, intenta más tarde.',
    GENERIC_ERROR: 'Algo salió mal. Por favor, intenta de nuevo.',
}

// Success Messages
export const SUCCESS_MESSAGES = {
    SCAN_COMPLETE: 'Escaneo completado exitosamente',
    BLOCKCHAIN_CONFIRMED: 'Transacción confirmada en blockchain',
    PROFILE_UPDATED: 'Perfil actualizado correctamente',
    EXPORT_COMPLETE: 'Exportación completada',
    BATCH_VERIFIED: 'Lote verificado correctamente',
}

// UI Constants
export const UI = {
    HEADER_HEIGHT: 64,
    BOTTOM_NAV_HEIGHT: 72,
    CARD_BORDER_RADIUS: 16,
    ANIMATION_DURATION: 300,
}

// Detection Confidence Thresholds
export const DETECTION_THRESHOLDS = {
    HIGH: 0.95,
    MEDIUM: 0.80,
    LOW: 0.60,
}

// Processing Time Benchmarks (ms)
export const BENCHMARKS = {
    EDGE_AI_FAST: 1000,
    EDGE_AI_NORMAL: 2000,
    GEMINI_ANALYSIS: 2000,
    BLOCKCHAIN_CONFIRMATION: 5000,
}

export default {
    API_CONFIG,
    BLOCKCHAIN_CONFIG,
    SCAN_PHASES,
    INVENTORY_STATUS,
    QUALITY_LEVELS,
    RISK_LEVELS,
    ROUTES,
    COLORS,
    FEATURES,
    CACHE_DURATION,
    PAGINATION,
    TOAST_MESSAGES,
    STORAGE_KEYS,
    API_ENDPOINTS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    UI,
    DETECTION_THRESHOLDS,
    BENCHMARKS,
}
