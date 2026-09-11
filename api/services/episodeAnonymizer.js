'use strict';

/**
 * services/episodeAnonymizer.js — seudonimización (art. 4.5 RGPD).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA REGLA QUE HACE DEFENDIBLE TODO EL PIPELINE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La capa operacional —el contenido de las llamadas— NUNCA alimenta la de
 * episodios sin pasar por aquí. Y lo que hace este módulo no es «limpiar» un
 * dato: es quedarse con su FORMA y tirar su contenido.
 *
 *   {"amount": "48200.00", "from": "BEZ"}   →   {"amount": "decimal", "from": "enum"}
 *
 * Si un episodio no sobrevive a ese borrado, es que no era un episodio: era el
 * dato del cliente. Por eso `formaDe()` no tiene rama que devuelva un valor
 * original; ni siquiera para números, ni para booleanos. Cualquier excepción
 * —«los importes son inofensivos», «el código de país no identifica a nadie»—
 * es el primer paso de un goteo que acaba con la conversación entera guardada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SEUDÓNIMO, NO ANÓNIMO, Y SE DICE ASÍ A PROPÓSITO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `tenantSeudonimo` es un HMAC-SHA256 del identificador de la app con una clave
 * que no está en la base de datos. Quien vuelque `agent_telemetry` no puede
 * revertirlo sin esa clave, pero NOSOTROS sí podemos recalcularlo — y eso lo
 * mantiene dentro del RGPD (art. 4.5), no fuera. Llamarlo «anónimo» sería
 * incorrecto y, peor, nos llevaría a tratarlo como si no tuviera plazo.
 *
 * El HMAC lleva además un `salt` por finalidad, así que el seudónimo de la
 * telemetría no permite cruzar con el de ningún otro tratamiento.
 */

const crypto = require('crypto');
const { IS_PRODUCTION } = require('../config/secrets');

/** Tipos que se conservan. Todo lo demás se etiqueta como 'desconocido'. */
const TIPOS = Object.freeze([
    'texto', 'entero', 'decimal', 'booleano', 'fecha', 'lista', 'objeto',
    'direccion_evm', 'hash', 'uuid', 'enum_corto', 'vacio', 'desconocido',
]);

function claveSeudonimo() {
    const raw = process.env.TELEMETRY_PSEUDONYM_KEY || process.env.SECRET_VAULT_KEY;
    if (!raw) {
        if (IS_PRODUCTION) {
            // Sin clave, el «seudónimo» sería un hash reproducible por
            // cualquiera con la tabla: dejaría de seudonimizar nada.
            throw new Error('FATAL: TELEMETRY_PSEUDONYM_KEY es obligatoria en producción.');
        }
        return 'dev-only-telemetry-pseudonym-key';
    }
    return raw;
}

/**
 * Seudónimo estable por finalidad. 32 caracteres hex: suficiente para no
 * colisionar y menos que el HMAC entero, que no aporta nada aquí.
 */
function seudonimo(valor, finalidad = 'telemetria') {
    if (!valor) return '0'.repeat(32);
    return crypto.createHmac('sha256', claveSeudonimo())
        .update(`${finalidad}:${valor}`)
        .digest('hex')
        .slice(0, 32);
}

/**
 * Tipo de un valor. NUNCA devuelve el valor.
 *
 * Se reconocen direcciones, hashes y uuid antes que «texto» porque saber que un
 * argumento traía una dirección EVM es señal de producto útil, y el tipo no
 * identifica a nadie por sí solo.
 */
function formaDe(valor) {
    if (valor === null || valor === undefined || valor === '') return 'vacio';
    if (Array.isArray(valor)) return 'lista';
    if (typeof valor === 'boolean') return 'booleano';
    if (typeof valor === 'number') return Number.isInteger(valor) ? 'entero' : 'decimal';
    if (typeof valor === 'object') return 'objeto';

    const s = String(valor);
    if (/^0x[0-9a-fA-F]{40}$/.test(s)) return 'direccion_evm';
    if (/^0x[0-9a-fA-F]{64}$/.test(s)) return 'hash';
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s)) return 'uuid';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 'fecha';
    if (/^\d+$/.test(s)) return 'entero';
    if (/^\d+\.\d+$/.test(s)) return 'decimal';
    // Un valor corto sin espacios suele ser un enum ('BEZ', 'pendiente'), y
    // saber que se usó uno es señal. Aun así se etiqueta, no se copia.
    if (s.length <= 24 && !/\s/.test(s)) return 'enum_corto';
    return 'texto';
}

/**
 * Forma de un objeto de argumentos: nombres de campo y tipos.
 *
 * Los NOMBRES sí se conservan —son del esquema de nuestra herramienta, no del
 * cliente— y son justo lo que hace falta para descubrir que una herramienta se
 * invoca mal. Se acotan en número y longitud: un agente puede mandar cien
 * campos inventados y esto no es un vertedero.
 */
const MAX_CAMPOS = 24;
const MAX_LONGITUD_NOMBRE = 40;

function formaArgumentos(args) {
    if (!args || typeof args !== 'object' || Array.isArray(args)) return {};
    const salida = {};
    for (const clave of Object.keys(args).slice(0, MAX_CAMPOS)) {
        const nombre = clave.slice(0, MAX_LONGITUD_NOMBRE);
        salida[nombre] = formaDe(args[clave]);
    }
    return salida;
}

/**
 * Comprobación de salida. Recorre el registro ya construido y falla si algo
 * huele a contenido.
 *
 * Es una red de seguridad deliberadamente paranoica: el coste de un falso
 * positivo es perder una fila de telemetría; el de un falso negativo, guardar
 * el dato de un cliente donde dijimos que no lo guardábamos.
 */
function contieneContenido(registro) {
    const sospechoso = [];
    const visitar = (v, ruta) => {
        if (v === null || v === undefined) return;
        if (typeof v === 'string') {
            // Un valor de la forma sólo puede ser uno de los tipos conocidos.
            if (ruta.startsWith('forma_argumentos.') && !TIPOS.includes(v)) {
                sospechoso.push(ruta);
            }
            return;
        }
        if (typeof v === 'object') {
            for (const [k, sub] of Object.entries(v)) visitar(sub, ruta ? `${ruta}.${k}` : k);
        }
    };
    visitar(registro, '');
    return sospechoso;
}

module.exports = {
    seudonimo, formaDe, formaArgumentos, contieneContenido,
    TIPOS, MAX_CAMPOS,
};
