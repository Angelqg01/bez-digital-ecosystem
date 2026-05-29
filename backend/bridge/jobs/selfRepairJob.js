/**
 * ============================================================================
 * BeZhas Self-Repair & Maintenance Job
 * ============================================================================
 * 
 * Este job se ejecuta periódicamente para que el sistema se "auto-repare"
 * basándose en las lecciones aprendidas en el Feedback Loop.
 */

const aegisSafetyService = require('../services/aegis-safety.service');
const logger = require('../utils/logger');

async function runSelfRepair() {
    logger.info('🔧 [AUTO-MAINTENANCE] Starting system self-repair cycle...');
    
    try {
        const report = await aegisSafetyService.evaluateSystemHealth();
        
        if (report.health !== 'ok') {
            logger.warn({ report }, 'Anomalies detected during self-repair. Safeguards active.');
        } else {
            logger.info('✅ System health is optimal. No repairs needed.');
        }
    } catch (error) {
        logger.error({ error }, 'Self-repair cycle failed');
    }
}

// Ejecutar cada 4 horas (o según configuración)
setInterval(runSelfRepair, 4 * 60 * 60 * 1000);

// Exportar para ejecución manual
module.exports = { runSelfRepair };
