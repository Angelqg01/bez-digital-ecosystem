'use strict';

/**
 * services/erp/canonical.js — los cinco documentos que BeZhas entiende.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ UN MODELO CANÓNICO Y NO EL ESQUEMA DEL ERP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La tentación es exponer el objeto del ERP tal cual —una factura de S/4HANA
 * con sus doscientos campos— y dejar que el agente se apañe. Tres razones para
 * no hacerlo, en orden de importancia:
 *
 *  1. MINIMIZACIÓN. Cada campo que sale del ERP del cliente es un dato que
 *     custodiamos y del que respondemos. Una factura tiene ocho campos que nos
 *     hacen falta; el resto es responsabilidad que se asume sin usarla.
 *  2. Lo que el cliente aprueba tiene que ser legible. «Salen estos ocho
 *     campos» se aprueba en una pantalla; «sale A_SupplierInvoice» no se
 *     aprueba, se acepta a ciegas.
 *  3. Un modelo común es lo que permite que la misma herramienta funcione con
 *     SAP, Odoo o Dynamics. Si el agente ve el esquema nativo, la integración
 *     deja de ser de BeZhas y pasa a ser de cada ERP.
 *
 * Lo que no está en esta lista no sale del ERP del cliente. Añadir un campo es
 * un cambio deliberado en este fichero, no un efecto secundario de una consulta.
 */

const TIPOS = Object.freeze({
    factura: {
        nombre: 'Factura de proveedor',
        campos: ['numero', 'proveedor', 'importe', 'moneda', 'vencimiento', 'estado', 'fecha', 'referencia'],
        obligatorios: ['numero', 'importe', 'moneda'],
    },
    pedido: {
        nombre: 'Pedido',
        campos: ['numero', 'cliente', 'importe', 'moneda', 'fecha', 'estado', 'lineas'],
        obligatorios: ['numero'],
    },
    albaran: {
        nombre: 'Albarán',
        campos: ['numero', 'pedido', 'destino', 'bultos', 'peso', 'fecha', 'estado'],
        obligatorios: ['numero'],
    },
    activo: {
        nombre: 'Activo',
        campos: ['referencia', 'descripcion', 'valoracion', 'moneda', 'fechaTasacion', 'estado'],
        obligatorios: ['referencia'],
    },
    asiento: {
        nombre: 'Asiento contable',
        campos: ['cuenta', 'debe', 'haber', 'concepto', 'fecha', 'referencia'],
        obligatorios: ['cuenta', 'fecha'],
    },
});

const NOMBRES = Object.freeze(Object.keys(TIPOS));

function esTipoValido(tipo) {
    return Object.prototype.hasOwnProperty.call(TIPOS, tipo);
}

function camposDe(tipo) {
    return TIPOS[tipo]?.campos || [];
}

/**
 * Recorta un documento al modelo canónico Y al alcance que el cliente aprobó.
 *
 * Dos filtros seguidos, y el orden importa: primero lo que BeZhas entiende,
 * después lo que ESTE cliente autorizó. Un campo canónico que el cliente no ha
 * aprobado no sale, aunque el ERP lo devuelva y aunque nos sirviera.
 *
 * @param {string} tipo
 * @param {object} bruto        documento ya traducido por el adaptador
 * @param {string[]} aprobados  alcance de campos de la conexión
 */
function proyectar(tipo, bruto, aprobados) {
    const permitidos = camposDe(tipo);
    const alcance = Array.isArray(aprobados) && aprobados.length > 0
        ? permitidos.filter((c) => aprobados.includes(c))
        : permitidos;

    const salida = {};
    for (const campo of alcance) {
        if (bruto[campo] !== undefined) salida[campo] = bruto[campo];
    }
    return salida;
}

/** Comprueba que un documento a escribir trae lo imprescindible. */
function validarParaEscritura(tipo, doc) {
    const faltan = (TIPOS[tipo]?.obligatorios || []).filter(
        (c) => doc[c] === undefined || doc[c] === null || doc[c] === ''
    );
    return { valido: faltan.length === 0, faltan };
}

module.exports = { TIPOS, NOMBRES, esTipoValido, camposDe, proyectar, validarParaEscritura };
