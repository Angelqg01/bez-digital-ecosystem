'use strict';

/**
 * config/marketplace.js — reglas de forma de proveedores y listings del API
 * Marketplace (docs/API_MARKETPLACE_DISENO.md).
 *
 * Fuente única de los enumerados y de la validación de lo que un proveedor
 * puede publicar. No toca red ni base de datos: la comprobación SSRF de
 * `upstream_url` (DNS) la hace la ruta con utils/safeFetch.validarDestinoPublico.
 *
 * La comisión NO vive aquí: irá en config/marketplace-fees.js con el paso 3
 * (Stripe Connect), con su test de tramos [10 %, 20 %].
 */

const SCOPES = Object.freeze({
    READ: 'marketplace:read',
    CONSUME: 'marketplace:consume',
    CONSUME_WRITE: 'marketplace:consume:write',
    PUBLISH: 'marketplace:publish',
});

const LISTING_STATUS = Object.freeze(['draft', 'review', 'live', 'suspended']);
const EDITABLE_STATUS = Object.freeze(['draft', 'review']);

const PRICING_MODELS = Object.freeze(['per_call', 'subscription', 'dataset']);
const CURRENCIES = Object.freeze(['eur', 'usd']);
const INTERVALS = Object.freeze(['month', 'year']);
// 1 céntimo a 100.000 €: lo de arriba es casi seguro un error de unidades.
const MAX_AMOUNT_CENTS = 10_000_000;

// Categorías GDPR que un listing declara mover. Lista cerrada: un texto libre no
// se puede auditar. Cualquiera de ellas exige DPA firmado antes de `live`; las
// del art. 9 (special) además quedan marcadas para la revisión manual.
const DATA_CATEGORIES = Object.freeze({
    identifiers: { special: false },
    contact: { special: false },
    financial: { special: false },
    location: { special: false },
    employment: { special: false },
    behavioral: { special: false },
    health: { special: true },
    biometric: { special: true },
});

const READ_METHODS = new Set(['get', 'head', 'options']);
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
const MAX_OPENAPI_BYTES = 256 * 1024;

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

class ListingInvalido extends Error {
    constructor(errores) {
        super(errores.join(' '));
        this.code = 'LISTING_INVALID';
        this.status = 400;
        this.errores = errores;
    }
}

function esObjeto(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function textoAcotado(v, min, max) {
    return typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
}

/**
 * Comprobación estructural del OpenAPI. La validación completa con ajv (y su
 * caché por versión) llega con el proxy, en el paso 2: aquí basta con que sea
 * un 3.1 con rutas y operaciones reconocibles.
 * Devuelve { errores, metodos } — `metodos` son los verbos que declara.
 */
function revisarOpenApi(doc) {
    const errores = [];
    const metodos = new Set();
    if (!esObjeto(doc)) return { errores: ['openapi debe ser un objeto JSON.'], metodos };

    if (Buffer.byteLength(JSON.stringify(doc)) > MAX_OPENAPI_BYTES) {
        errores.push(`openapi no puede superar ${MAX_OPENAPI_BYTES / 1024} KB.`);
    }
    if (typeof doc.openapi !== 'string' || !/^3\.1\.\d+$/.test(doc.openapi)) {
        errores.push('openapi debe declarar la versión 3.1.x.');
    }
    if (!esObjeto(doc.info) || !textoAcotado(doc.info.title, 1, 200) || !textoAcotado(doc.info.version, 1, 32)) {
        errores.push('openapi.info necesita title y version.');
    }
    if (!esObjeto(doc.paths) || Object.keys(doc.paths).length === 0) {
        errores.push('openapi.paths debe declarar al menos una ruta.');
        return { errores, metodos };
    }
    for (const [ruta, item] of Object.entries(doc.paths)) {
        if (!ruta.startsWith('/') || ruta.includes('..')) {
            errores.push(`Ruta no válida en openapi.paths: ${ruta.slice(0, 80)}`);
            continue;
        }
        if (!esObjeto(item)) continue;
        for (const clave of Object.keys(item)) {
            if (HTTP_METHODS.has(clave)) metodos.add(clave);
        }
    }
    if (metodos.size === 0) errores.push('openapi.paths no declara ninguna operación.');
    return { errores, metodos };
}

function revisarPricing(p) {
    if (!esObjeto(p)) return ['pricing debe ser un objeto.'];
    const errores = [];
    if (!PRICING_MODELS.includes(p.model)) errores.push(`pricing.model debe ser uno de: ${PRICING_MODELS.join(', ')}.`);
    if (!Number.isInteger(p.amount_cents) || p.amount_cents < 1 || p.amount_cents > MAX_AMOUNT_CENTS) {
        errores.push(`pricing.amount_cents debe ser un entero entre 1 y ${MAX_AMOUNT_CENTS}.`);
    }
    if (!CURRENCIES.includes(p.currency)) errores.push(`pricing.currency debe ser una de: ${CURRENCIES.join(', ')}.`);
    if (p.model === 'subscription' && !INTERVALS.includes(p.interval)) {
        errores.push(`pricing.interval debe ser uno de: ${INTERVALS.join(', ')}.`);
    }
    if (p.model !== 'subscription' && p.interval !== undefined) {
        errores.push('pricing.interval sólo aplica a suscripciones.');
    }
    return errores;
}

/**
 * Normaliza y valida el cuerpo de alta o edición de un listing. Con
 * `parcial = true` (PUT) sólo revisa los campos presentes.
 * Devuelve los campos limpios; lanza ListingInvalido con la lista de errores.
 */
function normalizarListing(body, { parcial = false } = {}) {
    const b = esObjeto(body) ? body : {};
    const errores = [];
    const out = {};
    const presente = (k) => !parcial || b[k] !== undefined;

    if (!parcial) {
        if (typeof b.slug !== 'string' || !SLUG_RE.test(b.slug)) {
            errores.push('slug: 3-50 caracteres en minúscula, dígitos y guiones, sin guion al principio ni al final.');
        } else out.slug = b.slug;
    } else if (b.slug !== undefined) {
        errores.push('El slug no se puede cambiar: es la ruta pública del listing.');
    }

    if (presente('title')) {
        if (!textoAcotado(b.title, 3, 120)) errores.push('title: entre 3 y 120 caracteres.');
        else out.title = b.title.trim();
    }
    if (b.summary !== undefined) {
        if (b.summary !== null && !textoAcotado(b.summary, 0, 500)) errores.push('summary: hasta 500 caracteres.');
        else out.summary = b.summary === null ? null : b.summary.trim();
    }
    if (presente('version')) {
        if (!textoAcotado(b.version, 1, 32)) errores.push('version: entre 1 y 32 caracteres.');
        else out.version = b.version.trim();
    }
    if (presente('upstream_url')) {
        if (typeof b.upstream_url !== 'string' || b.upstream_url.length > 2048) errores.push('upstream_url es obligatoria.');
        else out.upstream_url = b.upstream_url;
    }
    if (presente('pricing')) {
        const e = revisarPricing(b.pricing);
        if (e.length) errores.push(...e);
        else {
            out.pricing = { model: b.pricing.model, amount_cents: b.pricing.amount_cents, currency: b.pricing.currency };
            if (b.pricing.interval) out.pricing.interval = b.pricing.interval;
        }
    }
    if (b.data_categories !== undefined || !parcial) {
        const cats = b.data_categories === undefined ? [] : b.data_categories;
        if (!Array.isArray(cats) || cats.some((c) => !Object.hasOwn(DATA_CATEGORIES, c))) {
            errores.push(`data_categories sólo admite: ${Object.keys(DATA_CATEGORIES).join(', ')}.`);
        } else out.data_categories = [...new Set(cats)].sort();
    }
    if (b.writes !== undefined || !parcial) {
        const w = b.writes === undefined ? false : b.writes;
        if (typeof w !== 'boolean') errores.push('writes debe ser booleano.');
        else out.writes = w;
    }
    if (presente('openapi')) {
        const { errores: e, metodos } = revisarOpenApi(b.openapi);
        errores.push(...e);
        if (!e.length) {
            out.openapi = b.openapi;
            out._metodos = metodos;
        }
    }

    // Un listing que declara POST/PUT/DELETE escribe en el sistema del
    // proveedor aunque diga writes=false: se rechaza la contradicción en vez de
    // dejar que el proxy de sólo lectura (paso 2) descubra el problema en vivo.
    if (out._metodos && out.writes === false && [...out._metodos].some((m) => !READ_METHODS.has(m))) {
        errores.push('El OpenAPI declara operaciones de escritura: marca writes=true (exige el scope marketplace:consume:write).');
    }

    if (errores.length) throw new ListingInvalido(errores);
    return out;
}

/** Qué falta para que un listing pueda pasar a revisión (o aprobarse). */
function requisitosPendientes(provider, listing) {
    const faltan = [];
    if (!provider) return ['provider'];
    if (provider.status === 'suspended') faltan.push('provider_active');
    if (provider.kyb_status !== 'verified') faltan.push('kyb_verified');
    if (!provider.stripe_account_id) faltan.push('stripe_connect_account');
    if ((listing.data_categories || []).length > 0 && !provider.dpa_signed_at) faltan.push('dpa_signed');
    return faltan;
}

/** ¿Declara el OpenAPI alguna operación que no sea de lectura? */
function declaraEscritura(openapi) {
    const { metodos } = revisarOpenApi(openapi);
    return [...metodos].some((m) => !READ_METHODS.has(m));
}

function tieneCategoriasEspeciales(cats = []) {
    return cats.some((c) => DATA_CATEGORIES[c]?.special);
}

module.exports = {
    SCOPES, LISTING_STATUS, EDITABLE_STATUS, PRICING_MODELS, CURRENCIES, INTERVALS,
    DATA_CATEGORIES, MAX_AMOUNT_CENTS, MAX_OPENAPI_BYTES, SLUG_RE, ADDRESS_RE,
    ListingInvalido, normalizarListing, revisarOpenApi, revisarPricing,
    requisitosPendientes, tieneCategoriasEspeciales, declaraEscritura,
};
