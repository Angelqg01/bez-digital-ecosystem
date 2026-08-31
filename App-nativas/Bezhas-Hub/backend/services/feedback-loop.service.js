/**
 * ============================================================================
 * BeZhas Feedback Loop Service
 * ============================================================================
 * 
 * Este servicio implementa el aprendizaje autónomo de la IA de BeZhas.
 * Guarda éxitos, fallos y soluciones en la carpeta SKILL para que el LLM
 * aprenda de experiencias pasadas y optimice el uso de tokens.
 */

const fs = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');

class FeedbackLoopService {
    constructor() {
        this.skillsDir = path.join(process.cwd(), '_agents', 'skills');
        this.feedbackDir = path.join(this.skillsDir, 'feedback-loop');
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        try {
            await fs.mkdir(this.feedbackDir, { recursive: true });
            this.initialized = true;
            logger.info('🔄 Feedback Loop Service Initialized at ' + this.feedbackDir);
        } catch (error) {
            logger.error('Failed to initialize Feedback Loop Service', error);
        }
    }

    /**
     * Registra un evento de aprendizaje
     * @param {Object} entry - { type, action, status, result, error, solution, metadata }
     */
    async log(entry) {
        if (!this.initialized) await this.init();

        const timestamp = new Date().toISOString();
        const dateStr = timestamp.split('T')[0];
        const logFile = path.join(this.feedbackDir, `daily_${dateStr}.jsonl`);

        const logEntry = {
            timestamp,
            ...entry
        };

        try {
            await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
            
            // Si hay un error y una solución conocida, actualizar el archivo de Skill correspondiente
            if (entry.status === 'success' && entry.solution) {
                await this._updateSkillDoc(entry);
            }
        } catch (error) {
            logger.error('Error logging feedback loop entry', error);
        }
    }

    /**
     * Actualiza o crea un documento de Skill basado en el aprendizaje
     */
    async _updateSkillDoc(entry) {
        const skillName = entry.type || 'general';
        const skillPath = path.join(this.skillsDir, skillName, 'LEARNED_PATTERNS.md');
        
        try {
            await fs.mkdir(path.dirname(skillPath), { recursive: true });
            
            let content = '';
            try {
                content = await fs.readFile(skillPath, 'utf8');
            } catch (e) {
                content = `# Learned Patterns for ${skillName}\n\nEste archivo contiene patrones aprendidos automáticamente por el Feedback Loop.\n\n`;
            }

            const patternEntry = `### [${new Date().toLocaleDateString()}] ${entry.action}\n` +
                                `- **Contexto:** ${JSON.stringify(entry.metadata || {})}\n` +
                                `- **Resultado:** ${entry.result || 'Exitoso'}\n` +
                                `- **Aprendizaje:** ${entry.solution || 'N/A'}\n\n`;

            // Evitar duplicados simples (si la solución ya está exactamente igual)
            if (!content.includes(entry.solution)) {
                await fs.writeFile(skillPath, content + patternEntry);
                logger.info(`🧠 Skill updated: ${skillName}`);
            }
        } catch (error) {
            logger.warn('Failed to update skill doc', error);
        }
    }

    /**
     * Obtiene conocimientos previos para una acción específica
     */
    async getKnowledge(action) {
        // En una implementación real, esto leería los LEARNED_PATTERNS.md
        // Para este MVP, devolvemos un resumen de los últimos logs relevantes
        return null; 
    }
}

module.exports = new FeedbackLoopService();
