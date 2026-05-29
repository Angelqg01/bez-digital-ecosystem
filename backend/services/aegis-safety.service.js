/**
 * ============================================================================
 * AEGIS Safety & Autonomous Maintenance Service
 * ============================================================================
 * 
 * Monitorea el Feedback Loop y los logs de la IA para detectar anomalías
 * y aplicar correcciones preventivas.
 */

const fs = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');
const feedbackLoopService = require('./feedback-loop.service');

class AegisSafetyService {
    constructor() {
        this.status = 'monitor'; // monitor | alert | lockdown
        this.errorThreshold = 3;
    }

    /**
     * Analiza los logs recientes para detectar patrones de fallo
     */
    async evaluateSystemHealth() {
        logger.info('🛡️ [AEGIS] Evaluating system health via Feedback Loop...');
        
        try {
            const dateStr = new Date().toISOString().split('T')[0];
            const logFile = path.join(process.cwd(), '_agents', 'skills', 'feedback-loop', `daily_${dateStr}.jsonl`);
            
            const content = await fs.readFile(logFile, 'utf8');
            const entries = content.split('\n').filter(Boolean).map(JSON.parse);

            // 1. Contar errores recurrentes
            const errors = entries.filter(e => e.status === 'error');
            const errorCounts = {};
            
            errors.forEach(err => {
                const key = `${err.type}:${err.action}`;
                errorCounts[key] = (errorCounts[key] || 0) + 1;
            });

            // 2. Actuar si se supera el umbral
            for (const [action, count] of Object.entries(errorCounts)) {
                if (count >= this.errorThreshold) {
                    await this._handleSystemAnomaly(action, count);
                }
            }

            return { health: 'ok', detectedIssues: Object.keys(errorCounts).length };

        } catch (error) {
            // Si no hay logs hoy, el sistema está "limpio" o recién iniciado
            return { health: 'stable', message: 'No logs for analysis yet' };
        }
    }

    /**
     * Intervención proactiva ante anomalías
     */
    async _handleSystemAnomaly(actionKey, count) {
        logger.warn(`🚨 [AEGIS] Anomaly detected in ${actionKey}: ${count} failures!`);
        
        // Acción: Actualizar el estado a 'alert'
        this.status = 'alert';

        // Intentar una solución autónoma: Crear un documento de Skill de "ADVERTENCIA"
        const [type, action] = actionKey.split(':');
        await feedbackLoopService.log({
            type: 'aegis_intervention',
            action: 'PREVENTIVE_FIX',
            status: 'success',
            result: `Applied autonomous safeguard for ${actionKey}`,
            solution: `IA debe PRIORIZAR el modo heurístico para ${action} hasta que se revise el modelo.`,
            metadata: { originalFailures: count }
        });

        // Simulación: Notificar al panel de control del desarrollador (evento)
        // require('./notification.service').sendAlert('ANOMALY_DETECTED', { actionKey, count });
    }

    getStatus() {
        return this.status;
    }
}

module.exports = new AegisSafetyService();
