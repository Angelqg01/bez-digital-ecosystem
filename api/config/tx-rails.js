'use strict';

/**
 * config/tx-rails.js — los cuatro carriles por los que BeZhas mueve valor, y lo
 * que cada uno exige.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ HAY CUATRO CARRILES Y NO «PAGOS»
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BeZhas opera cripto→cripto, FIAT→cripto, cripto→FIAT y FIAT→FIAT. Parecen
 * variantes de lo mismo y no lo son: cada uno cae bajo un marco distinto y
 * falla de forma distinta.
 *
 *   crypto_transfer  MiCA + Reglamento de transferencias de fondos (UE)
 *                    2023/1113 («travel rule»): datos de ordenante y
 *                    beneficiario, y verificación de titularidad de wallets
 *                    autoalojadas por encima de 1.000 €.
 *   fiat_to_crypto   Cobro FIAT (tarjeta/SEPA) y entrega de token. El cobro lo
 *                    hace el PSP; la entrega es un crypto_transfer aparte.
 *   crypto_to_fiat   Venta de token y pago FIAT a un IBAN. Suma los dos marcos.
 *   fiat_to_fiat     PSD2. Transmitir dinero de un tercero a otro es un servicio
 *                    de pago que exige licencia (entidad de pago / EMI). BeZhas
 *                    sin licencia sólo puede cobrar y pagar lo SUYO; los fondos
 *                    de clientes tienen que moverse por un socio licenciado.
 *                    Además, verificación del beneficiario (Reglamento de
 *                    Pagos Inmediatos 2024/886): el nombre tiene que casar con
 *                    el IBAN antes de enviar.
 *
 * Nada de esto es asesoramiento jurídico: es la codificación de las reglas que
 * ya condicionan el diseño. La clasificación concreta de BeZhas (y si el memo de
 * estructura exenta aguanta con custodia gestionada) la valida un abogado.
 */

const fs = require('fs');
const path = require('path');

/**
 * nivelRiesgo sigue la clasificación del documento de seguridad del MCP:
 * 0 lectura · 1 preparación · 2 operación financiera · 3 alta criticidad ·
 * 4 infraestructura. Todos los carriles son nivel 2: nunca accesibles a un
 * agente sin política y aprobación.
 */
const RAILS = Object.freeze({
    crypto_transfer: {
        nivelRiesgo: 2,
        scope: 'wallet',
        claseOrigen: 'cripto',
        destinos: ['evm_address'],
        kycMinimo: 1,
        travelRule: true,
        verificacionBeneficiario: false,
    },
    fiat_to_crypto: {
        nivelRiesgo: 2,
        scope: 'payments',
        claseOrigen: 'fiat',
        destinos: ['evm_address'],
        kycMinimo: 1,
        travelRule: true,
        verificacionBeneficiario: false,
    },
    crypto_to_fiat: {
        nivelRiesgo: 2,
        scope: 'payments',
        claseOrigen: 'cripto',
        destinos: ['iban'],
        kycMinimo: 1,
        travelRule: true,
        verificacionBeneficiario: true,
    },
    fiat_to_fiat: {
        nivelRiesgo: 2,
        scope: 'payments',
        claseOrigen: 'fiat',
        destinos: ['iban'],
        kycMinimo: 1,
        travelRule: false,
        verificacionBeneficiario: true,
    },
});

const FIAT_ASSETS = Object.freeze({
    EUR: { decimales: 2 },
    USD: { decimales: 2 },
});

/**
 * Activos cripto por cadena.
 *
 * BEZ sólo existe en Polygon: 0xEcBa…11A8, verificado en Sourcify y Blockscout
 * y confirmado por Yoel (2026-09-18). En BSC NO hay contrato BEZ: ni 0x8a1e…5b55
 * (tabla de CLAUDE.md) ni 0xEcBa…11A8 (deployments/56.json) tienen código,
 * comprobado en tres RPC independientes. Por eso no hay entrada 56: un
 * `transfer` a una dirección sin código no revierte, así que un «pago en BEZ por
 * BSC» saldría como éxito sin mover nada. Si algún día se despliega BEZ en BSC,
 * se añade aquí con su dirección verificada.
 *
 * USDC/USDT: contratos oficiales (Circle nativo en Polygon; Binance-Peg en BSC,
 * que usa 18 decimales, no 6).
 */
const CRYPTO_ASSETS = Object.freeze({
    BEZ: {
        estable: null,
        porCadena: {
            137: { address: '0xecba873b534c54de2b62acde232adca4369f11a8', decimales: 18 },
        },
    },
    USDC: {
        estable: 'USD',
        porCadena: {
            137: { address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', decimales: 6 },
            56: { address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', decimales: 18 },
        },
    },
    USDT: {
        estable: 'USD',
        porCadena: {
            137: { address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', decimales: 6 },
            56: { address: '0x55d398326f99059ff775485246999027b3197955', decimales: 18 },
        },
    },
});

/** BEZ en la L2 y en Anvil vive en los despliegues, que cambian con cada redeploy. */
function bezDesdeDespliegues(chainId) {
    try {
        const fichero = path.resolve(__dirname, '../../smart-contracts/deployments', `${chainId}.json`);
        const d = JSON.parse(fs.readFileSync(fichero, 'utf8'));
        const addr = d?.core?.BEZCoinV2 || d?.core?.BEZCoin || d?.tokens?.BEZCoin?.address;
        return /^0x[0-9a-fA-F]{40}$/.test(addr || '') ? { address: addr.toLowerCase(), decimales: 18 } : null;
    } catch {
        return null;
    }
}

/** `{ address, decimales, estable }` o null si ese activo no existe en esa cadena. */
function activoCripto(simbolo, chainId) {
    const def = CRYPTO_ASSETS[simbolo];
    if (!def) return null;
    let entrada = def.porCadena[chainId] || null;
    if (!entrada && simbolo === 'BEZ' && (chainId === 2708 || chainId === 31337)) {
        entrada = bezDesdeDespliegues(chainId);
    }
    return entrada ? { simbolo, ...entrada, estable: def.estable } : null;
}

const esFiat = (simbolo) => Object.prototype.hasOwnProperty.call(FIAT_ASSETS, simbolo);
const esCripto = (simbolo) => Object.prototype.hasOwnProperty.call(CRYPTO_ASSETS, simbolo);

/**
 * Proveedores FIAT.
 *
 *   licenciado          el proveedor tiene licencia para mover fondos de terceros.
 *   soloPrimeraParte    sólo puede usarse cuando BeZhas es parte (cobra o paga
 *                       lo suyo). Es el caso de la cuenta propia en ING.
 *   habilitado(env)     configurado en este despliegue.
 */
const PROVEEDORES_FIAT = Object.freeze({
    stripe: {
        rails: ['fiat_to_crypto'],
        licenciado: true,
        soloPrimeraParte: true,
        habilitado: (env) => Boolean(env.STRIPE_SECRET_KEY),
        nota: 'Stripe cobra a BeZhas como comerciante por la venta de BEZ propio. No transmite fondos entre terceros.',
    },
    sepa_ing_propia: {
        rails: ['fiat_to_crypto', 'crypto_to_fiat', 'fiat_to_fiat'],
        licenciado: false,
        soloPrimeraParte: true,
        habilitado: () => true,
        nota: 'Cuenta propia de BeZhas sin API de pagos: instrucción SEPA para ejecución manual, sólo con BeZhas como ordenante.',
    },
    onramp_partner: {
        rails: ['fiat_to_crypto', 'crypto_to_fiat'],
        licenciado: true,
        soloPrimeraParte: false,
        habilitado: (env) => ['moonpay', 'transak', 'ramp'].includes(env.ONRAMP_PROVIDER),
        nota: 'El proveedor (CASP/EMI) hace el KYC y mueve los fondos; BeZhas deriva al cliente.',
    },
    emi_partner: {
        rails: ['fiat_to_fiat', 'crypto_to_fiat'],
        licenciado: true,
        soloPrimeraParte: false,
        habilitado: (env) => Boolean(env.FIAT_PARTNER_API_URL && env.FIAT_PARTNER_API_KEY),
        nota: 'Entidad de pago / EMI socia: custodia y transmite los fondos del cliente con su licencia y su SCA.',
    },
});

/**
 * Jurisdicciones.
 *
 * BLOQUEADAS: lista de «llamada a la acción» del GAFI (Corea del Norte, Irán,
 * Myanmar). Se bloquea: no hay importe ni aprobación que lo justifique.
 * REFORZADAS: diligencia reforzada, pide aprobación humana. Coincide con la que
 * ya usaba business-ops/src/compliance/screening.js para no tener dos criterios.
 *
 * Las dos listas cambian (la de terceros países de alto riesgo de la UE, el
 * Reglamento Delegado 2016/1675, se revisa varias veces al año). Son
 * configurables por entorno y las tiene que mantener cumplimiento, no el código.
 */
function listaPaises(raw, porDefecto) {
    if (!raw) return porDefecto;
    return String(raw).split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s));
}
const jurisdiccionesBloqueadas = (env = process.env) =>
    new Set(listaPaises(env.TX_BLOCKED_COUNTRIES, ['KP', 'IR', 'MM']));
const jurisdiccionesReforzadas = (env = process.env) =>
    new Set(listaPaises(env.TX_ENHANCED_DUE_DILIGENCE_COUNTRIES, ['RU', 'BY', 'SY', 'CU', 'VE', 'SD']));

/** Países SEPA con la longitud de su IBAN. Fuera de aquí es SWIFT: más lento, más caro, más riesgo. */
const IBAN_SEPA = Object.freeze({
    AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20,
    ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28, IE: 22, IS: 26,
    IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28,
    PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27, VA: 22,
});

module.exports = {
    RAILS, FIAT_ASSETS, CRYPTO_ASSETS, PROVEEDORES_FIAT, IBAN_SEPA,
    activoCripto, esFiat, esCripto,
    jurisdiccionesBloqueadas, jurisdiccionesReforzadas,
};
