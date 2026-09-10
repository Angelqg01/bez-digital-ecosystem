'use strict';

/**
 * SAP Business One — Service Layer (`/b1s/v1`).
 *
 * El Service Layer trabaja por SESIÓN: se hace login y devuelve una cookie
 * `B1SESSION` que hay que mandar en cada llamada. La sesión se abre por
 * instancia del adaptador, que vive lo que una petición nuestra, y se cierra al
 * terminar. No se guarda en base de datos ni se comparte entre clientes: una
 * sesión compartida sería una vía para operar en el B1 de otro.
 *
 * El filtro es OData v3, así que valen las mismas cautelas que en S/4HANA: los
 * campos son literales de este fichero y los valores pasan por `lit()`.
 */

const { ErpAdapter } = require('./ErpAdapter');
const { ErpHttpError } = require('./httpGuard');

const ENTIDADES = {
    factura: { coleccion: 'PurchaseInvoices', clave: 'DocNum' },
    pedido: { coleccion: 'Orders', clave: 'DocNum' },
    albaran: { coleccion: 'DeliveryNotes', clave: 'DocNum' },
    activo: { coleccion: 'Items', clave: 'ItemCode' },
    asiento: { coleccion: 'JournalEntries', clave: 'JdtNum' },
};

const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

class SapBusinessOneAdapter extends ErpAdapter {
    static get id() { return 'sap_b1'; }

    get tiposSoportados() { return Object.keys(ENTIDADES); }
    get tiposEscribibles() { return ['factura']; }

    cabeceras() {
        return this._sessionId
            ? { Cookie: `B1SESSION=${this._sessionId}`, 'Content-Type': 'application/json' }
            : { 'Content-Type': 'application/json' };
    }

    async _login() {
        if (this._sessionId) return this._sessionId;
        const { companyDB, usuario, password } = this.credenciales;
        if (!companyDB || !usuario || !password) {
            throw new ErpHttpError('Faltan base de empresa, usuario o clave de Business One.', 'ERP_CREDENCIALES');
        }
        const datos = await this._peticion(async (http) => {
            const res = await http.post('/b1s/v1/Login', {
                CompanyDB: companyDB, UserName: usuario, Password: password,
            });
            return this._comprobarRespuesta(res, 'iniciar sesión');
        });
        if (!datos?.SessionId) {
            throw new ErpHttpError('Business One rechazó las credenciales.', 'ERP_CREDENCIALES');
        }
        this._sessionId = datos.SessionId;
        // La cabecera de sesión hay que reconstruirla: el cliente se creó antes
        // de tenerla.
        this._cliente = null;
        return this._sessionId;
    }

    /** Cierra la sesión. El Service Layer tiene un tope de sesiones abiertas. */
    async cerrar() {
        if (!this._sessionId) return;
        try {
            await this.cliente().post('/b1s/v1/Logout');
        } catch { /* cerrar es mejor esfuerzo: caduca sola */ }
        this._sessionId = null;
    }

    _filtroOData(tipo, f) {
        const partes = [];
        const campoFecha = { factura: 'DocDate', pedido: 'DocDate', albaran: 'DocDate', asiento: 'ReferenceDate' }[tipo];
        if (f.desde && campoFecha) partes.push(`${campoFecha} ge ${lit(f.desde)}`);
        if (f.hasta && campoFecha) partes.push(`${campoFecha} le ${lit(f.hasta)}`);
        if (f.numero) partes.push(`${ENTIDADES[tipo].clave} eq ${/^\d+$/.test(f.numero) ? f.numero : lit(f.numero)}`);
        if (f.contraparte && tipo !== 'activo' && tipo !== 'asiento') partes.push(`CardName eq ${lit(f.contraparte)}`);
        if (f.estado) partes.push(`DocumentStatus eq ${lit(f.estado)}`);
        return partes.join(' and ');
    }

    _traducir(tipo, fila) {
        switch (tipo) {
            case 'factura':
                return {
                    numero: String(fila.DocNum ?? ''), proveedor: fila.CardName,
                    importe: fila.DocTotal, moneda: fila.DocCurrency,
                    vencimiento: fila.DocDueDate, fecha: fila.DocDate,
                    estado: fila.DocumentStatus, referencia: fila.NumAtCard,
                };
            case 'pedido':
                return {
                    numero: String(fila.DocNum ?? ''), cliente: fila.CardName,
                    importe: fila.DocTotal, moneda: fila.DocCurrency,
                    fecha: fila.DocDate, estado: fila.DocumentStatus,
                };
            case 'albaran':
                return {
                    numero: String(fila.DocNum ?? ''), pedido: fila.NumAtCard,
                    destino: fila.ShipToCode || fila.CardName,
                    bultos: fila.PackagesQuantity, peso: fila.GrossWeight,
                    fecha: fila.DocDate, estado: fila.DocumentStatus,
                };
            case 'activo':
                return {
                    referencia: fila.ItemCode, descripcion: fila.ItemName,
                    valoracion: fila.AvgStdPrice, moneda: null,
                    fechaTasacion: fila.CreateDate, estado: fila.Valid,
                };
            case 'asiento':
                return {
                    cuenta: fila.JournalEntryLines?.[0]?.AccountCode ?? null,
                    debe: fila.JournalEntryLines?.[0]?.Debit ?? null,
                    haber: fila.JournalEntryLines?.[0]?.Credit ?? null,
                    concepto: fila.Memo, fecha: fila.ReferenceDate,
                    referencia: String(fila.JdtNum ?? ''),
                };
            default:
                return {};
        }
    }

    async listarDocumentos(tipo, filtro = {}) {
        this.comprobarTipo(tipo);
        const f = this.normalizarFiltro(filtro);
        await this._login();
        const expr = this._filtroOData(tipo, f);

        const datos = await this._peticion(async (http) => {
            const res = await http.get(`/b1s/v1/${ENTIDADES[tipo].coleccion}`, {
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
        await this._login();
        const clave = /^\d+$/.test(String(id)) ? String(id) : lit(id);
        const datos = await this._peticion(async (http) => {
            const res = await http.get(`/b1s/v1/${ENTIDADES[tipo].coleccion}(${clave})`);
            return this._comprobarRespuesta(res, 'obtener el documento');
        });
        if (!datos) return null;
        return this.proyectar(tipo, this._traducir(tipo, datos));
    }

    async escribirDocumento(tipo, payload, idempotencyKey) {
        await super.escribirDocumento(tipo, payload, idempotencyKey).catch((err) => {
            if (err.message !== 'sin implementar') throw err;
        });
        await this._login();

        // Igual que en Odoo: B1 no tiene idempotencia, así que la clave viaja en
        // NumAtCard y se comprueba antes de crear. Es lo que impide que el
        // reintento de un agente acabe siendo dos facturas.
        const yaExiste = await this._peticion(async (http) => {
            const res = await http.get(`/b1s/v1/${ENTIDADES[tipo].coleccion}`, {
                params: { $top: 1, $filter: `NumAtCard eq ${lit(idempotencyKey)}` },
            });
            return this._comprobarRespuesta(res, 'comprobar la idempotencia');
        });
        if (yaExiste?.value?.length > 0) {
            return { id: String(yaExiste.value[0].DocNum), creado: false };
        }

        const datos = await this._peticion(async (http) => {
            const res = await http.post(`/b1s/v1/${ENTIDADES[tipo].coleccion}`,
                { ...payload, NumAtCard: idempotencyKey });
            return this._comprobarRespuesta(res, 'escribir el documento');
        });
        return { id: String(datos?.DocNum ?? ''), creado: true };
    }

    async probarConexion() {
        await this._login();
        return { ok: true, erp: SapBusinessOneAdapter.id };
    }
}

module.exports = SapBusinessOneAdapter;
