'use strict';

/**
 * gasTank/treasuryWatch — vigila el saldo NATIVO (POL) de las wallets que pagan gas por BeZhas y avisa.
 *
 * Sustituye al arranque del gasMonitor: SOLO MIDE Y ALERTA. Nunca transfiere. Rellenar una wallet es
 * una decisión humana (o una intención aprobada en el tx-signer), no un bucle de la API que corre en
 * cada instancia.
 *
 *   GAS_TREASURY_WATCH         JSON: [{ "label": "operador", "address": "0x…", "minNative": 5 }]
 *   GAS_TREASURY_MIN_NATIVE    umbral por defecto (POL), 5
 *   GAS_TREASURY_ALERT_EMAIL   destinatario de los avisos (si falta, sólo log de error)
 *   GAS_TREASURY_ALERT_HOURS   horas entre avisos repetidos de la misma wallet, 6
 *
 * Si no hay configuración vigila la dirección de la clave de operador de la API (DEPLOYER_PRIVATE_KEY),
 * derivada en memoria: la clave nunca se registra.
 */

const { ethers } = require('ethers');
const logger = require('../../utils/logger');

function loadTargets(env = process.env) {
    const def = Number(env.GAS_TREASURY_MIN_NATIVE) > 0 ? Number(env.GAS_TREASURY_MIN_NATIVE) : 5;
    if (env.GAS_TREASURY_WATCH) {
        let raw;
        try { raw = JSON.parse(env.GAS_TREASURY_WATCH); } catch { throw new Error('GAS_TREASURY_WATCH no es JSON válido'); }
        if (!Array.isArray(raw)) throw new Error('GAS_TREASURY_WATCH debe ser una lista');
        return raw.map((t) => {
            if (!t.label || !ethers.isAddress(t.address)) throw new Error(`GAS_TREASURY_WATCH: entrada no válida (${t.label})`);
            return { label: String(t.label), address: ethers.getAddress(t.address), minNative: Number(t.minNative) > 0 ? Number(t.minNative) : def };
        });
    }
    if (env.DEPLOYER_PRIVATE_KEY) {
        try { return [{ label: 'operador-api', address: new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY).address, minNative: def }]; } catch { /* clave no válida: nada que vigilar */ }
    }
    return [];
}

function createWatch({ env = process.env, getProvider, sendMail, now = () => Date.now() } = {}) {
    getProvider = getProvider || require('../contractService').getProvider;
    sendMail = sendMail || require('../mailer').sendMail;
    const cooldownMs = (Number(env.GAS_TREASURY_ALERT_HOURS) > 0 ? Number(env.GAS_TREASURY_ALERT_HOURS) : 6) * 3600 * 1000;
    const lastAlert = new Map();
    let readings = [];
    let timer = null;

    async function check() {
        const targets = loadTargets(env);
        if (!targets.length) return (readings = []);
        const provider = getProvider();
        const out = [];
        for (const t of targets) {
            const r = { label: t.label, address: t.address, minNative: t.minNative, at: new Date(now()).toISOString() };
            try {
                r.balanceNative = Number(ethers.formatEther(await provider.getBalance(t.address)));
                r.low = r.balanceNative < t.minNative;
            } catch (err) {
                r.error = err.message;
            }
            out.push(r);
            if (r.low) await alert(r);
            else if (!r.error) lastAlert.delete(t.label);
        }
        readings = out;
        return out;
    }

    async function alert(r) {
        const prev = lastAlert.get(r.label);
        if (prev && now() - prev < cooldownMs) return;
        lastAlert.set(r.label, now());
        logger.error({ label: r.label, address: r.address, balance: r.balanceNative, min: r.minNative }, '[gasTank] wallet de gas por debajo del mínimo: rellenar a mano');
        if (!env.GAS_TREASURY_ALERT_EMAIL) return;
        try {
            await sendMail({
                to: env.GAS_TREASURY_ALERT_EMAIL,
                subject: `Gas Tank: saldo bajo en ${r.label}`,
                text: `La wallet ${r.label} (${r.address}) tiene ${r.balanceNative} POL, por debajo del mínimo de ${r.minNative}. ` +
                      `Las operaciones que paga se detendrán al agotarse. Rellénala con una intención aprobada; este servicio no mueve fondos.`,
            });
        } catch (err) {
            logger.warn({ err: err.message }, '[gasTank] aviso de saldo bajo no enviado');
        }
    }

    function start(intervalMs = 5 * 60_000) {
        if (timer) return;
        check().catch((e) => logger.warn({ err: e.message }, '[gasTank] treasuryWatch'));
        timer = setInterval(() => check().catch((e) => logger.warn({ err: e.message }, '[gasTank] treasuryWatch')), intervalMs);
        timer.unref?.();
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    return { check, start, stop, status: () => readings };
}

let shared = null;
const instance = () => (shared ||= createWatch());

module.exports = { createWatch, loadTargets, start: (ms) => instance().start(ms), stop: () => instance().stop(), status: () => instance().status() };
