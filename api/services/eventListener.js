/**
 * eventListener.js — On-chain event subscriber and indexer.
 *
 * Subscribes to core contract events on the L2 and indexes them into
 * PostgreSQL + publishes via Redis pub/sub for real-time websocket push.
 *
 * Resilience features:
 *   - In-memory event queue with async drain (prevents backpressure)
 *   - Auto-reconnect on provider disconnect
 *   - Prometheus-compatible stats counter
 */
const { getContract, getProvider, resetProvider, pingChain } = require('./contractService');
const { recordTx } = require('./txService');
const { query } = require('../db/pool');
const { publish, cacheSet } = require('../cache/redis');

let active = false;
const listeners = [];
let warnedMissingEventsTable = false;
let reconnectTimer = null;
let livenessTimer = null;

const MAX_NORMALIZE_DEPTH = 10;
const QUEUE_FLUSH_INTERVAL_MS = 200;
const MAX_QUEUE_SIZE = 5000;

// ── Reconexión ──────────────────────────────────────────────────────────────
//
// El comportamiento anterior era: ethers reintentaba detectar la red cada
// segundo, para siempre, y este módulo escribía una línea de log por intento
// prometiendo una reconexión que nunca ocurría (`reconnectTimer` estaba
// declarado y no se asignaba nunca). Con el nodo caído eso son 86.400 líneas
// al día, un núcleo ocupado y cero reconexiones.
//
// Ahora: espera creciente entre intentos, con techo, y con ruido aleatorio para
// que varias réplicas no golpeen el nodo a la vez cuando vuelve — un enjambre
// sincronizado en el momento del arranque es una buena forma de volver a
// tumbarlo.
const RECONNECT_BASE_MS = parseInt(process.env.INDEXER_RECONNECT_BASE_MS || '1000', 10);
const RECONNECT_MAX_MS = parseInt(process.env.INDEXER_RECONNECT_MAX_MS || '60000', 10);
const RECONNECT_JITTER = 0.25;

let reconnecting = false;
let loggedDisconnect = false;

function backoffDelay(attempt) {
    const exp = Math.min(RECONNECT_BASE_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS);
    const jitter = exp * RECONNECT_JITTER * (Math.random() * 2 - 1);
    return Math.max(RECONNECT_BASE_MS, Math.round(exp + jitter));
}

/**
 * Reengancha las suscripciones cuando el nodo vuelve.
 *
 * Reconectar no es sólo "esperar y reintentar": las suscripciones viejas
 * cuelgan de un provider muerto, así que hay que soltarlas y reconstruirlas
 * sobre uno nuevo. Sin eso, el proceso sobrevive pero deja de indexar y nadie
 * se entera hasta que faltan datos.
 */
async function scheduleReconnect(reason) {
    if (reconnecting || !active) return;
    reconnecting = true;
    stats.chainReachable = false;
    stats.lastChainErrorAt = Date.now();
    stats.lastChainError = reason;

    // Una línea al caer y otra al volver. No una por intento: el log no es el
    // sitio donde contar los reintentos, para eso están las métricas.
    if (!loggedDisconnect) {
        console.warn(`[EventListener] Nodo inalcanzable (${reason}). Reintentando con espera creciente.`);
        loggedDisconnect = true;
    }

    const attempt = () => {
        stats.reconnectAttempts++;
        const delay = backoffDelay(stats.reconnectAttempts);
        stats.nextReconnectInMs = delay;

        reconnectTimer = setTimeout(async () => {
            if (!active) return;
            const { reachable, error } = await pingChain(5000);
            if (!reachable) {
                stats.lastChainError = error;
                attempt();
                return;
            }

            try {
                await teardownListeners(false);
                resetProvider();
                await subscribeAll();
                stats.reconnects++;
                stats.chainReachable = true;
                stats.nextReconnectInMs = null;
                console.log(
                    `[EventListener] Nodo recuperado tras ${stats.reconnectAttempts} intento(s); `
                    + `${listeners.length} suscripciones restablecidas.`
                );
                stats.reconnectAttempts = 0;
                reconnecting = false;
                loggedDisconnect = false;
            } catch (err) {
                stats.lastChainError = err.message;
                attempt();
            }
        }, delay);
        if (reconnectTimer.unref) reconnectTimer.unref();
    };

    attempt();
}

/**
 * Suelta las suscripciones actuales.
 *
 * @param uninstall si hay que dar de baja los filtros en el nodo. En la
 *   reconexión va a `false` A PROPÓSITO: el provider se va a destruir de todos
 *   modos, así que dar de baja los filtros es trabajo inútil sobre un nodo que
 *   acaba de caerse. Peor aún, `contract.off()` lanza un `eth_uninstallFilter`
 *   cuya promesa rechaza cuando el provider se destruye a continuación — y
 *   siendo un rechazo asíncrono que nadie captura, tumbaba el proceso. Que es
 *   exactamente el fallo que este trabajo venía a quitar.
 */
async function teardownListeners(uninstall = true) {
    const pending = listeners.splice(0, listeners.length);
    if (!uninstall) return;
    await Promise.allSettled(
        pending.map(({ contract, eventName, handler }) =>
            Promise.resolve(contract.off(eventName, handler)).catch(() => {}))
    );
}

// ── Stats for Prometheus ──
const stats = {
    eventsReceived: 0,
    eventsIndexed: 0,
    eventsPublished: 0,
    eventsFailed: 0,
    queueHighWatermark: 0,
    reconnects: 0,
    lastEventAt: null,
    startedAt: null,
    // Suscripciones que no se pudieron enganchar por un nombre de evento que ya
    // no existe en el ABI. Visible en /health: un indexador con huecos parece
    // sano hasta que alguien echa de menos los datos que nunca llegaron.
    failedSubscriptions: [],
    // Estado de la conexión con el nodo. `chainReachable: false` es la
    // diferencia entre "el indexador va bien y no pasa nada en la cadena" y
    // "el indexador lleva horas sin ver el nodo": desde fuera se parecen mucho.
    chainReachable: null,
    lastChainErrorAt: null,
    lastChainError: null,
    reconnectAttempts: 0,
    nextReconnectInMs: null,
};

function getListenerStats() { return { ...stats, active, listenerCount: listeners.length }; }

// ── Async event queue ──
const eventQueue = [];
let draining = false;

function enqueue(task) {
    if (eventQueue.length >= MAX_QUEUE_SIZE) {
        stats.eventsFailed++;
        console.warn('[EventListener] Queue full, dropping event.');
        return;
    }
    eventQueue.push(task);
    if (eventQueue.length > stats.queueHighWatermark) {
        stats.queueHighWatermark = eventQueue.length;
    }
}

async function drainQueue() {
    if (draining || eventQueue.length === 0) return;
    draining = true;
    while (eventQueue.length > 0) {
        const task = eventQueue.shift();
        try {
            await task();
            stats.eventsIndexed++;
        } catch (err) {
            stats.eventsFailed++;
            console.warn('[EventListener] Queue task failed:', err.message);
        }
    }
    draining = false;
}

let drainInterval = null;

function normalizeValue(value, depth = 0) {
    if (depth > MAX_NORMALIZE_DEPTH) return '[nested]';
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'string') return value.slice(0, 2000);
    if (Array.isArray(value)) return value.slice(0, 100).map((v) => normalizeValue(v, depth + 1));
    if (value && typeof value === 'object') {
        const out = {};
        const keys = Object.keys(value).slice(0, 50);
        for (const k of keys) out[k] = normalizeValue(value[k], depth + 1);
        return out;
    }
    return value;
}

async function indexBlockchainEvent({
    contractName,
    eventName,
    eventType,
    txHash,
    blockNumber,
    logIndex,
    actorAddress,
    eventData,
}) {
    try {
        await query(
            `INSERT INTO blockchain_events
             (chain_id, contract_name, event_name, event_type, tx_hash, block_number, log_index, actor_address, event_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (tx_hash, log_index) DO NOTHING`,
            [
                parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                contractName,
                eventName,
                eventType || 'generic',
                txHash,
                blockNumber,
                logIndex,
                actorAddress || null,
                normalizeValue(eventData || {}),
            ]
        );
    } catch (err) {
        if (!warnedMissingEventsTable && String(err.message || '').includes('blockchain_events')) {
            warnedMissingEventsTable = true;
            console.warn('[EventListener] blockchain_events table missing. Run DB migrations/schema.');
            return;
        }
        console.warn('[EventListener] Failed to index blockchain event:', err.message);
    }
}

/**
 * Subscribe to a contract event and index it.
 */
/**
 * Suscribe un handler a un evento, comprobando ANTES que el evento existe.
 *
 * Sin esta comprobación, un nombre de evento obsoleto —cosa que pasa cada vez
 * que se renombra algo en un contrato— hace que ethers rechace una promesa que
 * nadie captura, y el proceso entero se cae al arrancar. Es un modo de fallo
 * desproporcionado: una suscripción caduca tumbaba toda la API.
 *
 * Ahora se registra como error de configuración y el resto del indexado sigue
 * levantándose. Los eventos que no se pudieron enganchar quedan en
 * `stats.failedSubscriptions` para que se vean en /health en lugar de
 * descubrirse por la vía de que no llegan datos.
 */
/** SlashingManager.InfractionType — el orden lo fija el enum del contrato. */
const INFRACTION_TYPES = ['Downtime', 'FraudulentData', 'DAOInactivity', 'SequencerFailure', 'DoubleSigning'];

/**
 * ¿Existe el evento en el ABI del contrato? Devuelve null si sí; si no, el
 * motivo, incluyendo qué eventos SÍ hay — que es lo que hace falta para
 * arreglarlo sin ir a abrir el ABI a mano.
 */
function checkEvent(contract, eventName) {
    const available = contract.interface.fragments
        .filter((f) => f.type === 'event').map((f) => f.name);
    if (available.includes(eventName)) return null;
    return `evento '${eventName}' no existe en el ABI (disponibles: ${available.join(', ')})`;
}

function onEvent(contract, eventName, handler) {
    const problem = checkEvent(contract, eventName);
    if (problem) {
        console.error(`[EventListener] SUSCRIPCION INVALIDA: ${problem}`);
        stats.failedSubscriptions.push({ eventName, reason: problem });
        return false;
    }
    contract.on(eventName, handler);
    listeners.push({ contract, eventName, handler });
    return true;
}

/**
 * Start listening to core contract events.
 * Call once during server startup (after DB + Redis are ready).
 */
async function startListening() {
    if (active) return;
    active = true;
    stats.startedAt = Date.now();
    console.log('[EventListener] Starting event subscriptions...');

    drainInterval = setInterval(drainQueue, QUEUE_FLUSH_INTERVAL_MS);

    // Antes de suscribir, comprobar que el nodo responde. Suscribirse contra un
    // nodo caído deja el indexador aparentemente en marcha y completamente
    // ciego; mejor entrar directamente en el ciclo de reconexión.
    const { reachable, error } = await pingChain(5000);
    stats.chainReachable = reachable;
    if (!reachable) {
        scheduleReconnect(error);
        return;
    }

    await subscribeAll();
    startLivenessProbe();
}

/**
 * Detecta que el nodo se ha caído SIN avisar.
 *
 * `provider.on('error')` cubre el fallo ruidoso. El silencioso —el RPC deja de
 * responder y las suscripciones simplemente no entregan nada— no emite ningún
 * evento, y es el que deja un indexador que parece sano durante horas. Un
 * sondeo periódico es la única forma de verlo.
 */
function startLivenessProbe() {
    const intervalMs = parseInt(process.env.INDEXER_LIVENESS_INTERVAL_MS || '30000', 10);
    if (livenessTimer) clearInterval(livenessTimer);
    livenessTimer = setInterval(async () => {
        if (!active || reconnecting) return;
        const { reachable, error } = await pingChain(5000);
        stats.chainReachable = reachable;
        if (!reachable) scheduleReconnect(error);
    }, intervalMs);
    if (livenessTimer.unref) livenessTimer.unref();
}

/** Engancha todas las suscripciones. Reutilizable: la reconexión la vuelve a llamar. */
async function subscribeAll() {
    // El manejador de errores del provider cubre la caída ruidosa; el sondeo de
    // vitalidad cubre la silenciosa. Hacen falta los dos.
    try {
        const provider = getProvider();
        if (provider && typeof provider.on === 'function') {
            provider.on('error', (err) => {
                scheduleReconnect(err?.message || 'provider error');
            });
        }
    } catch { /* provider unavailable */ }

    try {
        // ── BEZCoinV2 Transfers ──
        const bez = await getContract('BEZCoinV2').catch(() => null);
        if (bez) {
            onEvent(bez, 'Transfer', (from, to, value, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: from,
                        toAddress: to,
                        value: value.toString(),
                        contract: 'BEZCoinV2',
                        method: 'Transfer',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish('event:bez:transfer', txData);
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: BEZCoinV2.Transfer');
        }

        // ── NFT Minted ──
        const nft = await getContract('BeZhasLogisticsNFT').catch(() => null);
        if (nft) {
            onEvent(nft, 'Transfer', (from, to, tokenId, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    // Mint = from is zero address
                    const isMint = from === '0x0000000000000000000000000000000000000000';
                    const method = isMint ? 'Mint' : 'Transfer';

                    const contractAddr = nft.target;
                    if (isMint) {
                        await query(
                            `INSERT INTO nfts (token_id, contract_address, owner_address, nft_type, minted_at)
                             VALUES ($1, $2, $3, $4, NOW())
                             ON CONFLICT (contract_address, token_id) DO NOTHING`,
                            [parseInt(tokenId.toString()), contractAddr, to, 'logistics']
                        );
                    } else {
                        await query(
                            'UPDATE nfts SET owner_address = $1 WHERE token_id = $2 AND contract_address = $3',
                            [to, parseInt(tokenId.toString()), contractAddr]
                        );
                    }

                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: from,
                        toAddress: to,
                        value: tokenId.toString(),
                        contract: 'BeZhasLogisticsNFT',
                        method,
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish(`event:nft:${method.toLowerCase()}`, txData);
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: BeZhasLogisticsNFT.Transfer');
        }

        // ── Quality Escrow ──
        const escrow = await getContract('QualityEscrow').catch(() => null);
        if (escrow) {
            onEvent(escrow, 'SensorDataRegistered', (containerId, temperature, status, node, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const eventData = {
                        containerId,
                        temperature: temperature.toString(),
                        status,
                        node,
                    };
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: node,
                        toAddress: escrow.target,
                        value: temperature.toString(),
                        contract: 'QualityEscrow',
                        method: 'SensorDataRegistered',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await indexBlockchainEvent({
                        contractName: 'QualityEscrow',
                        eventName: 'SensorDataRegistered',
                        eventType: 'escrow',
                        txHash: event.log.transactionHash,
                        blockNumber: event.log.blockNumber,
                        logIndex: event.log.index,
                        actorAddress: node,
                        eventData,
                    });
                    await recordTx(txData);
                    await publish('event:escrow:sensor_data', { ...txData, eventData });
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: QualityEscrow.SensorDataRegistered');
        }

        // ── Staking Events ──
        const staking = await getContract('StakingPool').catch(() => null);
        if (staking) {
            onEvent(staking, 'Staked', (user, amount, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    await query(
                        `INSERT INTO staking_positions (wallet_address, amount_staked, is_active)
                         VALUES ($1, $2, true)
                         ON CONFLICT (wallet_address) DO UPDATE SET amount_staked = staking_positions.amount_staked::numeric + $2::numeric`,
                        [user, amount.toString()]
                    );
                    await recordTx({
                        txHash: event.log.transactionHash,
                        fromAddress: user,
                        toAddress: staking.target,
                        value: amount.toString(),
                        contract: 'StakingPool',
                        method: 'Staked',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    });
                    await publish('event:staking:staked', { user, amount: amount.toString() });
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: StakingPool.Staked');
        }

        // ── Bridge Deposit/Withdraw Events ──
        const bridge = await getContract('BeZhasBridgeL2').catch(() => null);
        if (bridge) {
            // DepositFinalized(address to, uint256 amount, bytes32 srcTxHash)
            onEvent(bridge, 'DepositFinalized', (user, amount, srcTxHash, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: user,
                        toAddress: bridge.target,
                        value: amount.toString(),
                        contract: 'BeZhasBridgeL2',
                        method: 'DepositFinalized',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish('event:bridge:deposit', { ...txData, srcTxHash });
                    // Update bridge_transfers step if matching
                    await query(
                        `UPDATE bridge_transfers SET status = 'deposited', l2_tx_hash = $1, current_step = 2
                         WHERE sender = $2 AND status = 'initiated' AND created_at > NOW() - INTERVAL '1 hour'
                         ORDER BY created_at DESC LIMIT 1`,
                        [event.log.transactionHash, user]
                    ).catch(() => { });
                    stats.eventsPublished++;
                });
            });

            // WithdrawalInitiated(address from, address to, uint256 amount)
            onEvent(bridge, 'WithdrawalInitiated', (from, to, amount, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: from,
                        toAddress: to,
                        value: amount.toString(),
                        contract: 'BeZhasBridgeL2',
                        method: 'WithdrawalInitiated',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish('event:bridge:withdrawal', txData);
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: BeZhasBridgeL2.DepositFinalized/WithdrawalInitiated');
        }

        // ── LiquidityFarming Events ──
        const farming = await getContract('LiquidityFarming').catch(() => null);
        if (farming) {
            // Deposit(address user, uint256 pid, uint256 amount, uint256 lockDuration)
            onEvent(farming, 'Deposit', (provider, pid, amount, lockDuration, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: provider,
                        toAddress: farming.target,
                        value: amount.toString(),
                        contract: 'LiquidityFarming',
                        method: 'Deposit',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish('event:farming:liquidity_added', { ...txData, pid: pid.toString(), lockDuration: lockDuration.toString() });
                    stats.eventsPublished++;
                });
            });

            // Claim(address user, uint256 pid, uint256 amount)
            onEvent(farming, 'Claim', (user, pid, amount, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: farming.target,
                        toAddress: user,
                        value: amount.toString(),
                        contract: 'LiquidityFarming',
                        method: 'Claim',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish('event:farming:rewards_claimed', { ...txData, pid: pid.toString() });
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: LiquidityFarming.Deposit/Claim');
        }

        // ── ValidatorRegistry Events (enqueued + Redis publish) ──
        const validatorRegistry = await getContract('ValidatorRegistry').catch(() => null);
        if (validatorRegistry) {
            const vrEvents = [
                ['ValidatorRegistered', (op, name, stake) => ({ operator: op, companyName: name, initialStake: stake }), 'event:validator:registered'],
                ['StakeAdded', (op, amt, tier) => ({ operator: op, amount: amt, newTier: tier }), 'event:validator:stake_added'],
                ['UnbondingInitiated', (op, amt, at) => ({ operator: op, amount: amt, availableAt: at }), 'event:validator:unbonding'],
                ['StakeWithdrawn', (op, amt) => ({ operator: op, amount: amt }), 'event:validator:stake_withdrawn'],
                ['TierUpdated', (op, old, nw) => ({ operator: op, oldTier: old, newTier: nw }), 'event:validator:tier_updated'],
                ['HeartbeatRecorded', (op, ts) => ({ operator: op, timestamp: ts }), 'event:validator:heartbeat'],
                ['ContributionRecorded', (op, pts, task) => ({ operator: op, points: pts, taskType: task }), 'event:validator:contribution'],
                ['ValidatorSlashed', (op, amt, reason) => ({ operator: op, amount: amt, reason }), 'event:validator:slashed'],
                ['ValidatorDeactivated', (op, reason) => ({ operator: op, reason }), 'event:validator:deactivated'],
                ['ValidatorReactivated', (op) => ({ operator: op }), 'event:validator:reactivated'],
                ['SequencerEligibilityUpdated', (op, eligible) => ({ operator: op, eligible }), 'event:validator:sequencer_eligibility'],
            ];
            for (const [eventName, extractData, channel] of vrEvents) {
                onEvent(validatorRegistry, eventName, (...args) => {
                    stats.eventsReceived++;
                    stats.lastEventAt = Date.now();
                    const event = args[args.length - 1];
                    const dataArgs = args.slice(0, -1);
                    const eventData = extractData(...dataArgs);
                    enqueue(async () => {
                        await indexBlockchainEvent({
                            contractName: 'ValidatorRegistry', eventName, eventType: 'validator',
                            txHash: event.log.transactionHash, blockNumber: event.log.blockNumber,
                            logIndex: event.log.index, actorAddress: eventData.operator || null, eventData,
                        });
                        await publish(channel, normalizeValue(eventData));
                        stats.eventsPublished++;
                    });
                });
            }
            console.log('[EventListener] Subscribed: ValidatorRegistry (11 events)');
        }

        // ── SequencerRotation Events (enqueued + Redis publish) ──
        const sequencerRotation = await getContract('SequencerRotation').catch(() => null);
        if (sequencerRotation) {
            const srEvents = [
                ['EpochAdvanced', (epoch, seq) => ({ epoch, newSequencer: seq }), 'event:sequencer:epoch_advanced'],
                ['SequencerQueueUpdated', (len) => ({ queueLength: len }), 'event:sequencer:queue_updated'],
                ['ForcedRotation', (epoch, old, reason) => ({ epoch, oldSequencer: old, reason }), 'event:sequencer:forced_rotation'],
                ['BlocksReported', (epoch, seq, blocks) => ({ epoch, sequencer: seq, blocksProduced: blocks }), 'event:sequencer:blocks_reported'],
                ['FeesAccumulated', (seq, amt) => ({ sequencer: seq, amount: amt }), 'event:sequencer:fees_accumulated'],
                ['EpochLengthUpdated', (old, nw) => ({ oldLength: old, newLength: nw }), null],
                ['FeeShareUpdated', (old, nw) => ({ oldShare: old, newShare: nw }), null],
            ];
            for (const [eventName, extractData, channel] of srEvents) {
                onEvent(sequencerRotation, eventName, (...args) => {
                    stats.eventsReceived++;
                    stats.lastEventAt = Date.now();
                    const event = args[args.length - 1];
                    const dataArgs = args.slice(0, -1);
                    const eventData = extractData(...dataArgs);
                    enqueue(async () => {
                        await indexBlockchainEvent({
                            contractName: 'SequencerRotation', eventName, eventType: 'sequencer',
                            txHash: event.log.transactionHash, blockNumber: event.log.blockNumber,
                            logIndex: event.log.index, actorAddress: eventData.newSequencer || eventData.oldSequencer || eventData.sequencer || null, eventData,
                        });
                        if (channel) await publish(channel, normalizeValue(eventData));
                        stats.eventsPublished++;
                    });
                });
            }
            console.log('[EventListener] Subscribed: SequencerRotation (7 events)');
        }

        // ── EdgeNodeRewards Events (enqueued + Redis publish) ──
        const edgeNodeRewards = await getContract('EdgeNodeRewards').catch(() => null);
        if (edgeNodeRewards) {
            const enEvents = [
                ['NodeRegistered', (addr) => ({ nodeAddress: addr }), 'event:edge:node_registered'],
                ['NodeDeactivated', (addr) => ({ nodeAddress: addr }), 'event:edge:node_deactivated'],
                ['ValidationRecorded', (addr, pts, task) => ({ nodeAddress: addr, points: pts, taskType: task }), 'event:edge:validation_recorded'],
                ['RewardsClaimed', (addr, amt, boost) => ({ nodeAddress: addr, bezAmount: amt, boostBps: boost }), 'event:edge:rewards_claimed'],
                ['RewardRateUpdated', (old, nw) => ({ oldRate: old, newRate: nw }), null],
                ['ValidatorRegistryUpdated', (reg) => ({ newRegistry: reg }), null],
            ];
            for (const [eventName, extractData, channel] of enEvents) {
                onEvent(edgeNodeRewards, eventName, (...args) => {
                    stats.eventsReceived++;
                    stats.lastEventAt = Date.now();
                    const event = args[args.length - 1];
                    const dataArgs = args.slice(0, -1);
                    const eventData = extractData(...dataArgs);
                    enqueue(async () => {
                        await indexBlockchainEvent({
                            contractName: 'EdgeNodeRewards', eventName, eventType: 'edge-node',
                            txHash: event.log.transactionHash, blockNumber: event.log.blockNumber,
                            logIndex: event.log.index, actorAddress: eventData.nodeAddress || eventData.newRegistry || null, eventData,
                        });
                        if (channel) await publish(channel, normalizeValue(eventData));
                        stats.eventsPublished++;
                    });
                });
            }
            console.log('[EventListener] Subscribed: EdgeNodeRewards (6 events)');
        }

        // ── SlashingManager Events (enqueued + Redis publish) ──
        const slashingManager = await getContract('SlashingManager').catch(() => null);
        if (slashingManager) {
            onEvent(slashingManager, 'ValidatorSlashed', (...args) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                // ValidatorSlashed(uint256 slashId, address validator, uint8 infraction,
                //                  uint256 amount, string evidence)
                // El campo 3 es el TIPO de infracción, no el importe. Tomarlo como
                // importe dejaba cada sanción registrada como ~0 BEZ y guardaba los
                // wei en el campo de motivo — un libro de sanciones que no cuadraba
                // con la cadena y que no fallaba por ningún sitio.
                const [slashId, validator, infraction, amount, evidence] = args;
                const reason = INFRACTION_TYPES[Number(infraction)] ?? `unknown(${infraction})`;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'SlashingManager', eventName: 'ValidatorSlashed', eventType: 'slashing', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, actorAddress: validator, eventData: { slashId, validator, infraction: reason, amount, evidence } });
                    await query(
                        `INSERT INTO validator_slashes (operator, amount_bez, reason, tx_hash, block_number)
                         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tx_hash) DO NOTHING`,
                        [String(validator).toLowerCase(), Number(amount) / 1e18, `${reason}: ${evidence}`, event.log.transactionHash, event.log.blockNumber]
                    ).catch(() => { });
                    await publish('event:slashing:slashed', { slashId: slashId.toString(), validator, amount: amount.toString(), infraction: reason, evidence });
                    stats.eventsPublished++;
                });
            });
            onEvent(slashingManager, 'SlashAppealed', (...args) => {
                stats.eventsReceived++;
                const [slashId, validator] = args;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'SlashingManager', eventName: 'SlashAppealed', eventType: 'slashing', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, actorAddress: validator, eventData: { slashId, validator } });
                    await publish('event:slashing:appealed', { slashId: slashId.toString(), validator });
                    stats.eventsPublished++;
                });
            });
            onEvent(slashingManager, 'SlashReversed', (...args) => {
                stats.eventsReceived++;
                const [slashId, validator] = args;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'SlashingManager', eventName: 'SlashReversed', eventType: 'slashing', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, actorAddress: validator, eventData: { slashId, validator } });
                    await publish('event:slashing:reversed', { slashId: slashId.toString(), validator });
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: SlashingManager (3 events)');
        }

        // ── GovernanceSystem Events (enqueued + Redis publish) ──
        const governance = await getContract('GovernanceSystem').catch(() => null);
        if (governance) {
            onEvent(governance, 'ProposalCreated', (...args) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                const [proposalId, proposer, , , , description] = args;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'GovernanceSystem', eventName: 'ProposalCreated', eventType: 'governance', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, actorAddress: proposer, eventData: { proposalId, proposer, description } });
                    await publish('event:governance:proposal_created', { proposalId: proposalId.toString(), proposer, description });
                    stats.eventsPublished++;
                });
            });
            onEvent(governance, 'VoteCast', (...args) => {
                stats.eventsReceived++;
                const [voter, proposalId, support, weight, reason] = args;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'GovernanceSystem', eventName: 'VoteCast', eventType: 'governance', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, actorAddress: voter, eventData: { voter, proposalId, support, weight, reason } });
                    await publish('event:governance:vote_cast', { voter, proposalId: proposalId.toString(), support: support.toString() });
                    stats.eventsPublished++;
                });
            });
            onEvent(governance, 'ProposalExecuted', (...args) => {
                stats.eventsReceived++;
                const [proposalId] = args;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'GovernanceSystem', eventName: 'ProposalExecuted', eventType: 'governance', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, eventData: { proposalId } });
                    await publish('event:governance:proposal_executed', { proposalId: proposalId.toString() });
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: GovernanceSystem (3 events)');
        }

        console.log(`[EventListener] ${listeners.length} event subscriptions active.`);
    } catch (err) {
        console.error('[EventListener] Error starting listeners:', err.message);
    }
}

/**
 * Stop all event listeners.
 */
async function stopListening() {
    active = false;
    reconnecting = false;
    if (drainInterval) { clearInterval(drainInterval); drainInterval = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (livenessTimer) { clearInterval(livenessTimer); livenessTimer = null; }
    // Drain remaining queued events
    await drainQueue();
    await teardownListeners();
    console.log('[EventListener] All listeners stopped.');
}

module.exports = {
    // Expuesto sólo para pruebas: verifica que una suscripción caduca no
    // tumba el proceso. Ver __tests__/services/eventListener-subscriptions.test.js
    __onEvent: onEvent, __checkEvent: checkEvent, __backoffDelay: backoffDelay,
    startListening, stopListening, getListenerStats };
