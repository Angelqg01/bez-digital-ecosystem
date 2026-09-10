'use strict';

/**
 * Odoo — JSON-RPC (`/jsonrpc`, servicio `object`, método `execute_kw`).
 *
 * Ventaja frente a los ERP con OData: el filtro de Odoo —el «dominio»— es una
 * ESTRUCTURA, no una cadena. `['numero', '=', valor]` viaja como tres elementos
 * de un array JSON, así que el valor no puede alterar el operador ni el campo.
 * No hay que escapar nada, y es imposible que se cuele un operador por
 * concatenación. Los campos siguen siendo literales de este fichero.
 *
 * Autenticación: base de datos + usuario + clave de API. Odoo devuelve un `uid`
 * numérico al autenticar; se cachea en la instancia (que vive lo que una
 * petición) y no se guarda en ningún sitio.
 */

const { ErpAdapter } = require('./ErpAdapter');
const { ErpHttpError } = require('./httpGuard');

const MODELOS = {
    factura: { modelo: 'account.move', extra: [['move_type', '=', 'in_invoice']] },
    pedido: { modelo: 'sale.order', extra: [] },
    albaran: { modelo: 'stock.picking', extra: [] },
    activo: { modelo: 'account.asset', extra: [] },
    asiento: { modelo: 'account.move.line', extra: [] },
};

const CAMPOS = {
    factura: ['name', 'partner_id', 'amount_total', 'currency_id', 'invoice_date_due', 'invoice_date', 'state', 'ref'],
    pedido: ['name', 'partner_id', 'amount_total', 'currency_id', 'date_order', 'state'],
    albaran: ['name', 'origin', 'partner_id', 'move_line_ids', 'scheduled_date', 'state'],
    activo: ['name', 'code', 'original_value', 'currency_id', 'acquisition_date', 'state'],
    asiento: ['account_id', 'debit', 'credit', 'name', 'date', 'ref'],
};

/** Odoo devuelve las relaciones como [id, "nombre"]. Nos interesa el nombre. */
const rel = (v) => (Array.isArray(v) ? v[1] : v) || null;

class OdooAdapter extends ErpAdapter {
    static get id() { return 'odoo'; }

    get tiposSoportados() { return Object.keys(MODELOS); }
    get tiposEscribibles() { return ['factura', 'asiento']; }

    cabeceras() { return { 'Content-Type': 'application/json' }; }

    /** Llamada JSON-RPC cruda. Odoo devuelve 200 con `error` dentro. */
    async _rpc(servicio, metodo, args) {
        return this._peticion(async (http) => {
            const res = await http.post('/jsonrpc', {
                jsonrpc: '2.0', method: 'call',
                params: { service: servicio, method: metodo, args },
                id: Date.now(),
            });
            const datos = this._comprobarRespuesta(res, 'llamar a Odoo');
            if (datos?.error) {
                // El mensaje de Odoo puede traer una traza entera: se recorta.
                const msg = datos.error?.data?.message || datos.error?.message || 'error de Odoo';
                throw new ErpHttpError(`Odoo rechazó la llamada: ${String(msg).slice(0, 200)}`, 'ERP_RESPUESTA');
            }
            return datos?.result;
        });
    }

    async _uid() {
        if (this._uidCache) return this._uidCache;
        const { baseDatos, usuario, password } = this.credenciales;
        if (!baseDatos || !usuario || !password) {
            throw new ErpHttpError('Faltan base de datos, usuario o clave de API de Odoo.', 'ERP_CREDENCIALES');
        }
        const uid = await this._rpc('common', 'login', [baseDatos, usuario, password]);
        if (!uid) {
            throw new ErpHttpError('Odoo rechazó las credenciales.', 'ERP_CREDENCIALES');
        }
        this._uidCache = uid;
        return uid;
    }

    async _ejecutar(modelo, metodo, args, kwargs = {}) {
        const { baseDatos, password } = this.credenciales;
        const uid = await this._uid();
        return this._rpc('object', 'execute_kw', [baseDatos, uid, password, modelo, metodo, args, kwargs]);
    }

    /** Filtro canónico → dominio de Odoo. Estructurado: nada que escapar. */
    _dominio(tipo, f) {
        const dominio = [...MODELOS[tipo].extra];
        const campoFecha = { factura: 'invoice_date', pedido: 'date_order', albaran: 'scheduled_date', activo: 'acquisition_date', asiento: 'date' }[tipo];
        const campoNumero = tipo === 'asiento' ? 'ref' : 'name';

        if (f.desde) dominio.push([campoFecha, '>=', f.desde]);
        if (f.hasta) dominio.push([campoFecha, '<=', f.hasta]);
        if (f.numero) dominio.push([campoNumero, '=', f.numero]);
        if (f.estado) dominio.push(['state', '=', f.estado]);
        if (f.contraparte) dominio.push(['partner_id.name', '=', f.contraparte]);
        return dominio;
    }

    _traducir(tipo, fila) {
        switch (tipo) {
            case 'factura':
                return {
                    numero: fila.name, proveedor: rel(fila.partner_id), importe: fila.amount_total,
                    moneda: rel(fila.currency_id), vencimiento: fila.invoice_date_due,
                    fecha: fila.invoice_date, estado: fila.state, referencia: fila.ref,
                };
            case 'pedido':
                return {
                    numero: fila.name, cliente: rel(fila.partner_id), importe: fila.amount_total,
                    moneda: rel(fila.currency_id), fecha: fila.date_order, estado: fila.state,
                };
            case 'albaran':
                return {
                    numero: fila.name, pedido: fila.origin, destino: rel(fila.partner_id),
                    bultos: Array.isArray(fila.move_line_ids) ? fila.move_line_ids.length : null,
                    fecha: fila.scheduled_date, estado: fila.state,
                };
            case 'activo':
                return {
                    referencia: fila.code || fila.name, descripcion: fila.name,
                    valoracion: fila.original_value, moneda: rel(fila.currency_id),
                    fechaTasacion: fila.acquisition_date, estado: fila.state,
                };
            case 'asiento':
                return {
                    cuenta: rel(fila.account_id), debe: fila.debit, haber: fila.credit,
                    concepto: fila.name, fecha: fila.date, referencia: fila.ref,
                };
            default:
                return {};
        }
    }

    async listarDocumentos(tipo, filtro = {}) {
        this.comprobarTipo(tipo);
        const f = this.normalizarFiltro(filtro);
        const filas = await this._ejecutar(
            MODELOS[tipo].modelo, 'search_read',
            [this._dominio(tipo, f)],
            { fields: CAMPOS[tipo], limit: f.limite }
        );
        const lista = Array.isArray(filas) ? filas : [];
        return {
            documentos: lista.map((fila) => this.proyectar(tipo, this._traducir(tipo, fila))),
            total: lista.length,
        };
    }

    async obtenerDocumento(tipo, id) {
        this.comprobarTipo(tipo);
        const campoNumero = tipo === 'asiento' ? 'ref' : 'name';
        const filas = await this._ejecutar(
            MODELOS[tipo].modelo, 'search_read',
            [[...MODELOS[tipo].extra, [campoNumero, '=', String(id)]]],
            { fields: CAMPOS[tipo], limit: 1 }
        );
        if (!Array.isArray(filas) || filas.length === 0) return null;
        return this.proyectar(tipo, this._traducir(tipo, filas[0]));
    }

    async escribirDocumento(tipo, payload, idempotencyKey) {
        await super.escribirDocumento(tipo, payload, idempotencyKey).catch((err) => {
            if (err.message !== 'sin implementar') throw err;
        });

        // Idempotencia real: Odoo no la trae, así que se busca primero por la
        // referencia que lleva la clave. Si ya existe, se devuelve esa —no se
        // crea otra— y `creado: false` deja claro que fue un reintento.
        const modelo = MODELOS[tipo].modelo;
        const existente = await this._ejecutar(modelo, 'search_read',
            [[['ref', '=', idempotencyKey]]], { fields: ['id'], limit: 1 });
        if (Array.isArray(existente) && existente.length > 0) {
            return { id: String(existente[0].id), creado: false };
        }

        const id = await this._ejecutar(modelo, 'create', [{ ...payload, ref: idempotencyKey }]);
        return { id: String(id), creado: true };
    }

    async probarConexion() {
        const uid = await this._uid();
        return { ok: Boolean(uid), erp: OdooAdapter.id };
    }
}

module.exports = OdooAdapter;
