'use strict';

/**
 * Servidor MCP de prueba: habla el protocolo real (JSON-RPC 2.0 por stdio,
 * mensajes delimitados por línea) con dos herramientas:
 *   - echo({ text })       → devuelve el texto
 *   - sumar({ a, b })      → devuelve a + b
 * Sirve para probar MCPConnector sin depender de ningún servidor externo.
 */
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) handle(line);
  }
});

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function handle(line) {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined) return; // notificación (p.ej. notifications/initialized)

  if (method === 'initialize') {
    return send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'mcp-fake', version: '1.0.0' },
      },
    });
  }

  if (method === 'tools/list') {
    return send({
      jsonrpc: '2.0', id,
      result: {
        tools: [
          {
            name: 'echo',
            description: 'Devuelve el texto recibido',
            inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
          },
          {
            name: 'sumar',
            description: 'Suma dos números',
            inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] },
          },
        ],
      },
    });
  }

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params || {};
    if (name === 'echo') {
      return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `eco: ${args.text}` }] } });
    }
    if (name === 'sumar') {
      return send({
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: String(args.a + args.b) }],
          structuredContent: { resultado: args.a + args.b },
        },
      });
    }
    return send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: `herramienta desconocida: ${name}` }] } });
  }

  send({ jsonrpc: '2.0', id, error: { code: -32601, message: `método no soportado: ${method}` } });
}
