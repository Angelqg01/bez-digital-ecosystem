'use strict';

/**
 * txIntent — la intención de una operación, validada y normalizada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ INTENCIÓN Y NO TRANSACCIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un agente nunca entrega bytes de transacción. Entrega QUÉ quiere hacer
 * («pagar 1.000 USDC a este proveedor por esta factura») y el backend construye
 * el CÓMO. Así el agente no controla campos que no entiende —calldata, gas, a
 * qué contrato se llama— y un modelo equivocado o manipulado no puede colar un
 * `approve` ilimitado disfrazado de pago.
 *
 * La normalización fija lo que la firma humana y el firmante verán: importes en
 * unidades mínimas (nunca coma flotante), direcciones con checksum, IBAN
 * validado, red resuelta contra la lista cerrada, caducidad. El hash de ESTE
 * objeto es lo que se aprueba; cualquier cambio posterior lo invalida.
 */

const crypto = require('crypto');
const { z } = require('zod');
const { ethers } = require('ethers');

const { RAILS, FIAT_ASSETS, IBAN_SEPA, activoCripto, esFiat, esCripto } = require('../config/tx-rails');
const { resolverCadena, chainIdPorRed, MAINNET, TESTNET, LOCAL } = require('../config/chain-policy');
const { hashCanonico } = require('./txCanonical');
const { TxError } = require('./txErrors');

const VERSION_INTENCION = 1;
const CADUCIDAD_POR_DEFECTO_S = 900;

const REDES = [...Object.values(MAINNET), ...Object.values(TESTNET), ...Object.values(LOCAL)];
const ISO2 = z.string().regex(/^[A-Z]{2}$/, 'Código de país ISO 3166-1 alfa-2 en mayúsculas');
// Juego de caracteres SEPA para el concepto: lo que el banco no acepta, mejor
// rechazarlo aquí que descubrirlo en la devolución.
const CONCEPTO_SEPA = /^[A-Za-z0-9 /\-?:().,'+]*$/;

const PROPOSITOS = [
    'invoice_payment', 'supplier_payment', 'payroll', 'refund', 'treasury',
    'token_purchase', 'token_sale', 'escrow_release', 'other',
];

const esquemaDestino = z.strictObject({
    type: z.enum(['evm_address', 'iban']),
    value: z.string().min(3).max(64),
    name: z.string().min(2).max(140).optional(),
    country: ISO2.optional(),
    // Wallet autoalojada (no de un CASP). Por encima de 1.000 € el reglamento
    // de transferencias pide acreditar que es de quien dice ser.
    selfHosted: z.boolean().optional(),
    ownershipProof: z.enum(['signed_message', 'satoshi_test', 'custodian_attestation']).optional(),
});

const esquemaOrigen = z.strictObject({
    type: z.enum(['evm_address', 'bezhas_treasury', 'client_balance', 'card', 'sepa_incoming']),
    value: z.string().min(3).max(64).optional(),
});

const esquemaContraparte = z.strictObject({
    legalName: z.string().min(2).max(140),
    country: ISO2,
    taxResidence: ISO2.optional(),   // DAC8
    lei: z.string().regex(/^[A-Z0-9]{20}$/).optional(),
    vatId: z.string().regex(/^[A-Z0-9]{4,20}$/).optional(),
});

const esquemaIntencion = z.strictObject({
    rail: z.enum(Object.keys(RAILS)),
    asset: z.string().regex(/^[A-Z0-9]{2,10}$/),
    amount: z.string().regex(/^\d{1,15}(\.\d{1,18})?$/, 'Importe decimal en texto, con punto'),
    targetAsset: z.string().regex(/^[A-Z0-9]{2,10}$/).optional(),
    network: z.enum(REDES).optional(),
    source: esquemaOrigen,
    destination: esquemaDestino,
    purpose: z.enum(PROPOSITOS),
    reference: z.string().max(140).regex(CONCEPTO_SEPA, 'Concepto con caracteres no admitidos por SEPA').optional(),
    counterparty: esquemaContraparte.optional(),
    provider: z.string().regex(/^[a-z_]{2,40}$/).optional(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
    expiresInSeconds: z.number().int().min(60).max(86400).optional(),
});

// ── Importes ────────────────────────────────────────────────────────────────

function aUnidadesMinimas(importe, decimales) {
    const [entera, fraccion = ''] = importe.split('.');
    if (fraccion.length > decimales) {
        throw new TxError('AMOUNT_PRECISION', 400,
            `El activo admite como mucho ${decimales} decimales.`);
    }
    const digitos = `${entera}${fraccion.padEnd(decimales, '0')}`.replace(/^0+(?=\d)/, '');
    return BigInt(digitos).toString();
}

function desdeUnidadesMinimas(minimas, decimales) {
    if (decimales === 0) return BigInt(minimas).toString();
    const s = BigInt(minimas).toString().padStart(decimales + 1, '0');
    const entera = s.slice(0, -decimales);
    const fraccion = s.slice(-decimales).replace(/0+$/, '');
    return fraccion ? `${entera}.${fraccion}` : entera;
}

// ── IBAN ────────────────────────────────────────────────────────────────────

/** Normaliza y valida un IBAN (ISO 13616, módulo 97). */
function validarIban(entrada) {
    const iban = String(entrada || '').replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return { valido: false, motivo: 'formato' };
    const pais = iban.slice(0, 2);
    const longitudSepa = IBAN_SEPA[pais];
    if (longitudSepa && iban.length !== longitudSepa) return { valido: false, motivo: 'longitud' };

    const reordenado = iban.slice(4) + iban.slice(0, 4);
    const numerico = reordenado.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let resto = 0;
    for (let i = 0; i < numerico.length; i += 7) {
        resto = Number(`${resto}${numerico.slice(i, i + 7)}`) % 97;
    }
    if (resto !== 1) return { valido: false, motivo: 'digito_control' };
    return { valido: true, iban, pais, sepa: Boolean(longitudSepa) };
}

// ── Direcciones ─────────────────────────────────────────────────────────────

/**
 * Dirección EVM con checksum. Una dirección en mayúsculas y minúsculas mezcladas
 * con checksum incorrecto es casi siempre un error de copia: se rechaza en vez
 * de «corregirla» a otra dirección válida.
 */
function normalizarDireccion(valor, campo) {
    let checksum;
    try {
        checksum = ethers.getAddress(valor);
    } catch {
        throw new TxError('ADDRESS_INVALID', 400, `${campo}: dirección EVM no válida o con checksum incorrecto.`);
    }
    if (checksum === ethers.ZeroAddress) {
        throw new TxError('ADDRESS_INVALID', 400, `${campo}: la dirección cero quema los fondos.`);
    }
    return checksum;
}

// ── API ─────────────────────────────────────────────────────────────────────

/** Valida la forma. Lanza TxError INTENT_INVALID con la lista de campos. */
function parsear(entrada) {
    const r = esquemaIntencion.safeParse(entrada);
    if (!r.success) {
        throw new TxError('INTENT_INVALID', 400, 'La intención no es válida.',
            r.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })));
    }
    return r.data;
}

/**
 * Normaliza una intención ya parseada.
 * @param {object} d  salida de parsear()
 * @param {object} ctx { appId, enterpriseId, agentId, ahora?:Date, env? }
 */
function normalizar(d, ctx) {
    const rail = RAILS[d.rail];
    const env = ctx.env || process.env;
    const ahora = ctx.ahora || new Date();

    if (!rail.destinos.includes(d.destination.type)) {
        throw new TxError('INTENT_INCONSISTENT', 400,
            `El carril ${d.rail} paga a ${rail.destinos.join(' o ')}, no a ${d.destination.type}.`);
    }
    const origenEsCripto = rail.claseOrigen === 'cripto';
    if (origenEsCripto && !esCripto(d.asset)) {
        throw new TxError('INTENT_INCONSISTENT', 400, `${d.rail} mueve un activo cripto; ${d.asset} no lo es.`);
    }
    if (!origenEsCripto && !esFiat(d.asset)) {
        throw new TxError('INTENT_INCONSISTENT', 400, `${d.rail} parte de FIAT; ${d.asset} no lo es.`);
    }
    if (d.rail === 'fiat_to_crypto' && !esCripto(d.targetAsset || '')) {
        throw new TxError('INTENT_INCONSISTENT', 400, 'fiat_to_crypto necesita targetAsset cripto (p. ej. BEZ).');
    }
    if (d.rail === 'crypto_to_fiat' && !esFiat(d.targetAsset || '')) {
        throw new TxError('INTENT_INCONSISTENT', 400, 'crypto_to_fiat necesita targetAsset FIAT (EUR o USD).');
    }

    // Tipos de origen válidos por carril. `bezhas_treasury` es BeZhas pagando lo
    // suyo; `client_balance` es dinero del cliente en un socio licenciado.
    const origenesValidos = {
        crypto_transfer: ['evm_address', 'bezhas_treasury'],
        fiat_to_crypto: ['card', 'sepa_incoming', 'client_balance'],
        crypto_to_fiat: ['evm_address', 'bezhas_treasury'],
        fiat_to_fiat: ['client_balance', 'bezhas_treasury'],
    }[d.rail];
    if (!origenesValidos.includes(d.source.type)) {
        throw new TxError('INTENT_INCONSISTENT', 400,
            `Origen ${d.source.type} no válido para ${d.rail} (admite ${origenesValidos.join(', ')}).`);
    }

    // Red: sólo cuando interviene cripto, y siempre explícita en la intención.
    // Aquí no hay «red por defecto»: aprobar un pago sin saber en qué red va
    // es aprobar a ciegas.
    const interviniendoCripto = origenEsCripto || d.rail === 'fiat_to_crypto';
    let chainId = null;
    let activo = null;
    if (interviniendoCripto) {
        if (!d.network) throw new TxError('NETWORK_REQUIRED', 400, 'Indica la red (network) de la parte cripto.');
        const cadena = resolverCadena(chainIdPorRed(d.network), env);
        if (!cadena.ok) throw new TxError(cadena.code, 400, cadena.message);
        chainId = cadena.chainId;
        const simboloCripto = origenEsCripto ? d.asset : d.targetAsset;
        activo = activoCripto(simboloCripto, chainId);
        if (!activo) {
            throw new TxError('ASSET_NOT_SUPPORTED', 400, `${simboloCripto} no está registrado en ${d.network}.`);
        }
    } else if (d.network) {
        throw new TxError('INTENT_INCONSISTENT', 400, 'Una operación sólo FIAT no lleva red.');
    }

    const decimales = origenEsCripto ? activo.decimales : FIAT_ASSETS[d.asset].decimales;
    const amountMinor = aUnidadesMinimas(d.amount, decimales);
    if (BigInt(amountMinor) <= 0n) throw new TxError('AMOUNT_INVALID', 400, 'El importe tiene que ser mayor que cero.');

    const destino = { type: d.destination.type };
    if (d.destination.type === 'evm_address') {
        destino.value = normalizarDireccion(d.destination.value, 'destination.value');
        if (activo && destino.value.toLowerCase() === activo.address) {
            throw new TxError('ADDRESS_INVALID', 400, 'El destino es el propio contrato del token: los fondos se perderían.');
        }
    } else {
        const iban = validarIban(d.destination.value);
        if (!iban.valido) throw new TxError('IBAN_INVALID', 400, `IBAN no válido (${iban.motivo}).`);
        destino.value = iban.iban;
        destino.ibanCountry = iban.pais;
        destino.sepa = iban.sepa;
    }
    for (const k of ['name', 'country', 'selfHosted', 'ownershipProof']) {
        if (d.destination[k] !== undefined) destino[k] = d.destination[k];
    }

    const origen = { type: d.source.type };
    if (d.source.type === 'evm_address') {
        if (!d.source.value) throw new TxError('INTENT_INVALID', 400, 'source.value es obligatorio para evm_address.');
        origen.value = normalizarDireccion(d.source.value, 'source.value');
    } else if (d.source.value) {
        origen.value = d.source.value;
    }

    // Quién custodia lo que se mueve decide quién firma:
    //   self      el cliente firma con su wallet; BeZhas sólo prepara.
    //   bezhas    sale de la tesorería de BeZhas; firma el tx-signer aislado.
    //   partner   dinero del cliente en un socio licenciado.
    //   provider  cobro entrante (tarjeta, SEPA): no sale nada de BeZhas aquí.
    const custodia = {
        evm_address: 'self', bezhas_treasury: 'bezhas', client_balance: 'partner',
        card: 'provider', sepa_incoming: 'provider',
    }[d.source.type];

    const segundos = d.expiresInSeconds || CADUCIDAD_POR_DEFECTO_S;
    return {
        version: VERSION_INTENCION,
        appId: String(ctx.appId),
        enterpriseId: ctx.enterpriseId ? String(ctx.enterpriseId) : null,
        agentId: ctx.agentId ? String(ctx.agentId) : null,
        rail: d.rail,
        asset: d.asset,
        amount: desdeUnidadesMinimas(amountMinor, decimales),
        amountMinor,
        decimals: decimales,
        targetAsset: d.targetAsset || null,
        chainId,
        network: d.network || null,
        tokenAddress: activo ? ethers.getAddress(activo.address) : null,
        source: origen,
        destination: destino,
        purpose: d.purpose,
        reference: d.reference || null,
        counterparty: d.counterparty || null,
        provider: d.provider || null,
        custody: custodia,
        idempotencyKey: d.idempotencyKey,
        // El nonce hace que dos intenciones idénticas en todo lo demás tengan
        // hashes distintos: una aprobación nunca vale para dos pagos.
        nonce: crypto.randomBytes(16).toString('hex'),
        createdAt: ahora.toISOString(),
        expiresAt: new Date(ahora.getTime() + segundos * 1000).toISOString(),
    };
}

const hashIntencion = (normalizada) => hashCanonico(normalizada);

/** Huella de la PETICIÓN (no de la intención): misma clave con otro cuerpo → 409. */
const huellaPeticion = (entrada) => hashCanonico(entrada);

module.exports = {
    VERSION_INTENCION, PROPOSITOS, REDES,
    esquemaIntencion, parsear, normalizar, hashIntencion, huellaPeticion,
    aUnidadesMinimas, desdeUnidadesMinimas, validarIban, normalizarDireccion,
};
