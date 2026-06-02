// backend/utils/nlp.js
// Emparejamiento simple de contexto para campañas publicitarias

/**
 * matchContextToCampaign
 * Recibe un array de palabras clave de contexto y una lista de campañas.
 * Devuelve la campaña con mayor coincidencia de palabras clave.
 * @param {string[]} context - Palabras clave del contexto actual
 * @param {Array} campaigns - Lista de campañas activas [{ id, keywords, ... }]
 * @returns {Object|null} Campaña más relevante o null si no hay coincidencias
 */
function matchContextToCampaign(context, campaigns) {
    let best = null, maxScore = 0;
    for (const camp of campaigns) {
        // Coincidencias exactas (puedes mejorar con stemming/fuzzy)
        const score = camp.keywords.filter(k => context.includes(k)).length;
        if (score > maxScore) {
            best = camp;
            maxScore = score;
        }
    }
    return best;
}

module.exports = { matchContextToCampaign };
