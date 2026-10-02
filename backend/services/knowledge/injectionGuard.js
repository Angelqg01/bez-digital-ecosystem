/**
 * Defensa frente a prompt injection indirecta en contenido recuperado.
 * El texto de los documentos es SIEMPRE dato no confiable.
 */
const PATTERNS = [
    /ignor(e|a|ar)\s+(all|todas?|las|the|previous|anteriores|prior)[^.\n]{0,40}(instruction|instrucci|polic|pol[ií]tic|rule|regla)/i,
    /disregard\s+(all|any|the|previous)[^.\n]{0,40}(instruction|polic|rule)/i,
    /olvida\s+(todo|las\s+instrucciones|lo\s+anterior)/i,
    /(you\s+are\s+now|ahora\s+eres|from\s+now\s+on\s+you)/i,
    /(reveal|show|print|muestra|revela|imprime)[^.\n]{0,30}(system\s+prompt|prompt\s+del\s+sistema|api[\s_-]?key|private\s+key|clave\s+privada|secret|token)/i,
    /(export|exfiltrat|env[ií]a|send|post)[^.\n]{0,40}(all|todos?|every)[^.\n]{0,30}(document|data|datos|secret|key)/i,
    /<\/?\s*(system|assistant|untrusted_document|tool|function_call)\b/i,
    /!\[[^\]]*\]\(\s*https?:\/\/[^)]*[?&][^)]*=/i, // exfiltración vía imagen markdown
    /\b(sudo|rm\s+-rf|curl\s+[^|]+\|\s*(ba)?sh)\b/i,
];

function scan(text) {
    const hits = [];
    const s = String(text || '');
    for (const re of PATTERNS) if (re.test(s)) hits.push(re.source.slice(0, 40));
    return { suspicious: hits.length > 0, hits };
}

/** Neutraliza delimitadores para que un documento no pueda cerrar su sandbox. */
function neutralize(text) {
    return String(text || '')
        .replace(/<\s*\/?\s*untrusted_document[^>]*>/gi, '[tag-removed]')
        .replace(/<\s*\/?\s*(system|assistant|tool)[^>]*>/gi, '[tag-removed]')
        .replace(/!\[([^\]]*)\]\(\s*https?:\/\/[^)]*\)/g, '[imagen externa bloqueada: $1]');
}

module.exports = { scan, neutralize };
