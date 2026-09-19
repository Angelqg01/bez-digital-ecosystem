/**
 * BeZhas Intelligence — punto de entrada por STDIO
 *
 * Es el transporte que usa un cliente MCP de verdad (Claude Desktop, Claude
 * Code, la integración de VS Code): el cliente lanza este proceso y habla con
 * él por la entrada y la salida estándar. Para Docker y para el backend está
 * el envoltorio HTTP, en `http-server.ts`.
 *
 * Dos cosas que este fichero hace a propósito:
 *
 *   1. Arma el servidor en una función exportada, `crearServidor()`, y solo
 *      abre el transporte cuando este fichero ES el programa que se ejecuta.
 *      Con la conexión al importar, cualquier prueba que lo cargara se quedaba
 *      enganchada a stdin y no había forma de comprobar nada de aquí.
 *
 *   2. Deriva el sujeto del vigilante con `subjectFromApiKey`, que aplica un
 *      HMAC. Antes usaba `BEZHAS_API_KEY.slice(0, 12)` en claro, y el sujeto
 *      va en CADA entrada de la auditoría, que se escribe a disco: eran doce
 *      caracteres de la credencial en un fichero de registro. La vía HTTP ya
 *      seudonimizaba correctamente; esta no.
 *
 * @contract BEZ Token: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8 (INMUTABLE)
 */
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';
import { hardenServer, subjectFromApiKey } from './security/index.js';

/**
 * Arma el servidor MCP con todas las herramientas ya vigiladas.
 *
 * El blindaje se aplica envolviendo el servidor, no herramienta a herramienta,
 * para que una herramienta nueva quede protegida sin que nadie tenga que
 * acordarse en su fichero.
 *
 * El sujeto del vigilante se calcula UNA vez aquí, no en cada llamada. Además
 * de ahorrar la derivación —que con `scrypt` cuesta de verdad—, deja la
 * credencial leída del entorno en un único punto del proceso: se convierte en
 * su etiqueta opaca ahí mismo y el valor en claro no viaja a ninguna otra
 * parte ni puede acabar por descuido en un registro.
 */
export function crearServidor(): McpServer {
    const server = new McpServer({
        name: 'bezhas-intelligence',
        version: '1.1.0',
        description:
            'BeZhas AI Intelligence Server - Gas optimization, Fiat/Crypto swap, payment processing, and regulatory compliance',
    });

    const sujeto = subjectFromApiKey(process.env.BEZHAS_API_KEY);

    registerTools(
        hardenServer(server, {
            resolveSubject: () => sujeto,
        }),
    );

    return server;
}

/** Arranca el servidor sobre STDIO. */
export async function arrancar(): Promise<McpServer> {
    const server = crearServidor();
    await server.connect(new StdioServerTransport());

    // Por stderr: stdout es el canal del protocolo, y escribir ahí corrompe
    // los mensajes que el cliente está leyendo.
    console.error('🧠 BeZhas Intelligence MCP Server running (STDIO)');
    return server;
}

/** Solo se conecta cuando este fichero es el programa, no cuando se importa. */
const ejecutadoDirectamente = (() => {
    const entrada = process.argv[1];
    return Boolean(entrada) && import.meta.url === pathToFileURL(entrada!).href;
})();

if (ejecutadoDirectamente) {
    arrancar().catch((err) => {
        // Sin esto, un fallo al conectar salía como rechazo no atendido: el
        // proceso moría con un volcado y el cliente solo veía que su servidor
        // MCP no respondía, sin motivo.
        console.error('No se pudo arrancar el servidor MCP por STDIO:', err);
        process.exit(1);
    });
}
