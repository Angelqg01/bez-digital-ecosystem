/**
 * Defensa frente a prompt injection indirecta en contenido recuperado.
 * El texto de los documentos es SIEMPRE dato no confiable.
 */
// Cuantificadores acotados en todos los patrones: el texto de los documentos es
// entrada no confiable y no debe poder provocar backtracking polinómico (ReDoS).
const PATTERNS = [
    /ignor(?:e|a|ar)\s{1,5}(?:all|todas?|las|the|previous|anteriores|prior)[^.\n]{0,40}(?:instruction|instrucci|polic|pol[ií]tic|rule|regla)/i,
    /disregard\s{1,5}(?:all|any|the|previous)[^.\n]{0,40}(?:instruction|polic|rule)/i,
    /olvida\s{1,5}(?:todo|las\s{1,5}instrucciones|lo\s{1,5}anterior)/i,
    /(?:you\s{1,5}are\s{1,5}now|ahora\s{1,5}eres|from\s{1,5}now\s{1,5}on\s{1,5}you)/i,
    /(?:reveal|show|print|muestra|revela|imprime)[^.\n]{0,30}(?:system\s{1,5}prompt|prompt\s{1,5}del\s{1,5}sistema|api[\s_-]{0,2}key|private\s{1,5}key|clave\s{1,5}privada|secret|token)/i,
    /(?:export|exfiltrat|env[ií]a|send|post)[^.\n]{0,40}(?:all|todos?|every)[^.\n]{0,30}(?:document|data|datos|secret|key)/i,
    /<\/?\s{0,5}(?:system|assistant|untrusted_document|tool|function_call)\b/i,
    /!\[[^\]]{0,200}\]\(\s{0,5}https?:\/\/[^)?&]{0,300}[?&]/i, // exfiltración vía imagen markdown con query
    /\b(?:sudo|rm\s{1,5}-rf|curl\s{1,5}[^|\n]{0,200}\|\s{0,5}(?:ba)?sh)\b/i,
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
        .replace(/<\s{0,5}\/?\s{0,5}untrusted_document[^>]{0,200}>/gi, '[tag-removed]')
        .replace(/<\s{0,5}\/?\s{0,5}(?:system|assistant|tool)[^>]{0,200}>/gi, '[tag-removed]')
        .replace(/!\[([^\]]{0,200})\]\(\s{0,5}https?:\/\/[^)]{0,500}\)/g, '[imagen externa bloqueada: $1]');
}

module.exports = { scan, neutralize };
