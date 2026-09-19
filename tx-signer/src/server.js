'use strict';

/**
 * tx-signer — el único proceso de BeZhas que puede producir una firma de la
 * tesorería, y sin tener la clave: la clave está en KMS.
 *
 *   POST /v1/sign   petición HMAC de la API → verificación completa → firma
 *   GET  /healthz   estado, carteras (direcciones públicas) y LOCKDOWN
 *
 * No difunde: devuelve la transacción firmada y la API la difunde por su quórum
 * de RPC. No tiene base de datos, ni acceso a la de la API, ni puertos
 * publicados: vive en una red interna de Docker a la que sólo llega la API.
 *
 * Kill switch propio: fichero LOCKDOWN en su volumen o TX_SIGNER_LOCKDOWN=true.
 * No depende de la API para parar: si la API está comprometida, su kill switch
 * también puede estarlo.
 */

const http = require('http');
const { ethers } = require('ethers');

const { cargarConfig } = require('./config');
const { crearProveedor } = require('./keys');
const { crearAlmacen } = require('./store');
const { verificarHmac, verificarSolicitud, crearRegistroNonces } = require('./verify');

const LIMITE_CUERPO = 64 * 1024;

function log(nivel, msg, datos = {}) {
    // Nunca claves, nunca firmas completas: identificadores y resultados.
    process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), nivel, msg, ...datos })}\n`);
}

function responder(res, estado, cuerpo) {
    res.writeHead(estado, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(cuerpo));
}

function leerCuerpo(req) {
    return new Promise((resolve, reject) => {
        let tam = 0;
        const trozos = [];
        req.on('data', (c) => {
            tam += c.length;
            if (tam > LIMITE_CUERPO) { reject(Object.assign(new Error('Cuerpo demasiado grande.'), { code: 'BODY_TOO_LARGE', status: 413 })); req.destroy(); return; }
            trozos.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
        req.on('error', reject);
    });
}

/**
 * Crea el servidor. `proveedores` es opcional (tests); si no, se construyen de
 * la config y se comprueba que cada clave corresponde a la dirección declarada.
 */
async function crearServidor({ config, almacen, proveedores } = {}) {
    const claves = proveedores || new Map();
    if (!proveedores) {
        for (const w of config.wallets) claves.set(w.id, crearProveedor(w.key));
    }
    for (const w of config.wallets) {
        const real = (await claves.get(w.id).direccion()).toLowerCase();
        if (real !== w.address) {
            // Config que dice una dirección y clave que es otra: mejor no arrancar
            // que firmar desde una cartera que nadie está vigilando.
            throw Object.assign(new Error(`La clave de ${w.id} es ${real}, no ${w.address}.`), { code: 'WALLET_KEY_MISMATCH' });
        }
    }
    const nonces = crearRegistroNonces();

    return http.createServer(async (req, res) => {
        try {
            if (req.method === 'GET' && req.url === '/healthz') {
                return responder(res, 200, {
                    status: config.lockdownActivo() ? 'lockdown' : 'ok',
                    wallets: config.wallets.map((w) => ({ id: w.id, address: w.address, chainIds: w.chainIds })),
                });
            }
            if (req.method !== 'POST' || req.url !== '/v1/sign') return responder(res, 404, { error: 'No encontrado.', code: 'NOT_FOUND' });
            if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
                return responder(res, 415, { error: 'Sólo application/json.', code: 'UNSUPPORTED_MEDIA_TYPE' });
            }

            const cuerpo = await leerCuerpo(req);
            verificarHmac({ headers: req.headers, cuerpo, clave: config.claveHmac, nonces });
            const peticion = JSON.parse(cuerpo);
            const v = verificarSolicitud({ peticion, config, almacen });

            const tx = ethers.Transaction.from(v.tx);
            tx.signature = await claves.get(v.cartera.id).firmarDigest(tx.unsignedHash);
            if (tx.from.toLowerCase() !== v.cartera.address) {
                throw Object.assign(new Error('La firma no corresponde a la cartera.'), { code: 'SIGNER_KEY_MISMATCH', status: 500 });
            }

            almacen.registrar({
                intentHash: peticion.intentHash, nonce: v.tx.nonce, txHash: tx.hash,
                carteraId: v.cartera.id, activo: peticion.intent.asset, cantidad: v.cantidad.toString(),
            });
            log('info', 'firmada', {
                intentId: peticion.intentId, cartera: v.cartera.id, txHash: tx.hash,
                activo: peticion.intent.asset, cantidad: v.cantidad.toString(), aprobadores: v.aprobadores,
            });
            return responder(res, 200, { signedTx: tx.serialized, txHash: tx.hash, from: tx.from });
        } catch (err) {
            const estado = err.status || (err instanceof SyntaxError ? 400 : 500);
            log(estado >= 500 ? 'error' : 'warn', 'rechazada', { code: err.code || 'ERROR', mensaje: err.message });
            return responder(res, estado, { error: estado >= 500 ? 'Error interno del firmante.' : err.message, code: err.code || 'SIGNER_ERROR' });
        }
    });
}

async function main() {
    const config = cargarConfig();
    const almacen = crearAlmacen(config.dataDir);
    const servidor = await crearServidor({ config, almacen });
    const puerto = Number(process.env.PORT) || 4100;
    servidor.listen(puerto, '0.0.0.0', () => log('info', 'tx-signer escuchando', {
        puerto, wallets: config.wallets.map((w) => w.id), lockdown: config.lockdownActivo(),
    }));
}

if (require.main === module) {
    main().catch((err) => { log('error', 'arranque fallido', { code: err.code, mensaje: err.message }); process.exit(1); });
}

module.exports = { crearServidor };
