/**
 * Destinos que el auditor de páginas (`playwright_automation`) puede pedir.
 *
 * La herramienta mide carga, rendimiento y accesibilidad de las páginas de
 * BeZhas. Si acepta cualquier URL, quien la invoque la usa para que este
 * servidor haga peticiones por él: a la red interna de Cloud Run, al servidor
 * de metadatos (169.254.169.254) o a terceros, con nuestra IP (SSRF).
 *
 * Por eso el host sale de esta lista y no de la entrada: la URL que se pide se
 * construye con el host de la lista, no con el que llegó.
 */
export const HOSTS_AUDITABLES = ['bezhas.com', 'www.bezhas.com', 'api.bezhas.com', 'mcp.bezhas.com'] as const;

export class UrlNoPermitida extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UrlNoPermitida';
    }
}

export function urlAuditable(entrada: string): string {
    let url: URL;
    try {
        url = new URL(entrada);
    } catch {
        throw new UrlNoPermitida('URL no válida.');
    }
    if (url.protocol !== 'https:') throw new UrlNoPermitida('Solo se auditan URLs https.');
    if (url.username || url.password || (url.port && url.port !== '443')) {
        throw new UrlNoPermitida('La URL no puede llevar credenciales ni otro puerto que el 443.');
    }
    const host = HOSTS_AUDITABLES.find((h) => h === url.hostname.toLowerCase());
    if (!host) {
        throw new UrlNoPermitida(`Solo se auditan páginas de BeZhas: ${HOSTS_AUDITABLES.join(', ')}.`);
    }
    return `https://${host}${url.pathname}${url.search}`;
}
