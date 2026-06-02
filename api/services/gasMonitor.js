const { ethers } = require('ethers');
const { query } = require('../db/pool');
const { getProvider, getSigner } = require('./contractService');
const { sendBEZ } = require('./txService');

class GasMonitorService {
    constructor() {
        this.MIN_GAS_THRESHOLD = ethers.parseEther("1.0"); // 1 BEZ limit
        this.RECHARGE_AMOUNT_BEZ = 50;
        this.isRunning = false;
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

                // Upsert balance in DB
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

                console.log(`📊 [GasMonitor] Saldo de ${enterprise.name}: ${objBalance} BEZ`);

                if (balance < this.MIN_GAS_THRESHOLD) {
                    console.log(`⚠️ [GasMonitor] Gas bajo para ${enterprise.name} (${objBalance} < 1.0). Auto-Recarga...`);

                    try {
                        const record = await sendBEZ(enterprise.gas_tank_address, this.RECHARGE_AMOUNT_BEZ, {
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
