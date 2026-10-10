'use strict';

/**
 * config/admin-sectors.js — catálogo único de servicios y sectores de BeZhas
 * para la consola de administración (routes/admin-console.js).
 *
 * Los servicios son las rutas que `index.js` monta de verdad (`base`). Los
 * sectores verticales (salud, energía, logística…) NO se listan a mano: salen de
 * `smart-contracts/deployments/<chainId>.json`, que es la fuente de verdad de lo
 * desplegado. Mantener dos listas es el modo de que una se quede vieja.
 */

const fs = require('fs');
const path = require('path');

const DEPLOYMENTS_DIR = path.resolve(__dirname, '..', '..', 'smart-contracts', 'deployments');

/** `auth`: con qué credencial hay que llamar a esa ruta (ver POST /session). */
const SERVICES = Object.freeze([
    { id: 'wallet',        nombre: 'Wallet / Paymaster / Guardian', base: '/api/wallet',            auth: 'user-jwt' },
    { id: 'gas',           nombre: 'Gas tank empresarial',          base: '/api/gas',               auth: 'user-jwt' },
    { id: 'treasury',      nombre: 'Tesorería',                     base: '/api/treasury',          auth: 'user-jwt' },
    { id: 'tokenomics',    nombre: 'Tokenomics BEZ',                base: '/api/tokenomics',        auth: 'user-jwt' },
    { id: 'contracts',     nombre: 'Contratos y ABIs',              base: '/api/contracts',         auth: 'user-jwt' },
    { id: 'blockchain',    nombre: 'Blockchain / L2',               base: '/api/blockchain',        auth: 'user-jwt' },
    { id: 'transactions',  nombre: 'Transacciones',                 base: '/api/transactions',      auth: 'user-jwt' },
    { id: 'validators',    nombre: 'Validadores',                   base: '/api/validators',        auth: 'user-jwt' },
    { id: 'nfts',          nombre: 'NFTs / RWA',                    base: '/api/nfts',              auth: 'user-jwt' },
    { id: 'market',        nombre: 'Mercado / DeFi',                base: '/api/market',            auth: 'user-jwt' },
    { id: 'bridge',        nombre: 'Ecosystem bridge',              base: '/api/ecosystem-bridge',  auth: 'user-jwt' },
    { id: 'sectors',       nombre: 'Sectores (RWA factory)',        base: '/api/sectors',           auth: 'user-jwt' },
    { id: 'energy',        nombre: 'Energía / VPP',                 base: '/api/energy',            auth: 'user-jwt' },
    { id: 'cargolink',     nombre: 'CargoLink (logística)',         base: '/api/cargolink',         auth: 'user-jwt' },
    { id: 'purescan',      nombre: 'PureScan',                      base: '/api/purescan',          auth: 'user-jwt' },
    { id: 'mtfc',          nombre: 'MTFC',                          base: '/api/mtfc',              auth: 'user-jwt' },
    { id: 'operant',       nombre: 'OPERANT (gestión autónoma)',    base: '/api/operant',           auth: 'user-jwt' },
    { id: 'aegis',         nombre: 'Aegis (seguridad IA)',          base: '/api/aegis',             auth: 'user-jwt' },
    { id: 'openclaw',      nombre: 'OpenClaw (orquestador IA)',     base: '/api/openclaw',          auth: 'user-jwt' },
    { id: 'agents',        nombre: 'Agentes',                       base: '/api/agents',            auth: 'user-jwt' },
    { id: 'ai-billing',    nombre: 'Facturación IA',                base: '/api/ai-billing',        auth: 'user-jwt' },
    { id: 'identity',      nombre: 'Identidad',                     base: '/api/identity',          auth: 'user-jwt' },
    { id: 'organizations', nombre: 'Organizaciones',                base: '/api/organizations',     auth: 'user-jwt' },
    { id: 'gamification',  nombre: 'Gamificación',                  base: '/api/gamification',      auth: 'user-jwt' },
    { id: 'monitor',       nombre: 'Monitor',                       base: '/api/monitor',           auth: 'user-jwt' },
    { id: 'admin-config',  nombre: 'Config de administración',      base: '/api/admin-config',      auth: 'superadmin' },
    { id: 'governance',    nombre: 'Gobernanza (admin)',            base: '/api/admin/governance',  auth: 'superadmin' },
]);

function leerDespliegue(chainId) {
    try {
        return JSON.parse(fs.readFileSync(path.join(DEPLOYMENTS_DIR, `${chainId}.json`), 'utf8'));
    } catch {
        return null;
    }
}

const ES_DIRECCION = /^0x[0-9a-fA-F]{40}$/;

/**
 * `{ core: {Nombre: addr}, sectores: {salud: {Nombre: addr}}, todos: {Nombre: addr} }`
 * para una cadena. Sólo entradas con forma de dirección: el JSON mezcla
 * metadatos (`chainId`, `timestamp`) con contratos.
 */
function contratosDeLaCadena(chainId) {
    const d = leerDespliegue(chainId);
    const vacio = { core: {}, sectores: {}, todos: {} };
    if (!d) return vacio;

    const soloDirecciones = (obj) => Object.fromEntries(
        Object.entries(obj || {}).filter(([, v]) => typeof v === 'string' && ES_DIRECCION.test(v)));

    const core = soloDirecciones(d.core);
    const sectores = Object.fromEntries(
        Object.entries(d.sectors || {}).map(([s, c]) => [s, soloDirecciones(c)]));
    const todos = { ...core, ...Object.assign({}, ...Object.values(sectores)) };
    return { core, sectores, todos };
}

function catalogo(chainId) {
    const { core, sectores } = contratosDeLaCadena(chainId);
    return {
        chainId,
        servicios: SERVICES,
        contratos: {
            core: Object.keys(core),
            sectores: Object.fromEntries(Object.entries(sectores).map(([s, c]) => [s, Object.keys(c)])),
        },
    };
}

module.exports = { SERVICES, contratosDeLaCadena, catalogo, ES_DIRECCION };
