/**
 * @fileoverview Ad Rewards Service - Sistema de Recompensas Watch-to-Earn
 * @description Gestiona la lógica de liquidación FIAT-First para anuncios
 * @architecture FIAT-First: Calcula recompensas en EUR, luego convierte a BEZ
 */

const pino = require('pino');
const priceOracle = require('./price-oracle.service');
const web3Service = require('./web3.service');
const settingsHelper = require('../utils/settingsHelper');
const { ethers } = require('ethers');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================
// CONFIGURACIÓN DE RECOMPENSAS (DYNAMIC FROM GLOBALSETTINGS)
// ============================================

/**
 * Get ad rates from GlobalSettings (with fallbacks)
 * @returns {Promise<object>} Ad rates in EUR
 */
async function getAdRatesEur() {
    const config = await settingsHelper.getAdRewardsConfig();
    return {
        ADSENSE_CPM: config.adsenseCPM || 2.50,
        ADSENSE_CPC: config.adsenseCPC || 0.15,
        ADMOB_REWARDED: config.admobRewardedRate || 0.10,
        DIRECT_SPONSOR_VIEW: config.directSponsorView || 0.20,
        DIRECT_SPONSOR_CLICK: config.directSponsorClick || 0.50,
    };
}

/**
 * Get revenue split configuration from GlobalSettings
 * @returns {Promise<object>} Revenue split percentages
 */
async function getRevenueSplit() {
    const config = await settingsHelper.getAdRewardsConfig();
    return {
        WATCH_TO_EARN: {
            user: config.userSharePercent || 40,
            platform: config.platformSharePercent || 60,
        },
        POST_CONTEXT: {
            viewer: config.viewerSharePercent || 20,
            creator: config.creatorSharePercent || 25,
            platform: 100 - (config.viewerSharePercent || 20) - (config.creatorSharePercent || 25),
        },
    };
}

/**
 * Tipos de eventos de anuncios
 * @constant
 */
const AD_EVENT_TYPES = {
    IMPRESSION: 'impression',      // Impresión de anuncio
    CLICK: 'click',                // Clic en anuncio
    REWARDED_VIEW: 'rewarded_view', // Visualización completa de anuncio recompensado
    SPONSORED_VIEW: 'sponsored_view' // Visualización de patrocinio directo
};

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

/**
 * Calcula el ingreso FIAT del anuncio según su tipo (DYNAMIC)
 * @param {string} adType - Tipo de anuncio
 * @param {string} eventType - Tipo de evento
 * @returns {Promise<number>} Ingreso en EUR
 */
async function calculateAdRevenue(adType, eventType) {
    const AD_RATES_EUR = await getAdRatesEur();
    let revenueEur = 0;

    switch (adType) {
        case 'adsense':
            if (eventType === AD_EVENT_TYPES.IMPRESSION) {
                revenueEur = AD_RATES_EUR.ADSENSE_CPM / 1000; // CPM dividido entre 1000
            } else if (eventType === AD_EVENT_TYPES.CLICK) {
                revenueEur = AD_RATES_EUR.ADSENSE_CPC;
            }
            break;

        case 'admob_rewarded':
            if (eventType === AD_EVENT_TYPES.REWARDED_VIEW) {
                revenueEur = AD_RATES_EUR.ADMOB_REWARDED;
            }
            break;

        case 'direct_sponsor':
            if (eventType === AD_EVENT_TYPES.SPONSORED_VIEW) {
                revenueEur = AD_RATES_EUR.DIRECT_SPONSOR_VIEW;
            } else if (eventType === AD_EVENT_TYPES.CLICK) {
                revenueEur = AD_RATES_EUR.DIRECT_SPONSOR_CLICK;
            }
            break;

        default:
            logger.warn({ adType, eventType }, 'Unknown ad type');
    }

    logger.debug({ adType, eventType, revenueEur }, 'Calculated ad revenue');
    return revenueEur;
}

/**
 * Calcula el reparto de recompensas según el contexto (DYNAMIC)
 * @param {number} revenueEur - Ingreso total en EUR
 * @param {string} context - Contexto: 'watch-to-earn' o 'post:POST_ID'
 * @returns {Promise<object>} Reparto de recompensas { viewer, creator?, platform }
 */
async function calculateRewardsSplit(revenueEur, context) {
    const REVENUE_SPLIT = await getRevenueSplit();
    const isWatchToEarn = context === 'watch-to-earn' || context.startsWith('watch-to-earn');
    const split = isWatchToEarn ? REVENUE_SPLIT.WATCH_TO_EARN : REVENUE_SPLIT.POST_CONTEXT;

    const rewards = {
        viewerEur: (revenueEur * (split.user || split.viewer)) / 100,
        platformEur: (revenueEur * split.platform) / 100
    };

    if (!isWatchToEarn) {
        rewards.creatorEur = (revenueEur * split.creator) / 100;
    }

    logger.debug({ revenueEur, context, split, rewards }, 'Calculated rewards split');
    return rewards;
}

/**
 * Procesa una reclamación de recompensa por anuncio (FIAT-FIRST)
 * @param {object} params - Parámetros de la reclamación
 * @param {string} params.userId - ID del usuario que reclama
 * @param {string} params.adType - Tipo de anuncio
 * @param {string} params.eventType - Tipo de evento
 * @param {string} params.context - Contexto (watch-to-earn o post:ID)
 * @param {string} params.creatorId - ID del creador (si aplica)
 * @param {string} params.adEventId - ID del evento del anuncio (para tracking)
 * @returns {Promise<object>} Resultado de la liquidación
 */
async function processAdRewardClaim(params) {
    const { userId, adType, eventType, context, creatorId, adEventId } = params;

    try {
        logger.info({ params }, 'Processing ad reward claim');

        // 0. Check if ad rewards are enabled
        const isEnabled = await settingsHelper.isEnabled('adRewards');
        if (!isEnabled) {
            throw new Error('Ad rewards are currently disabled');
        }

        // 1. Validar parámetros
        if (!userId || !adType || !eventType || !context) {
            throw new Error('Missing required parameters');
        }

        // 2. Calcular ingreso FIAT del anuncio (now async)
        const revenueEur = await calculateAdRevenue(adType, eventType);

        if (revenueEur <= 0) {
            throw new Error('Invalid ad revenue calculated');
        }

        // 3. Calcular reparto de recompensas (now async)
        const split = await calculateRewardsSplit(revenueEur, context);

        // 4. Obtener precio actual de BEZ/EUR del oráculo
        const bezPriceEur = await priceOracle.getBezEurPrice();

        // 5. Convertir EUR a BEZ (FIAT-FIRST)
        const viewerBezAmount = split.viewerEur / bezPriceEur;
        const creatorBezAmount = split.creatorEur ? split.creatorEur / bezPriceEur : 0;

        logger.info({
            revenueEur,
            bezPriceEur,
            split,
            viewerBezAmount,
            creatorBezAmount
        }, 'Reward amounts calculated');

        // 6. Preparar transferencias para el contrato
        const transfers = [
            {
                recipient: userId,
                amount: viewerBezAmount,
                reason: 'ad_reward_viewer'
            }
        ];

        if (creatorId && creatorBezAmount > 0) {
            transfers.push({
                recipient: creatorId,
                amount: creatorBezAmount,
                reason: 'ad_reward_creator'
            });
        }

        // 7. Ejecutar transferencias en blockchain (batch)
        const txResult = await executeRewardTransfers(transfers, adEventId);

        // 8. Registrar en base de datos (para analytics)
        await recordRewardClaim({
            userId,
            creatorId,
            adType,
            eventType,
            context,
            adEventId,
            revenueEur,
            bezPriceEur,
            viewerBezAmount,
            creatorBezAmount,
            txHash: txResult.txHash,
            timestamp: new Date()
        });

        return {
            success: true,
            rewardClaimed: {
                viewer: {
                    amountBez: viewerBezAmount,
                    amountEur: split.viewerEur
                },
                creator: creatorId ? {
                    amountBez: creatorBezAmount,
                    amountEur: split.creatorEur
                } : null
            },
            transaction: {
                hash: txResult.txHash,
                blockNumber: txResult.blockNumber
            },
            priceInfo: {
                bezEurPrice: bezPriceEur,
                timestamp: new Date()
            }
        };

    } catch (error) {
        logger.error({ error, params }, 'Error processing ad reward claim');
        throw error;
    }
}

/**
 * Ejecuta transferencias de recompensas en el contrato (batch)
 * @param {Array} transfers - Array de transferencias {recipient, amount, reason}
 * @param {string} adEventId - ID del evento del anuncio
 * @returns {Promise<object>} Resultado de la transacción
 */
async function executeRewardTransfers(transfers, adEventId) {
    try {
        // Obtener contrato de BezhasToken
        const { contract: tokenContract, signer } = await web3Service.getBezhasTokenContract();

        if (!tokenContract) {
            throw new Error('BezhasToken contract not available');
        }

        // Preparar arrays para batch transfer
        const recipients = transfers.map(t => t.recipient);
        const amounts = transfers.map(t => ethers.parseEther(t.amount.toString()));

        logger.info({ transfers, recipients, amounts }, 'Executing batch reward transfer');

        // Ejecutar transferencia batch (requiere función en el contrato)
        // Si no existe batchTransfer, ejecutar transferencias individuales
        let tx;

        if (typeof tokenContract.batchTransfer === 'function') {
            // Batch transfer (más eficiente en gas)
            tx = await tokenContract.batchTransfer(recipients, amounts);
        } else {
            // Transferencias individuales (fallback)
            for (let i = 0; i < transfers.length; i++) {
                tx = await tokenContract.transfer(recipients[i], amounts[i]);
                await tx.wait();
            }
        }

        const receipt = await tx.wait();

        logger.info({
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString()
        }, 'Reward transfer executed successfully');

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString()
        };

    } catch (error) {
        logger.error({ error, transfers }, 'Error executing reward transfers');
        throw error;
    }
}

/**
 * Registra una reclamación de recompensa en la base de datos
 * @param {object} claimData - Datos de la reclamación
 * @returns {Promise<void>}
 */
async function recordRewardClaim(claimData) {
    // TODO: Implementar persistencia en base de datos
    // Por ahora solo loguear
    logger.info({ claimData }, 'Reward claim recorded');

    // En producción, guardar en PostgreSQL/MongoDB:
    // await db.rewardClaims.insert(claimData);
}

/**
 * Obtiene estadísticas de recompensas de un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<object>} Estadísticas
 */
async function getUserRewardStats(userId) {
    // TODO: Implementar consulta a base de datos
    // Por ahora retornar mock
    return {
        totalBezEarned: 125.50,
        totalEurEquivalent: 6.275,
        adsWatched: 42,
        lastClaim: new Date(),
        todayEarnings: {
            bez: 12.5,
            eur: 0.625
        }
    };
}

module.exports = {
    processAdRewardClaim,
    calculateAdRevenue,
    calculateRewardsSplit,
    getUserRewardStats,
    AD_EVENT_TYPES,
    getAdRatesEur,
    getRevenueSplit
};
