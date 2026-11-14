/**
 * Reparto de rentas de activos RWA: cliente del Gateway
 * (/api/gateway/v1/rwa/…) y firma de las transacciones sin firmar que devuelve.
 *
 * La API nunca firma ni mueve fondos: calcula quién cobra qué y devuelve las
 * transacciones; las firma la wallet del navegador (Polygon). Sin React: la firma
 * recibe sus dependencias, así se prueba sin wallet.
 */
import { id as keccakId } from 'ethers';
import { apiFetch, ApiError } from './api';
import { getBrowserSigner } from './contracts';

export const POLYGON_CHAIN_ID = 137;
const BASE = '/api/rwa';

export type Fabrica = 'activos' | 'industrial';

export interface Transaccion {
    paso: number;
    descripcion: string;
    to: string;
    data: string;
    value?: string;
    chainId: number;
}

export interface Activo {
    assetId: string;
    nombre: string;
    fracciones: string;
    precioFraccionBez?: string;
    precioFraccionUsd?: string;
    activo: boolean;
}

export interface Reparto {
    distributionId: string;
    assetId: string;
    emisor: string;
    token: string;
    importe: string;
    importeUsd?: string;
    sinReclamar: string;
    plazoReclamo: string;
    abierto: boolean;
    detallesCID: string | null;
    /** Sólo con `cuenta`: */
    yaCobrado?: boolean;
    miParte?: string | null;
    miParteUsd?: string | null;
    motivoSinParte?: string | null;
}

export interface PropuestaReparto {
    reparto: {
        titulares: number;
        importe: string;
        comision: string;
        totalAPagar: string;
        importeUsd?: string;
        totalAPagarUsd?: string;
        restoSinAsignar: string;
        bloqueDeCorte: number;
        raiz: string;
        token: string;
        plazoReclamo: string;
    };
    justificante: unknown;
    aviso?: string;
    transacciones: Transaccion[];
}

export interface PropuestaCobro {
    cobro: { importe: string; token: string };
    transacciones: Transaccion[];
}

export interface Recibo {
    status?: string | number | null;
    logs?: ReadonlyArray<{ address: string; topics: ReadonlyArray<string> }>;
}

export interface Progreso {
    paso: number;
    total: number;
    descripcion: string;
    estado: 'firmando' | 'confirmando' | 'hecho';
    hash?: string;
    /** Sólo en 'hecho'. */
    recibo?: Recibo;
}

export interface Oferta {
    listingId: string;
    assetId: string;
    vendedor: string;
    precioFraccionBez: string;
    precioFraccionUsd?: string;
    disponibles: string;
    abierta: boolean;
}

export interface PropuestaOferta {
    contratoVenta: string;
    oferta: { assetId: string; fracciones: string; precioFraccionBez: string; precioFraccionUsd?: string; totalUsd?: string };
    transacciones: Transaccion[];
}

export interface PropuestaCompra {
    compra: { listingId: string; assetId: string; fracciones: string; precioFraccionBez: string; totalBez: string };
    transacciones: Transaccion[];
}

/** Mensajes para el usuario según el `code` que devuelve la API. */
const MENSAJES: Record<string, string> = {
    DISTRIBUTOR_NOT_DEPLOYED: 'El reparto de rentas todavía no está activo: el contrato aún no está desplegado en esta red.',
    SALE_NOT_DEPLOYED: 'La venta primaria todavía no está activa: el contrato aún no está desplegado en esta red.',
    LISTING_CLOSED: 'La oferta está cerrada o no tiene tantas fracciones disponibles.',
    NOT_CREATOR: 'Sólo la wallet que creó el activo puede hacer esto.',
    ASSET_INACTIVE: 'El activo está desactivado.',
    KYC_REQUIRED: 'Necesitas el KYC verificado para este activo antes de cobrar.',
    ALREADY_CLAIMED: 'Esta wallet ya cobró este reparto.',
    CLAIM_WINDOW_CLOSED: 'El plazo para reclamar este reparto ha terminado.',
    NO_SHARE: 'Esta wallet no tenía fracciones en el bloque de corte de este reparto.',
    NO_HOLDERS: 'Ninguna fracción está en manos de otros titulares: no hay a quién repartir.',
    AMOUNT_TOO_SMALL: 'El importe es demasiado pequeño para repartirlo entre los titulares.',
    ROOT_NOT_REPRODUCIBLE: 'No se puede generar tu prueba desde aquí: la raíz publicada no sale de los saldos de la cadena. '
        + 'Si el reparto trae justificante, tu prueba está en él.',
    RANGE_TOO_LARGE: 'El activo es demasiado antiguo para recalcular el reparto ahora mismo. Inténtalo más tarde.',
    RPC_UNAVAILABLE: 'No se pudo leer Polygon. Inténtalo en unos minutos.',
    INVALID_AMOUNT: 'El importe no es válido para este token.',
    INVALID_INPUT: 'Algún dato no es válido.',
    INVALID_CID: 'El CID del justificante no es válido.',
    NOT_FOUND: 'No existe.',
};

/** Texto legible de un error de la API o de la wallet. */
export function mensajeDeError(err: unknown): string {
    const e = err as { code?: string | number; status?: number; message?: string; shortMessage?: string; info?: { error?: { code?: number } } };
    if (err instanceof ApiError || (typeof e?.status === 'number' && typeof e?.code !== 'number')) {
        if (typeof e.code === 'string' && MENSAJES[e.code]) return MENSAJES[e.code];
        if (e.status === 403) {
            // El Gateway usa 403 tanto para un token inválido como para una wallet ajena.
            return /token|sso|expired|caduc/i.test(e.message || '')
                ? 'Tu sesión ha caducado o no es válida. Vuelve a iniciar sesión.'
                : 'Esta wallet no es la de tu sesión.';
        }
        if (e.status === 429) return 'Demasiadas peticiones. Espera un momento.';
        return e.message || 'Algo ha fallado.';
    }
    // fetch sin respuesta (API caída, CORS, sin red): el navegador sólo dice «Failed to fetch».
    if (err instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(e?.message || '')) {
        return 'No se pudo conectar con la API. Comprueba que está en marcha y que permite este origen.';
    }
    // Wallet: el rechazo del usuario no es un fallo.
    if (e?.code === 4001 || e?.code === 'ACTION_REJECTED' || e?.info?.error?.code === 4001
        || /user rejected|rejected the request|denied transaction/i.test(e?.message || '')) {
        return 'Cancelaste la firma en la wallet.';
    }
    return e?.shortMessage || e?.message || 'Algo ha fallado.';
}

// ── Cliente ──────────────────────────────────────────────────────────────────

export const activosDeCreador = (fabrica: Fabrica, address: string) =>
    apiFetch<{ assetIds: string[] }>(`${BASE}/${fabrica}/creators/${address}`);

export const leerActivo = async (fabrica: Fabrica, assetId: string) =>
    (await apiFetch<{ activo: Activo }>(`${BASE}/${fabrica}/assets/${assetId}`)).activo;

/** Repartos de un activo. Con `cuenta` añade «lo mío» (la API exige que la wallet sea la de la sesión). */
export const repartosDeActivo = (fabrica: Fabrica, assetId: string, cuenta?: string) =>
    apiFetch<{ repartos: Reparto[] }>(
        `${BASE}/${fabrica}/assets/${assetId}/rent/distributions${cuenta ? `?cuenta=${cuenta}` : ''}`,
    );

export interface CuerpoReparto {
    fabrica: Fabrica;
    assetId: number;
    emisor: string;
    token: string;
    importe: string;
    plazoDias: number;
    detallesCID?: string;
}

export const prepararReparto = (cuerpo: CuerpoReparto) =>
    apiFetch<PropuestaReparto>(`${BASE}/rent/distribute/prepare`, { method: 'POST', body: JSON.stringify(cuerpo) });

export const prepararReclamo = (cuerpo: { fabrica: Fabrica; distributionId: number; cuenta: string }) =>
    apiFetch<PropuestaCobro>(`${BASE}/rent/claim/prepare`, { method: 'POST', body: JSON.stringify(cuerpo) });

// ── Venta primaria ───────────────────────────────────────────────────────────

export const leerOferta = async (fabrica: Fabrica, listingId: string) =>
    (await apiFetch<{ oferta: Oferta }>(`${BASE}/${fabrica}/sale/listings/${listingId}`)).oferta;

export const prepararOferta = (cuerpo: { fabrica: Fabrica; assetId: number; cantidad: number; precioFraccionBez: string; vendedor: string }) =>
    apiFetch<PropuestaOferta>(`${BASE}/sale/list/prepare`, { method: 'POST', body: JSON.stringify(cuerpo) });

export const prepararCompra = (cuerpo: { fabrica: Fabrica; listingId: number; cantidad: number; comprador: string }) =>
    apiFetch<PropuestaCompra>(`${BASE}/sale/buy/prepare`, { method: 'POST', body: JSON.stringify(cuerpo) });

const TOPIC_LISTED = keccakId('Listed(uint256,uint256,address,uint256,uint256)');

/** Número de la oferta que acaba de publicar un `list` (evento Listed del recibo), o null. */
export function idDeOfertaDeRecibo(recibo: Recibo | null | undefined, contratoVenta: string): string | null {
    const log = recibo?.logs?.find((l) => l.topics?.[0] === TOPIC_LISTED && l.address?.toLowerCase() === contratoVenta.toLowerCase());
    return log ? BigInt(log.topics[1]).toString() : null;
}

// ── Firma ────────────────────────────────────────────────────────────────────

export interface DepsFirma {
    /** Cuenta que tiene activa la wallet. */
    cuentaWallet: string;
    /** Cuenta de la sesión: la única en cuyo nombre la API prepara nada. */
    cuentaSesion: string;
    chainId: number;
    switchChain: (chainId: number) => Promise<unknown>;
    sendTransaction: (tx: { to: string; data: string; value: bigint; chainId: number }) => Promise<string>;
    waitForReceipt: (hash: string) => Promise<Recibo | null>;
    onProgress?: (e: Progreso) => void;
}

/**
 * Firma y envía las transacciones EN ORDEN, esperando cada recibo antes de la
 * siguiente (el reparto necesita el `approve` minado antes del depósito).
 * Devuelve los hashes en el orden de las transacciones.
 */
export async function runTransactions(transacciones: Transaccion[], deps: DepsFirma): Promise<string[]> {
    if (!Array.isArray(transacciones) || transacciones.length === 0) throw new Error('No hay transacciones que firmar.');
    const { cuentaWallet, cuentaSesion, chainId, switchChain, sendTransaction, waitForReceipt, onProgress = () => {} } = deps;
    if (cuentaWallet.toLowerCase() !== cuentaSesion.toLowerCase()) {
        throw new Error(`Tu wallet tiene activa otra cuenta. Cambia a ${cuentaSesion.slice(0, 6)}…${cuentaSesion.slice(-4)} para firmar.`);
    }
    const destino = transacciones[0].chainId || POLYGON_CHAIN_ID;
    if (chainId !== destino) await switchChain(destino);

    const ordenadas = [...transacciones].sort((a, b) => a.paso - b.paso);
    const hashes: string[] = [];
    for (const tx of ordenadas) {
        const info = { paso: tx.paso, total: ordenadas.length, descripcion: tx.descripcion };
        onProgress({ ...info, estado: 'firmando' });
        const hash = await sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value || '0'), chainId: tx.chainId });
        onProgress({ ...info, estado: 'confirmando', hash });
        const recibo = await waitForReceipt(hash);
        // ethers: status 1 = éxito; otros clientes devuelven 'success'.
        if (recibo && recibo.status != null && recibo.status !== 1 && recibo.status !== 'success') {
            throw new Error(`La transacción del paso ${tx.paso} falló en la cadena.`);
        }
        hashes.push(hash);
        onProgress({ ...info, estado: 'hecho', hash, recibo: recibo ?? undefined });
    }
    return hashes;
}

/** Firma con la wallet del navegador (ethers + `window.ethereum`), exigiendo la cuenta de la sesión. */
export async function firmarConWallet(
    transacciones: Transaccion[],
    cuentaSesion: string,
    onProgress?: (e: Progreso) => void,
): Promise<string[]> {
    const signer = await getBrowserSigner();
    const provider = signer.provider;
    return runTransactions(transacciones, {
        cuentaWallet: await signer.getAddress(),
        cuentaSesion,
        chainId: Number((await provider.getNetwork()).chainId),
        switchChain: (id) => provider.send('wallet_switchEthereumChain', [{ chainId: `0x${id.toString(16)}` }]),
        sendTransaction: async (tx) => (await signer.sendTransaction(tx)).hash,
        waitForReceipt: (hash) => provider.waitForTransaction(hash),
        onProgress,
    });
}

/** Descarga el justificante (lista con pruebas) para fijarlo en IPFS. */
export function descargarJustificante(justificante: unknown, nombre = 'justificante-reparto.json') {
    const blob = new Blob([JSON.stringify(justificante, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
}

export const urlTx = (hash: string) => `https://polygonscan.com/tx/${hash}`;
