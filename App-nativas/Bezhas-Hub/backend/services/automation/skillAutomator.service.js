const fs = require('fs').promises;
const path = require('path');
const pino = require('pino');
const logger = pino({ name: 'SkillAutomator' });
const GlobalSettings = require('../../models/pg/GlobalSettings');

/**
 * SkillAutomator Service - BeZhas
 * 
 * Automates the recording of platform knowledge into SKILL files.
 * This service ensures the AI "learns" from every configuration change,
 * bugfix, and optimization.
 */
class SkillAutomatorService {
    constructor() {
        this.baseSkillPath = path.join(process.cwd(), '_agents/skills');
        this.feedbackLoopPath = path.join(this.baseSkillPath, 'feedback-loop');
    }

    /**
     * Registra un error y su solución en el Feedback Loop
     * @param {Object} data { symptom, cause, solution, filesAffected }
     */
    async registerBugfix({ symptom, cause, solution, filesAffected = [] }) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const logPath = path.join(this.feedbackLoopPath, 'error-log.md');
            
            const entry = `
### [${date}] ERROR: ${symptom.substring(0, 50)}...
- **Síntoma**: ${symptom}
- **Causa**: ${cause}
- **Solución**: ${solution}
- **Estado**: ✅ Resuelto
- **Archivos afectados**: ${filesAffected.join(', ') || 'N/A'}

---
`;
            await fs.appendFile(logPath, entry);
            logger.info('Bugfix registered in Feedback Loop');
            return true;
        } catch (error) {
            logger.error('Failed to register bugfix', error);
            return false;
        }
    }

    /**
     * Registra una optimización o mejora (AIOps)
     * @param {Object} data { area, before, after, impact }
     */
    async registerOptimization({ area, before, after, impact }) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const logPath = path.join(this.feedbackLoopPath, 'optimization-log.md');
            
            const entry = `
### [${date}] OPT: ${area.toUpperCase()} Improvement
- **Área**: ${area}
- **Antes**: ${before}
- **Después**: ${after}
- **Impacto**: ${impact}

---
`;
            await fs.appendFile(logPath, entry);
            logger.info('Optimization registered in Feedback Loop');
            return true;
        } catch (error) {
            logger.error('Failed to register optimization', error);
            return false;
        }
    }

    /**
     * Guarda un snapshot de la configuración global actual en el Learning Vault
     * para que la IA sepa qué parámetros están activos.
     */
    async snapshotConfig() {
        try {
            const settings = await GlobalSettings.findOne().sort({ createdAt: -1 });
            if (!settings) return;

            const vaultPath = path.join(this.feedbackLoopPath, 'learning-vault');
            await fs.mkdir(vaultPath, { recursive: true });

            const date = new Date().toISOString().replace(/:/g, '-');
            const filename = `config-snapshot-${date}.md`;
            
            const content = `# BeZhas Config Snapshot - ${date}\n\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\``;
            
            await fs.writeFile(path.join(vaultPath, filename), content);
            logger.info(`Config snapshot saved: ${filename}`);
            return filename;
        } catch (error) {
            logger.error('Failed to snapshot config', error);
        }
    }

    /**
     * Automatiza la creación de un nuevo SKILL si se detecta un módulo nuevo
     * @param {String} name 
     * @param {String} description 
     */
    async createNewSkill(name, description) {
        try {
            const skillDir = path.join(this.baseSkillPath, name.toLowerCase());
            await fs.mkdir(skillDir, { recursive: true });

            const content = `---
name: ${name}
description: ${description}
---

# ${name} SKILL

## Propósito
${description}

## Automatización IA
Este archivo fue generado automáticamente por el SkillAutomator de BeZhas.

---
`;
            await fs.writeFile(path.join(skillDir, 'SKILL.md'), content);
            logger.info(`New Skill created: ${name}`);
            return true;
        } catch (error) {
            logger.error('Failed to create new skill', error);
            return false;
        }
    }
}

module.exports = new SkillAutomatorService();
