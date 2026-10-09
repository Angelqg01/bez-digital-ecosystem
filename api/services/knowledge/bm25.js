/** BM25 mínimo sobre un conjunto de chunks (ya filtrado por ACL). */
const STOP = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'un', 'una', 'que', 'es', 'se', 'por', 'con', 'para', 'del', 'al', 'the', 'of', 'and', 'to', 'is', 'in', 'a',
    // Palabras de pregunta y auxiliares: no distinguen un documento de otro y diluían la consulta («¿qué es… y en qué red está?»).
    'como', 'cual', 'cuales', 'cuanto', 'cuanta', 'cuantos', 'donde', 'cuando', 'quien', 'puedo', 'puede', 'pueden', 'hay', 'esta', 'estan',
    'son', 'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'me', 'te', 'lo', 'le', 'si', 'no', 'ni', 'sobre', 'entre', 'hasta', 'desde', 'muy', 'una', 'uno', 'unos', 'unas', 'ser', 'hace', 'hacer']);

/**
 * Raíz ligera para español: quita la «s» final y corta a 6 letras. Sin esto la búsqueda es literal y «¿cómo tokenizo…?»
 * no encontraba el documento que habla de «tokenizar» y «tokenización» (ni «nóminas» ↔ «nómina»). Se aplica igual a los
 * documentos y a la consulta, así que no cambia nada de lo que ya coincidía y sólo añade coincidencias.
 */
function raiz(t) {
    if (t.length < 6) return t;
    return t.replace(/s$/, '').slice(0, 6);
}

function tokenize(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 1 && !STOP.has(t))
        .map(raiz);
}

/**
 * `minCoverage`: fracción mínima del «peso» de la consulta (suma de idf de sus términos) que un documento tiene que cubrir.
 * Sin esto, BM25 devuelve lo que sea que comparta UNA palabra («capital de Mongolia» → el documento de BZ Capital) y el
 * asistente presenta como respuesta un documento que no tiene nada que ver. Un término que no existe en ningún documento
 * pesa mucho y deja la cobertura baja: la pregunta queda sin respuesta en vez de inventada.
 */
function bm25Rank(query, chunks, { k1 = 1.4, b = 0.75, minCoverage = 0.25 } = {}) {
    const qTerms = [...new Set(tokenize(query))];
    if (!qTerms.length || !chunks.length) return [];

    // El título se cuenta tres veces: una pregunta que nombra un tema («¿qué es el BEZ…?») debe encontrar el documento que se llama así.
    const docs = chunks.map((c) => ({ c, tokens: tokenize(`${c.title || ''} ${c.title || ''} ${c.title || ''} ${c.section || ''} ${c.content}`) }));
    const avgLen = docs.reduce((s, d) => s + d.tokens.length, 0) / docs.length || 1;
    const df = new Map();
    for (const d of docs) for (const t of new Set(d.tokens)) df.set(t, (df.get(t) || 0) + 1);

    const N = docs.length;
    const idfDe = (q) => Math.log(1 + (N - (df.get(q) || 0) + 0.5) / ((df.get(q) || 0) + 0.5));
    const masaTotal = qTerms.reduce((m, q) => m + idfDe(q), 0) || 1;
    return docs
        .map(({ c, tokens }) => {
            const tf = new Map();
            tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
            let score = 0;
            let masa = 0;
            for (const q of qTerms) {
                const f = tf.get(q) || 0;
                if (!f) continue;
                const idf = idfDe(q);
                masa += idf;
                score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * tokens.length) / avgLen)));
            }
            return { chunk: c, score, coverage: masa / masaTotal };
        })
        .filter((r) => r.score > 0 && r.coverage >= minCoverage)
        .sort((a, b2) => b2.score - a.score);
}

module.exports = { tokenize, bm25Rank };
