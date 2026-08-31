const fs = require('fs/promises');
const path = require('path');
const UnifiedAI = require('../unified-ai.service');

class ThirdPartyAnalysisService {

    /**
     * Recibe datos de sdk de terceros, analiza usabilidad y genera informe.
     * @param {Object} platformData - Datos de uso, tiempos de carga, flows fallidos, etc.
     * @param {string} platformName - Nombre de la plataforma externa
     */
    async analyzeAndReport(platformData, platformName) {
        console.log(`🕵️ Analizando usabilidad de plataforma externa: ${platformName}`);

        try {
            // 1. AI Analysis of the data
            const analysisPrompt = `
                Analiza los siguientes datos de métricas de usuario de la plataforma "${platformName}":
                ${JSON.stringify(platformData, null, 2)}
                
                Identifica:
                1. Carencias graves en la experiencia de usuario (UX).
                2. Un servicio automatizado que BeZhas podría ofrecer para resolver esto.
                3. Cómo esto justifica una suscripción de nivel superior en BeZhas.
                
                Responde en formato Markdown estructurado.
            `;

            const aiReport = await UnifiedAI.generateText(analysisPrompt);

            // 2. Generate File
            const fileName = `UX_ANALYSIS_${platformName.toUpperCase()}_${Date.now()}.md`;
            const reportPath = path.join(__dirname, '../../../REPORTS', fileName);

            // Ensure dir exists
            await fs.mkdir(path.dirname(reportPath), { recursive: true });

            const fullReport = `
# 📊 Informe de Optimización de Usabilidad: ${platformName}
**Fecha:** ${new Date().toLocaleDateString()}
**Generado por:** BeZhas Automation Engine

${aiReport}

## 🚀 Acciones Automatizadas Sugeridas
- [ ] Implementar conector API para ${platformName}
- [ ] Activar flujo de migración de usuarios
            `;

            await fs.writeFile(reportPath, fullReport, 'utf8');
            console.log(`✅ Informe generado: ${reportPath}`);

            return {
                success: true,
                reportPath,
                summary: "Análisis completado. Se han detectado oportunidades de servicio."
            };

        } catch (error) {
            console.error('Error en análisis de terceros:', error);
            throw error;
        }
    }
}

module.exports = new ThirdPartyAnalysisService();
