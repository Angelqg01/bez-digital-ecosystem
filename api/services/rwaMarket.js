'use strict';

/**
 * services/rwaMarket.js — activos tokenizados después de crearlos: consultarlos,
 * transferir fracciones y la venta primaria en BEZ.
 *
 * Igual que rwaTokenization.js, todo devuelve transacciones SIN FIRMAR: las
 * firma la wallet del titular o del comprador. BeZhas nunca tiene ni las
 * fracciones ni el BEZ de nadie.
 *
 * Venta primaria: contrato RWAPrimarySale (smart-contracts/src/finance), uno por
 * fábrica. ⚠️ Pendiente de auditoría y de dictamen MiFID II: vender fracciones
 * con valoración y rendimiento puede ser un instrumento financiero. Hasta que se
 * despliegue y se configure RWA_PRIMARY_SALE_ADDRESS (o
 * RWA_PRIMARY_SALE_INDUSTRIAL_ADDRESS), la venta responde 503
 * SALE_NOT_DEPLOYED; consultar y transferir funcionan ya.
 */

const { ethers } = require('ethers');
const polygon = require('./polygonReader');
const { FABRICAS, CATEGORIAS } = require('./rwaTokenization');

const BEZ = process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

const ASSET_TUPLE = 'tuple(string name, uint8 category, string legalDocumentCID, string imagesCID, uint256 totalSupply, '
    + 'uint256 valuationUSD, uint256 pricePerFraction, uint256 estimatedYield, address creator, string location, '
    + 'uint256 createdAt, bool isActive)';
const FACTORY_ABI = [
    `function getAsset(uint256 assetId) view returns (${ASSET_TUPLE})`,
    'function getCreatorAssets(address creator) view returns (uint256[])',
    'function assetCount() view returns (uint256)',
    'function isVerified(uint256 assetId, address investor) view returns (bool)',
    'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
    'function setApprovalForAll(address operator, bool approved)',
];
const SALE_ABI = [
    'function listings(uint256) view returns (uint256 assetId, address seller, uint256 pricePerFraction, uint256 remaining, bool active)',
    'function feeBps() view returns (uint16)',
    'function list(uint256 assetId, uint256 amount, uint256 pricePerFraction) returns (uint256)',
    'function buy(uint256 listingId, uint256 amount, uint256 maxPricePerFraction)',
];
const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];

/** Las que el factory protege con KYC: INMUEBLE, HOTEL, BARCO, HELICOPTERO. */
const ALTO_VALOR = new Set(['inmueble', 'hotel', 'barco', 'helicoptero']);
const ENV_VENTA = { activos: 'RWA_PRIMARY_SALE_ADDRESS', industrial: 'RWA_PRIMARY_SALE_INDUSTRIAL_ADDRESS' };

class RwaMarketError extends Error {
    constructor(message, code, status = 400) {
        super(message);
        this.name = 'RwaMarketError';
        this.code = code;
        this.status = status;
    }
}

function fabrica(id = 'activos') {
    if (!Object.prototype.hasOwnProperty.call(FABRICAS, id)) {
        throw new RwaMarketError(`Fábrica no válida. Admitidas: ${Object.keys(FABRICAS).join(', ')}.`, 'INVALID_FACTORY');
    }
    return FABRICAS[id].direccion;
}

function contratoVenta(id = 'activos', env = process.env) {
    fabrica(id);
    const dir = env[ENV_VENTA[id]] || '';
    if (!ethers.isAddress(dir)) {
        throw new RwaMarketError(
            'La venta primaria de fracciones todavía no está activa: el contrato está pendiente de auditoría y de dictamen.',
            'SALE_NOT_DEPLOYED', 503,
        );
    }
    return dir;
}

function entero(v, nombre, { min = 1 } = {}) {
    const s = String(v);
    if (!/^\d{1,30}$/.test(s) || BigInt(s) < BigInt(min)) {
        throw new RwaMarketError(`${nombre} tiene que ser un entero ≥ ${min}.`, 'INVALID_INPUT');
    }
    return BigInt(s);
}

function direccion(v, nombre) {
    if (!ethers.isAddress(v || '')) throw new RwaMarketError(`${nombre} tiene que ser una dirección EVM.`, 'INVALID_ADDRESS');
    return ethers.getAddress(v);
}

function bez(v, nombre) {
    if (!/^\d{1,15}(\.\d{1,18})?$/.test(String(v))) {
        throw new RwaMarketError(`${nombre} tiene que ser un importe en BEZ, decimal con punto.`, 'INVALID_AMOUNT');
    }
    const w = ethers.parseEther(String(v));
    if (w <= 0n) throw new RwaMarketError(`${nombre} tiene que ser mayor que cero.`, 'INVALID_AMOUNT');
    return w;
}

async function leerSeguro(dir, abi, fn, args) {
    try {
        return await polygon.leer(dir, abi, fn, args);
    } catch (err) {
        if (err.code === 'CALL_EXCEPTION' || /revert/i.test(err.message || '')) {
            throw new RwaMarketError('No existe en el contrato.', 'NOT_FOUND', 404);
        }
        throw new RwaMarketError('No se pudo leer Polygon. Inténtalo en unos minutos.', 'RPC_UNAVAILABLE', 503);
    }
}

function formatearActivo(id, a) {
    return {
        assetId: String(id),
        nombre: a.name,
        categoria: CATEGORIAS[Number(a.category)] || String(a.category),
        cidDocumentacion: a.legalDocumentCID,
        cidImagenes: a.imagesCID || null,
        fracciones: a.totalSupply.toString(),
        valoracionUsd: a.valuationUSD.toString(),
        precioFraccionBez: ethers.formatEther(a.pricePerFraction),
        rendimientoAnualPct: Number(a.estimatedYield) / 100,
        creador: a.creator,
        ubicacion: a.location,
        creado: new Date(Number(a.createdAt) * 1000).toISOString(),
        activo: a.isActive,
        requiereKyc: ALTO_VALOR.has(CATEGORIAS[Number(a.category)]),
    };
}

async function leerActivo({ fabrica: f = 'activos', assetId }) {
    const id = entero(assetId, 'assetId');
    const a = await leerSeguro(fabrica(f), FACTORY_ABI, 'getAsset', [id]);
    return { fabrica: f, contrato: fabrica(f), ...formatearActivo(id, a) };
}

async function activosDeCreador({ fabrica: f = 'activos', creador }) {
    const quien = direccion(creador, 'creador');
    const ids = await leerSeguro(fabrica(f), FACTORY_ABI, 'getCreatorAssets', [quien]);
    return { fabrica: f, creador: quien, assetIds: ids.map((x) => x.toString()) };
}

/** Transferencia de fracciones entre wallets (no es una venta: no hay precio ni pago). */
function prepararTransferencia({ fabrica: f = 'activos', assetId, desde, hacia, cantidad }) {
    const contrato = fabrica(f);
    const id = entero(assetId, 'assetId');
    const de = direccion(desde, 'desde');
    const a = direccion(hacia, 'hacia');
    if (de === a) throw new RwaMarketError('Origen y destino son la misma wallet.', 'INVALID_ADDRESS');
    const n = entero(cantidad, 'cantidad');
    return {
        red: { chainId: polygon.CHAIN_ID, nombre: 'Polygon' },
        transacciones: [{
            paso: 1,
            descripcion: `Transferir ${n} fracciones del activo ${id}.`,
            to: contrato, value: '0', chainId: polygon.CHAIN_ID,
            data: new ethers.Interface(FACTORY_ABI).encodeFunctionData('safeTransferFrom', [de, a, id, n, '0x']),
        }],
        aviso: 'En inmuebles, hoteles, barcos y helicópteros el contrato exige que el destino tenga KYC verificado '
            + 'si se transfiere el 10 % o más del activo; si no, la transacción revierte.',
        siguientePaso: 'Firma la transacción con la wallet de origen.',
    };
}

// ── Venta primaria ───────────────────────────────────────────────────────────

async function prepararOferta({ fabrica: f = 'activos', assetId, cantidad, precioFraccionBez, vendedor }) {
    const venta = contratoVenta(f);
    const contrato = fabrica(f);
    const id = entero(assetId, 'assetId');
    const n = entero(cantidad, 'cantidad');
    const precio = bez(precioFraccionBez, 'precioFraccionBez');
    const quien = direccion(vendedor, 'vendedor');
    const a = await leerSeguro(contrato, FACTORY_ABI, 'getAsset', [id]);
    if (ethers.getAddress(a.creator) !== quien) {
        throw new RwaMarketError('Sólo el creador del activo puede abrir su venta primaria.', 'NOT_CREATOR', 403);
    }
    if (!a.isActive) throw new RwaMarketError('El activo está desactivado.', 'ASSET_INACTIVE', 409);
    if (n > BigInt(a.totalSupply)) throw new RwaMarketError('No puedes ofrecer más fracciones de las que existen.', 'INVALID_INPUT');

    return {
        red: { chainId: polygon.CHAIN_ID, nombre: 'Polygon' },
        contratoVenta: venta,
        oferta: { assetId: id.toString(), fracciones: n.toString(), precioFraccionBez: ethers.formatEther(precio) },
        transacciones: [
            {
                paso: 1,
                descripcion: 'Autorizar al contrato de venta a entregar tus fracciones cuando alguien compre. No salen de tu wallet hasta entonces.',
                to: contrato, value: '0', chainId: polygon.CHAIN_ID,
                data: new ethers.Interface(FACTORY_ABI).encodeFunctionData('setApprovalForAll', [venta, true]),
            },
            {
                paso: 2,
                descripcion: 'Publicar la oferta (emite Listed con su listingId).',
                to: venta, value: '0', chainId: polygon.CHAIN_ID,
                data: new ethers.Interface(SALE_ABI).encodeFunctionData('list', [id, n, precio]),
            },
        ],
        siguientePaso: 'Firma las dos transacciones, en orden, con la wallet del creador del activo.',
    };
}

async function leerOferta({ fabrica: f = 'activos', listingId }) {
    const venta = contratoVenta(f);
    const id = entero(listingId, 'listingId');
    const l = await leerSeguro(venta, SALE_ABI, 'listings', [id]);
    if (l.seller === ethers.ZeroAddress) throw new RwaMarketError('No existe esa oferta.', 'NOT_FOUND', 404);
    return {
        listingId: id.toString(),
        assetId: l.assetId.toString(),
        vendedor: l.seller,
        precioFraccionBez: ethers.formatEther(l.pricePerFraction),
        disponibles: l.remaining.toString(),
        abierta: l.active,
    };
}

/**
 * `comprobarKyc` lee si el comprador está verificado para avisar antes de firmar.
 * Es un dato SOBRE esa wallet: sólo la REST, que acredita la titularidad, lo pide.
 * El MCP no puede (su api-key no tiene titular) y deja que lo compruebe el contrato.
 */
async function prepararCompra({ fabrica: f = 'activos', listingId, cantidad, comprador, comprobarKyc = true }) {
    const venta = contratoVenta(f);
    const contrato = fabrica(f);
    const lid = entero(listingId, 'listingId');
    const n = entero(cantidad, 'cantidad');
    const quien = direccion(comprador, 'comprador');

    const l = await leerSeguro(venta, SALE_ABI, 'listings', [lid]);
    if (l.seller === ethers.ZeroAddress) throw new RwaMarketError('No existe esa oferta.', 'NOT_FOUND', 404);
    if (!l.active || BigInt(l.remaining) < n) {
        throw new RwaMarketError(`La oferta está cerrada o no tiene ${n} fracciones disponibles.`, 'LISTING_CLOSED', 409);
    }
    const a = await leerSeguro(contrato, FACTORY_ABI, 'getAsset', [l.assetId]);
    if (!a.isActive) throw new RwaMarketError('El activo está desactivado.', 'ASSET_INACTIVE', 409);
    const categoria = CATEGORIAS[Number(a.category)];
    if (comprobarKyc && ALTO_VALOR.has(categoria)) {
        const verificado = await leerSeguro(contrato, FACTORY_ABI, 'isVerified', [l.assetId, quien]);
        if (!verificado) {
            throw new RwaMarketError(
                `Para comprar fracciones de un ${categoria} necesitas el KYC verificado para este activo.`,
                'KYC_REQUIRED', 409,
            );
        }
    }

    const precio = BigInt(l.pricePerFraction);
    const total = precio * n;
    return {
        red: { chainId: polygon.CHAIN_ID, nombre: 'Polygon' },
        contratoVenta: venta,
        compra: {
            listingId: lid.toString(), assetId: l.assetId.toString(), fracciones: n.toString(),
            precioFraccionBez: ethers.formatEther(precio), totalBez: ethers.formatEther(total),
        },
        transacciones: [
            {
                paso: 1,
                descripcion: `Autorizar al contrato de venta a cobrar ${ethers.formatEther(total)} BEZ.`,
                to: BEZ, value: '0', chainId: polygon.CHAIN_ID,
                data: new ethers.Interface(ERC20_ABI).encodeFunctionData('approve', [venta, total]),
            },
            {
                paso: 2,
                descripcion: 'Comprar: el BEZ va al emisor (menos la comisión) y las fracciones a tu wallet en la misma transacción.',
                to: venta, value: '0', chainId: polygon.CHAIN_ID,
                data: new ethers.Interface(SALE_ABI).encodeFunctionData('buy', [lid, n, precio]),
            },
        ],
        aviso: 'Comprar fracciones de un activo real conlleva riesgo de pérdida; la valoración y el rendimiento los declara el emisor.'
            + (ALTO_VALOR.has(categoria) ? ` En un ${categoria} el contrato exige KYC verificado para este activo: sin él la compra revierte.` : ''),
        siguientePaso: 'Firma las dos transacciones, en orden, con la wallet compradora. Necesita el BEZ y algo de POL para el gas.',
    };
}

module.exports = {
    leerActivo, activosDeCreador, prepararTransferencia,
    prepararOferta, leerOferta, prepararCompra,
    RwaMarketError, ALTO_VALOR,
};
