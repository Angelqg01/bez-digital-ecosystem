'use strict';

/**
 * Escudo del chat: protege los secretos del usuario y la plataforma ANTES de que el mensaje llegue al modelo, a la
 * base de datos o al historial.
 *
 *  1. Secretos en el mensaje (clave privada, frase semilla, api-key, JWT, clave de Stripe…): se eliminan, no se guardan
 *     y se avisa al usuario de que, si eran reales, debe rotarlos.
 *  2. Intención de ataque (sacar secretos de BeZhas, hackear, eludir KYC/aprobaciones/límites, drenar la tesorería) y
 *     manipulación del asistente (ignorar instrucciones, revelar el prompt): NO se llama al modelo, se responde con un
 *     texto fijo que redirige a lo legítimo, no cuesta cuota y queda auditado.
 *
 * Sólo patrones de intención OFENSIVA: «¿cómo protejo mis claves?» o «¿cómo evito un hackeo?» pasan sin problema.
 */

const { ethers } = require('ethers');

const MARCA = '[SECRETO ELIMINADO]';

const PATRONES_SECRETO = [
    ['clave privada PEM', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g],
    ['clave secreta de Stripe', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g],
    ['secreto de webhook', /\bwhsec_[A-Za-z0-9]{10,}\b/g],
    ['api-key de BeZhas', /\bbez_(?:live_|test_)?[A-Za-z0-9]{24,}\b/g],
    ['clave de IA', /\b(?:sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{30,})\b/g],
    ['token JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g],
    ['token Bearer', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/gi],
    ['variable de entorno secreta', /\b[A-Z][A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|API_KEY|TOKEN)[A-Z0-9_]*\s*[=:]\s*\S{6,}/g],
    ['contraseña', /\b(?:contraseña|password|passwd|pwd)\s*(?:es|is|=|:)\s*\S{6,}/gi],
];

/** 64 hex = clave privada… o hash de transacción. Se respeta si se presenta claramente como hash. */
const HEX64 = /\b(?:0x)?[0-9a-fA-F]{64}\b/g;
const CONTEXTO_HASH = /(?:hash|tx|transacci[oó]n|transaction|txid)\W{0,12}$/i;

/** Frase semilla BIP-39 válida (checksum incluido): sin falsos positivos con frases normales. */
function eliminarFrasesSemilla(texto) {
    const palabras = texto.split(/(\s+)/); // conserva los separadores
    const idx = []; // posiciones de palabras (no separadores)
    palabras.forEach((p, i) => { if (/^[a-z]{3,8}$/.test(p)) idx.push(i); else if (!/^\s+$/.test(p)) idx.push(-1); });
    let eliminada = false;
    for (const largo of [24, 21, 18, 15, 12]) {
        for (let s = 0; s + largo <= idx.length; s++) {
            const ventana = idx.slice(s, s + largo);
            if (ventana.some((i) => i < 0)) continue;
            const frase = ventana.map((i) => palabras[i]).join(' ');
            let valida = false;
            try { valida = ethers.Mnemonic.isValidMnemonic(frase); } catch { valida = false; }
            if (valida) {
                for (const i of ventana) palabras[i] = '';
                palabras[ventana[0]] = MARCA;
                eliminada = true;
            }
        }
    }
    return { texto: eliminada ? palabras.join('') : texto, eliminada };
}

function redactarSecretos(texto) {
    let t = String(texto || '');
    const tipos = new Set();
    for (const [nombre, re] of PATRONES_SECRETO) {
        t = t.replace(re, () => { tipos.add(nombre); return MARCA; });
    }
    t = t.replace(HEX64, (m, offset, todo) => {
        if (CONTEXTO_HASH.test(todo.slice(Math.max(0, offset - 20), offset))) return m;
        tipos.add('posible clave privada (64 caracteres hexadecimales)');
        return MARCA;
    });
    const semilla = eliminarFrasesSemilla(t);
    if (semilla.eliminada) tipos.add('frase semilla');
    return { texto: semilla.texto.replace(/(\[SECRETO ELIMINADO\]\s*){2,}/g, `${MARCA} `).trim(), tipos: [...tipos] };
}

// ── Intención ofensiva y manipulación ────────────────────────────────────────

// Homoglifos cirílicos/griegos más usados para disfrazar palabras latinas, por código de carácter.
const HOMOGLIFOS = { 0x430: 'a', 0x435: 'e', 0x43e: 'o', 0x440: 'p', 0x441: 'c', 0x445: 'x', 0x443: 'y', 0x456: 'i', 0x3bf: 'o', 0x3b1: 'a', 0x3b5: 'e' };
const esInvisible = (cp) => cp === 0xad || (cp >= 0x200b && cp <= 0x200f) || cp === 0x2060 || cp === 0xfeff;

const normalizar = (t) => {
    let limpio = '';
    for (const ch of String(t || '').toLowerCase().normalize('NFKD')) {
        const cp = ch.codePointAt(0);
        if (esInvisible(cp)) continue;
        limpio += HOMOGLIFOS[cp] || ch;
    }
    return limpio.replace(/[̀-ͯ]/g, '');
};

const OBJETIVO_BEZHAS = '(?:bezhas|la plataforma|la tesoreria|tesoreria|hot ?wallet|el bridge|el gateway|la api de bezhas|los contratos|el escrow|el kyc|la verificacion|las aprobaciones|la doble aprobacion|los limites|el kill ?switch|aegis|la firma|el webhook|la wallet de bezhas)';
const VERBO_OFENSIVO = '(?:hackear|hackearl\\w*|explotar|vulnerar|atacar|romper|saltarm\\w*|saltar|eludir|evadir|burlar|falsificar|robar|drenar|vaciar|sabotear|colarm\\w*|bypassear|bypass)';

const REGLAS = [
    {
        categoria: 'secretos',
        re: [
            new RegExp(`(?:dame|dime|pasame|muestrame|revela|filtra|enseñame|ensenam\\w*|imprime|dump|extrae|obten)\\W.{0,45}(?:clave privada|private key|frase semilla|seed phrase|mnemonic|jwt_secret|variables? de entorno|\\.env|secret manager|api.?keys? de (?:otros|los|todos)|credenciales de)`),
            /(?:clave privada|private key|frase semilla|seed phrase|mnemonic|secretos?)\W.{0,40}(?:tesoreria|hot ?wallet|bezhas|deployer|operador|admin(?:istrador)?|del servidor)/,
        ],
    },
    {
        categoria: 'hacking',
        re: [
            new RegExp(`(?:como|quiero|quisiera|necesito|puedo|podrias|ayudame a|ayudame con|dime como|explicame como|enseñame a|ensenam\\w* a)\\W.{0,30}${VERBO_OFENSIVO}\\W.{0,50}${OBJETIVO_BEZHAS}`),
            new RegExp(`${VERBO_OFENSIVO}\\W.{0,25}${OBJETIVO_BEZHAS}`),
            /(?:sql ?injection|inyeccion sql|xss|ddos|ransomware|exploit|payload|reverse shell)\W.{0,40}(?:bezhas|api\.bezhas|bezhas\.com|la plataforma)/,
            /(?:bezhas|api\.bezhas|bezhas\.com)\W.{0,40}(?:sql ?injection|inyeccion sql|xss|ddos|exploit)/,
        ],
    },
    {
        categoria: 'manipulacion',
        re: [
            /(?:ignora|olvida|descarta|omite|salta)\w*\W.{0,30}(?:instrucciones|reglas|restricciones|prompt)/,
            /(?:ignore|forget|disregard|override)\W.{0,30}(?:instructions|rules|prompt|restrictions)/,
            /(?:revela|muestra|dime|imprime|repite|show|reveal|print|repeat)\w*\W.{0,30}(?:system prompt|prompt del sistema|prompt de sistema|tus instrucciones|your instructions|tus reglas internas)/,
            /(?:modo (?:desarrollador|dios|sin restricciones|sin filtros)|developer mode|jailbreak|\bdan\b mode|actua como si no tuvieras (?:reglas|restricciones))/,
        ],
    },
];

const RESPUESTAS = {
    secretos: 'No puedo darte claves, secretos ni datos internos de BeZhas, y nadie del equipo te los va a pedir nunca por aquí. '
        + 'Lo que sí puedo hacer: explicarte cómo proteger los tuyos (api-keys con permisos mínimos, rotación, gestor de secretos) '
        + 'o guiarte para crear tus propias credenciales desde tu panel.',
    hacking: 'No puedo ayudar a atacar, eludir controles ni acceder sin autorización a BeZhas ni a otros sistemas, y esta petición queda registrada. '
        + 'Si has encontrado una vulnerabilidad, repórtala de forma responsable a info.bezcoin@bezhas.com. '
        + 'Si lo que quieres es proteger tu propia cuenta o integración, dímelo y te guío paso a paso.',
    manipulacion: 'No voy a revelar mis instrucciones internas ni a cambiar mis reglas. '
        + 'Puedo guiarte paso a paso para contratar un plan, comprar BEZ, conectar tu IA por MCP o automatizar tu plataforma con la API y el SDK: ¿por dónde empezamos?',
};

/** @returns {{categoria:string, respuesta:string}|null} */
function detectarIntencion(texto) {
    const t = normalizar(texto);
    for (const { categoria, re } of REGLAS) {
        if (re.some((r) => r.test(t))) return { categoria, respuesta: RESPUESTAS[categoria] };
    }
    return null;
}

function avisoSecretos(tipos) {
    return `⚠️ **He eliminado de tu mensaje lo que parecía un secreto** (${tipos.join(', ')}) y no se ha guardado ni enviado a ningún modelo. `
        + 'Si era real, considéralo comprometido y rótalo ahora. Nunca pegues claves, frases semilla ni api-keys en el chat: nadie de BeZhas te las pedirá.\n\n';
}

/**
 * Inspecciona el mensaje de un turno.
 * @returns {{mensaje:string, antes:string, bloqueado:null|{categoria:string, respuesta:string}, secretos:string[]}}
 */
function inspeccionar(mensaje) {
    const { texto, tipos } = redactarSecretos(mensaje);
    const intencion = detectarIntencion(texto);
    return {
        mensaje: texto,
        secretos: tipos,
        antes: tipos.length ? avisoSecretos(tipos) : '',
        bloqueado: intencion,
    };
}

// ── Reincidencia: quien insiste en atacar se enfría ──────────────────────────
const VENTANA_MS = 10 * 60_000;
const MAX_BLOQUEOS = 5;
const bloqueos = new Map(); // clave → { n, desde }

function registrarBloqueo(clave) {
    const ahora = Date.now();
    const e = bloqueos.get(clave);
    const actual = !e || ahora - e.desde > VENTANA_MS ? { n: 0, desde: ahora } : e;
    actual.n += 1;
    bloqueos.set(clave, actual);
    if (bloqueos.size > 5000) bloqueos.delete(bloqueos.keys().next().value);
    return actual.n;
}
function enfriamiento(clave) {
    const e = bloqueos.get(clave);
    return !!e && Date.now() - e.desde <= VENTANA_MS && e.n >= MAX_BLOQUEOS;
}
function _reiniciar() { bloqueos.clear(); }

module.exports = { inspeccionar, redactarSecretos, detectarIntencion, registrarBloqueo, enfriamiento, _reiniciar, MARCA, MAX_BLOQUEOS };
