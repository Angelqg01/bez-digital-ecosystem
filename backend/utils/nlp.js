// backend/utils/nlp.js
// Emparejamiento simple de contexto para campañas publicitarias

/**
 * matchContextToCampaign
 *
 * Recibe un array de palabras clave de contexto y una lista de campañas, y
 * devuelve la campaña con mayor coincidencia de palabras clave.
 *
 * Las entradas vienen de fuera (el contexto lo manda el cliente, las campañas
 * la base de datos), así que se validan: una campaña sin `keywords` o un
 * contexto que no sea un array hacían reventar el emparejamiento con
 * «Cannot read properties of undefined (reading 'filter')» en vez de
 * devolver «ningún anuncio».
 *
 * @param {string[]} context - Palabras clave del contexto actual
 * @param {Array} campaigns - Lista de campañas activas [{ id, keywords, ... }]
 * @returns {Object|null} Campaña más relevante o null si no hay coincidencias
 */
function matchContextToCampaign(context, campaigns) {
    if (!Array.isArray(context) || !Array.isArray(campaigns)) return null;

    // Comparación insensible a mayúsculas: «DeFi» y «defi» son la misma etiqueta.
    const contexto = new Set(
        context.filter((c) => typeof c === 'string').map((c) => c.toLowerCase())
    );
    if (contexto.size === 0) return null;

    let best = null;
    let maxScore = 0;

    for (const camp of campaigns) {
        if (!camp || !Array.isArray(camp.keywords)) continue;

        const score = camp.keywords.filter(
            (k) => typeof k === 'string' && contexto.has(k.toLowerCase())
        ).length;

        if (score > maxScore) {
            best = camp;
            maxScore = score;
        }
    }

    return best;
}

module.exports = { matchContextToCampaign };
