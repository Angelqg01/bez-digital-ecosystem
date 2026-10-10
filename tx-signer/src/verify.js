'use strict';

/**
 * verify — todo lo que el firmante comprueba POR SU CUENTA antes de firmar.
 *
 * Regla de oro (§54): el firmante acepta una petición firmada, nunca una orden
 * cruda de una IA. Y no se fía de la API: recalcula el hash de la intención,
 * reconstruye él mismo la calldata, recalcula el policyHash, verifica cada
 * firma EIP-712 contra SU lista de aprobadores y aplica SUS topes. Lo único que
 * acepta de la API sin reconstruir es el nonce y el gas, y el gas va acotado.
 *
 * Cualquier discrepancia es un error con código: el firmante falla cerrado.
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const { hashCanonico, sha256Hex } = require('./canonical');
const { recuperarAprobador } = require('./eip712');

const ERC20 = new ethers.Interface(['function transfer(address to, uint256 amount) returns (bool)']);
const VENTANA_S = 60;

function rechazo(code, status, message) {
    const e = new Error(message);
    e.code = code;
    e.status = status;
    return e;
}

/** Nonces de petición vistos; caducan con la ventana de tiempo. */
function crearRegistroNonces() {
    const vistos = new Map();
    return {
        usar(nonce, ahoraMs) {
            for (const [n, hasta] of vistos) if (hasta < ahoraMs) vistos.delete(n);
            if (vistos.has(nonce)) return false;
            vistos.set(nonce, ahoraMs + VENTANA_S * 2 * 1000);
            return true;
        },
    };
}

function verificarHmac({ headers, cuerpo, clave, nonces, ahoraMs = Date.now() }) {
    const ts = headers['x-bezhas-timestamp'];
    const nonce = headers['x-bezhas-nonce'];
    const firma = headers['x-bezhas-signature'];
    if (!ts || !nonce || !firma) throw rechazo('REQUEST_UNSIGNED', 401, 'Petición sin firmar.');
    if (!/^\d{10}$/.test(ts) || Math.abs(ahoraMs / 1000 - Number(ts)) > VENTANA_S) {
        throw rechazo('REQUEST_STALE', 401, 'Marca de tiempo fuera de ventana.');
    }
    const hashCuerpo = sha256Hex(cuerpo).slice(2);
    const esperada = crypto.createHmac('sha256', clave).update(`${ts}.${nonce}.${hashCuerpo}`).digest('hex');
    const a = Buffer.from(String(firma));
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw rechazo('REQUEST_SIGNATURE_INVALID', 401, 'Firma de petición no válida.');
    }
    if (!nonces.usar(String(nonce), ahoraMs)) throw rechazo('REQUEST_REPLAYED', 409, 'Petición repetida.');
}

const aMinimas = (decimal, decimales) => ethers.parseUnits(String(decimal), decimales);

/**
 * @returns {{ cartera, activo, cantidad:bigint, tx:object, aprobadores:string[] }}
 */
function verificarSolicitud({ peticion, config, almacen, ahora = new Date() }) {
    if (config.lockdownActivo()) throw rechazo('LOCKDOWN', 423, 'Firmante en LOCKDOWN.');

    const { intentId, intent, intentHash, policy, approvals, tx } = peticion || {};
    if (!intent || !intentHash || !policy || !Array.isArray(approvals) || !tx || !intentId) {
        throw rechazo('REQUEST_INCOMPLETE', 400, 'Petición incompleta.');
    }

    // 1. La intención es la que dice ser.
    if (hashCanonico(intent) !== intentHash) throw rechazo('INTENT_HASH_MISMATCH', 422, 'El hash no corresponde a la intención.');

    // 2. Vigente, y con una caducidad razonable.
    const caduca = Date.parse(intent.expiresAt);
    const creada = Date.parse(intent.createdAt);
    if (!(caduca > ahora.getTime())) throw rechazo('INTENT_EXPIRED', 410, 'Intención caducada.');
    if (!(caduca - creada <= config.maxIntentTtlSeconds * 1000)) throw rechazo('INTENT_TTL_TOO_LONG', 422, 'Caducidad demasiado larga.');

    // 3. Sólo lo que este firmante sabe firmar: transferencia desde tesorería.
    if (intent.rail !== 'crypto_transfer' || intent.custody !== 'bezhas' || intent.source?.type !== 'bezhas_treasury') {
        throw rechazo('INTENT_NOT_SIGNABLE', 422, 'Este firmante sólo firma transferencias cripto desde la tesorería.');
    }

    // 4. Red.
    const chainId = Number(intent.chainId);
    if (!config.allowedChainIds.has(chainId) || Number(tx.chainId) !== chainId) {
        throw rechazo('CHAIN_NOT_ALLOWED', 422, 'Cadena no permitida o distinta de la intención.');
    }

    // 5. Activo según el registro del firmante, no según la API.
    const activo = config.activo(intent.asset, chainId);
    if (!activo) throw rechazo('ASSET_NOT_ALLOWED', 422, `${intent.asset} no está permitido en ${chainId}.`);
    if (String(intent.tokenAddress || '').toLowerCase() !== activo.address
        || String(tx.to || '').toLowerCase() !== activo.address) {
        throw rechazo('CONTRACT_MISMATCH', 422, 'El contrato no es el registrado para ese activo.');
    }
    if (Number(intent.decimals) !== activo.decimals) throw rechazo('DECIMALS_MISMATCH', 422, 'Decimales distintos del registro.');

    // 6. Importe y destino, y la calldata reconstruida aquí.
    const cantidad = BigInt(intent.amountMinor);
    if (cantidad <= 0n) throw rechazo('AMOUNT_INVALID', 422, 'Importe no válido.');
    let destino;
    try { destino = ethers.getAddress(intent.destination?.value); } catch { throw rechazo('DESTINATION_INVALID', 422, 'Destino no válido.'); }
    const cartera = config.carteraPara(chainId);
    if (!cartera) throw rechazo('NO_WALLET', 422, `No hay cartera configurada para ${chainId}.`);
    if (cartera.allowedDestinations && !cartera.allowedDestinations.map((d) => d.toLowerCase()).includes(destino.toLowerCase())) {
        throw rechazo('DESTINATION_NOT_ALLOWED', 403, 'Destino fuera de la lista de la cartera.');
    }
    const dataEsperada = ERC20.encodeFunctionData('transfer', [destino, cantidad]);
    if (String(tx.data || '').toLowerCase() !== dataEsperada.toLowerCase()) {
        throw rechazo('CALLDATA_MISMATCH', 422, 'La calldata no es la transferencia aprobada.');
    }
    if (BigInt(tx.value || 0) !== 0n) throw rechazo('VALUE_NOT_ZERO', 422, 'Una transferencia ERC-20 no lleva valor nativo.');

    // 7. Gas acotado.
    const gasLimit = BigInt(tx.gasLimit);
    const maxFee = BigInt(tx.maxFeePerGas);
    const prioridad = BigInt(tx.maxPriorityFeePerGas);
    if (gasLimit <= 0n || gasLimit > config.maxGasLimit) throw rechazo('GAS_LIMIT_EXCEEDED', 422, 'Límite de gas fuera de rango.');
    if (maxFee <= 0n || maxFee > config.maxFeePerGas || prioridad > maxFee) throw rechazo('GAS_PRICE_EXCEEDED', 422, 'Precio de gas fuera de rango.');
    if (!Number.isInteger(Number(tx.nonce)) || Number(tx.nonce) < 0) throw rechazo('NONCE_INVALID', 422, 'Nonce no válido.');

    // 8. La política que se aprobó es la que dice ser.
    const policyHash = hashCanonico({
        intentHash, policyVersion: policy.policyVersion, decision: policy.decision, requiredApprovals: policy.requiredApprovals,
    });
    if (policyHash !== policy.policyHash) throw rechazo('POLICY_HASH_MISMATCH', 422, 'El policyHash no corresponde.');
    if (policy.decision !== 'REQUIRE_APPROVAL') {
        // Salir de la tesorería sin aprobación no existe, diga lo que diga la API.
        throw rechazo('APPROVAL_REQUIRED', 403, 'La tesorería sólo firma operaciones aprobadas.');
    }

    // 9. Aprobaciones: firmas EIP-712 de aprobadores de SU lista, distintos.
    let requeridas = Math.max(Number(policy.requiredApprovals) || 0, config.minApprovals);
    const umbralDoble = config.dualApprovalAbove[intent.asset];
    if (umbralDoble !== undefined && cantidad >= aMinimas(umbralDoble, activo.decimals)) requeridas = Math.max(requeridas, 2);
    const registro = { id: intentId, intent, intent_hash: intentHash, policy_hash: policy.policyHash };
    const validos = new Set();
    for (const a of approvals) {
        if (a?.decision !== 'APPROVE') continue;
        const dir = recuperarAprobador(registro, a.signature);
        if (dir && (config.aprobadores.get(dir) || []).includes('treasury')) validos.add(dir);
    }
    if (validos.size < requeridas) {
        throw rechazo('APPROVALS_INSUFFICIENT', 403, `Aprobaciones válidas: ${validos.size} de ${requeridas}.`);
    }

    // 10. Una intención, una transacción. Re-firmar sólo con el MISMO nonce
    //     (reintento de difusión); con otro sería un segundo pago.
    const previa = almacen.firmada(intentHash);
    if (previa && Number(previa.nonce) !== Number(tx.nonce)) {
        throw rechazo('INTENT_ALREADY_SIGNED', 409, 'Esta intención ya se firmó con otro nonce.');
    }

    // 11. Topes propios de la cartera.
    const tope = cartera.limits[intent.asset];
    if (!tope) throw rechazo('NO_LIMIT_FOR_ASSET', 403, `La cartera no tiene tope para ${intent.asset}: no se firma.`);
    if (cantidad > aMinimas(tope.perTx, activo.decimals)) throw rechazo('LIMIT_PER_TX', 403, 'Supera el tope por operación del firmante.');
    if (!previa && almacen.gastadoHoy(cartera.id, intent.asset, ahora) + cantidad > aMinimas(tope.daily, activo.decimals)) {
        throw rechazo('LIMIT_DAILY', 403, 'Supera el tope diario del firmante.');
    }

    return {
        cartera,
        activo,
        cantidad,
        aprobadores: [...validos],
        tx: {
            type: 2,
            chainId,
            nonce: Number(tx.nonce),
            to: ethers.getAddress(activo.address),
            data: dataEsperada,
            value: 0n,
            gasLimit,
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: prioridad,
        },
    };
}

module.exports = { verificarHmac, verificarSolicitud, crearRegistroNonces, rechazo };
