'use strict';

/**
 * services/erp/ErpAdapter.js — contrato común de los adaptadores de ERP.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ EL CONTRATO ES TAN CORTO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cuatro métodos y cinco tipos de documento. Es deliberadamente pobre.
 *
 * La alternativa —exponer una consulta libre, un `path` de OData, un dominio de
 * Odoo— sería más potente y sería el mismo error que `call_gateway(path)` en el
 * MCP: un argumento libre que llega hasta un sistema ajeno es evasión de
 * permisos y SSRF por diseño. Aquí además el sistema ajeno es el ERP DEL
 * CLIENTE, así que un filtro mal construido no es un fallo nuestro: es un
 * incidente en su casa, con nuestro nombre encima.
 *
 * Los filtros que se aceptan son un conjunto cerrado y tipado (`FILTROS`), y
 * cada adaptador los traduce a su dialecto escapando lo que haga falta. Lo que
 * no está en el conjunto no se puede pedir.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  IDEMPOTENCIA EN ESCRITURA, SIEMPRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Al otro lado hay un agente, y un agente reintenta: por un timeout, por una
 * respuesta ambigua, o porque el modelo decidió volver a intentarlo. Sin clave
 * de idempotencia propagada, un reintento son dos facturas en la contabilidad
 * del cliente.
 *
 * `escribirDocumento` EXIGE `idempotencyKey`. No es opcional ni tiene valor por
 * defecto: un valor por defecto lo generaría el servidor en cada intento y sería
 * distinto cada vez, que es justo lo contrario de lo que hace falta.
 */

const canonical = require('./canonical');
const { crearCliente, traducirError, ErpHttpError } = require('./httpGuard');

/** Filtros admitidos, cerrados. Cada adaptador los traduce a su dialecto. */
const FILTROS = Object.freeze({
    desde: 'fecha ISO (inclusive)',
    hasta: 'fecha ISO (inclusive)',
    estado: 'estado del documento, tal y como lo devuelve el ERP',
    numero: 'número exacto del documento',
    contraparte: 'proveedor o cliente, coincidencia exacta',
    limite: 'máximo de documentos, 1-200',
});

const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 200;

class ErpAdapter {
    /**
     * @param {object} cfg
     * @param {string} cfg.baseUrl
     * @param {object} cfg.credenciales  ya descifradas; NUNCA se registran
     * @param {string[]} cfg.alcanceCampos  campos que el cliente aprobó
     * @param {object} [cfg.opciones]
     */
    constructor({ baseUrl, credenciales, alcanceCampos = [], opciones = {} }) {
        if (new.target === ErpAdapter) {
            throw new Error('ErpAdapter es abstracta: usa un adaptador concreto.');
        }
        this.baseUrl = baseUrl;
        this.credenciales = credenciales || {};
        this.alcanceCampos = alcanceCampos;
        this.opciones = opciones;
        this._cliente = null;
    }

    /** Identificador del ERP. Lo define cada subclase. */
    static get id() { throw new Error('sin implementar'); }

    /** Tipos que este adaptador sabe leer. Por defecto, todos. */
    get tiposSoportados() { return canonical.NOMBRES; }

    /** Tipos que sabe ESCRIBIR. Vacío por defecto: escribir es la excepción. */
    get tiposEscribibles() { return []; }

    /** Cabeceras de autenticación. Cada subclase las construye a su manera. */
    cabeceras() { return {}; }

    /** Cliente HTTP con las cuatro defensas de httpGuard. Perezoso. */
    cliente() {
        if (!this._cliente) {
            this._cliente = crearCliente({ baseUrl: this.baseUrl, headers: this.cabeceras() });
        }
        return this._cliente;
    }

    /** Normaliza y acota el filtro antes de que lo vea ninguna subclase. */
    normalizarFiltro(filtro = {}) {
        const salida = {};
        for (const clave of Object.keys(filtro)) {
            if (!Object.prototype.hasOwnProperty.call(FILTROS, clave)) {
                throw new ErpHttpError(
                    `Filtro no admitido: «${clave}». Admitidos: ${Object.keys(FILTROS).join(', ')}.`,
                    'ERP_FILTRO_NO_ADMITIDO'
                );
            }
        }
        for (const campoFecha of ['desde', 'hasta']) {
            if (filtro[campoFecha]) {
                const d = new Date(filtro[campoFecha]);
                if (Number.isNaN(d.getTime())) {
                    throw new ErpHttpError(`«${campoFecha}» no es una fecha válida.`, 'ERP_FILTRO_FECHA');
                }
                salida[campoFecha] = d.toISOString().slice(0, 10);
            }
        }
        for (const texto of ['estado', 'numero', 'contraparte']) {
            if (filtro[texto] !== undefined && filtro[texto] !== null) {
                const v = String(filtro[texto]).trim();
                if (v.length > 100) {
                    throw new ErpHttpError(`«${texto}» es demasiado largo.`, 'ERP_FILTRO_LARGO');
                }
                salida[texto] = v;
            }
        }
        const limite = parseInt(filtro.limite, 10);
        salida.limite = Number.isFinite(limite)
            ? Math.min(Math.max(limite, 1), LIMITE_MAXIMO)
            : LIMITE_POR_DEFECTO;
        return salida;
    }

    comprobarTipo(tipo, paraEscribir = false) {
        if (!canonical.esTipoValido(tipo)) {
            throw new ErpHttpError(
                `Tipo de documento desconocido: «${tipo}». Admitidos: ${canonical.NOMBRES.join(', ')}.`,
                'ERP_TIPO_DESCONOCIDO'
            );
        }
        const soportados = paraEscribir ? this.tiposEscribibles : this.tiposSoportados;
        if (!soportados.includes(tipo)) {
            throw new ErpHttpError(
                `${this.constructor.id} no soporta ${paraEscribir ? 'escribir' : 'leer'} «${tipo}».`,
                'ERP_TIPO_NO_SOPORTADO'
            );
        }
    }

    /** Recorta al modelo canónico y al alcance aprobado. */
    proyectar(tipo, bruto) {
        return canonical.proyectar(tipo, bruto, this.alcanceCampos);
    }

    // ── Contrato ────────────────────────────────────────────────────────────

    /** @returns {Promise<{documentos: object[], total: number}>} */
    async listarDocumentos() { throw new Error('sin implementar'); }

    /** @returns {Promise<object|null>} */
    async obtenerDocumento() { throw new Error('sin implementar'); }

    /**
     * Escribe en el ERP. Exige clave de idempotencia — ver cabecera del fichero.
     * @returns {Promise<{id:string, creado:boolean}>}
     */
    async escribirDocumento(tipo, _payload, idempotencyKey) {
        this.comprobarTipo(tipo, true);
        if (!idempotencyKey || typeof idempotencyKey !== 'string') {
            throw new ErpHttpError(
                'Falta la clave de idempotencia. Sin ella, un reintento del agente duplicaría el documento.',
                'ERP_SIN_IDEMPOTENCIA'
            );
        }
        throw new Error('sin implementar');
    }

    /** Qué campos se pueden pedir de un tipo, y cuáles ha aprobado el cliente. */
    describirEsquema(tipo) {
        this.comprobarTipo(tipo);
        const todos = canonical.camposDe(tipo);
        const aprobados = this.alcanceCampos.length > 0
            ? todos.filter((c) => this.alcanceCampos.includes(c))
            : todos;
        return {
            tipo,
            nombre: canonical.TIPOS[tipo].nombre,
            camposCanonicos: todos,
            camposAprobados: aprobados,
            filtrosAdmitidos: FILTROS,
            escribible: this.tiposEscribibles.includes(tipo),
        };
    }

    /** Prueba de conexión. Cada adaptador toca el endpoint más barato que tenga. */
    async probarConexion() { throw new Error('sin implementar'); }

    /** Envuelve una llamada traduciendo el fallo de red a un error legible. */
    async _peticion(fn) {
        try {
            return await fn(this.cliente());
        } catch (err) {
            throw traducirError(err);
        }
    }

    /**
     * Interpreta el código de estado del ERP.
     *
     * Se separa 401/403 del resto a propósito: «tus credenciales ya no valen» es
     * accionable por el cliente, y confundirlo con «el ERP falla» le hace buscar
     * en el sitio equivocado.
     */
    _comprobarRespuesta(res, contexto) {
        if (res.status === 401 || res.status === 403) {
            throw new ErpHttpError(
                'El ERP rechazó las credenciales. Revísalas o renueva el usuario de servicio.',
                'ERP_CREDENCIALES', res.status
            );
        }
        if (res.status === 404) return null;
        if (res.status >= 400) {
            throw new ErpHttpError(
                `El ERP devolvió ${res.status} al ${contexto}.`,
                'ERP_RESPUESTA', res.status
            );
        }
        return res.data;
    }
}

module.exports = { ErpAdapter, FILTROS, LIMITE_POR_DEFECTO, LIMITE_MAXIMO };
