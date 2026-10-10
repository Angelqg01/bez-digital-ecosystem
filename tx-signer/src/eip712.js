'use strict';

/**
 * Definición EIP-712 de la aprobación de una intención. Duplicada de
 * api/services/txApproval.js por el mismo motivo que canonical.js, con su test
 * de paridad.
 */

const { ethers } = require('ethers');

const DOMINIO = Object.freeze({ name: 'BeZhas Transaction Approval', version: '1' });

const TIPOS_APROBACION = Object.freeze({
    TransactionApproval: [
        { name: 'intentId', type: 'string' },
        { name: 'intentHash', type: 'bytes32' },
        { name: 'policyHash', type: 'bytes32' },
        { name: 'rail', type: 'string' },
        { name: 'asset', type: 'string' },
        { name: 'amount', type: 'string' },
        { name: 'destination', type: 'string' },
        { name: 'beneficiary', type: 'string' },
        { name: 'network', type: 'string' },
        { name: 'decision', type: 'string' },
        { name: 'expiresAt', type: 'uint64' },
    ],
});

function mensajeAprobacion(intentRecord, decision) {
    const i = intentRecord.intent;
    return {
        intentId: String(intentRecord.id),
        intentHash: intentRecord.intent_hash,
        policyHash: intentRecord.policy_hash,
        rail: i.rail,
        asset: i.asset,
        amount: i.amount,
        destination: `${i.destination.type}:${i.destination.value}`,
        beneficiary: i.destination.name || i.counterparty?.legalName || '',
        network: i.network || 'fiat',
        decision,
        expiresAt: Math.floor(Date.parse(i.expiresAt) / 1000),
    };
}

/** Dirección (minúsculas) que firmó APPROVE sobre esta intención, o null. */
function recuperarAprobador(intentRecord, firma) {
    try {
        return ethers.verifyTypedData(DOMINIO, TIPOS_APROBACION, mensajeAprobacion(intentRecord, 'APPROVE'), firma).toLowerCase();
    } catch {
        return null;
    }
}

module.exports = { DOMINIO, TIPOS_APROBACION, mensajeAprobacion, recuperarAprobador };
