'use strict';

/**
 * openapiContract — el OpenAPI de un listing como contrato que el proxy hace
 * cumplir en los dos sentidos (docs/API_MARKETPLACE_DISENO.md, flujo 4 y 6).
 *
 *   petición  → la ruta y el método deben estar declarados; los parámetros de
 *               path y query se validan (con coerción de tipos) y SÓLO los
 *               declarados viajan al proveedor. Lo no declarado no se reenvía.
 *   respuesta → debe ser JSON y cumplir el esquema declarado para su código;
 *               los campos que el esquema no declara se quitan antes de
 *               devolverla. Si no cumple, el consumidor recibe un 502 y nunca
 *               el cuerpo del proveedor.
 *
 * Los esquemas de OpenAPI 3.1 son JSON Schema 2020-12: se valida con Ajv2020.
 * Las `$ref` locales (`#/components/...`) se reescriben a un $id propio del
 * listing y el documento entero se registra con ese $id, así resuelven igual
 * que en el documento original.
 *
 * Limitación conocida: `removeAdditional: 'all'` quita en cada subesquema lo
 * que ése no declara, así que un `allOf` que reparte propiedades entre varios
 * subesquemas pierde campos. Los contratos de respuesta deben declarar las
 * propiedades en un solo objeto (o en `$ref` a uno). Se revisa en el piloto.
 *
 * Los contratos compilados se cachean por (listing, updated_at): un listing en
 * `live` no se edita, así que en la práctica se compila una vez por proceso.
 */

const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const MAX_CACHE = 500;
const cache = new Map(); // clave → contrato (orden de inserción = LRU sencillo)

const READ_METHODS = new Set(['get', 'head']);

class ContratoIncumplido extends Error {
    constructor(code, message, status, detalles) {
        super(message);
        this.code = code;
        this.status = status;
        this.detalles = detalles;
    }
}

function esObjeto(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function nuevoAjv(opciones) {
    // strict:false — OpenAPI añade palabras (example, xml, discriminator,
    // externalDocs) que no son JSON Schema; se ignoran en vez de fallar.
    const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: true, ...opciones });
    addFormats(ajv);
    return ajv;
}

/** Copia profunda reescribiendo `$ref: '#/…'` al $id del documento. */
function reescribirRefs(nodo, base) {
    if (Array.isArray(nodo)) return nodo.map((n) => reescribirRefs(n, base));
    if (!esObjeto(nodo)) return nodo;
    const out = {};
    for (const [k, v] of Object.entries(nodo)) {
        out[k] = k === '$ref' && typeof v === 'string' && v.startsWith('#') ? `${base}${v}` : reescribirRefs(v, base);
    }
    return out;
}

function escaparRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `/tariffs/{hs}/rates` → { regex, nombres, plantillas } */
function compilarRuta(plantilla) {
    const nombres = [];
    let plantillas = 0;
    const cuerpo = plantilla.split('/').map((seg) => {
        if (/^\{[^}/]+\}$/.test(seg)) {
            nombres.push(seg.slice(1, -1));
            plantillas += 1;
            return '([^/]+)';
        }
        return escaparRegex(seg);
    }).join('/');
    return { regex: new RegExp(`^${cuerpo}$`), nombres, plantillas };
}

function parametrosDe(pathItem, operacion) {
    // Los de la operación sustituyen a los del path con el mismo (in, name).
    const porClave = new Map();
    for (const p of [...(pathItem.parameters || []), ...(operacion.parameters || [])]) {
        if (esObjeto(p) && typeof p.name === 'string' && typeof p.in === 'string') porClave.set(`${p.in}:${p.name}`, p);
    }
    return [...porClave.values()];
}

function compilarContrato(listing) {
    const base = `urn:bezhas:marketplace:${listing.id}`;
    const doc = reescribirRefs(listing.openapi, base);
    const ajvPeticion = nuevoAjv({ coerceTypes: 'array', useDefaults: false });
    const ajvRespuesta = nuevoAjv({ removeAdditional: 'all' });
    // Cuerpos de petición (paso 6): ni coerción ni recorte. Lo que no cumple, no sale.
    const ajvCuerpo = nuevoAjv({});
    // Sin `openapi`/`info`/`paths`: sólo hacen falta las ramas a las que apuntan
    // las $ref. Va como un esquema más, con su $id.
    const raiz = { $id: base, components: doc.components || {} };
    ajvPeticion.addSchema(raiz);
    ajvRespuesta.addSchema(raiz);
    ajvCuerpo.addSchema(raiz);

    const rutas = Object.entries(doc.paths || {})
        .filter(([, item]) => esObjeto(item))
        .map(([plantilla, item]) => ({ plantilla, item, ...compilarRuta(plantilla) }))
        // Una ruta literal gana a una con plantilla (OpenAPI 3.1, «Path Templating Matching»).
        .sort((a, b) => a.plantillas - b.plantillas);

    const operaciones = new Map(); // `${metodo} ${plantilla}` → validadores, perezosos
    function operacion(metodo, ruta) {
        const clave = `${metodo} ${ruta.plantilla}`;
        if (operaciones.has(clave)) return operaciones.get(clave);
        const op = ruta.item[metodo];
        if (!esObjeto(op)) return null;

        const params = parametrosDe(ruta.item, op)
            .filter((p) => p.in === 'path' || p.in === 'query')
            .map((p) => ({
                nombre: p.name,
                en: p.in,
                requerido: p.in === 'path' || p.required === true,
                // Envuelto en { v } para que la coerción de tipos tenga un padre
                // donde escribir el valor convertido.
                validar: ajvPeticion.compile({
                    type: 'object',
                    properties: { v: esObjeto(p.schema) ? p.schema : {} },
                    required: ['v'],
                }),
            }));

        const respuestas = {};
        for (const [codigo, r] of Object.entries(op.responses || {})) {
            const esquema = r?.content?.['application/json']?.schema;
            if (esObjeto(esquema)) respuestas[codigo] = ajvRespuesta.compile(esquema);
        }
        const esquemaCuerpo = op.requestBody?.content?.['application/json']?.schema;
        const cuerpo = op.requestBody
            ? { requerido: op.requestBody.required === true, validar: esObjeto(esquemaCuerpo) ? ajvCuerpo.compile(esquemaCuerpo) : null }
            : null;
        const compilada = { params, respuestas, cuerpo, operationId: op.operationId || null };
        operaciones.set(clave, compilada);
        return compilada;
    }

    return {
        /**
         * Valida la petición. `ruta` es lo que va tras el slug ("/tariffs/0101"),
         * `consulta` el objeto de query de Express. Devuelve la ruta y la query
         * string que se reenvían (sólo con lo declarado).
         */
        validarPeticion(metodo, rutaCruda, consulta = {}, cuerpo = undefined) {
            const pedido = String(metodo).toLowerCase();
            const cruda = rutaCruda || '/';
            // Se casa la ruta SIN decodificar: así un %2F dentro de un parámetro
            // no parte el segmento ni hace casar otra plantilla.
            const r = rutas.find((x) => x.regex.test(cruda));
            if (!r) throw new ContratoIncumplido('ROUTE_NOT_DECLARED', 'La ruta no está declarada en el contrato del listing.', 404);
            // HEAD sin declarar se trata como el GET de la misma ruta (RFC 9110).
            const m = pedido === 'head' && !r.item.head ? 'get' : pedido;
            const op = operacion(m, r);
            if (!op) throw new ContratoIncumplido('METHOD_NOT_DECLARED', 'El método no está declarado para esta ruta.', 405);

            const valores = {};
            r.regex.exec(cruda).slice(1).forEach((v, i) => {
                let d;
                try {
                    d = decodeURIComponent(v);
                } catch {
                    throw new ContratoIncumplido('INVALID_REQUEST', 'Ruta mal codificada.', 400);
                }
                // Ni subir de directorio en el servidor del proveedor ni colar
                // una barra: sólo se llega a lo que el contrato declara.
                if (d === '.' || d === '..' || /[/\\\u0000]/.test(d)) {
                    throw new ContratoIncumplido('INVALID_REQUEST', 'Parámetro de ruta no permitido.', 400);
                }
                valores[r.nombres[i]] = d;
            });

            const errores = [];
            const query = new URLSearchParams();
            for (const p of op.params) {
                const crudo = p.en === 'path' ? valores[p.nombre] : consulta[p.nombre];
                if (crudo === undefined) {
                    if (p.requerido) errores.push(`Falta el parámetro ${p.en} «${p.nombre}».`);
                    continue;
                }
                const lista = Array.isArray(crudo) ? crudo : [crudo];
                if (lista.some((v) => typeof v !== 'string')) {
                    errores.push(`Parámetro ${p.en} «${p.nombre}» con forma no admitida.`);
                    continue;
                }
                if (!p.validar({ v: crudo })) {
                    errores.push(`Parámetro ${p.en} «${p.nombre}» no válido.`);
                    continue;
                }
                if (p.en === 'query') for (const v of lista) query.append(p.nombre, v);
            }
            // Cuerpo: sólo JSON y sólo si la operación lo declara. `cuerpo` llega
            // undefined cuando la petición no trae cuerpo (lo decide la ruta).
            if (!op.cuerpo) {
                if (cuerpo !== undefined) errores.push('La operación no declara cuerpo.');
            } else if (cuerpo === undefined) {
                if (op.cuerpo.requerido) errores.push('Falta el cuerpo de la petición.');
            } else if (!op.cuerpo.validar) {
                errores.push('La operación no declara un esquema JSON para el cuerpo.');
            } else if (!op.cuerpo.validar(cuerpo)) {
                errores.push(...(op.cuerpo.validar.errors || []).slice(0, 5).map((e) => `cuerpo${e.instancePath || ''} ${e.message}`));
            }
            if (errores.length) throw new ContratoIncumplido('INVALID_REQUEST', 'La petición no cumple el contrato.', 400, errores);

            // La ruta que se reenvía se reconstruye desde la plantilla, con cada
            // valor recodificado: nunca se pasa tal cual lo que mandó el consumidor.
            const rutaReenvio = r.plantilla.replace(/\{([^}/]+)\}/g, (_, n) => encodeURIComponent(valores[n]));
            const qs = query.toString();
            return { plantilla: r.plantilla, metodoContrato: m, operationId: op.operationId, rutaReenvio, query: qs ? `?${qs}` : '' };
        },

        /**
         * Valida la respuesta del proveedor y devuelve el cuerpo ya filtrado.
         * `datos` se modifica (removeAdditional): pasar una copia si importa.
         */
        validarRespuesta(metodo, plantilla, status, datos) {
            const r = rutas.find((x) => x.plantilla === plantilla);
            const op = r && operacion(String(metodo).toLowerCase(), r);
            const familia = `${String(status)[0]}XX`;
            const validar = op && (op.respuestas[String(status)] || op.respuestas[familia] || op.respuestas.default);
            if (!validar) {
                throw new ContratoIncumplido('RESPONSE_NOT_DECLARED', 'El contrato no declara una respuesta JSON para este código.', 502);
            }
            if (!validar(datos)) {
                throw new ContratoIncumplido('RESPONSE_CONTRACT_VIOLATION', 'La respuesta del proveedor no cumple su contrato.', 502,
                    (validar.errors || []).slice(0, 5).map((e) => `${e.instancePath || '/'} ${e.message}`));
            }
            return datos;
        },
    };
}

function contratoDe(listing) {
    const clave = `${listing.id}:${new Date(listing.updated_at || 0).getTime()}`;
    let c = cache.get(clave);
    if (c) {
        cache.delete(clave);
        cache.set(clave, c);
        return c;
    }
    c = compilarContrato(listing);
    cache.set(clave, c);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return c;
}

module.exports = { contratoDe, ContratoIncumplido, READ_METHODS, _cache: cache };
