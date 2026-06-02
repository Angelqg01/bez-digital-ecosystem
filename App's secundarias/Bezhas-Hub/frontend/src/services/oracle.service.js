/**
 * ============================================================================
 * ORACLE SERVICE - Frontend
 * ============================================================================
 * 
 * Servicio para interactuar con el Quality Oracle multi-sector
 * Conecta con el backend API y smart contracts
 */

import http from './http';

// Sectores disponibles del Oracle
export const ORACLE_SECTORS = [
    'marketplace',
    'logistics',
    'payments',
    'ai_moderation',
    'identity',
    'real_estate',
    'healthcare',
    'manufacturing',
    'automotive',
    'energy',
    'agriculture',
    'education',
    'insurance',
    'entertainment',
    'legal',
    'supply_chain',
    'government',
    'carbon_credits'
];

/**
 * Obtener cola de validaciones por sector
 */
export const getValidationQueue = async (sector = 'marketplace', limit = 10) => {
    try {
        const response = await http.get(`/oracle/queue/${sector}`, {
            params: { limit }
        });
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error fetching validation queue:', error);
        throw error;
    }
};

/**
 * Obtener validaciones pendientes del usuario
 */
export const getUserPendingValidations = async (address) => {
    try {
        const response = await http.get(`/oracle/user/${address}/pending`);
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error fetching user pending validations:', error);
        throw error;
    }
};

/**
 * Enviar voto de validación
 */
export const submitValidationVote = async (validationId, vote, reason = '') => {
    try {
        const response = await http.post('/oracle/vote', {
            validationId,
            vote, // 'approve', 'reject', 'escalate'
            reason
        });
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error submitting vote:', error);
        throw error;
    }
};

/**
 * Obtener estadísticas del validador
 */
export const getValidatorStats = async (address) => {
    try {
        const response = await http.get(`/oracle/validator/${address}/stats`);
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error fetching validator stats:', error);
        throw error;
    }
};

/**
 * Obtener recompensas pendientes
 */
export const getPendingRewards = async (address) => {
    try {
        const response = await http.get(`/oracle/validator/${address}/rewards`);
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error fetching pending rewards:', error);
        throw error;
    }
};

/**
 * Reclamar recompensas
 */
export const claimRewards = async () => {
    try {
        const response = await http.post('/oracle/rewards/claim');
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error claiming rewards:', error);
        throw error;
    }
};

/**
 * Registrar como validador (stake BEZ)
 */
export const registerAsValidator = async (stakeAmount, sectors = ['marketplace']) => {
    try {
        const response = await http.post('/oracle/validator/register', {
            stakeAmount,
            sectors
        });
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error registering as validator:', error);
        throw error;
    }
};

/**
 * Obtener estadísticas globales del Oracle
 */
export const getOracleGlobalStats = async () => {
    try {
        const response = await http.get('/oracle/stats/global');
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error fetching global stats:', error);
        throw error;
    }
};

/**
 * Obtener estadísticas por sector
 */
export const getSectorStats = async (sector) => {
    try {
        const response = await http.get(`/oracle/stats/sector/${sector}`);
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error fetching sector stats:', error);
        throw error;
    }
};

/**
 * Escalar validación para revisión DAO
 */
export const escalateValidation = async (validationId, reason) => {
    try {
        const response = await http.post('/oracle/escalate', {
            validationId,
            reason
        });
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error escalating validation:', error);
        throw error;
    }
};

/**
 * Obtener historial de validaciones del usuario
 */
export const getValidationHistory = async (address, page = 1, limit = 20) => {
    try {
        const response = await http.get(`/oracle/validator/${address}/history`, {
            params: { page, limit }
        });
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error fetching validation history:', error);
        throw error;
    }
};

/**
 * Verificar si una dirección es validador activo
 */
export const isActiveValidator = async (address) => {
    try {
        const response = await http.get(`/oracle/validator/${address}/status`);
        return response.data?.isActive || false;
    } catch (error) {
        console.error('[OracleService] Error checking validator status:', error);
        return false;
    }
};

/**
 * Obtener detalles de una validación específica
 */
export const getValidationDetails = async (validationId) => {
    try {
        const response = await http.get(`/oracle/validation/${validationId}`);
        return response.data;
    } catch (error) {
        console.error('[OracleService] Error fetching validation details:', error);
        throw error;
    }
};

// Export default object
export default {
    ORACLE_SECTORS,
    getValidationQueue,
    getUserPendingValidations,
    submitValidationVote,
    getValidatorStats,
    getPendingRewards,
    claimRewards,
    registerAsValidator,
    getOracleGlobalStats,
    getSectorStats,
    escalateValidation,
    getValidationHistory,
    isActiveValidator,
    getValidationDetails
};
