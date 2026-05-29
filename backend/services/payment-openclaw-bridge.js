/**
 * ============================================================================
 * PAYMENT-OPENCLAW BRIDGE — BeZhas Pay ↔ OpenCLaw/AEGIS Integration
 * ============================================================================
 *
 * Puente automático que conecta el flujo de pagos de BeZhas con:
 *  - OpenCLaw: Agente IA personalizado que provisiona credenciales
 *  - AEGIS: Sistema de monitoreo/validación de inteligencia artificial
 *
 * Flujo:
 *  1. Cliente compra/suscribe → BezPay procesa el pago
 *  2. AEGIS valida la transacción
 *  3. OpenCLaw genera credenciales en MongoDB (OpenClawClient)
 *  4. OpenCLaw entrega al cliente via chat/email/API callback
 *  5. AEGIS monitorea el uso continuamente
 *
 * Persistencia: MongoDB (OpenClawClient Model)
 * Configuración: Dinámica via GlobalSettings
 */

'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');
const EventEmitter = require('events');
const settingsHelper = require('../utils/settingsHelper');
const OpenClawClient = require('../models/OpenClawClient.model');
const AuditLog = require('../models/pg/AuditLog');
const feedbackLoopService = require('./feedback-loop.service');

// ─── BRIDGE EVENT BUS ────────────────────────────────────────────────────────
const bridgeEvents = new EventEmitter();
bridgeEvents.setMaxListeners(50);

// ─── AEGIS INTEGRATION ──────────────────────────────────────────────────────
class AegisValidator {
  /**
   * Validar transacción antes de provisionar
   */
  static async validateTransaction({ walletAddress, txHash, amount, type }) {
    try {
      logger.info({ walletAddress, txHash, type }, '🛡️ [AEGIS] Validating transaction');

      // Obtener config de AEGIS desde GlobalSettings (vía settingsHelper)
      // Nota: Asumimos que AEGIS usa settings comunes o específicos
      const aegisUrl = process.env.AEGIS_URL || 'http://localhost:8000/api/aegis';
      const aegisKey = process.env.AEGIS_API_KEY || '';
      const timeout = 10000;

      const isProduction = process.env.NODE_ENV === 'production';

      if (isProduction && aegisKey) {
        const response = await fetch(`${aegisUrl}/control/trigger_action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-aegis-key': aegisKey,
          },
          body: JSON.stringify({
            action: 'validate_payment',
            params: { walletAddress, txHash, amount, type },
          }),
          signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
          logger.warn({ status: response.status }, '[AEGIS] Validation endpoint returned error');
          return { valid: true, score: 0.5, reason: 'AEGIS unavailable — fail-open policy' };
        }

        const data = await response.json();
        return { valid: data.approved !== false, score: data.confidence || 0.8, reason: data.reason };
      }

      // Desarrollo: validación básica local
      const riskScore = _calculateRiskScore(walletAddress, amount, type);
      const valid = riskScore < 0.8;

      logger.info({ walletAddress, riskScore, valid }, '🛡️ [AEGIS] Local validation result');
      return { valid, score: 1 - riskScore, reason: valid ? 'Approved' : 'High risk score' };

    } catch (err) {
      logger.error({ err: err.message }, '[AEGIS] Validation error — fail-open');
      return { valid: true, score: 0.3, reason: `Validation error: ${err.message}` };
    }
  }

  /**
   * Reportar actividad al AEGIS monitoring
   */
  static async reportActivity({ clientWallet, action, metadata }) {
    try {
      const aegisUrl = process.env.AEGIS_URL || 'http://localhost:8000/api/aegis';
      const aegisKey = process.env.AEGIS_API_KEY || '';

      if (aegisKey && process.env.NODE_ENV === 'production') {
        await fetch(`${aegisUrl}/telemetry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-aegis-key': aegisKey,
          },
          body: JSON.stringify({
            type: 'client_activity',
            client: clientWallet,
            action,
            metadata,
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      }
    } catch (_) { /* non-blocking */ }
  }
}

// ─── OPENCLAW AGENT ─────────────────────────────────────────────────────────
class OpenClawAgent {
  /**
   * Provisionar credenciales para un nuevo cliente (Persistido)
   */
  static async provisionClient({ walletAddress, plan, platforms, txHash, duration }) {
    // 1. Obtener config dinámica
    const config = await settingsHelper.getOpenClawConfig();
    const planConfig = config.plans[plan] || config.plans.starter;

    const clientId = `bzh_client_${crypto.randomBytes(16).toString('hex')}`;
    const credentials = new Map();

    // Generar credenciales por plataforma
    for (const platform of platforms) {
      credentials.set(platform, {
        apiKey: `bzh_cli_${platform}_${crypto.randomBytes(24).toString('hex')}`,
        webhookSecret: `whsec_cli_${crypto.randomBytes(32).toString('hex')}`,
        clientId,
        rateLimits: planConfig,
        expiresAt: _calcExpiry(plan, config),
        createdAt: new Date().toISOString(),
      });
    }

    // 2. Guardar en MongoDB
    const client = await OpenClawClient.findOneAndUpdate(
        { walletAddress: walletAddress.toLowerCase() },
        {
            clientId,
            walletAddress: walletAddress.toLowerCase(),
            plan,
            platforms,
            credentials,
            txHash,
            status: 'active',
            provisionedAt: new Date(),
            expiresAt: _calcExpiry(plan, config),
            usage: { requestsToday: 0, webhooksToday: 0 }
        },
        { upsert: true, new: true }
    );

    // 3. Auditoría global
    await AuditLog.log({
        performedBy: 'OpenClawSystem',
        action: 'CLIENT_PROVISIONED',
        resource: 'openclaw_client',
        resourceId: client._id.toString(),
        section: 'openclaw',
        newState: client
    });

    logger.info({ clientId, walletAddress, plan }, '🔑 [OpenCLaw] Client provisioned and persisted');
    
    // LOG FEEDBACK: Aprender de la provisión exitosa
    await feedbackLoopService.log({
        type: 'openclaw',
        action: 'PROVISION_CLIENT',
        status: 'success',
        result: `Provisioned plan ${plan} for ${walletAddress}`,
        metadata: { plan, platforms, txHash }
    });

    return client;
  }

  /**
   * Revocar acceso de un cliente
   */
  static async revokeClient(walletAddress, reason = 'manual_revoke') {
    const client = await OpenClawClient.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!client) return null;

    client.status = 'revoked';
    client.revokedAt = new Date();
    client.revokeReason = reason;
    await client.save();

    await AuditLog.log({
        performedBy: 'OpenClawSystem',
        action: 'CLIENT_REVOKED',
        resource: 'openclaw_client',
        resourceId: client._id.toString(),
        section: 'openclaw',
        newState: { status: 'revoked', reason }
    });

    logger.info({ walletAddress, reason }, '🚫 [OpenCLaw] Client revoked in DB');
    
    // LOG FEEDBACK: Aprender de la revocación
    await feedbackLoopService.log({
        type: 'openclaw',
        action: 'REVOKE_CLIENT',
        status: 'success',
        result: `Revoked ${walletAddress} for reason: ${reason}`,
        metadata: { reason }
    });

    return client;
  }

  /**
   * Rotar credenciales de un cliente
   */
  static async rotateCredentials(walletAddress) {
    const client = await OpenClawClient.findOne({ 
        walletAddress: walletAddress.toLowerCase(), 
        status: 'active' 
    });
    if (!client) return null;

    const creds = client.credentials;
    for (const [platform, old] of creds.entries()) {
      creds.set(platform, {
        ...old,
        apiKey: `bzh_cli_${platform}_${crypto.randomBytes(24).toString('hex')}`,
        webhookSecret: `whsec_cli_${crypto.randomBytes(32).toString('hex')}`,
        rotatedAt: new Date().toISOString(),
      });
    }

    client.credentials = creds;
    await client.save();

    logger.info({ walletAddress }, '🔄 [OpenCLaw] Credentials rotated in DB');
    return client;
  }

  /**
   * Obtener credenciales activas de un cliente (desde DB)
   */
  static async getClientCredentials(walletAddress) {
    return await OpenClawClient.findOne({ walletAddress: walletAddress.toLowerCase() });
  }

  /**
   * Listar plataformas disponibles para un plan (Dinámico)
   */
  static async getAvailablePlatforms(plan) {
    const config = await settingsHelper.getOpenClawConfig();
    const allPlatforms = [
      'vinted', 'airbnb', 'maersk', 'amazon', 'ebay', 'wallapop',
      'shopify', 'woocommerce', 'stripe_connect', 'mercadolibre',
      'aliexpress', 'etsy',
    ];
    const planConfig = config.plans[plan] || config.plans.starter;
    return {
      platforms: allPlatforms,
      maxAllowed: planConfig.platforms,
      plan,
      rateLimits: planConfig,
    };
  }

  /**
   * Chat con el agente OpenCLaw (proxy a LLM)
   */
  static async chat({ walletAddress, message, context = {} }) {
    const client = await OpenClawClient.findOne({ walletAddress: walletAddress.toLowerCase() });

    // Construir contexto para el LLM
    const systemPrompt = _buildOpenClawSystemPrompt(client);

    try {
      // Intentar usar servicios AI unificados
      let aiService;
      try { aiService = require('./unified-ai.service'); } catch (_) {
        try { aiService = require('./ai-provider.service'); } catch (_) {
            return _fallbackChat(message, client);
        }
      }

      if (aiService.generateResponse || aiService.generate) {
        const genFn = aiService.generateResponse || aiService.generate;
        const response = await genFn({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          maxTokens: 500,
          temperature: 0.7,
        });
        return { response: response.text || response.content || response, source: 'ai' };
      }

      return _fallbackChat(message, client);
    } catch (err) {
      logger.warn({ err: err.message }, '[OpenCLaw] AI chat error — using fallback');
      return _fallbackChat(message, client);
    }
  }
}

// ─── PAYMENT EVENT HANDLERS ─────────────────────────────────────────────────

async function onPaymentCompleted({ walletAddress, type, txHash, bezAmount, planId, metadata = {} }) {
  logger.info({ walletAddress, type, txHash, bezAmount, planId }, '📩 [Bridge] Payment completed event');

  try {
    const aegisResult = await AegisValidator.validateTransaction({
      walletAddress, txHash, amount: bezAmount, type,
    });

    if (!aegisResult.valid) {
      logger.warn({ walletAddress, reason: aegisResult.reason }, '⚠️ [Bridge] AEGIS rejected payment');
      bridgeEvents.emit('payment.rejected', { walletAddress, reason: aegisResult.reason });
      return { success: false, reason: aegisResult.reason };
    }

    if (['subscription', 'vip_subscription'].includes(type) && planId) {
      return await onSubscriptionCreated({ walletAddress, planId, txHash, bezAmount });
    }

    await AegisValidator.reportActivity({
      clientWallet: walletAddress,
      action: `payment_${type}`,
      metadata: { txHash, bezAmount, ...metadata },
    });

    bridgeEvents.emit('payment.processed', { walletAddress, type, txHash, bezAmount });
    return { success: true, type };

  } catch (err) {
    logger.error({ err: err.message, walletAddress }, '[Bridge] onPaymentCompleted error');
    return { success: false, reason: err.message };
  }
}

async function onSubscriptionCreated({ walletAddress, planId, txHash, bezAmount }) {
  logger.info({ walletAddress, planId, txHash }, '📋 [Bridge] Subscription created event');

  try {
    const planMap = {
      basic: 'starter', starter: 'starter', free: 'starter',
      creator: 'pro', pro: 'pro',
      business: 'enterprise', enterprise: 'enterprise',
      vip: 'vip', whale: 'vip',
    };
    const plan = planMap[(planId || '').toLowerCase()] || 'starter';

    const info = await OpenClawAgent.getAvailablePlatforms(plan);
    const selectedPlatforms = info.platforms.slice(0, info.maxAllowed);

    const client = await OpenClawAgent.provisionClient({
      walletAddress,
      plan,
      platforms: selectedPlatforms,
      txHash,
      duration: info.rateLimits.credentialTTL || 30,
    });

    await AegisValidator.reportActivity({
      clientWallet: walletAddress,
      action: 'subscription_provisioned',
      metadata: { plan, platforms: selectedPlatforms, clientId: client.clientId },
    });

    bridgeEvents.emit('client.provisioned', {
      walletAddress, plan, platforms: selectedPlatforms,
      clientId: client.clientId,
    });

    return { success: true, client };

  } catch (err) {
    logger.error({ err: err.message, walletAddress, planId }, '[Bridge] Subscription provisioning error');
    return { success: false, reason: err.message };
  }
}

/**
 * Verificar y revocar credenciales expiradas (Persistido)
 */
async function checkExpiredCredentials() {
  const now = new Date();
  const expiredClients = await OpenClawClient.find({ 
      status: 'active', 
      expiresAt: { $lt: now } 
  });

  for (const client of expiredClients) {
    await OpenClawAgent.revokeClient(client.walletAddress, 'expired');
  }

  if (expiredClients.length > 0) {
    logger.info({ count: expiredClients.length }, '🕐 [Bridge] Expired clients revoked from DB');
  }
  return expiredClients.length;
}

// ─── WEBHOOK DELIVERY ────────────────────────────────────────────────────────

async function deliverWebhook(walletAddress, event, data) {
  const client = await OpenClawClient.findOne({ 
      walletAddress: walletAddress.toLowerCase(), 
      status: 'active' 
  });
  if (!client) return false;

  const platform = data.platform;
  const cred = client.credentials.get(platform);
  if (!cred) return false;

  const webhookUrl = client.webhookUrl || null;
  if (!webhookUrl) return false;

  const payload = JSON.stringify({
    type: event,
    data,
    clientId: client.clientId,
    timestamp: new Date().toISOString(),
  });

  const signature = crypto
    .createHmac('sha256', cred.webhookSecret)
    .update(payload)
    .digest('hex');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bezhas-signature': signature,
        'x-bezhas-event': event,
        'x-bezhas-client': client.clientId,
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
    });

    const success = response.ok;
    return success;
  } catch (err) {
    logger.warn({ err: err.message, walletAddress, event }, '[Bridge] Webhook delivery failed');
    return false;
  }
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

function _calculateRiskScore(wallet, amount, type) {
  let score = 0;
  if (amount > 50000) score += 0.3;
  else if (amount > 10000) score += 0.1;
  if (type === 'bridge_transfer') score += 0.1;
  return Math.min(score, 1.0);
}

function _calcExpiry(plan, config) {
  const planConfig = config.plans[plan] || config.plans.starter;
  const days = planConfig.credentialTTL;
  if (!days || days < 0) return null; // unlimited
  return new Date(Date.now() + days * 86400000);
}

function _buildOpenClawSystemPrompt(client) {
  const planInfo = client
    ? `Cliente activo con plan ${client.plan}. Plataformas: ${client.platforms.join(', ')}. ClientID: ${client.clientId}.`
    : 'Cliente sin suscripción activa.';

  return `Eres OpenCLaw, el agente IA personalizado de la plataforma BeZhas.
Ayudas a los clientes a gestionar sus conexiones con plataformas de terceros.
Tus capacidades:
- Provisionar y rotar credenciales de API
- Explicar cómo integrar las APIs de BeZhas Bridge
- Diagnosticar problemas de conexión
- Gestionar webhooks y rate limits

Información del cliente actual: ${planInfo}

Responde siempre de forma profesional, concisa y en el idioma del usuario.`;
}

function _fallbackChat(message, client) {
  const msg = message.toLowerCase();
  if (msg.includes('credencial') || msg.includes('api key')) {
    if (client) {
      return {
        response: `Tus credenciales están activas con el plan ${client.plan}. ¿Necesitas rotar las claves?`,
        source: 'fallback',
      };
    }
    return { response: 'No tienes un plan activo.', source: 'fallback' };
  }
  return {
    response: '¡Hola! Soy OpenCLaw, tu asistente de BeZhas. ¿En qué puedo ayudarte?',
    source: 'fallback',
  };
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
module.exports = {
  onPaymentCompleted,
  onSubscriptionCreated,
  checkExpiredCredentials,
  deliverWebhook,
  OpenClawAgent,
  AegisValidator,
  bridgeEvents,
  _getProvisionedClients: async () => await OpenClawClient.find({}),
};
