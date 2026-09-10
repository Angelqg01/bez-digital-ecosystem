'use strict';

/**
 * services/erp/httpGuard.js — cliente HTTP para sistemas del cliente.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ ESTE FICHERO EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * En el modo gestionado, la URL del ERP LA ELIGE EL CLIENTE y nosotros hacemos
 * la petición desde nuestro servidor. Eso es, literalmente, la definición de
 * SSRF: un tercero decide a qué dirección se conecta nuestra máquina.
 *
 * Lo que un atacante conseguiría dando de alta una «conexión a su ERP» apuntada
 * a otro sitio:
 *
 *   http://127.0.0.1:5432        nuestro Postgres
 *   http://bezhas-redis:6379     otro contenedor de la red de Docker
 *   http://169.254.169.254/…     metadatos del proveedor (credenciales de la VM)
 *   http://10.0.0.5/admin        cualquier cosa de la red interna
 *
 * Y no basta con mirar la URL al darla de alta: el nombre puede resolver a una
 * IP pública cuando se valida y a 127.0.0.1 cuando se usa —DNS rebinding—, o
 * responder con un 302 hacia dentro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LAS CUATRO DEFENSAS, Y POR QUÉ HACEN FALTA LAS CUATRO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  1. Validación de la URL al darla de alta: esquema, puerto y forma.
 *     Barata y atrapa el error honesto.
 *  2. Resolución y comprobación de TODAS las IPs del nombre. Un nombre puede
 *     resolver a varias; que una sea pública no salva a las demás.
 *  3. `lookup` propio en el agente, que vuelve a comprobar CADA dirección en el
 *     momento de conectar. Ésta es la que cierra el DNS rebinding: la
 *     comprobación deja de ser «antes» y pasa a ser «en el mismo instante».
 *  4. Cero redirecciones. Un 302 hacia http://127.0.0.1 convertiría un destino
 *     válido en uno interno sin que ninguna comprobación previa lo viera.
 *
 * Quitar cualquiera de las cuatro reabre el agujero por otro lado.
 */

const dns = require('dns');
const net = require('net');
const https = require('https');
const http = require('http');
const axios = require('axios');

/** Puertos admitidos. Un ERP publica en HTTPS; lo demás huele a red interna. */
const PUERTOS_PERMITIDOS = new Set([443, 8443, 44300, 50000, 50001]);

/** Tiempo máximo de una llamada al ERP del cliente. */
const TIMEOUT_MS = parseInt(process.env.ERP_TIMEOUT_MS || '15000', 10);

/** Tamaño máximo de respuesta: el ERP es de otro, y puede devolver lo que sea. */
const MAX_RESPUESTA_BYTES = parseInt(process.env.ERP_MAX_RESPONSE_BYTES || '5242880', 10);

/**
 * Sólo para desarrollo contra un ERP de pruebas en la propia máquina.
 * En producción no se lee: la comprobación de IP no se puede desactivar.
 */
const PERMITIR_PRIVADAS = process.env.NODE_ENV !== 'production'
    && process.env.ERP_ALLOW_PRIVATE_HOSTS === 'true';

class ErpHttpError extends Error {
    constructor(message, code, detalle) {
        super(message);
        this.name = 'ErpHttpError';
        this.code = code;
        this.detalle = detalle;
    }
}

/**
 * ¿Es una dirección que no debe alcanzarse desde nuestro servidor?
 *
 * Se comprueba sobre la IP resuelta, nunca sobre el texto del nombre:
 * `interno.ejemplo.com` puede apuntar a 10.0.0.5, y `0x7f.1` es 127.0.0.1
 * escrito de otra forma. El texto engaña; la IP, no.
 */
function esDireccionProhibida(ip) {
    const version = net.isIP(ip);
    if (version === 0) return true;              // no es una IP: no se arriesga

    if (version === 4) {
        const o = ip.split('.').map(Number);
        if (o[0] === 0) return true;                                  // 0.0.0.0/8
        if (o[0] === 10) return true;                                 // privada
        if (o[0] === 127) return true;                                // loopback
        if (o[0] === 169 && o[1] === 254) return true;                // link-local y metadatos
        if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;    // privada
        if (o[0] === 192 && o[1] === 168) return true;                // privada
        if (o[0] === 192 && o[1] === 0 && o[2] === 0) return true;    // IETF
        if (o[0] === 192 && o[1] === 0 && o[2] === 2) return true;    // documentación
        if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true;   // CGNAT
        if (o[0] >= 224) return true;                                 // multicast y reservadas
        return false;
    }

    const v6 = ip.toLowerCase();
    if (v6 === '::' || v6 === '::1') return true;                     // sin especificar y loopback
    if (v6.startsWith('fe80')) return true;                           // link-local
    if (v6.startsWith('fc') || v6.startsWith('fd')) return true;      // unique local
    if (v6.startsWith('ff')) return true;                             // multicast
    // IPv4 embebida (::ffff:127.0.0.1): se comprueba la parte v4.
    const embebida = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (embebida) return esDireccionProhibida(embebida[1]);
    return false;
}

/**
 * Valida la URL base que declara el cliente. Se llama al dar de alta la
 * conexión y otra vez en cada uso: una conexión guardada hace meses puede
 * apuntar hoy a otro sitio.
 */
async function validarUrlBase(urlTexto) {
    let url;
    try {
        url = new URL(String(urlTexto));
    } catch {
        throw new ErpHttpError('La URL del ERP no es válida.', 'ERP_URL_INVALIDA');
    }

    if (url.protocol !== 'https:' && !PERMITIR_PRIVADAS) {
        throw new ErpHttpError(
            'La conexión con el ERP tiene que ser HTTPS. Por HTTP viajarían en claro las credenciales y los datos.',
            'ERP_URL_NO_HTTPS'
        );
    }

    const puerto = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);
    if (!PERMITIR_PRIVADAS && !PUERTOS_PERMITIDOS.has(puerto)) {
        throw new ErpHttpError(
            `Puerto ${puerto} no admitido. Un ERP publicado usa 443, 8443, 44300 o el 50000/50001 de SAP Business One.`,
            'ERP_PUERTO_NO_ADMITIDO'
        );
    }

    // Credenciales embebidas en la URL: acabarían en logs y en la fila.
    if (url.username || url.password) {
        throw new ErpHttpError(
            'La URL no puede llevar usuario ni contraseña. Las credenciales se introducen aparte.',
            'ERP_URL_CON_CREDENCIALES'
        );
    }

    if (PERMITIR_PRIVADAS) return url;

    let direcciones;
    try {
        direcciones = await dns.promises.lookup(url.hostname, { all: true });
    } catch (err) {
        throw new ErpHttpError(
            `No se pudo resolver ${url.hostname}. Comprueba el nombre.`,
            'ERP_DNS', err.code
        );
    }

    // TODAS, no la primera: un nombre puede resolver a varias y basta una
    // interna para que la conexión sea aprovechable.
    for (const { address } of direcciones) {
        if (esDireccionProhibida(address)) {
            throw new ErpHttpError(
                `${url.hostname} resuelve a una dirección interna o reservada. `
                + 'La conexión gestionada sólo alcanza sistemas publicados en internet.',
                'ERP_DESTINO_INTERNO'
            );
        }
    }

    return url;
}

/**
 * `lookup` para el agente: repite la comprobación EN EL MOMENTO DE CONECTAR.
 *
 * Sin esto, entre validar la URL y hacer la petición hay una ventana en la que
 * el nombre puede cambiar de IP. Es corta, pero es exactamente la que explota
 * el DNS rebinding, y se cierra entera comprobando aquí.
 */
function lookupValidado(hostname, opciones, callback) {
    const cb = typeof opciones === 'function' ? opciones : callback;
    const opts = typeof opciones === 'function' ? {} : (opciones || {});

    dns.lookup(hostname, { ...opts, all: true }, (err, direcciones) => {
        if (err) return cb(err);
        const lista = Array.isArray(direcciones) ? direcciones : [direcciones];

        for (const d of lista) {
            if (esDireccionProhibida(d.address)) {
                return cb(new ErpHttpError(
                    `${hostname} resolvió a una dirección interna al conectar.`,
                    'ERP_DESTINO_INTERNO'
                ));
            }
        }
        if (opts.all) return cb(null, lista);
        return cb(null, lista[0].address, lista[0].family);
    });
}

/**
 * Cliente HTTP para un ERP concreto.
 *
 * `maxRedirects: 0` es deliberado y no se debe subir: seguir un 302 significa
 * conectar a un destino que ninguna de las comprobaciones anteriores ha visto.
 * Si un ERP redirige, se corrige la URL base y punto.
 */
function crearCliente({ baseUrl, headers = {}, timeoutMs = TIMEOUT_MS }) {
    const agenteHttps = new https.Agent({ lookup: lookupValidado, keepAlive: false });
    const agenteHttp = new http.Agent({ lookup: lookupValidado, keepAlive: false });

    return axios.create({
        baseURL: String(baseUrl).replace(/\/+$/, ''),
        timeout: timeoutMs,
        maxRedirects: 0,
        maxContentLength: MAX_RESPUESTA_BYTES,
        maxBodyLength: MAX_RESPUESTA_BYTES,
        httpsAgent: agenteHttps,
        httpAgent: agenteHttp,
        headers: { Accept: 'application/json', ...headers },
        // Los 4xx los interpreta cada adaptador: un 404 de documento no es un
        // fallo de integración y no debe subir como excepción.
        validateStatus: (s) => s >= 200 && s < 500,
    });
}

/**
 * Traduce un fallo de red a algo que se le pueda enseñar al cliente sin
 * revelar nuestra topología. El detalle va al log del servidor.
 */
function traducirError(err) {
    if (err instanceof ErpHttpError) return err;
    const code = err?.code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
        return new ErpHttpError('El ERP no respondió a tiempo.', 'ERP_TIMEOUT', code);
    }
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
        return new ErpHttpError('No se pudo resolver el nombre del ERP.', 'ERP_DNS', code);
    }
    if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
        return new ErpHttpError('El ERP rechazó la conexión.', 'ERP_CONEXION', code);
    }
    if (code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' || code === 'ERR_BAD_RESPONSE') {
        return new ErpHttpError('La respuesta del ERP es demasiado grande. Acota la consulta.', 'ERP_RESPUESTA_GRANDE', code);
    }
    return new ErpHttpError('No se pudo hablar con el ERP.', 'ERP_ERROR', code);
}

module.exports = {
    validarUrlBase,
    esDireccionProhibida,
    lookupValidado,
    crearCliente,
    traducirError,
    ErpHttpError,
    PUERTOS_PERMITIDOS,
    TIMEOUT_MS,
    MAX_RESPUESTA_BYTES,
};
