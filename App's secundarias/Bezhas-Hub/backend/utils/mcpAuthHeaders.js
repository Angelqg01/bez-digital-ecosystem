/**
 * Headers de auth para llamar al MCP server (bezhas-intelligence).
 *
 * Si `MCP_API_KEY` está definida en el entorno del backend, se añade
 * `X-API-Key` a las peticiones — necesario cuando el MCP server tiene
 * enforcement activo (su propio MCP_API_KEY configurado).
 * Sin la variable, devuelve {} (modo legacy, compatible con despliegues actuales).
 */
function mcpAuthHeaders() {
    const key = (process.env.MCP_API_KEY || '').trim();
    return key ? { 'X-API-Key': key } : {};
}

module.exports = { mcpAuthHeaders };
