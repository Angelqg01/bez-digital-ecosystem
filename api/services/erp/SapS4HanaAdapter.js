'use strict';

/**
 * SAP S/4HANA Cloud — OData v4 a través de un destino de BTP.
 *
 * Autenticación: usuario de servicio (Basic) o Bearer de BTP. Se admite Basic
 * porque es lo que la mayoría de instalaciones puede emitir sin un proyecto de
 * por medio; el Bearer es preferible y se usa si está.
 *
 * SOBRE EL FILTRO DE ODATA: `$filter` es una expresión que se construye
 * concatenando texto, así que un valor con una comilla puede cambiar su
 * significado. No es SQL, pero el mecanismo es el mismo. Todo valor pasa por
 * `lit()`, que dobla las comillas simples como manda OData. Y los CAMPOS nunca
 * salen de la entrada: son literales de este fichero.
 */

const { ErpAdapter } = require('./ErpAdapter');

/** Entidad de OData por tipo canónico. */
const ENTIDADES = {
    factura: { ruta: 'API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice', clave: 'SupplierInvoice' },
    pedido: { ruta: 'API_SALES_ORDER_SRV/A_SalesOrder', clave: 'SalesOrder' },
    albaran: { ruta: 'API_OUTBOUND_DELIVERY_SRV/A_OutbDeliveryHeader', clave: 'DeliveryDocument' },
    activo: { ruta: 'API_FIXEDASSET_SRV/A_FixedAsset', clave: 'MasterFixedAsset' },
    asiento: { ruta: 'API_OPLACCTGDOCITEMCUBE_SRV/A_OperationalAcctgDocItemCube', clave: 'AccountingDocument' },
};

/** Literal de OData: la comilla simple se escapa doblándola. */
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

class SapS4HanaAdapter extends ErpAdapter {
    static get id() { return 'sap_s4hana'; }

    get tiposSoportados() { return Object.keys(ENTIDADES); }
    get tiposEscribibles() { return ['factura']; }

    cabeceras() {
        const { token, usuario, password } = this.credenciales;
        if (token) return { Authorization: `Bearer ${token}` };
        if (usuario && password) {
            const b64 = Buffer.from(`${usuario}:${password}`).toString('base64');
            return { Authorization: `Basic ${b64}` };
        }
        return {};
    }

    /** Traduce el filtro canónico a `$filter`. Campos literales, valores escapados. */
    _filtroOData(tipo, f) {
        const partes = [];
        const campoFecha = {
            factura: 'PostingDate', pedido: 'SalesOrderDate', albaran: 'CreationDate',
            activo: 'CapitalizationDate', asiento: 'PostingDate',
        }[tipo];
        const campoContraparte = {
            factura: 'InvoicingParty', pedido: 'SoldToParty', albaran: 'ShipToParty',
        }[tipo];

        if (f.desde && campoFecha) partes.push(`${campoFecha} ge ${f.desde}`);
        if (f.hasta && campoFecha) partes.push(`${campoFecha} le ${f.hasta}`);
        if (f.numero) partes.push(`${ENTIDADES[tipo].clave} eq ${lit(f.numero)}`);
        if (f.contraparte && campoContraparte) partes.push(`${campoContraparte} eq ${lit(f.contraparte)}`);
        return partes.join(' and ');
    }

    /** OData → modelo canónico. Lo que no se mapea, no existe para BeZhas. */
    _traducir(tipo, fila) {
        switch (tipo) {
            case 'factura':
                return {
                    numero: fila.SupplierInvoice,
                    proveedor: fila.InvoicingParty,
                    importe: fila.InvoiceGrossAmount,
                    moneda: fila.DocumentCurrency,
                    vencimiento: fila.DueCalculationBaseDate,
                    fecha: fila.PostingDate,
                    estado: fila.PaymentBlockingReason ? 'bloqueada' : 'abierta',
                    referencia: fila.SupplierInvoiceIDByInvcgParty,
                };
            case 'pedido':
                return {
                    numero: fila.SalesOrder, cliente: fila.SoldToParty,
                    importe: fila.TotalNetAmount, moneda: fila.TransactionCurrency,
                    fecha: fila.SalesOrderDate, estado: fila.OverallSDProcessStatus,
                };
            case 'albaran':
                return {
                    numero: fila.DeliveryDocument, pedido: fila.ReferenceSDDocument,
                    destino: fila.ShipToParty, bultos: fila.TotalNumberOfPackage,
                    peso: fila.GrossWeight, fecha: fila.CreationDate,
                    estado: fila.OverallSDProcessStatus,
                };
            case 'activo':
                return {
                    referencia: fila.MasterFixedAsset, descripcion: fila.FixedAssetDescription,
                    valoracion: fila.AcqnAmtInCoCodeCrcy, moneda: fila.CompanyCodeCurrency,
                    fechaTasacion: fila.CapitalizationDate, estado: fila.DeactivationDate ? 'baja' : 'alta',
                };
            case 'asiento':
                return {
                    cuenta: fila.GLAccount, debe: fila.DebitAmountInCoCodeCrcy,
                    haber: fila.CreditAmountInCoCodeCrcy, concepto: fila.DocumentItemText,
                    fecha: fila.PostingDate, referencia: fila.AccountingDocument,
                };
            default:
                return {};
        }
    }

    async listarDocumentos(tipo, filtro = {}) {
        this.comprobarTipo(tipo);
        const f = this.normalizarFiltro(filtro);
        const entidad = ENTIDADES[tipo];
        const expr = this._filtroOData(tipo, f);

        const datos = await this._peticion(async (http) => {
            const res = await http.get(`/sap/opu/odata4/sap/${entidad.ruta}`, {
                params: {
                    $top: f.limite,
                    $count: true,
                    ...(expr ? { $filter: expr } : {}),
                },
            });
            return this._comprobarRespuesta(res, 'listar documentos');
        });

        const filas = datos?.value || [];
        return {
            documentos: filas.map((fila) => this.proyectar(tipo, this._traducir(tipo, fila))),
            total: datos?.['@odata.count'] ?? filas.length,
        };
    }

    async obtenerDocumento(tipo, id) {
        this.comprobarTipo(tipo);
        const entidad = ENTIDADES[tipo];
        const datos = await this._peticion(async (http) => {
            // El id va como literal de OData en la clave de la entidad, con la
            // comilla escapada: es entrada del cliente y llega hasta la URL.
            const res = await http.get(`/sap/opu/odata4/sap/${entidad.ruta}(${lit(id)})`);
            return this._comprobarRespuesta(res, 'obtener el documento');
        });
        if (!datos) return null;
        return this.proyectar(tipo, this._traducir(tipo, datos));
    }

    async escribirDocumento(tipo, payload, idempotencyKey) {
        await super.escribirDocumento(tipo, payload, idempotencyKey).catch((err) => {
            // La base valida tipo e idempotencia y luego lanza «sin implementar»;
            // ese último error es el único que se descarta aquí.
            if (err.message !== 'sin implementar') throw err;
        });

        const entidad = ENTIDADES[tipo];
        const datos = await this._peticion(async (http) => {
            const res = await http.post(`/sap/opu/odata4/sap/${entidad.ruta}`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    // SAP no tiene cabecera de idempotencia estándar; se manda la
                    // nuestra y además se refleja en el propio documento, que es
                    // lo que permite detectar el duplicado si el ERP la ignora.
                    'X-Idempotency-Key': idempotencyKey,
                },
            });
            return this._comprobarRespuesta(res, 'escribir el documento');
        });
        return { id: datos?.[entidad.clave] || null, creado: true };
    }

    async probarConexion() {
        return this._peticion(async (http) => {
            const res = await http.get('/sap/opu/odata4/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice', {
                params: { $top: 1 },
            });
            this._comprobarRespuesta(res, 'probar la conexión');
            return { ok: true, erp: SapS4HanaAdapter.id };
        });
    }
}

module.exports = SapS4HanaAdapter;
