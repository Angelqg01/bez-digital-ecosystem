/**
 * lib/rwaOps.js — operaciones RWA del Gateway (/api/gateway/v1/rwa/…): venta primaria
 * de fracciones y reparto de rentas, y firma de las transacciones sin firmar que
 * devuelve. La API nunca firma ni mueve fondos: las firma la wallet conectada.
 *
 * Sin React ni wagmi: `runTransactions` recibe las funciones de envío, así que se
 * prueba sin navegador.
 */
import { keccak256, toBytes } from 'viem';
import http from '../services/http';

export const POLYGON_CHAIN_ID = 137;
const BASE = '/api/gateway/v1/rwa';

/** Mensajes para el usuario según el `code` que devuelve la API. */
const MENSAJES = {
    DISTRIBUTOR_NOT_DEPLOYED: 'El reparto de rentas todavía no está activo: el contrato aún no está desplegado en esta red.',
    SALE_NOT_DEPLOYED: 'La venta primaria todavía no está activa: el contrato aún no está desplegado en esta red.',
    NOT_CREATOR: 'Sólo la wallet que creó el activo puede hacer esto.',
    ASSET_INACTIVE: 'El activo está desactivado.',
    KYC_REQUIRED: 'Necesitas el KYC verificado para este activo.',
    ALREADY_CLAIMED: 'Esta wallet ya cobró este reparto.',
    CLAIM_WINDOW_CLOSED: 'El plazo para reclamar este reparto ha terminado.',
    LISTING_CLOSED: 'La oferta está cerrada o no tiene tantas fracciones disponibles.',
    NO_SHARE: 'Esta wallet no tenía fracciones en el bloque de corte de este reparto.',
    NO_HOLDERS: 'Ninguna fracción está en manos de otros titulares: no hay a quién repartir.',
    AMOUNT_TOO_SMALL: 'El importe es demasiado pequeño para repartirlo entre los titulares.',
    ROOT_NOT_REPRODUCIBLE: 'No se puede generar tu prueba desde aquí: la raíz publicada no sale de los saldos de la cadena. '
        + 'Si el reparto trae justificante, tu prueba está en él.',
    RANGE_TOO_LARGE: 'El activo es demasiado antiguo para recalcular el reparto ahora mismo. Inténtalo más tarde.',
    RPC_UNAVAILABLE: 'No se pudo leer Polygon. Inténtalo en unos minutos.',
    INVALID_AMOUNT: 'El importe no es válido.',
    INVALID_INPUT: 'Algún dato no es válido.',
    INVALID_CID: 'El CID del justificante no es válido.',
    NOT_FOUND: 'No existe.',
};

/** Texto legible de un error de la API (o de la wallet). */
export function mensajeDeError(err) {
    const code = err?.response?.data?.code;
    if (code && MENSAJES[code]) return MENSAJES[code];
    const status = err?.response?.status;
    if (status === 401) return 'Inicia sesión para continuar.';
    if (status === 403) {
        // El Gateway usa 403 tanto para un token inválido como para una wallet ajena.
        return /token|sso|expired|caduc/i.test(err?.response?.data?.error || '')
            ? 'Tu sesión ha caducado o no es válida. Vuelve a iniciar sesión.'
            : 'Esta wallet no es la de tu sesión.';
    }
    if (status === 429) return 'Demasiadas peticiones. Espera un momento.';
    if (err?.response?.data?.error) return err.response.data.error;
    // axios sin respuesta (API caída, CORS, sin red).
    if (err?.isAxiosError && !err.response) return 'No se pudo conectar con la API. Comprueba que está en marcha y que permite este origen.';
    // Errores de la wallet (viem/wagmi): el rechazo del usuario no es un fallo.
    if (err?.code === 4001 || /user rejected|rejected the request|denied transaction/i.test(err?.message || '')) {
        return 'Cancelaste la firma en la wallet.';
    }
    return err?.shortMessage || err?.message || 'Algo ha fallado.';
}

const datos = (res) => res.data;

/**
 * Wallet de la sesión: la del JWT (la única en cuyo nombre el Gateway prepara
 * nada), o la conectada si no hay claims legibles.
 */
export function sessionAddress(fallback = null) {
    try {
        const t = localStorage.getItem('bezhas-jwt');
        if (t && !t.startsWith('demo-')) {
            const claims = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            const a = claims.address || claims.wallet_address || claims.primary_wallet_address;
            if (typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a)) return a;
        }
    } catch { /* no es un JWT legible */ }
    return fallback;
}

/**
 * Precio real del BEZ en USD (0,0075 en la fase semilla; no es de mercado), del
 * oráculo público del Gateway. null si no responde: sin precio no se enseña ninguna equivalencia.
 */
export async function fetchPrecioBez() {
    try {
        const { data } = await http.get('/api/gateway/v1/oracle/token-prices');
        const p = Number(data?.price ?? data?.bezCoinPriceUSD);
        return Number.isFinite(p) && p > 0 ? p : null;
    } catch {
        return null;
    }
}

// ── Activos ──────────────────────────────────────────────────────────────────

export const activosDeCreador = async ({ fabrica = 'activos', address }) => datos(await http.get(`${BASE}/${fabrica}/creators/${address}`));
export const leerActivo = async ({ fabrica = 'activos', assetId }) => datos(await http.get(`${BASE}/${fabrica}/assets/${assetId}`)).activo;

// ── Venta primaria ───────────────────────────────────────────────────────────

export const leerOferta = async ({ fabrica = 'activos', listingId }) => datos(await http.get(`${BASE}/${fabrica}/sale/listings/${listingId}`)).oferta;
export const prepararOferta = async (cuerpo) => datos(await http.post(`${BASE}/sale/list/prepare`, cuerpo));
export const prepararCompra = async (cuerpo) => datos(await http.post(`${BASE}/sale/buy/prepare`, cuerpo));

const TOPIC_LISTED = keccak256(toBytes('Listed(uint256,uint256,address,uint256,uint256)'));

/** id de la oferta que acaba de publicar un `list` (evento Listed del recibo), o null. */
export function idDeOfertaDeRecibo(recibo, contratoVenta) {
    const log = (recibo?.logs || []).find((l) => l.topics?.[0] === TOPIC_LISTED
        && l.address?.toLowerCase() === String(contratoVenta).toLowerCase());
    return log ? BigInt(log.topics[1]).toString() : null;
}

// ── Rentas ───────────────────────────────────────────────────────────────────

/** Repartos de un activo. Con `cuenta` añade «lo mío» (la API exige que la wallet sea la de la sesión). */
export const repartosDeActivo = async ({ fabrica = 'activos', assetId, cuenta }) =>
    datos(await http.get(`${BASE}/${fabrica}/assets/${assetId}/rent/distributions`, { params: cuenta ? { cuenta } : undefined }));
export const prepararReparto = async (cuerpo) => datos(await http.post(`${BASE}/rent/distribute/prepare`, cuerpo));
export const prepararReclamo = async (cuerpo) => datos(await http.post(`${BASE}/rent/claim/prepare`, cuerpo));

// ── Firma ────────────────────────────────────────────────────────────────────

/**
 * Firma y envía las transacciones EN ORDEN, esperando cada recibo antes de la
 * siguiente (el reparto y la compra necesitan el `approve` minado antes).
 * Exige que la wallet tenga activa la cuenta de la sesión: es la única en cuyo
 * nombre el Gateway prepara nada. `onProgress` en 'hecho' lleva el `recibo`.
 *
 * @returns {Promise<string[]>} hashes, en el orden de las transacciones
 */
export async function runTransactions(transacciones, { cuentaWallet, cuentaSesion, chainId, switchChain, sendTransaction, waitForReceipt, onProgress = () => {} }) {
    if (!Array.isArray(transacciones) || transacciones.length === 0) throw new Error('No hay transacciones que firmar.');
    if (String(cuentaWallet || '').toLowerCase() !== String(cuentaSesion || '').toLowerCase()) {
        throw new Error(`Tu wallet tiene activa otra cuenta. Cambia a ${String(cuentaSesion).slice(0, 6)}…${String(cuentaSesion).slice(-4)} para firmar.`);
    }
    const destino = transacciones[0].chainId || POLYGON_CHAIN_ID;
    if (chainId !== destino) await switchChain(destino);

    const ordenadas = [...transacciones].sort((a, b) => a.paso - b.paso);
    const hashes = [];
    for (const tx of ordenadas) {
        const info = { paso: tx.paso, total: ordenadas.length, descripcion: tx.descripcion };
        onProgress({ ...info, estado: 'firmando' });
        const hash = await sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value || '0'), chainId: tx.chainId });
        onProgress({ ...info, estado: 'confirmando', hash });
        const recibo = await waitForReceipt(hash);
        if (recibo?.status && recibo.status !== 'success') {
            throw new Error(`La transacción del paso ${tx.paso} falló en la cadena.`);
        }
        hashes.push(hash);
        onProgress({ ...info, estado: 'hecho', hash, recibo });
    }
    return hashes;
}

/** Descarga el justificante (lista con pruebas) para fijarlo en IPFS. */
export function descargarJustificante(justificante, nombre = 'justificante-reparto.json') {
    const blob = new Blob([JSON.stringify(justificante, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
}

export const urlTx = (hash) => `https://polygonscan.com/tx/${hash}`;
