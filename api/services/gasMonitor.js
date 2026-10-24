const { ethers } = require('ethers');
const { query } = require('../db/pool');
const { getProvider, getSigner } = require('./contractService');
const { sendBEZ } = require('./txService');

/**
 * OBSOLETO: ya no se arranca desde index.js; lo sustituye services/gasTank/treasuryWatch.js (sólo mide y avisa).
 * Se conserva con su test mientras se retira el modelo antiguo de gas_balances/gas_tank_address.
 *
 * Mide el saldo NATIVO (POL en Polygon) de cada gas_tank_address y avisa si baja
 * del umbral. Ese saldo no es BEZ: antes se comparaba y se registraba como BEZ.
 *
 * La recarga automática está APAGADA por defecto. Mueve fondos reales desde
 * DEPLOYER_PRIVATE_KEY y este daemon corre en cada instancia de la API, así que
 * sólo se activa a propósito con GAS_MONITOR_AUTORECHARGE=true. El diseño
 * definitivo (rellenado aprobado vía tx-signer) está en
 * docs/developer/GAS_TANK_PLAN_DESARROLLO.md.
 */
class GasMonitorService {
    constructor() {
        this.MIN_NATIVE_THRESHOLD = ethers.parseEther("1.0"); // 1 POL
        this.RECHARGE_AMOUNT_NATIVE = 50;
        this.isRunning = false;
    }

    get autoRechargeEnabled() {
        return process.env.GAS_MONITOR_AUTORECHARGE === 'true';
    }

    /**
     * Load enterprises from PostgreSQL instead of hardcoded array.
     */
    async getEnterprises() {
        const { rows } = await query(
            "SELECT id, name, gas_tank_address FROM enterprises WHERE is_active = true AND gas_tank_address IS NOT NULL"
        );
        return rows;
    }

    async checkAndRechargeEnterpriseNodes() {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log("🔍 [GasMonitor] Iniciando escaneo de Tanques de Gas corporativos...");

        try {
            const enterprises = await this.getEnterprises();
            if (enterprises.length === 0) {
                console.log("[GasMonitor] No enterprises with auto-recharge enabled.");
                return;
            }

            const provider = getProvider();

            for (const enterprise of enterprises) {
                const balance = await provider.getBalance(enterprise.gas_tank_address);
                const objBalance = parseFloat(ethers.formatEther(balance));

                // Upsert balance in DB. OJO: la columna se llama balance_bez pero guarda saldo nativo
                // hasta que la migración de la fase 1 la sustituya.
                const existing = await query(
                    'SELECT id FROM gas_balances WHERE enterprise_id = $1',
                    [enterprise.id]
                );
                if (existing.rows.length > 0) {
                    await query(
                        'UPDATE gas_balances SET balance_bez = $1, updated_at = NOW() WHERE enterprise_id = $2',
                        [objBalance, enterprise.id]
                    );
                } else {
                    await query(
                        'INSERT INTO gas_balances (enterprise_id, wallet_address, balance_bez) VALUES ($1, $2, $3)',
                        [enterprise.id, enterprise.gas_tank_address, objBalance]
                    );
                }

                console.log(`📊 [GasMonitor] Saldo nativo de ${enterprise.name}: ${objBalance}`);

                if (balance < this.MIN_NATIVE_THRESHOLD) {
                    if (!this.autoRechargeEnabled) {
                        console.warn(`⚠️ [GasMonitor] Saldo bajo para ${enterprise.name} (${objBalance} < 1.0). Auto-recarga desactivada: sólo aviso.`);
                        continue;
                    }
                    console.log(`⚠️ [GasMonitor] Saldo bajo para ${enterprise.name} (${objBalance} < 1.0). Auto-Recarga...`);

                    try {
                        const record = await sendBEZ(enterprise.gas_tank_address, this.RECHARGE_AMOUNT_NATIVE, {
                            contract: 'GasTankRecharge',
                            method: 'autoRecharge',
                        });

                        console.log(`✅ [GasMonitor] Recarga exitosa. TX: ${record.tx_hash}`);
                    } catch (error) {
                        console.error(`❌ [GasMonitor] Fallo al recargar gas para ${enterprise.name}:`, error.message);
                    }
                }
            }
        } catch (globalError) {
            console.error(`🚨 [GasMonitor] Error general del servicio:`, globalError.message);
        } finally {
            this.isRunning = false;
        }
    }

    startDaemon(intervalMs = 60000) {
        console.log(`🚀 [GasMonitor] Demonio iniciado. Ciclo de escaneo: ${intervalMs / 1000}s`);
        // Ejecución inmediata
        this.checkAndRechargeEnterpriseNodes();
        // Ciclos regulares
        setInterval(() => this.checkAndRechargeEnterpriseNodes(), intervalMs);
    }
}

module.exports = new GasMonitorService();
