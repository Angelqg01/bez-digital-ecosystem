'use strict';

/**
 * services/erp/index.js — registro de adaptadores.
 *
 * Un ERP que no esté aquí no se puede dar de alta. Es la misma idea que la
 * lista blanca de herramientas del MCP: el conjunto de destinos posibles se
 * decide en el repositorio, no en una petición.
 */

const SapS4HanaAdapter = require('./SapS4HanaAdapter');
const SapBusinessOneAdapter = require('./SapBusinessOneAdapter');
const OdooAdapter = require('./OdooAdapter');
const DynamicsAdapter = require('./DynamicsAdapter');
const NetSuiteAdapter = require('./NetSuiteAdapter');
const canonical = require('./canonical');
const { ErpHttpError } = require('./httpGuard');

const ADAPTADORES = {
    [SapS4HanaAdapter.id]: SapS4HanaAdapter,
    [SapBusinessOneAdapter.id]: SapBusinessOneAdapter,
    [OdooAdapter.id]: OdooAdapter,
    [DynamicsAdapter.id]: DynamicsAdapter,
    [NetSuiteAdapter.id]: NetSuiteAdapter,
};

/**
 * Qué credenciales pide cada ERP. Lo consume la pantalla alojada para pintar el
 * formulario, y el servicio para validar antes de guardar.
 *
 * `secreto: true` marca lo que se cifra y no vuelve a mostrarse nunca.
 */
const CREDENCIALES = {
    sap_s4hana: [
        { campo: 'usuario', etiqueta: 'Usuario de servicio', secreto: false, opcional: true },
        { campo: 'password', etiqueta: 'Contraseña', secreto: true, opcional: true },
        { campo: 'token', etiqueta: 'Token de BTP (alternativa a usuario y contraseña)', secreto: true, opcional: true },
    ],
    sap_b1: [
        { campo: 'companyDB', etiqueta: 'Base de datos de empresa', secreto: false, opcional: false },
        { campo: 'usuario', etiqueta: 'Usuario', secreto: false, opcional: false },
        { campo: 'password', etiqueta: 'Contraseña', secreto: true, opcional: false },
    ],
    odoo: [
        { campo: 'baseDatos', etiqueta: 'Base de datos', secreto: false, opcional: false },
        { campo: 'usuario', etiqueta: 'Usuario', secreto: false, opcional: false },
        { campo: 'password', etiqueta: 'Clave de API', secreto: true, opcional: false },
    ],
    dynamics: [
        { campo: 'token', etiqueta: 'Token de Dataverse (Entra ID)', secreto: true, opcional: false },
    ],
    netsuite: [
        { campo: 'token', etiqueta: 'Token OAuth 2.0', secreto: true, opcional: false },
    ],
};

const IDS = Object.keys(ADAPTADORES);

function crearAdaptador(erpId, cfg) {
    const Clase = ADAPTADORES[erpId];
    if (!Clase) {
        throw new ErpHttpError(
            `ERP no soportado: «${erpId}». Disponibles: ${IDS.join(', ')}.`,
            'ERP_NO_SOPORTADO'
        );
    }
    return new Clase(cfg);
}

/** Descripción para el catálogo, sin instanciar nada. */
function describirErp(erpId) {
    const Clase = ADAPTADORES[erpId];
    if (!Clase) return null;
    // Instancia mínima sólo para leer sus capacidades declaradas: no abre
    // conexión ninguna porque el cliente HTTP es perezoso.
    const sonda = new Clase({ baseUrl: 'https://example.invalid', credenciales: {} });
    return {
        id: erpId,
        tiposLegibles: sonda.tiposSoportados,
        tiposEscribibles: sonda.tiposEscribibles,
        credenciales: CREDENCIALES[erpId] || [],
    };
}

module.exports = {
    ADAPTADORES, CREDENCIALES, IDS,
    crearAdaptador, describirErp, canonical,
};
