const pool = require('../../db/pool');
const AuditLog = require('./AuditLog'); // Note: uses AuditLog PG DAO

/** Secciones que el panel de administración puede escribir. */
const SECCIONES = ['defi', 'fiat', 'token', 'farming', 'staking', 'dao', 'rwa', 'platform', 'openclaw'];

/**
 * Cotas numéricas de cada parámetro sensible.
 *
 * El modelo Mongoose original (`models/GlobalSettings.model.js`) declaraba
 * estos `min`/`max` en el esquema, y Mongoose los hacía cumplir en cada
 * escritura. Al migrar a PostgreSQL las secciones pasaron a ser columnas
 * `jsonb`, que no validan nada: `updateSettings` guardaba tal cual lo que
 * llegara del cuerpo de la petición. Eso deja la tokenómica sin barandilla
 * —una comisión de swap del 500 %, un `burnRate` negativo, un quórum de DAO
 * del 0 % que aprueba cualquier propuesta— a un solo PUT de distancia.
 *
 * Aquí se recuperan esas cotas y se aplican antes de tocar la base de datos.
 * Los valores son los mismos que declaraba el esquema Mongoose.
 */
const COTAS = {
    'defi.swapFeePercent': { min: 0, max: 10 },
    'defi.maxSlippage': { min: 0.1, max: 50 },
    'defi.bridgeFeePercent': { min: 0, max: 5 },
    'token.decimals': { min: 0, max: 18 },
    'token.burnRate': { min: 0, max: 500 },          // base 10000 (20 = 0,2 %)
    'token.treasuryRate': { min: 0, max: 1000 },     // base 10000 (100 = 1 %)
    'token.transferFeePercent': { min: 0, max: 10 },
    'fiat.minPurchaseUSD': { min: 0, max: 1000000 },
    'fiat.maxPurchaseUSD': { min: 0, max: 10000000 },
    'farming.defaultAPY': { min: 0, max: 1000 },
    'farming.earlyWithdrawalPenalty': { min: 0, max: 50 },
    'staking.rewardRatePercent': { min: 0, max: 100 },
    'staking.slashingPercent': { min: 0, max: 100 },
    'dao.quorumPercentage': { min: 1, max: 100 },
    'dao.votingPeriodDays': { min: 1, max: 30 },
    'dao.vetoThreshold': { min: 0, max: 100 },
    'rwa.platformFeePercent': { min: 0, max: 10 },
    'platform.maxLoginAttempts': { min: 1, max: 100 },
    'platform.sessionTimeoutMinutes': { min: 1, max: 10080 },
};

/** Error de validación: la ruta lo traduce a 400, no a 500. */
class SettingsValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SettingsValidationError';
        this.statusCode = 400;
    }
}

/**
 * Comprueba las cotas de `updates` (parcial: solo mira lo que venga).
 * Lanza `SettingsValidationError` al primer valor fuera de rango.
 */
function validateSettings(updates) {
    if (!updates || typeof updates !== 'object') return;

    for (const [ruta, { min, max }] of Object.entries(COTAS)) {
        const [seccion, campo] = ruta.split('.');
        const valores = updates[seccion];
        if (!valores || typeof valores !== 'object' || !(campo in valores)) continue;

        const bruto = valores[campo];
        if (bruto === undefined || bruto === null) continue;

        const valor = typeof bruto === 'string' ? Number(bruto) : bruto;
        if (typeof valor !== 'number' || !Number.isFinite(valor)) {
            throw new SettingsValidationError(`${ruta} debe ser un número finito, se recibió ${JSON.stringify(bruto)}`);
        }
        if (valor < min || valor > max) {
            throw new SettingsValidationError(`${ruta} debe estar entre ${min} y ${max}, se recibió ${valor}`);
        }
    }
}

class GlobalSettingsPG {
    static async getSettings() {
        const result = await pool.query("SELECT * FROM global_settings WHERE id = 'global_settings'");
        if (result.rows.length === 0) {
            // Create default if not exists
            const defaultSettings = this.getDefaultSettings();
            const query = `
                INSERT INTO global_settings (
                    id, defi, fiat, token, farming, staking, dao, rwa, platform, openclaw
                ) VALUES (
                    'global_settings', $1::jsonb, $2::jsonb, $3::jsonb, $4::jsonb, 
                    $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb
                ) RETURNING *;
            `;
            const values = [
                JSON.stringify(defaultSettings.defi),
                JSON.stringify(defaultSettings.fiat),
                JSON.stringify(defaultSettings.token),
                JSON.stringify(defaultSettings.farming),
                JSON.stringify(defaultSettings.staking),
                JSON.stringify(defaultSettings.dao),
                JSON.stringify(defaultSettings.rwa),
                JSON.stringify(defaultSettings.platform),
                JSON.stringify(defaultSettings.openclaw)
            ];
            const created = await pool.query(query, values);
            return created.rows[0];
        }
        return result.rows[0];
    }

    static async updateSettings(updates, adminId, metadata = {}) {
        validateSettings(updates);
        const current = await this.getSettings();
        const previousState = { ...current };

        const updatedSections = Object.keys(updates);
        const primarySection = updatedSections.length === 1 ? updatedSections[0] : 'multiple';

        const setClauses = [];
        const values = [];
        let paramIdx = 1;

        for (const key of updatedSections) {
            if (SECCIONES.includes(key)) {
                // deep merge simulation
                const merged = { ...current[key], ...updates[key] };
                setClauses.push(`${key} = $${paramIdx}::jsonb`);
                values.push(JSON.stringify(merged));
                paramIdx++;
            }
        }

        if (setClauses.length === 0) return current;

        setClauses.push(`last_updated_by = $${paramIdx}`);
        values.push(adminId || 'admin');
        paramIdx++;

        setClauses.push(`version = version + 1`);
        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

        const query = `
            UPDATE global_settings 
            SET ${setClauses.join(', ')} 
            WHERE id = 'global_settings' RETURNING *;
        `;
        const updated = await pool.query(query, values);

        // Audit Log
        await AuditLog.log({
            user: adminId || null,
            performedBy: adminId || 'system',
            action: 'UPDATE_GLOBAL_SETTINGS',
            resource: 'global_settings',
            resourceId: 'global_settings',
            section: primarySection,
            previousState,
            newState: updated.rows[0],
            metadata: {
                ipAddress: metadata.ip,
                userAgent: metadata.userAgent,
                method: metadata.method,
                path: metadata.path
            }
        });

        return updated.rows[0];
    }

    static async resetSettings(adminId) {
        const query = `DELETE FROM global_settings WHERE id = 'global_settings'`;
        await pool.query(query);
        const settings = await this.getSettings();
        await AuditLog.log({
            user: adminId || null,
            performedBy: adminId || 'system',
            action: 'RESET_GLOBAL_SETTINGS',
            resource: 'global_settings',
            resourceId: 'global_settings',
            section: 'all',
            previousState: null,
            newState: settings,
            metadata: {}
        });
        return settings;
    }

    static async rollback(auditLogId, adminId) {
        const result = await pool.query('SELECT * FROM audit_logs WHERE id = $1', [auditLogId]);
        const log = result.rows[0];
        if (!log || !log.previous_state) return null;

        const currentState = await this.getSettings();
        const stateToRestore = log.previous_state;

        const updateData = {
            defi: stateToRestore.defi,
            fiat: stateToRestore.fiat,
            token: stateToRestore.token,
            farming: stateToRestore.farming,
            staking: stateToRestore.staking,
            dao: stateToRestore.dao,
            rwa: stateToRestore.rwa,
            platform: stateToRestore.platform,
            openclaw: stateToRestore.openclaw
        };

        const settings = await this.updateSettings(updateData, adminId);
        return settings;
    }

    static getDefaultSettings() {
        return {
            defi: { enabled: true, swapFeePercent: 0.3, maxSlippage: 1, activePools: [], bridgeFeePercent: 0.1, minSwapAmount: 1, maxSwapAmount: 1000000 },
            fiat: { enabled: true, providers: { stripe: { enabled: true, feePercent: 2.9 }, bankTransfer: { enabled: true, feePercent: 1 } }, minPurchaseUSD: 10, maxPurchaseUSD: 10000, supportedCurrencies: ['USD', 'EUR', 'GBP'], kycRequired: true, kycThresholdUSD: 1000 },
            token: { contractAddress: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8', symbol: 'BEZ', decimals: 18, totalSupply: '1000000000', circulatingSupply: '0', mintingEnabled: false, mintingRules: { maxMintPerTx: '10000', dailyMintLimit: '100000', allowedMinters: [] }, burningEnabled: true, burnRate: 20, treasuryRate: 100, transferFeePercent: 0 },
            farming: { enabled: true, defaultAPY: 15, pools: [], rewardsPerBlock: '1', harvestLockHours: 24, earlyWithdrawalPenalty: 10 },
            staking: { enabled: true, minStakeAmount: '100', maxStakeAmount: '10000000', rewardRatePercent: 12, lockPeriods: [], compoundingEnabled: true, compoundFrequencyHours: 24, unstakeCooldownHours: 48, slashingEnabled: false, slashingPercent: 5 },
            dao: { enabled: true, quorumPercentage: 10, votingPeriodDays: 7, proposalThreshold: '100000', executionDelayHours: 24, allowDelegation: true, maxDelegations: 100, rewardPerVote: '10', proposalCategories: ['protocol', 'treasury', 'governance', 'community'], vetoEnabled: false, vetoThreshold: 33 },
            rwa: { enabled: true, minInvestmentUSD: 100, maxInvestmentUSD: 1000000, platformFeePercent: 2.5, assetCategories: { realEstate: { enabled: true }, commodities: { enabled: true } }, kycRequired: true, accreditedInvestorRequired: false, legalJurisdictions: ['US', 'EU', 'UK'], tokenizationStandard: 'ERC-1155' },
            platform: { maintenanceMode: false, maintenanceMessage: 'Platform is under maintenance.', registrationEnabled: true, emailVerificationRequired: true, maxLoginAttempts: 5, sessionTimeoutMinutes: 60, loggingLevel: 'info' },
            openclaw: { enabled: true, baseUrl: 'http://localhost:3001/api/openclaw', apiKey: 'bzh_3p_openclaw_agent_default_key', plans: {} }
        };
    }
}

module.exports = GlobalSettingsPG;
module.exports.SECCIONES = SECCIONES;
module.exports.COTAS = COTAS;
module.exports.validateSettings = validateSettings;
module.exports.SettingsValidationError = SettingsValidationError;
