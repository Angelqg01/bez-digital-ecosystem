'use strict';

/**
 * services/bezSwap.js — compraventa de BEZ-Coin en un DEX, SIN CUSTODIA.
 *
 * Prepara las transacciones SIN FIRMAR para que el titular cambie BEZ por la
 * moneda de cotización (venta) o al revés (compra) contra un router tipo
 * Uniswap V2 (QuickSwap V2 y compatibles) en Polygon. BeZhas no firma, no
 * envía y no toca los fondos: la operación ocurre entre la wallet del cliente y
 * el pool. Por eso no es un servicio de cambio por cuenta de terceros.
 *
 * Inactivo mientras no haya un pool: hoy BEZ no tiene liquidez en ningún DEX
 * (el precio es el fijo de la fase semilla, config/bez-price.js). Se activa
 * configurando BEZ_DEX_ROUTER (y, si no es USDC, BEZ_DEX_QUOTE_TOKEN y
 * BEZ_DEX_QUOTE_DECIMALS). Sin router, todo responde 503 DEX_NOT_CONFIGURED;
 * con router y sin pool o sin liquidez, 409 NO_LIQUIDITY.
 *
 * La compra de BEZ a BeZhas (fase semilla, con tarjeta/SEPA/cripto) es otra
 * cosa y va por BEZ-Pay (services/bezPayOrders.js); esto sólo cubre el mercado.
 */

const { ethers } = require('ethers');
const polygon = require('./polygonReader');

const BEZ = process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const USDC_POLYGON = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

const ROUTER_ABI = [
    'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
    'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
];
const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];

const DESLIZAMIENTO_POR_DEFECTO_BPS = 100; // 1 %
const DESLIZAMIENTO_MAX_BPS = 500;         // 5 %: más es casi siempre un error
const PLAZO_MIN = 20;

class SwapError extends Error {
    constructor(message, code, status = 400) {
        super(message);
        this.name = 'SwapError';
        this.code = code;
        this.status = status;
    }
}

/** Configuración leída en cada llamada: activar el DEX no exige reiniciar el código, sólo el entorno. */
function config(env = process.env) {
    const router = env.BEZ_DEX_ROUTER || '';
    return {
        activo: ethers.isAddress(router),
        router,
        nombre: env.BEZ_DEX_NAME || 'DEX (router Uniswap V2)',
        bez: BEZ,
        cotizacion: env.BEZ_DEX_QUOTE_TOKEN || USDC_POLYGON,
        simbolo: env.BEZ_DEX_QUOTE_SYMBOL || 'USDC',
        decimales: parseInt(env.BEZ_DEX_QUOTE_DECIMALS || '6', 10),
    };
}

function estado() {
    const c = config();
    return {
        activo: c.activo,
        red: { chainId: polygon.CHAIN_ID, nombre: 'Polygon' },
        dex: c.activo ? { nombre: c.nombre, router: c.router } : null,
        par: { base: 'BEZ', cotizacion: c.simbolo, bez: c.bez, tokenCotizacion: c.cotizacion },
        nota: c.activo
            ? 'Swap no custodio: firmas tú, el intercambio ocurre entre tu wallet y el pool.'
            : 'BEZ todavía no tiene pool con liquidez en un DEX. La compra a BeZhas en la fase semilla va por BEZ-Pay.',
    };
}

function exigirActivo() {
    const c = config();
    if (!c.activo) {
        throw new SwapError(
            'El mercado de BEZ todavía no está abierto: no hay pool con liquidez configurado. '
            + 'Para comprar BEZ en la fase semilla usa BEZ-Pay.',
            'DEX_NOT_CONFIGURED', 503,
        );
    }
    return c;
}

/** compra = cotización → BEZ; venta = BEZ → cotización. */
function ruta(c, lado) {
    if (lado === 'venta') return { entra: { token: c.bez, simbolo: 'BEZ', decimales: 18 }, sale: { token: c.cotizacion, simbolo: c.simbolo, decimales: c.decimales } };
    if (lado === 'compra') return { entra: { token: c.cotizacion, simbolo: c.simbolo, decimales: c.decimales }, sale: { token: c.bez, simbolo: 'BEZ', decimales: 18 } };
    throw new SwapError('lado tiene que ser «compra» o «venta».', 'INVALID_SIDE');
}

function aUnidades(importe, decimales) {
    if (!/^\d{1,15}(\.\d{1,18})?$/.test(String(importe))) {
        throw new SwapError('El importe tiene que ser un decimal en texto, con punto.', 'INVALID_AMOUNT');
    }
    let v;
    try {
        v = ethers.parseUnits(String(importe), decimales);
    } catch {
        throw new SwapError(`El importe admite como mucho ${decimales} decimales.`, 'INVALID_AMOUNT');
    }
    if (v <= 0n) throw new SwapError('El importe tiene que ser mayor que cero.', 'INVALID_AMOUNT');
    return v;
}

async function cotizarUnidades(c, r, cantidad) {
    let amounts;
    try {
        amounts = await polygon.leer(c.router, ROUTER_ABI, 'getAmountsOut', [cantidad, [r.entra.token, r.sale.token]]);
    } catch (err) {
        // El router revierte si no existe el par o no hay reservas; cualquier otra cosa es la red.
        if (err.code === 'CALL_EXCEPTION' || /revert/i.test(err.message || '')) {
            throw new SwapError(`No hay pool o liquidez suficiente para ${r.entra.simbolo}→${r.sale.simbolo}.`, 'NO_LIQUIDITY', 409);
        }
        throw new SwapError('No se pudo consultar el DEX en Polygon. Inténtalo en unos minutos.', 'DEX_UNAVAILABLE', 503);
    }
    const salida = BigInt(amounts[amounts.length - 1]);
    if (salida === 0n) throw new SwapError('El pool no tiene liquidez para ese importe.', 'NO_LIQUIDITY', 409);
    return salida;
}

async function cotizar({ lado, importe }) {
    const c = exigirActivo();
    const r = ruta(c, lado);
    const cantidad = aUnidades(importe, r.entra.decimales);
    const salida = await cotizarUnidades(c, r, cantidad);
    return {
        lado,
        entregas: { activo: r.entra.simbolo, importe: ethers.formatUnits(cantidad, r.entra.decimales) },
        recibes: { activo: r.sale.simbolo, importe: ethers.formatUnits(salida, r.sale.decimales) },
        dex: c.nombre,
        aviso: 'Cotización orientativa del pool en este bloque; el precio final lo fija la ejecución.',
    };
}

async function prepararSwap({ lado, importe, wallet, deslizamientoBps = DESLIZAMIENTO_POR_DEFECTO_BPS, plazoMin = PLAZO_MIN }) {
    const c = exigirActivo();
    const r = ruta(c, lado);
    if (!ethers.isAddress(wallet || '')) throw new SwapError('wallet tiene que ser una dirección EVM.', 'INVALID_WALLET');
    const slip = Number(deslizamientoBps);
    if (!Number.isInteger(slip) || slip < 1 || slip > DESLIZAMIENTO_MAX_BPS) {
        throw new SwapError(`El deslizamiento va de 1 a ${DESLIZAMIENTO_MAX_BPS} puntos básicos.`, 'INVALID_SLIPPAGE');
    }
    const minutos = Number(plazoMin);
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 60) {
        throw new SwapError('El plazo va de 1 a 60 minutos.', 'INVALID_DEADLINE');
    }

    const cantidad = aUnidades(importe, r.entra.decimales);
    const salida = await cotizarUnidades(c, r, cantidad);
    const minimo = (salida * BigInt(10_000 - slip)) / 10_000n;
    const limite = BigInt(Math.floor(Date.now() / 1000) + minutos * 60);
    const router = new ethers.Interface(ROUTER_ABI);
    const erc20 = new ethers.Interface(ERC20_ABI);

    return {
        lado,
        red: { chainId: polygon.CHAIN_ID, nombre: 'Polygon' },
        dex: { nombre: c.nombre, router: c.router },
        entregas: { activo: r.entra.simbolo, importe: ethers.formatUnits(cantidad, r.entra.decimales) },
        recibesEstimado: { activo: r.sale.simbolo, importe: ethers.formatUnits(salida, r.sale.decimales) },
        recibesMinimo: { activo: r.sale.simbolo, importe: ethers.formatUnits(minimo, r.sale.decimales) },
        deslizamientoBps: slip,
        caduca: new Date(Number(limite) * 1000).toISOString(),
        transacciones: [
            {
                paso: 1,
                descripcion: `Autorizar al router a usar ${ethers.formatUnits(cantidad, r.entra.decimales)} ${r.entra.simbolo}.`,
                to: r.entra.token, value: '0', chainId: polygon.CHAIN_ID,
                data: erc20.encodeFunctionData('approve', [c.router, cantidad]),
            },
            {
                paso: 2,
                descripcion: `Cambiar ${r.entra.simbolo} por ${r.sale.simbolo}; revierte si recibes menos del mínimo.`,
                to: c.router, value: '0', chainId: polygon.CHAIN_ID,
                data: router.encodeFunctionData('swapExactTokensForTokens', [cantidad, minimo, [r.entra.token, r.sale.token], wallet, limite]),
            },
        ],
        siguientePaso: 'Firma las dos transacciones, en orden, con la wallet indicada. BeZhas no puede firmarlas ni mover tus fondos.',
    };
}

module.exports = { estado, cotizar, prepararSwap, SwapError, config, DESLIZAMIENTO_MAX_BPS };
