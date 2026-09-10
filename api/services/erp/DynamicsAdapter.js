'use strict';

/**
 * Microsoft Dynamics 365 — Dataverse Web API (`/api/data/v9.2`).
 *
 * OData v4 con Bearer de Entra ID. El token lo obtiene el cliente y lo mete por
 * la pantalla: no pedimos secreto de aplicación porque no queremos poder
 * renovarlo solos —un token que caduca y hay que reponer es una molestia; un
 * secreto de aplicación en nuestra base es una responsabilidad—.
 */

const { ErpAdapter } = require('./ErpAdapter');
const { ErpHttpError } = require('./httpGuard');

const ENTIDADES = {
    factura: { coleccion: 'invoices', clave: 'invoicenumber', id: 'invoiceid' },
    pedido: { coleccion: 'salesorders', clave: 'ordernumber', id: 'salesorderid' },
    albaran: { coleccion: 'msdyn_shipments', clave: 'msdyn_name', id: 'msdyn_shipmentid' },
    activo: { coleccion: 'msdyn_customerassets', clave: 'msdyn_name', id: 'msdyn_customerassetid' },
};

const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

class DynamicsAdapter extends ErpAdapter {
    static get id() { return 'dynamics'; }

    get tiposSoportados() { return Object.keys(ENTIDADES); }
    get tiposEscribibles() { return []; }   // sólo lectura hasta que haya un caso real

    cabeceras() {
        const { token } = this.credenciales;
        if (!token) throw new ErpHttpError('Falta el token de Dataverse.', 'ERP_CREDENCIALES');
        return {
            Authorization: `Bearer ${token}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Content-Type': 'application/json',
        };
    }

    _filtroOData(tipo, f) {
        const partes = [];
        const campoFecha = { factura: 'createdon', pedido: 'createdon', albaran: 'createdon', activo: 'createdon' }[tipo];
        if (f.desde && campoFecha) partes.push(`${campoFecha} ge ${f.desde}`);
        if (f.hasta && campoFecha) partes.push(`${campoFecha} le ${f.hasta}`);
        if (f.numero) partes.push(`${ENTIDADES[tipo].clave} eq ${lit(f.numero)}`);
        return partes.join(' and ');
    }

    _traducir(tipo, fila) {
        switch (tipo) {
            case 'factura':
                return {
                    numero: fila.invoicenumber, proveedor: fila._customerid_value,
                    importe: fila.totalamount, moneda: fila.transactioncurrencyid,
                    vencimiento: fila.duedate, fecha: fila.createdon,
                    estado: fila.statuscode, referencia: fila.invoiceid,
                };
            case 'pedido':
                return {
                    numero: fila.ordernumber, cliente: fila._customerid_value,
                    importe: fila.totalamount, moneda: fila.transactioncurrencyid,
                    fecha: fila.createdon, estado: fila.statuscode,
                };
            case 'albaran':
                return {
                    numero: fila.msdyn_name, pedido: fila._msdyn_order_value,
                    destino: fila.msdyn_shipto, fecha: fila.createdon, estado: fila.statuscode,
                };
            case 'activo':
                return {
                    referencia: fila.msdyn_name, descripcion: fila.msdyn_description,
                    valoracion: fila.msdyn_value, fechaTasacion: fila.createdon,
                    estado: fila.statuscode,
                };
            default:
                return {};
        }
    }

    async listarDocumentos(tipo, filtro = {}) {
        this.comprobarTipo(tipo);
        const f = this.normalizarFiltro(filtro);
        const expr = this._filtroOData(tipo, f);
        const datos = await this._peticion(async (http) => {
            const res = await http.get(`/api/data/v9.2/${ENTIDADES[tipo].coleccion}`, {
                params: { $top: f.limite, ...(expr ? { $filter: expr } : {}) },
            });
            return this._comprobarRespuesta(res, 'listar documentos');
        });
        const filas = datos?.value || [];
        return {
            documentos: filas.map((fila) => this.proyectar(tipo, this._traducir(tipo, fila))),
            total: filas.length,
        };
    }

    async obtenerDocumento(tipo, id) {
        this.comprobarTipo(tipo);
        const datos = await this._peticion(async (http) => {
            const res = await http.get(`/api/data/v9.2/${ENTIDADES[tipo].coleccion}`, {
                params: { $top: 1, $filter: `${ENTIDADES[tipo].clave} eq ${lit(id)}` },
            });
            return this._comprobarRespuesta(res, 'obtener el documento');
        });
        const fila = datos?.value?.[0];
        if (!fila) return null;
        return this.proyectar(tipo, this._traducir(tipo, fila));
    }

    async probarConexion() {
        return this._peticion(async (http) => {
            const res = await http.get('/api/data/v9.2/invoices', { params: { $top: 1 } });
            this._comprobarRespuesta(res, 'probar la conexión');
            return { ok: true, erp: DynamicsAdapter.id };
        });
    }
}

module.exports = DynamicsAdapter;
