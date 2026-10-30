'use strict';

/**
 * safeFetch — peticiones salientes a URLs que elige un cliente (webhooks,
 * conectores, upstreams del marketplace) sin abrir la red interna (SSRF).
 *
 * Sin esto, un cliente registra `http://169.254.169.254/computeMetadata/...`
 * o `http://10.x.x.x:6379` como "su webhook" y la API, que corre en Cloud Run
 * con acceso a la VPC y al servidor de metadatos de GCP, hace la petición por él.
 *
 * Reglas:
 *   · sólo https, sin usuario:contraseña en la URL;
 *   · TODAS las IPs a las que resuelve el host deben ser públicas: un registro
 *     con una IP pública y otra privada se rechaza entero;
 *   · la IP se comprueba en el momento de CONECTAR, no sólo al registrar: el
 *     `lookup` del socket es el que valida, así un DNS que cambia entre la
 *     comprobación y la conexión (DNS rebinding) no cuela una IP interna;
 *   · no sigue redirecciones (un 30x a una IP interna sería el mismo agujero);
 *   · timeout y tamaño de respuesta acotados.
 *
 * Los conectores ERP usan su propio cliente axios (services/erp/httpGuard.js,
 * con puertos acotados), pero clasifican las IPs con `esIpPublica` de aquí:
 * una sola lista de rangos para toda la API.
 */

const dns = require('dns');
const net = require('net');
const https = require('https');

const BLOQUEADAS = new net.BlockList();
for (const [red, prefijo] of [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
    ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
    ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) BLOQUEADAS.addSubnet(red, prefijo, 'ipv4');
for (const [red, prefijo] of [
    ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64],
    ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
]) BLOQUEADAS.addSubnet(red, prefijo, 'ipv6');

const HOSTS_INTERNOS = /^(localhost|metadata|metadata\.google\.internal)$|\.(localhost|internal|local)$/i;

class DestinoNoPermitido extends Error {
    constructor(message) {
        super(message);
        this.code = 'DESTINATION_NOT_ALLOWED';
        this.status = 400;
    }
}

/** ¿Es `ip` una dirección enrutable en Internet? */
function esIpPublica(ip) {
    const familia = net.isIP(ip);
    if (familia === 4) return !BLOQUEADAS.check(ip, 'ipv4');
    if (familia === 6) {
        // ::ffff:10.0.0.1 es 10.0.0.1: se juzga por la IPv4 que lleva dentro.
        const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
        if (mapeada) return esIpPublica(mapeada[1]);
        return !BLOQUEADAS.check(ip, 'ipv6');
    }
    return false;
}

/** Comprobaciones que no necesitan red. Devuelve la URL parseada. */
function validarUrl(url) {
    let u;
    try {
        u = new URL(String(url));
    } catch {
        throw new DestinoNoPermitido('URL inválida.');
    }
    if (u.protocol !== 'https:') throw new DestinoNoPermitido('Sólo se admiten URLs https.');
    if (u.username || u.password) throw new DestinoNoPermitido('La URL no puede llevar credenciales.');
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (HOSTS_INTERNOS.test(host)) throw new DestinoNoPermitido('El host apunta a una red interna.');
    if (net.isIP(host) && !esIpPublica(host)) throw new DestinoNoPermitido('La IP no es pública.');
    return u;
}

/** Resuelve `host` y exige que TODAS sus IPs sean públicas. */
async function resolverPublico(host) {
    if (net.isIP(host)) {
        if (!esIpPublica(host)) throw new DestinoNoPermitido('La IP no es pública.');
        return [{ address: host, family: net.isIP(host) }];
    }
    let direcciones;
    try {
        direcciones = await dns.promises.lookup(host, { all: true, verbatim: true });
    } catch {
        throw new DestinoNoPermitido(`No se pudo resolver ${host}.`);
    }
    if (direcciones.length === 0) throw new DestinoNoPermitido(`No se pudo resolver ${host}.`);
    if (direcciones.some((d) => !esIpPublica(d.address))) {
        throw new DestinoNoPermitido('El host resuelve a una dirección interna.');
    }
    return direcciones;
}

/** Validación completa para el momento del registro (URL + DNS). */
async function validarDestinoPublico(url) {
    const u = validarUrl(url);
    await resolverPublico(u.hostname.replace(/^\[|\]$/g, ''));
    return u;
}

/** `lookup` para el socket: valida en la conexión misma (anti DNS rebinding). */
function lookupPublico(hostname, opciones, callback) {
    resolverPublico(hostname).then(
        (direcciones) => {
            const familia = opciones && opciones.family;
            const validas = familia ? direcciones.filter((d) => d.family === familia) : direcciones;
            if (validas.length === 0) return callback(new DestinoNoPermitido(`Sin dirección IPv${familia} pública.`));
            if (opciones && opciones.all) return callback(null, validas);
            return callback(null, validas[0].address, validas[0].family);
        },
        (err) => callback(err),
    );
}

/**
 * POST/GET a una URL de cliente. Interfaz mínima compatible con lo que usan los
 * despachadores de webhooks: `{ ok, status, text(), json() }`.
 */
function safeFetch(url, { method = 'GET', headers = {}, body, timeoutMs = 10_000, maxBytes = 1_000_000 } = {}) {
    let u;
    try {
        u = validarUrl(url);
    } catch (err) {
        return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
        const req = https.request(u, {
            method,
            headers: body !== undefined ? { 'Content-Length': Buffer.byteLength(body), ...headers } : headers,
            lookup: lookupPublico,
            timeout: timeoutMs,
        }, (res) => {
            const trozos = [];
            let recibidos = 0;
            res.on('data', (trozo) => {
                recibidos += trozo.length;
                if (recibidos > maxBytes) {
                    req.destroy(new Error(`Respuesta mayor de ${maxBytes} bytes.`));
                    return;
                }
                trozos.push(trozo);
            });
            res.on('end', () => {
                const texto = Buffer.concat(trozos).toString('utf8');
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    headers: res.headers,
                    text: async () => texto,
                    json: async () => JSON.parse(texto),
                });
            });
            res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error(`Timeout tras ${timeoutMs} ms.`)));
        req.on('error', reject);
        if (body !== undefined) req.write(body);
        req.end();
    });
}

module.exports = {
    safeFetch,
    validarUrl,
    validarDestinoPublico,
    esIpPublica,
    DestinoNoPermitido,
    _lookupPublico: lookupPublico,
};
