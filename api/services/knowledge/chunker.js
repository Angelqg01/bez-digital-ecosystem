/**
 * Chunking por párrafos con solape. Conserva la sección (último encabezado).
 */
function chunkText(text, { maxChars = 900, overlap = 120 } = {}) {
    const clean = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!clean) return [];

    const paragraphs = clean.split(/\n{2,}/);
    const chunks = [];
    let section = '';
    let buf = '';

    const flush = () => {
        const content = buf.trim();
        if (content) chunks.push({ content, section });
        buf = overlap > 0 && content.length > overlap ? content.slice(-overlap) : '';
    };

    for (const para of paragraphs) {
        const heading = para.match(/^#{1,6}\s+(.+)$/m);
        if (heading && para.trim().startsWith('#')) section = heading[1].trim();

        if (para.length > maxChars) {
            // Párrafo largo: partir por frases.
            for (const sentence of para.split(/(?<=[.!?])\s+/)) {
                if ((buf + ' ' + sentence).length > maxChars) flush();
                buf += (buf ? ' ' : '') + sentence;
            }
            continue;
        }
        if ((buf + '\n\n' + para).length > maxChars) flush();
        buf += (buf ? '\n\n' : '') + para;
    }
    flush();
    return chunks;
}

module.exports = { chunkText };
