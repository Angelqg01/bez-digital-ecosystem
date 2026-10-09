/** BM25 mínimo sobre un conjunto de chunks (ya filtrado por ACL). */
const STOP = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'un', 'una', 'que', 'es', 'se', 'por', 'con', 'para', 'del', 'al', 'the', 'of', 'and', 'to', 'is', 'in', 'a']);

function tokenize(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 1 && !STOP.has(t));
}

function bm25Rank(query, chunks, { k1 = 1.4, b = 0.75 } = {}) {
    const qTerms = [...new Set(tokenize(query))];
    if (!qTerms.length || !chunks.length) return [];

    const docs = chunks.map((c) => ({ c, tokens: tokenize(`${c.title || ''} ${c.section || ''} ${c.content}`) }));
    const avgLen = docs.reduce((s, d) => s + d.tokens.length, 0) / docs.length || 1;
    const df = new Map();
    for (const d of docs) for (const t of new Set(d.tokens)) df.set(t, (df.get(t) || 0) + 1);

    const N = docs.length;
    return docs
        .map(({ c, tokens }) => {
            const tf = new Map();
            tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
            let score = 0;
            for (const q of qTerms) {
                const f = tf.get(q) || 0;
                if (!f) continue;
                const idf = Math.log(1 + (N - (df.get(q) || 0) + 0.5) / ((df.get(q) || 0) + 0.5));
                score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * tokens.length) / avgLen)));
            }
            return { chunk: c, score };
        })
        .filter((r) => r.score > 0)
        .sort((a, b2) => b2.score - a.score);
}

module.exports = { tokenize, bm25Rank };
