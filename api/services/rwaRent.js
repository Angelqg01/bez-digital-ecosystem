'use strict';

/**
 * services/rwaRent.js — reparto de rentas de un activo RWA a los titulares de
 * sus fracciones (contrato RWARentDistributor, smart-contracts/src/finance).
 *
 * Igual que rwaMarket.js, todo devuelve transacciones SIN FIRMAR: las firma la
 * wallet del emisor (crear el reparto) o del titular (cobrar). BeZhas nunca
 * tiene el dinero de nadie ni guarda nada.
 *
 * Cómo se sabe quién cobra qué: el RWAFactory desplegado no tiene snapshots, así
 * que se lee de Polygon cada TransferSingle/TransferBatch del factory hasta el
 * bloque de corte, se reconstruyen los saldos y se reparte a prorrata
 * (rwaRentTree.js). Es reproducible por cualquiera con los mismos eventos.
 *
 * Política fija, para que el titular pueda cobrar sin que BeZhas guarde la
 * lista: las fracciones que conserva el emisor NO cobran (son las que no ha
 * vendido); su parte se reparte entre los demás. El importe y el bloque de corte
 * están en el contrato, así que quien cobra recalcula el árbol y comprueba que
 * su raíz es la que el emisor publicó.
 *
 * Auditoría y dictamen MiFID II dados por resueltos por Yoel (2026-11-13). Falta
 * desplegar el contrato y configurar RWA_RENT_DISTRIBUTOR_ADDRESS (o
 * RWA_RENT_DISTRIBUTOR_INDUSTRIAL_ADDRESS): hasta entonces responde 503
 * DISTRIBUTOR_NOT_DEPLOYED. Despliegue: smart-contracts/script/DeployRWAFinance.s.sol.
 */

const { ethers } = require('ethers');
const polygon = require('./polygonReader');
const { FABRICAS, CATEGORIAS } = require('./rwaTokenization');
const { ALTO_VALOR } = require('./rwaMarket');
const tree = require('./rwaRentTree');
const { usdDeBezWei } = require('./rwaUsd');

const BEZ = process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // USDC nativo de Polygon

/** Tokens en los que se puede repartir. El contrato admite cualquier ERC-20; la API sólo estos. */
const TOKENS = {
    bez: { simbolo: 'BEZ', direccion: BEZ, decimales: 18 },
    usdc: { simbolo: 'USDC', direccion: USDC, decimales: 6 },
};

/**
 * Equivalente en USD de un importe en unidades mínimas del token de pago. USDC es
 * 1 USD; BEZ, al precio de config/bez-price.js. Un token desconocido no tiene
 * equivalencia: null, no un cálculo inventado.
 */
function usdDe(tk, v) {
    if (!tk) return null;
    if (tk.simbolo === 'BEZ') return usdDeBezWei(v);
    const c = (BigInt(v) * 100n + 10n ** BigInt(tk.decimales) / 2n) / 10n ** BigInt(tk.decimales);
    return `${c / 100n}.${String(c % 100n).padStart(2, '0')}`;
}

const ENV_REPARTO = { activos: 'RWA_RENT_DISTRIBUTOR_ADDRESS', industrial: 'RWA_RENT_DISTRIBUTOR_INDUSTRIAL_ADDRESS' };

/** Bloques de margen entre el corte y la cabeza de la cadena, contra reorganizaciones. */
const CONFIRMACIONES = 128;
/** El contrato exige 30 días como mínimo; el margen cubre el tiempo hasta firmar. */
const PLAZO_MIN_DIAS = 31;
const PLAZO_MAX_DIAS = 365;
const PLAZO_DEFECTO_DIAS = 90;

const PASO_INICIAL = parseInt(process.env.RWA_LOGS_CHUNK || '50000', 10);
const PASO_MIN = 1000;
const MAX_PETICIONES = parseInt(process.env.RWA_LOGS_MAX_REQUESTS || '2000', 10);

const ASSET_TUPLE = 'tuple(string name, uint8 category, string legalDocumentCID, string imagesCID, uint256 totalSupply, '
    + 'uint256 valuationUSD, uint256 pricePerFraction, uint256 estimatedYield, address creator, string location, '
    + 'uint256 createdAt, bool isActive)';
const FACTORY_ABI = [
    `function getAsset(uint256 assetId) view returns (${ASSET_TUPLE})`,
    'function isVerified(uint256 assetId, address investor) view returns (bool)',
];
const REPARTO_ABI = [
    'function feeBps() view returns (uint16)',
    'function distributions(uint256) view returns (uint256 assetId, address issuer, address token, uint256 amount, '
        + 'uint256 remaining, bytes32 merkleRoot, uint64 snapshotBlock, uint64 claimDeadline, string detailsCID)',
    'function isClaimed(uint256 distributionId, address account) view returns (bool)',
    'function createDistribution(uint256 assetId, address token, uint256 amount, bytes32 merkleRoot, '
        + 'uint64 snapshotBlock, uint64 claimDeadline, string detailsCID) returns (uint256)',
    'function claim(uint256 distributionId, address account, uint256 amount, bytes32[] proof)',
];
const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];

const TRANSFER_IFACE = new ethers.Interface([
    'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
    'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
]);
const TOPICS_TRANSFER = [[TRANSFER_IFACE.getEvent('TransferSingle').topicHash, TRANSFER_IFACE.getEvent('TransferBatch').topicHash]];

class RwaRentError extends Error {
    constructor(message, code, status = 400) {
        super(message);
        this.name = 'RwaRentError';
        this.code = code;
        this.status = status;
    }
}

// ── Validación ───────────────────────────────────────────────────────────────

function fabrica(id = 'activos') {
    if (!Object.prototype.hasOwnProperty.call(FABRICAS, id)) {
        throw new RwaRentError(`Fábrica no válida. Admitidas: ${Object.keys(FABRICAS).join(', ')}.`, 'INVALID_FACTORY');
    }
    return FABRICAS[id].direccion;
}

function contratoReparto(id = 'activos', env = process.env) {
    fabrica(id);
    const dir = env[ENV_REPARTO[id]] || '';
    if (!ethers.isAddress(dir)) {
        throw new RwaRentError(
            'El reparto de rentas todavía no está activo: el contrato aún no está desplegado en esta red.',
            'DISTRIBUTOR_NOT_DEPLOYED', 503,
        );
    }
    return dir;
}

function entero(v, nombre, { min = 1 } = {}) {
    const s = String(v);
    if (!/^\d{1,30}$/.test(s) || BigInt(s) < BigInt(min)) {
        throw new RwaRentError(`${nombre} tiene que ser un entero ≥ ${min}.`, 'INVALID_INPUT');
    }
    return BigInt(s);
}

function direccion(v, nombre) {
    if (!ethers.isAddress(v || '')) throw new RwaRentError(`${nombre} tiene que ser una dirección EVM.`, 'INVALID_ADDRESS');
    return ethers.getAddress(v);
}

function tokenDePago(clave = 'usdc') {
    if (!Object.prototype.hasOwnProperty.call(TOKENS, clave)) {
        throw new RwaRentError(`Token de pago no válido. Admitidos: ${Object.keys(TOKENS).join(', ')}.`, 'INVALID_TOKEN');
    }
    return TOKENS[clave];
}

function importe(v, token) {
    const re = new RegExp(`^\\d{1,15}(\\.\\d{1,${token.decimales}})?$`);
    if (!re.test(String(v))) {
        throw new RwaRentError(
            `importe tiene que ser decimal con punto y como mucho ${token.decimales} decimales (${token.simbolo}).`,
            'INVALID_AMOUNT',
        );
    }
    const w = ethers.parseUnits(String(v), token.decimales);
    if (w <= 0n) throw new RwaRentError('importe tiene que ser mayor que cero.', 'INVALID_AMOUNT');
    return w;
}

function cid(v) {
    if (v === undefined || v === null || v === '') return '';
    if (!/^[A-Za-z0-9]{10,100}$/.test(String(v))) {
        throw new RwaRentError('detallesCID no parece un CID de IPFS.', 'INVALID_CID');
    }
    return String(v);
}

async function leerSeguro(dir, abi, fn, args) {
    try {
        return await polygon.leer(dir, abi, fn, args);
    } catch (err) {
        if (err.code === 'CALL_EXCEPTION' || /revert/i.test(err.message || '')) {
            throw new RwaRentError('No existe en el contrato.', 'NOT_FOUND', 404);
        }
        throw new RwaRentError('No se pudo leer Polygon. Inténtalo en unos minutos.', 'RPC_UNAVAILABLE', 503);
    }
}

async function enCadena(fn) {
    try {
        return await fn();
    } catch (err) {
        if (err instanceof RwaRentError) throw err;
        throw new RwaRentError('No se pudo leer Polygon. Inténtalo en unos minutos.', 'RPC_UNAVAILABLE', 503);
    }
}

// ── Lectura de eventos ───────────────────────────────────────────────────────

/** Primer bloque ≤ `hasta` cuya marca de tiempo es ≥ `ts` (búsqueda binaria). */
async function bloqueDesde(ts, hasta) {
    let lo = 0;
    let hi = hasta;
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const t = await enCadena(() => polygon.timestampDeBloque(mid));
        if (t === undefined || t === null) throw new RwaRentError('Polygon no devolvió el bloque.', 'RPC_UNAVAILABLE', 503);
        if (Number(t) >= ts) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

/**
 * Logs de `address` con `topics` en [desde, hasta], por tramos. Si el RPC rechaza
 * un tramo por grande, lo parte por la mitad hasta PASO_MIN.
 */
async function leerLogs(address, topics, desde, hasta, { hastaElFinal = false } = {}) {
    const todos = [];
    let paso = PASO_INICIAL;
    let from = desde;
    let peticiones = 0;
    while (from <= hasta) {
        if (++peticiones > MAX_PETICIONES) {
            throw new RwaRentError(
                'El activo es demasiado antiguo para recalcular el reparto con este RPC.', 'RANGE_TOO_LARGE', 503,
            );
        }
        const to = Math.min(from + paso - 1, hasta);
        let logs;
        try {
            // El último tramo puede pedirse con 'latest': el número de bloque que se leyó antes
            // puede ir unos instantes por detrás y dejaría fuera lo recién minado.
            logs = await polygon.logs({ address, topics, fromBlock: from, toBlock: hastaElFinal && to === hasta ? 'latest' : to });
        } catch (err) {
            if (paso > PASO_MIN) {
                paso = Math.max(PASO_MIN, Math.floor(paso / 2));
                continue; // reintenta el mismo `from` con un tramo menor
            }
            throw new RwaRentError('No se pudo leer Polygon. Inténtalo en unos minutos.', 'RPC_UNAVAILABLE', 503);
        }
        todos.push(...logs);
        from = to + 1;
    }
    todos.sort((a, b) => (a.blockNumber - b.blockNumber) || ((a.index ?? a.logIndex ?? 0) - (b.index ?? b.logIndex ?? 0)));
    return todos;
}

/** Transferencias de fracciones del factory en [desde, hasta], ya decodificadas y en orden de cadena. */
async function leerTransferencias(contrato, desde, hasta) {
    const logs = await leerLogs(contrato, TOPICS_TRANSFER, desde, hasta);
    const eventos = [];
    for (const log of logs) {
        const ev = TRANSFER_IFACE.parseLog({ topics: log.topics, data: log.data });
        if (!ev) continue;
        eventos.push(ev.name === 'TransferSingle'
            ? { from: ev.args[1], to: ev.args[2], id: ev.args[3], value: ev.args[4] }
            // Por posición: `values` es también un método de ethers.Result.
            : { from: ev.args[1], to: ev.args[2], ids: [...ev.args[3]], values: [...ev.args[4]] });
    }
    return eventos;
}

// El corte es un bloque ya pasado: su resultado no cambia, así que se guarda.
const CACHE_MAX = 50;
const cache = new Map();

/**
 * Reparto calculado para (activo, corte, importe, emisor). Siempre excluye al
 * emisor: ver "Política fija" arriba.
 */
async function calcular({ contrato, assetId, creadoTs, corte, importeBase, emisor }) {
    const clave = [contrato, assetId, corte, importeBase, emisor].join(':');
    if (cache.has(clave)) return cache.get(clave);

    const desde = await bloqueDesde(creadoTs, corte);
    const eventos = await leerTransferencias(contrato, desde, corte);
    let resultado;
    try {
        resultado = tree.calcularReparto({ eventos, assetId, importe: importeBase, excluir: [emisor] });
    } catch (err) {
        // Los errores del árbol (NO_HOLDERS, AMOUNT_TOO_SMALL…) son del cliente: 400 con su código, no un 500.
        if (err instanceof tree.RwaRentTreeError) throw new RwaRentError(err.message, err.code, err.status || 400);
        throw err;
    }

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(clave, resultado);
    return resultado;
}

// ── Crear un reparto (emisor) ────────────────────────────────────────────────

async function prepararReparto({
    fabrica: f = 'activos', assetId, emisor, token = 'usdc', importe: importeDecimal,
    plazoDias = PLAZO_DEFECTO_DIAS, detallesCID,
}) {
    const reparto = contratoReparto(f);
    const contrato = fabrica(f);
    const id = entero(assetId, 'assetId');
    const quien = direccion(emisor, 'emisor');
    const tk = tokenDePago(token);
    const total = importe(importeDecimal, tk);
    const dias = Number(entero(plazoDias, 'plazoDias'));
    if (dias < PLAZO_MIN_DIAS || dias > PLAZO_MAX_DIAS) {
        throw new RwaRentError(`plazoDias tiene que estar entre ${PLAZO_MIN_DIAS} y ${PLAZO_MAX_DIAS}.`, 'INVALID_INPUT');
    }
    const ipfs = cid(detallesCID);

    const a = await leerSeguro(contrato, FACTORY_ABI, 'getAsset', [id]);
    if (ethers.getAddress(a.creator) !== quien) {
        throw new RwaRentError('Sólo el creador del activo puede repartir sus rentas.', 'NOT_CREATOR', 403);
    }
    if (!a.isActive) throw new RwaRentError('El activo está desactivado.', 'ASSET_INACTIVE', 409);

    const feeBps = BigInt(await leerSeguro(reparto, REPARTO_ABI, 'feeBps', []));
    const fee = (total * feeBps) / 10_000n;
    const cabeza = await enCadena(() => polygon.bloqueActual());
    const corte = Math.max(0, Number(cabeza) - CONFIRMACIONES);

    const calculo = await calcular({
        contrato, assetId: id.toString(), creadoTs: Number(a.createdAt), corte,
        importeBase: total.toString(), emisor: quien,
    });

    const plazo = Math.floor(Date.now() / 1000) + dias * 86400;
    const iface = new ethers.Interface(REPARTO_ABI);
    return {
        red: { chainId: polygon.CHAIN_ID, nombre: 'Polygon' },
        contratoReparto: reparto,
        reparto: {
            assetId: id.toString(),
            token: tk.simbolo,
            importe: ethers.formatUnits(total, tk.decimales),
            comision: ethers.formatUnits(fee, tk.decimales),
            totalAPagar: ethers.formatUnits(total + fee, tk.decimales),
            importeUsd: usdDe(tk, total),
            totalAPagarUsd: usdDe(tk, total + fee),
            titulares: calculo.titulares,
            repartido: ethers.formatUnits(calculo.repartido, tk.decimales),
            restoSinAsignar: ethers.formatUnits(calculo.resto, tk.decimales),
            bloqueDeCorte: corte,
            raiz: calculo.raiz,
            plazoReclamo: new Date(plazo * 1000).toISOString(),
        },
        // Lista completa con las pruebas: es el justificante que se fija en IPFS (detallesCID).
        justificante: {
            version: 1,
            fabrica: contrato,
            assetId: id.toString(),
            token: tk.direccion,
            importe: total.toString(),
            bloqueDeCorte: corte,
            raiz: calculo.raiz,
            emisorExcluido: quien,
            reparto: calculo.pruebas,
        },
        transacciones: [
            {
                paso: 1,
                descripcion: `Autorizar al contrato de reparto a cobrar ${ethers.formatUnits(total + fee, tk.decimales)} ${tk.simbolo} `
                    + `(${ethers.formatUnits(total, tk.decimales)} a repartir + ${ethers.formatUnits(fee, tk.decimales)} de comisión).`,
                to: tk.direccion, value: '0', chainId: polygon.CHAIN_ID,
                data: new ethers.Interface(ERC20_ABI).encodeFunctionData('approve', [reparto, total + fee]),
            },
            {
                paso: 2,
                descripcion: 'Crear el reparto: deposita el importe y publica la raíz con la que cobrarán los titulares.',
                to: reparto, value: '0', chainId: polygon.CHAIN_ID,
                data: iface.encodeFunctionData('createDistribution', [
                    id, tk.direccion, total, calculo.raiz, corte, plazo, ipfs,
                ]),
            },
        ],
        aviso: 'Las fracciones que conservas no cobran. Lo que nadie reclame antes del plazo lo recuperas tú después. '
            + (ipfs ? '' : 'Sin detallesCID el reparto se crea sin justificante público: fija el justificante en IPFS y vuelve a '
                + 'preparar con ese CID si quieres que los titulares puedan verificarlo. ')
            + `Firma en las próximas 24 horas: el plazo mínimo de ${PLAZO_MIN_DIAS} días se cuenta desde ahora.`,
        siguientePaso: 'Firma las dos transacciones, en orden, con la wallet creadora del activo.',
    };
}

// ── Consultar y cobrar (titular) ─────────────────────────────────────────────

function tokenConocido(direccionToken) {
    const d = ethers.getAddress(direccionToken);
    return Object.values(TOKENS).find((t) => ethers.getAddress(t.direccion) === d) || null;
}

async function leerRepartoOnChain(reparto, id) {
    const d = await leerSeguro(reparto, REPARTO_ABI, 'distributions', [id]);
    if (d.issuer === ethers.ZeroAddress) throw new RwaRentError('No existe ese reparto.', 'NOT_FOUND', 404);
    return d;
}

function formatearReparto(id, d) {
    const tk = tokenConocido(d.token);
    const fmt = (v) => (tk ? ethers.formatUnits(v, tk.decimales) : v.toString());
    return {
        distributionId: id.toString(),
        assetId: d.assetId.toString(),
        emisor: d.issuer,
        token: tk ? tk.simbolo : d.token,
        importe: fmt(d.amount),
        importeUsd: usdDe(tk, d.amount),
        sinReclamar: fmt(d.remaining),
        raiz: d.merkleRoot,
        bloqueDeCorte: Number(d.snapshotBlock),
        plazoReclamo: new Date(Number(d.claimDeadline) * 1000).toISOString(),
        abierto: Math.floor(Date.now() / 1000) <= Number(d.claimDeadline),
        detallesCID: d.detailsCID || null,
    };
}

async function leerReparto({ fabrica: f = 'activos', distributionId }) {
    const reparto = contratoReparto(f);
    const id = entero(distributionId, 'distributionId');
    return formatearReparto(id, await leerRepartoOnChain(reparto, id));
}

/** Máximo de repartos que devuelve el listado de un activo (los más recientes). */
const MAX_LISTADO = 50;
const TOPIC_CREADO = new ethers.Interface(REPARTO_ABI.concat([
    'event DistributionCreated(uint256 indexed distributionId, uint256 indexed assetId, address indexed issuer, '
        + 'address token, uint256 amount, uint256 fee, bytes32 merkleRoot, uint64 snapshotBlock, uint64 claimDeadline, string detailsCID)',
])).getEvent('DistributionCreated').topicHash;

/**
 * Repartos de rentas de un activo, del más reciente al más antiguo. Con `cuenta`
 * añade, por reparto, si ya cobró y cuánto le toca (sólo en los abiertos): es un
 * dato SOBRE esa wallet, así que la REST exige que la clave la represente.
 * Sin `cuenta` sólo hay datos públicos del contrato (lo que ofrece el MCP).
 */
async function listarRepartos({ fabrica: f = 'activos', assetId, cuenta }) {
    const reparto = contratoReparto(f);
    const contrato = fabrica(f);
    const id = entero(assetId, 'assetId');
    const quien = cuenta ? direccion(cuenta, 'cuenta') : null;

    const a = await leerSeguro(contrato, FACTORY_ABI, 'getAsset', [id]);
    const cabeza = Number(await enCadena(() => polygon.bloqueActual()));
    const desde = await bloqueDesde(Number(a.createdAt), cabeza);
    const topicActivo = ethers.zeroPadValue(ethers.toBeHex(id), 32);
    // Hasta 'latest': tras crear un reparto, el historial tiene que incluirlo ya.
    const logs = await leerLogs(reparto, [TOPIC_CREADO, null, topicActivo], desde, cabeza, { hastaElFinal: true });

    const ids = logs.map((l) => BigInt(l.topics[1])).reverse().slice(0, MAX_LISTADO);
    const repartos = [];
    for (const rid of ids) {
        const d = await leerRepartoOnChain(reparto, rid);
        const item = formatearReparto(rid, d);
        if (quien) {
            item.yaCobrado = Boolean(await leerSeguro(reparto, REPARTO_ABI, 'isClaimed', [rid, quien]));
            item.miParte = null;
            item.motivoSinParte = null;
            if (item.abierto && !item.yaCobrado) {
                try {
                    const calculo = await calcular({
                        contrato, assetId: id.toString(), creadoTs: Number(a.createdAt), corte: Number(d.snapshotBlock),
                        importeBase: d.amount.toString(), emisor: ethers.getAddress(d.issuer),
                    });
                    if (calculo.raiz !== d.merkleRoot) item.motivoSinParte = 'ROOT_NOT_REPRODUCIBLE';
                    else if (!calculo.pruebas[quien]) item.motivoSinParte = 'NO_SHARE';
                    else {
                        const tk = tokenConocido(d.token);
                        item.miParte = tk ? ethers.formatUnits(calculo.pruebas[quien].importe, tk.decimales) : calculo.pruebas[quien].importe;
                        item.miParteUsd = usdDe(tk, calculo.pruebas[quien].importe);
                    }
                } catch (err) {
                    if (!(err instanceof RwaRentError)) throw err;
                    item.motivoSinParte = err.code;
                }
            }
        }
        repartos.push(item);
    }
    return { fabrica: f, assetId: id.toString(), cuenta: quien, repartos };
}

/**
 * `comprobarKyc` lee si el titular está verificado para avisar antes de firmar.
 * Es un dato SOBRE esa wallet: sólo la REST, que acredita la titularidad, lo pide.
 */
async function prepararReclamo({ fabrica: f = 'activos', distributionId, cuenta, comprobarKyc = true }) {
    const reparto = contratoReparto(f);
    const contrato = fabrica(f);
    const id = entero(distributionId, 'distributionId');
    const quien = direccion(cuenta, 'cuenta');

    const d = await leerRepartoOnChain(reparto, id);
    if (Math.floor(Date.now() / 1000) > Number(d.claimDeadline)) {
        throw new RwaRentError('El plazo para reclamar este reparto ha terminado.', 'CLAIM_WINDOW_CLOSED', 409);
    }
    if (await leerSeguro(reparto, REPARTO_ABI, 'isClaimed', [id, quien])) {
        throw new RwaRentError('Esta wallet ya cobró este reparto.', 'ALREADY_CLAIMED', 409);
    }

    const a = await leerSeguro(contrato, FACTORY_ABI, 'getAsset', [d.assetId]);
    const calculo = await calcular({
        contrato, assetId: d.assetId.toString(), creadoTs: Number(a.createdAt), corte: Number(d.snapshotBlock),
        importeBase: d.amount.toString(), emisor: ethers.getAddress(d.issuer),
    });
    if (calculo.raiz !== d.merkleRoot) {
        throw new RwaRentError(
            'La raíz publicada no sale de los saldos de la cadena con la política estándar, así que no se puede '
            + 'generar tu prueba desde aquí. Si el reparto trae justificante (detallesCID), tu prueba está en él.',
            'ROOT_NOT_REPRODUCIBLE', 409,
        );
    }
    const suyo = calculo.pruebas[quien];
    if (!suyo) {
        throw new RwaRentError('Esta wallet no tenía fracciones de este activo en el bloque de corte.', 'NO_SHARE', 404);
    }

    const categoria = CATEGORIAS[Number(a.category)];
    if (comprobarKyc && ALTO_VALOR.has(categoria)) {
        const verificado = await leerSeguro(contrato, FACTORY_ABI, 'isVerified', [d.assetId, quien]);
        if (!verificado) {
            throw new RwaRentError(
                `Para cobrar rentas de un ${categoria} necesitas el KYC verificado para este activo.`, 'KYC_REQUIRED', 409,
            );
        }
    }

    const tk = tokenConocido(d.token);
    return {
        red: { chainId: polygon.CHAIN_ID, nombre: 'Polygon' },
        contratoReparto: reparto,
        cobro: {
            distributionId: id.toString(),
            cuenta: quien,
            token: tk ? tk.simbolo : d.token,
            importe: tk ? ethers.formatUnits(suyo.importe, tk.decimales) : suyo.importe,
            importeUsd: usdDe(tk, suyo.importe),
        },
        transacciones: [{
            paso: 1,
            descripcion: 'Cobrar tu parte del reparto. El dinero va siempre a esta wallet, la firme quien la firme.',
            to: reparto, value: '0', chainId: polygon.CHAIN_ID,
            data: new ethers.Interface(REPARTO_ABI).encodeFunctionData('claim', [id, quien, suyo.importe, suyo.prueba]),
        }],
        siguientePaso: 'Firma la transacción antes de que termine el plazo. Necesita algo de POL para el gas.',
    };
}

module.exports = {
    prepararReparto, leerReparto, listarRepartos, prepararReclamo,
    TOKENS, RwaRentError,
    _vaciarCache: () => cache.clear(),
};
