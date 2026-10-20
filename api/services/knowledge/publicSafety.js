'use strict';

/**
 * Última barrera antes de publicar conocimiento como PUBLIC: el texto lo leen
 * clientes por el chat, la API, el SDK y el MCP, y lo copia OPERANT.
 *
 * No sustituye a la revisión humana de lo que se marca público; atrapa los
 * descuidos típicos al resumir notas internas: rutas del repositorio, puertos,
 * hosts internos, nombres de secretos o material que parece una clave.
 */
const PROHIBIDO = [
    [/App-nativas\//i, 'ruta del repositorio'],
    [/\b(?:api|agent-lib|business-ops|obsidian-mcp|control-center|deploy)\/[\w.-]/i, 'ruta del repositorio'],
    [/\b[\w-]+\.(?:js|ts|tsx|sol|sh|env|json|ya?ml)\b/i, 'nombre de fichero'],
    [/\blocalhost\b|127\.0\.0\.1|0\.0\.0\.0/i, 'host local'],
    [/\.run\.app\b|\.internal\b/i, 'host interno'],
    [/\b(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?:\.\d{1,3})?\b/, 'IP privada'],
    [/(?:^|[\s(])[:·]\s?\d{4,5}\b|\bpuerto\s*:?\s*\d{2,5}\b/i, 'puerto'],
    [/\b0x[0-9a-f]{64}\b/i, 'posible clave privada'],
    [/\b(?:sk|rk|pk)_(?:live|test)_\w+/i, 'clave de Stripe'],
    [/\b[A-Z][A-Z0-9_]*_(?:SECRET|KEY|TOKEN|PASSWORD|PASS)\b/, 'nombre de secreto'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'clave privada'],
    [/\[\[|\]\]/, 'enlace interno del vault'],
];

/** Devuelve los motivos por los que el texto no puede publicarse (vacío = apto). */
function motivosNoPublicable(texto) {
    const s = String(texto || '');
    return PROHIBIDO.filter(([re]) => re.test(s)).map(([, motivo]) => motivo);
}

/** Lanza si el texto no es apto para conocimiento PUBLIC. */
function assertPublicable(texto, origen = 'documento') {
    const motivos = motivosNoPublicable(texto);
    if (motivos.length) {
        throw new Error(`${origen} no es publicable: ${[...new Set(motivos)].join(', ')}`);
    }
}

module.exports = { motivosNoPublicable, assertPublicable };
