#!/usr/bin/env node
'use strict';

/**
 * Keeper de la observación TWAP de BeZhasDEX (ver services/dexKeeper.js y
 * docs/runbooks/DEX-KEEPER.md). Una pasada y sale: pensado para un Cloud Run Job con
 * Cloud Scheduler cada 30 min, o para cron / un temporizador de systemd.
 *
 *   node scripts/dex-keeper.js              una pasada
 *   node scripts/dex-keeper.js --dry-run    simula sin enviar ni gastar gas
 *   node scripts/dex-keeper.js --loop       repite cada DEX_KEEPER_INTERVAL_SECONDS (def. 300)
 *
 * Variables:
 *   DEX_KEEPER_KEY              clave de una wallet DEDICADA (sólo paga gas). Obligatoria.
 *   BEZHAS_DEX_ADDRESS          dirección de BeZhasDEX. Obligatoria.
 *   DEX_KEEPER_RPC_URL          RPC (def.: POLYGON_RPC_URL, y si no, un RPC público de Polygon)
 *   DEX_KEEPER_CHAIN_ID         cadena esperada (def.: la de la API, 137 en producción)
 *   DEX_KEEPER_MAX_GWEI         tope de maxFeePerGas (def. 300)
 *   DEX_KEEPER_MIN_BALANCE      saldo mínimo de la clave, en moneda nativa (def. 0.02)
 *   DEX_KEEPER_CONFIRMATIONS    confirmaciones que espera (def. 2; 1 en cadenas que sólo minan con tx)
 *   BEZ_TOKEN_ADDRESS, DEX_USDC_ADDRESS   par a observar (def.: BEZ y USDC de Polygon)
 *
 * Imprime un resumen sin secretos. Sale con 1 si algo falla (clave sin saldo, cadena
 * equivocada, RPC caído…) para que el trabajo figure como fallido y salte la alerta.
 */

// Antes que nada: si la clave controlara una dirección protegida, hotKeyGuard la retira.
require('../services/hotKeyGuard').revisar();

const { ethers } = require('ethers');
const { ejecutar, KeeperError } = require('../services/dexKeeper');
const { cadenaPorDefecto } = require('../config/chain-policy');

const BEZ_POLYGON = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const USDC_POLYGON = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

const dryRun = process.argv.includes('--dry-run');
const loop = process.argv.includes('--loop');

async function pasada() {
    const clave = process.env.DEX_KEEPER_KEY;
    if (!clave) throw new KeeperError('CONFIG', 'Falta DEX_KEEPER_KEY (wallet dedicada del keeper)');

    const provider = new ethers.JsonRpcProvider(
        process.env.DEX_KEEPER_RPC_URL || process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com');
    const signer = new ethers.Wallet(clave.trim(), provider);

    const r = await ejecutar({
        provider, signer,
        dexAddress: process.env.BEZHAS_DEX_ADDRESS,
        tokenA: process.env.BEZ_TOKEN_ADDRESS || BEZ_POLYGON,
        tokenB: process.env.DEX_USDC_ADDRESS || USDC_POLYGON,
        expectedChainId: Number(process.env.DEX_KEEPER_CHAIN_ID || cadenaPorDefecto()),
        maxGwei: Number(process.env.DEX_KEEPER_MAX_GWEI || 300),
        minBalanceWei: ethers.parseEther(process.env.DEX_KEEPER_MIN_BALANCE || '0.02'),
        confirmations: Number(process.env.DEX_KEEPER_CONFIRMATIONS || 2),
        dryRun,
        log: (m) => console.log(`[DEX-KEEPER] ${m}`),
    });
    const { estado, txHash, edadSegundos, proximaEnSegundos, gwei } = r;
    console.log(`[DEX-KEEPER] estado=${estado} keeper=${r.direccion}`
        + (txHash ? ` tx=${txHash}` : '')
        + (edadSegundos != null ? ` edad=${edadSegundos}s` : '')
        + (proximaEnSegundos != null ? ` proxima_en=${proximaEnSegundos}s` : '')
        + (gwei != null ? ` gwei=${gwei}` : ''));
    return r;
}

(async () => {
    if (!loop) {
        try { await pasada(); process.exit(0); } catch (err) {
            console.error(`[DEX-KEEPER] error${err.code ? ` (${err.code})` : ''}: ${err.shortMessage || err.message}`);
            process.exit(1);
        }
    }
    const cada = Math.max(30, Number(process.env.DEX_KEEPER_INTERVAL_SECONDS || 300)) * 1000;
    // En bucle un fallo no mata el proceso: se registra y se reintenta en la siguiente vuelta.
    for (;;) {
        try { await pasada(); } catch (err) {
            console.error(`[DEX-KEEPER] error${err.code ? ` (${err.code})` : ''}: ${err.shortMessage || err.message}`);
        }
        await new Promise((r) => setTimeout(r, cada));
    }
})();
