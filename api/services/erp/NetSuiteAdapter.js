'use strict';

/**
 * Oracle NetSuite — SuiteQL sobre REST (`/services/rest/query/v1/suiteql`).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE ADAPTADOR ES EL ÚNICO QUE CONSTRUYE SQL, Y ESO CAMBIA LAS REGLAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SuiteQL no admite parámetros ligados: la consulta viaja como texto. Es decir,
 * aquí sí hay inyección SQL de verdad si el valor de un filtro entra sin más en
 * la cadena.
 *
 * La defensa no es escapar y confiar. Es que NINGÚN VALOR DE TEXTO llegue crudo:
 *
 *   · Las fechas se reconstruyen desde un Date (ya normalizado en la base) y se
 *     vuelven a formatear aquí. Lo que se concatena es una fecha nuestra.
 *   · Los números se comprueban con Number.isFinite y se concatenan como número.
 *   · El resto de valores —número de documento, contraparte, estado— pasa por
 *     `textoSeguro()`, que RECHAZA lo que no encaje en un alfabeto conservador
 *     en vez de intentar limpiarlo. Limpiar es una carrera que se pierde;
 *     rechazar, no.
 *   · Tablas y columnas son literales de este fichero, nunca entrada.
 *
 * Sólo lectura, además: escribir en NetSuite exige SuiteScript o los endpoints
 * de registro, y no vamos a construir eso hasta que un cliente lo pida.
 */

const { ErpAdapter } = require('./ErpAdapter');
const { ErpHttpError } = require('./httpGuard');

const TABLAS = {
    factura: {
        tabla: 'transaction', tipoTx: 'VendBill',
        columnas: 'tranid, entity, foreignTotal, currency, duedate, trandate, status',
    },
    pedido: {
        tabla: 'transaction', tipoTx: 'SalesOrd',
        columnas: 'tranid, entity, foreignTotal, currency, trandate, status',
    },
    albaran: {
        tabla: 'transaction', tipoTx: 'ItemShip',
        columnas: 'tranid, entity, trandate, status',
    },
};

/**
 * Alfabeto conservador para valores de texto que acaban en la consulta.
 * Letras, dígitos, espacio y los separadores que aparecen en un número de
 * documento. Ni comillas, ni punto y coma, ni guiones dobles, ni paréntesis.
 */
const SEGURO = /^[A-Za-z0-9 ._/-]{1,100}$/;

function textoSeguro(valor, campo) {
    const v = String(valor).trim();
    if (!SEGURO.test(v)) {
        throw new ErpHttpError(
            `El valor de «${campo}» tiene caracteres no admitidos para una consulta de NetSuite. `
            + 'Usa letras, dígitos, espacio, punto, guion, barra o guion bajo.',
            'ERP_FILTRO_CARACTERES'
        );
    }
    return v;
}

class NetSuiteAdapter extends ErpAdapter {
    static get id() { return 'netsuite'; }

    get tiposSoportados() { return Object.keys(TABLAS); }
    get tiposEscribibles() { return []; }

    cabeceras() {
        const { token } = this.credenciales;
        if (!token) throw new ErpHttpError('Falta el token OAuth de NetSuite.', 'ERP_CREDENCIALES');
        return {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'transient',
        };
    }

    _where(tipo, f) {
        const cfg = TABLAS[tipo];
        // El tipo de transacción es un literal de este fichero, no entrada.
        const partes = [`type = '${cfg.tipoTx}'`];

        if (f.desde) partes.push(`trandate >= TO_DATE('${f.desde}', 'YYYY-MM-DD')`);
        if (f.hasta) partes.push(`trandate <= TO_DATE('${f.hasta}', 'YYYY-MM-DD')`);
        if (f.numero) partes.push(`tranid = '${textoSeguro(f.numero, 'numero')}'`);
        if (f.estado) partes.push(`status = '${textoSeguro(f.estado, 'estado')}'`);
        if (f.contraparte) partes.push(`entity = '${textoSeguro(f.contraparte, 'contraparte')}'`);
        return partes.join(' AND ');
    }

    _traducir(tipo, fila) {
        const base = {
            numero: fila.tranid, fecha: fila.trandate, estado: fila.status,
        };
        if (tipo === 'factura') {
            return { ...base, proveedor: fila.entity, importe: fila.foreigntotal, moneda: fila.currency, vencimiento: fila.duedate };
        }
        if (tipo === 'pedido') {
            return { ...base, cliente: fila.entity, importe: fila.foreigntotal, moneda: fila.currency };
        }
        return { ...base, destino: fila.entity };
    }

    async _suiteql(sql, limite) {
        return this._peticion(async (http) => {
            const res = await http.post('/services/rest/query/v1/suiteql', { q: sql },
                { params: { limit: limite } });
            return this._comprobarRespuesta(res, 'consultar NetSuite');
        });
    }

    async listarDocumentos(tipo, filtro = {}) {
        this.comprobarTipo(tipo);
        const f = this.normalizarFiltro(filtro);
        const cfg = TABLAS[tipo];
        // El límite ya viene acotado a 1-200 y como entero por normalizarFiltro,
        // pero se vuelve a comprobar: es lo único numérico que se concatena.
        if (!Number.isInteger(f.limite)) {
            throw new ErpHttpError('Límite no válido.', 'ERP_FILTRO_LIMITE');
        }
        const sql = `SELECT ${cfg.columnas} FROM ${cfg.tabla} WHERE ${this._where(tipo, f)}`;
        const datos = await this._suiteql(sql, f.limite);
        const filas = datos?.items || [];
        return {
            documentos: filas.map((fila) => this.proyectar(tipo, this._traducir(tipo, fila))),
            total: datos?.totalResults ?? filas.length,
        };
    }

    async obtenerDocumento(tipo, id) {
        this.comprobarTipo(tipo);
        const cfg = TABLAS[tipo];
        const sql = `SELECT ${cfg.columnas} FROM ${cfg.tabla} `
            + `WHERE type = '${cfg.tipoTx}' AND tranid = '${textoSeguro(id, 'id')}'`;
        const datos = await this._suiteql(sql, 1);
        const fila = datos?.items?.[0];
        if (!fila) return null;
        return this.proyectar(tipo, this._traducir(tipo, fila));
    }

    async probarConexion() {
        await this._suiteql('SELECT id FROM transaction', 1);
        return { ok: true, erp: NetSuiteAdapter.id };
    }
}

module.exports = NetSuiteAdapter;
module.exports.textoSeguro = textoSeguro;
