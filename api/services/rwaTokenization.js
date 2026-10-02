'use strict';

/**
 * services/rwaTokenization.js — preparar la tokenización de un activo real.
 *
 * Construye las dos transacciones SIN FIRMAR que crea el asistente de
 * www.bezhas.com/rwa: aprobar la comisión en BEZ y llamar a
 * `tokenizeAsset` del RWAFactory de Polygon. No firma, no envía y no guarda
 * nada: las firma la wallet del dueño del activo. Por eso el MCP puede
 * ofrecerla sin aprobación por llamada.
 *
 * El contrato es el que usa hoy la web (0xa7e6…0d9A, confirmado por Yoel el
 * 2026-10-02). `smart-contracts/deployments/137.json` registra otro RWAFactory
 * (0x5F99…CCc0) con el mismo código; no se toca hasta decidir cuál queda.
 *
 * La comisión se lee del contrato en cada preparación (con caché corta): si
 * el owner la cambia, la aprobación que se prepara cambia con ella. Mostrar
 * una cifra fija haría fallar la segunda transacción sin explicar por qué.
 */

const { ethers } = require('ethers');
const { urlsParaCadena } = require('./rpcQuorum');

const CHAIN_ID = 137;
const FACTORY = process.env.RWA_FACTORY_ADDRESS || '0xa7e6656eFA45EB59ca247aa15F883330692C0d9A';
const BEZ = process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

const FACTORY_ABI = [
    'function tokenizationFee() view returns (uint256)',
    'function tokenizeAsset(string name, uint8 category, string legalCID, string imagesCID, uint256 supply, uint256 valuationUSD, uint256 pricePerFraction, uint256 estimatedYield, string location) returns (uint256)',
];
const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];

/** Mismo orden que ASSET_CATEGORIES del contrato y de la web. */
const CATEGORIAS = Object.freeze(['inmueble', 'hotel', 'local', 'ropa', 'coche', 'barco', 'helicoptero', 'objeto']);

/** CIDv0 (Qm…, base58) o CIDv1 en base32 (b…). Sólo el CID, sin `ipfs://`. */
const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,100})$/;

const CACHE_MS = 10 * 60_000;
let cacheComision = null;

class TokenizationError extends Error {
    constructor(message, code, status = 400) {
        super(message);
        this.name = 'TokenizationError';
        this.code = code;
        this.status = status;
    }
}

async function leerComisionDeCadena() {
    const url = urlsParaCadena(CHAIN_ID)[0] || 'https://polygon-rpc.com';
    const provider = new ethers.JsonRpcProvider(url, CHAIN_ID, { staticNetwork: true });
    const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
    let t;
    try {
        return await Promise.race([
            factory.tokenizationFee(),
            new Promise((_, rej) => { t = setTimeout(() => rej(new Error('RPC sin respuesta')), 8_000); }),
        ]);
    } finally {
        clearTimeout(t);
    }
}

/** Inyectable en las pruebas: no se depende de la red para probar la forma. */
let lectorComision = leerComisionDeCadena;

async function comision() {
    if (cacheComision && Date.now() - cacheComision.t < CACHE_MS) return cacheComision.valor;
    let valor;
    try {
        valor = await lectorComision();
    } catch (_) {
        throw new TokenizationError(
            'No se pudo leer la comisión del contrato de tokenización en Polygon. Inténtalo en unos minutos.',
            'FEE_UNAVAILABLE', 503,
        );
    }
    cacheComision = { valor, t: Date.now() };
    return valor;
}

function validar(e) {
    if (!CATEGORIAS.includes(e.categoria)) {
        throw new TokenizationError(`Categoría no válida. Admitidas: ${CATEGORIAS.join(', ')}.`, 'INVALID_CATEGORY');
    }
    if (!CID_RE.test(e.cidDocumentacion)) {
        throw new TokenizationError(
            'La documentación legal tiene que estar ya subida a IPFS: indica su CID (Qm… o b…), sin «ipfs://».',
            'INVALID_LEGAL_CID',
        );
    }
    if (e.cidImagenes && !CID_RE.test(e.cidImagenes)) {
        throw new TokenizationError('El CID de las imágenes no es válido.', 'INVALID_IMAGES_CID');
    }
}

/**
 * Prepara la tokenización. Devuelve las transacciones en el orden en que
 * hay que firmarlas.
 */
async function prepararTokenizacion(e) {
    validar(e);
    const fee = await comision();
    const factory = new ethers.Interface(FACTORY_ABI);
    const erc20 = new ethers.Interface(ERC20_ABI);
    const precio = ethers.parseEther(e.precioFraccionBez);
    // La web guarda el rendimiento en puntos básicos (8,5 % → 850).
    const rendimientoBps = Math.round(Number(e.rendimientoAnualPct) * 100);

    return {
        red: { chainId: CHAIN_ID, nombre: 'Polygon' },
        contrato: FACTORY,
        comisionBez: ethers.formatEther(fee),
        activo: {
            nombre: e.nombre, categoria: e.categoria, ubicacion: e.ubicacion,
            fracciones: e.fracciones, valoracionUsd: e.valoracionUsd,
            precioFraccionBez: e.precioFraccionBez, rendimientoAnualPct: e.rendimientoAnualPct,
            capitalTotalBez: ethers.formatEther(precio * BigInt(e.fracciones)),
            valorFraccionUsd: Math.round((e.valoracionUsd / e.fracciones) * 100) / 100,
        },
        transacciones: [
            {
                paso: 1,
                descripcion: `Autorizar al contrato de tokenización a cobrar la comisión de ${ethers.formatEther(fee)} BEZ.`,
                to: BEZ, value: '0', chainId: CHAIN_ID,
                data: erc20.encodeFunctionData('approve', [FACTORY, fee]),
            },
            {
                paso: 2,
                descripcion: 'Crear el activo tokenizado (emite el evento AssetTokenized con su assetId).',
                to: FACTORY, value: '0', chainId: CHAIN_ID,
                data: factory.encodeFunctionData('tokenizeAsset', [
                    e.nombre, CATEGORIAS.indexOf(e.categoria), e.cidDocumentacion, e.cidImagenes || '',
                    BigInt(e.fracciones), BigInt(e.valoracionUsd), precio, BigInt(rendimientoBps), e.ubicacion,
                ]),
            },
        ],
        siguientePaso: 'Firma las dos transacciones, en orden, con la wallet del titular del activo en Polygon. '
            + 'La wallet necesita la comisión en BEZ y algo de POL para el gas. Ni BeZhas ni tu IA pueden firmarlas por ti.',
        aviso: 'La tokenización refleja el activo en la cadena; no crea el derecho sobre él. La documentación legal tiene que respaldar la valoración.',
    };
}

module.exports = {
    prepararTokenizacion, TokenizationError, CATEGORIAS, FACTORY, CHAIN_ID,
    _setLectorComision: (fn) => { lectorComision = fn || leerComisionDeCadena; cacheComision = null; },
};
