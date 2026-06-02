/**
 * BeZhas — HumanInLoopManager
 * ─────────────────────────────────────────────────────────────────────────────
 * Intercepta acciones críticas (trades, deploys, transferencias) y solicita
 * confirmación explícita de un humano autorizado antes de ejecutarlas.
 *
 * Flujo:
 *   Agente → HumanInLoop.guard() → Telegram botones → Humano aprueba/rechaza
 *   → Agente recibe {approved, userId} → ejecuta o cancela acción
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { randomUUID } from 'crypto';

// Acciones que SIEMPRE requieren confirmación humana (sin excepciones)
export const ALWAYS_REQUIRE_CONFIRMATION = new Set([
  'place_order', 'place_trade', 'close_position', 'close_all_positions',
  'deploy_contract', 'upgrade_contract', 'pause_contract',
  'transfer_tokens', 'bridge_tokens', 'withdraw_treasury',
  'create_payment', 'execute_swap', 'add_liquidity', 'remove_liquidity',
  'execute_multisig', 'send_bulk_email', 'delete_entity', 'revoke_access',
]);

// Umbrales que activan confirmación incluso para acciones no listadas
export const CONFIRMATION_THRESHOLDS = {
  trade_value_usd:     500,
  transfer_amount_bez: 1_000,
  transfer_amount_usd: 200,
  gas_fee_usd:         50,
  affected_users:      10,
};

export class HumanInLoopManager {
  /**
   * @param {{ telegram, memory, logger? }} deps
   * @param {{ defaultTimeout?: number, skipInDev?: boolean, alertChatId?: string }} opts
   */
  constructor(deps, opts = {}) {
    this.telegram    = deps.telegram;
    this.memory      = deps.memory;
    this.logger      = deps.logger || console;
    this.timeout     = opts.defaultTimeout || 120;
    this.skipInDev   = opts.skipInDev || false;
    this.alertChatId = opts.alertChatId || process.env.TELEGRAM_ALERT_CHAT_ID;
  }

  // ─── Verificar si una acción requiere aprobación ──────────────────────────
  requiresConfirmation(action, details = {}) {
    if (ALWAYS_REQUIRE_CONFIRMATION.has(action))
      return { required: true, reason: `"${action}" siempre requiere aprobación humana` };

    if (details.value_usd > CONFIRMATION_THRESHOLDS.trade_value_usd)
      return { required: true, reason: `Valor $${details.value_usd} supera umbral` };

    if (details.amount_bez > CONFIRMATION_THRESHOLDS.transfer_amount_bez)
      return { required: true, reason: `${details.amount_bez} BEZ supera umbral` };

    if (details.amount_usd > CONFIRMATION_THRESHOLDS.transfer_amount_usd)
      return { required: true, reason: `$${details.amount_usd} supera umbral` };

    if (details.gas_fee_usd > CONFIRMATION_THRESHOLDS.gas_fee_usd)
      return { required: true, reason: `Gas $${details.gas_fee_usd} supera umbral` };

    if (details.affected_users > CONFIRMATION_THRESHOLDS.affected_users)
      return { required: true, reason: `Afecta a ${details.affected_users} usuarios` };

    return { required: false, reason: 'dentro de límites automáticos' };
  }

  // ─── Solicitar confirmación al humano ─────────────────────────────────────
  async request({ action, agentId, details, timeout, chatId }) {
    const requestId  = `hil_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const targetChat = chatId || this.alertChatId;
    const waitSecs   = timeout || this.timeout;

    // Modo desarrollo: auto-aprobar
    if (this.skipInDev && process.env.NODE_ENV !== 'production') {
      this.logger.warn(`[HIL] DEV auto-approve: ${action} (${requestId})`);
      await this._log(requestId, action, agentId, details, true, 'dev_auto');
      return { approved: true, userId: 'dev', username: 'dev_mode' };
    }

    this.logger.info(`[HIL] Solicitando confirmación: ${action} | ${requestId}`);

    try {
      const result = await this.telegram.requestConfirmation({
        requestId, chatId: targetChat, action, details, timeoutSecs: waitSecs
      });

      await this._log(requestId, action, agentId, details, result.approved, result.userId);
      this.logger.info(`[HIL] ${result.approved ? '✅' : '❌'} ${action} por ${result.username}`);
      return result;

    } catch (err) {
      this.logger.warn(`[HIL] Timeout para "${action}": ${err.message}`);
      await this._log(requestId, action, agentId, details, false, 'timeout');
      return { approved: false, reason: 'timeout', error: err.message };
    }
  }

  /**
   * Guard principal: ejecuta fn() solo si el humano aprueba.
   * Si la acción no requiere confirmación, ejecuta directamente.
   *
   * @example
   * const out = await hil.guard('place_order', 'trading-agent',
   *   { symbol:'AAPL', qty:10, value_usd:1500 },
   *   () => ibkr.placeOrder(...)
   * );
   */
  async guard(action, agentId, details, fn) {
    const { required, reason } = this.requiresConfirmation(action, details);

    if (!required) {
      const result = await fn();
      return { executed: true, confirmed: false, result };
    }

    const { approved, userId, username, reason: rejReason } = await this.request({
      action, agentId, details
    });

    if (!approved) {
      return {
        executed: false, confirmed: true,
        rejection: rejReason || 'rechazado por el usuario',
        rejected_by: username
      };
    }

    const result = await fn();
    return {
      executed: true, confirmed: true, result,
      approved_by: username, approved_by_id: userId
    };
  }

  // ─── Auditoría en Redis ───────────────────────────────────────────────────
  async _log(requestId, action, agentId, details, approved, userId) {
    if (!this.memory) return;
    try {
      await this.memory.saveEpisode(agentId, 'human_in_loop', {
        request_id: requestId, action, details, approved,
        decided_by: userId, decided_at: Date.now()
      }, [approved ? 'approved' : 'rejected', action]);
    } catch (e) {
      this.logger.warn('[HIL] No se pudo loggear episodio:', e.message);
    }
  }

  async getDecisionHistory(agentId, limit = 20) {
    if (!this.memory) return [];
    return this.memory.getEpisodes(agentId, 'human_in_loop', limit);
  }

  async getStats(agentId) {
    const history  = await this.getDecisionHistory(agentId, 100);
    const approved = history.filter(e => e.data?.approved).length;
    const rejected = history.length - approved;
    return {
      total: history.length, approved, rejected,
      approval_rate: history.length > 0 ? Math.round((approved / history.length) * 100) : 0
    };
  }
}
