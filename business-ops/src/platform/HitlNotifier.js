'use strict';

const { telegramSender } = require('../channels/transports');

/**
 * HitlNotifier — avisa cuando una acción queda pendiente de aprobación humana.
 *
 * Enruta por DEPARTAMENTO a un bot distinto: p.ej. finanzas → bot del CFO,
 * marketing → bot de marketing. El departamento se deduce del prefijo del
 * agentId (`finance.ar-chaser` → `finance`) o de approval.department.
 * Sin ruta/destino → no envía (no rompe el flujo).
 */
class HitlNotifier {
  constructor({ routes = {}, categoryRoutes = {}, fallback = null } = {}) {
    this.routes = routes;             // department -> { send, chatId, token }
    this.categoryRoutes = categoryRoutes; // action.category -> { send, chatId, token } (gana a department)
    this.fallback = fallback;         // { send, chatId, token } | null
  }

  /**
   * Construye el enrutado desde variables de entorno. Un bot de Telegram por
   * departamento/rol (CEO, CFO, CMO, DevOps-Blockchain, Legal), coherente con
   * los bots reales del ecosistema BeZhas:
   *   - finance    → CFO bot
   *   - marketing  → CMO bot
   *   - operations → DevOps/Blockchain bot
   *   - fallback (sales, support, hr, sin departamento) → CEO bot
   * Además, cualquier acción de categoría cripto/contrato/legal se enruta
   * SIEMPRE a su bot especializado sin importar el departamento del agente:
   * el CFO no tiene por qué ser quien apruebe un deploy de contrato, ni el
   * DevOps quien apruebe una firma legal.
   */
  static fromEnv(env = process.env) {
    // Chat de destino: uno global, o uno por departamento si se declara. Sin
    // ninguno, el aviso se construye y no sale — la aprobación sigue en el panel.
    const chatGlobal = env.HITL_TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID || null;
    const route = (token, chatPropio) => ({
      send: telegramSender(token),
      chatId: chatPropio || chatGlobal,
      token,
    });

    // Se aceptan DOS convenciones de nombre para el token de cada bot.
    //
    // El despliegue real las llama `TELEGRAM_TOKEN_FINANCE`, `..._DEVOPS`,
    // `..._LEGAL`; este código solo miraba `TELEGRAM_CFO_BOT_TOKEN` y
    // similares. Como no casaban, los cinco departamentos caían al
    // `TELEGRAM_BOT_TOKEN` de reserva y TODOS los avisos —tesorería, legal,
    // cadena— acababan en el bot del CEO. El enrutado por departamento existía
    // sobre el papel y no ocurría. Verificado contra la API de Telegram: los
    // seis resolvían a @BeZhasCEOBot.
    const tok = (...nombres) => nombres.map((n) => env[n]).find(Boolean);

    // Bot genérico de la casa (@BeZhasBot): lo que da la cara ante el cliente
    // final —ventas y soporte—, que no es asunto de un director concreto.
    const general = route(tok('TELEGRAM_BOT_TOKEN'), env.TELEGRAM_CHAT_GENERAL);
    const ceo = route(tok('TELEGRAM_CEO_BOT_TOKEN', 'TELEGRAM_TOKEN_DIRECTOR', 'TELEGRAM_BOT_TOKEN'), env.TELEGRAM_CHAT_CEO);
    const cfo = route(tok('TELEGRAM_CFO_BOT_TOKEN', 'TELEGRAM_TOKEN_FINANCE', 'TELEGRAM_BOT_TOKEN'), env.TELEGRAM_CHAT_CFO);
    const cmo = route(tok('TELEGRAM_CMO_BOT_TOKEN', 'TELEGRAM_TOKEN_MARKETING', 'TELEGRAM_BOT_TOKEN'), env.TELEGRAM_CHAT_CMO);
    const devops = route(tok('TELEGRAM_DEVOPS_BOT_TOKEN', 'TELEGRAM_TOKEN_DEVOPS', 'TELEGRAM_BOT_TOKEN'), env.TELEGRAM_CHAT_DEVOPS);
    const legal = route(tok('TELEGRAM_LEGAL_BOT_TOKEN', 'TELEGRAM_TOKEN_LEGAL', 'TELEGRAM_BOT_TOKEN'), env.TELEGRAM_CHAT_LEGAL);

    return new HitlNotifier({
      // Los DIEZ departamentos, cada uno a su bot. Antes solo seis estaban
      // asignados y sales, support, hr y fundraising caían al de reserva: sus
      // avisos llegaban al bot del CEO sin distinguirse de los demás.
      routes: {
        finance: cfo,         // @BeZhasCFOBot
        treasury: cfo,        // tesorería y tokenomics las lleva el CFO
        marketing: cmo,       // @bezhas_marketing_master_bot
        blockchain: devops,   // @bezhas_devops_block_bot — vigilancia on-chain
        operations: devops,   // DevOps es quien opera
        legal: legal,         // @BeZBufeteLegalFiscalBot
        hr: legal,            // contratar y despedir es decisión jurídica: la
                              // categoría `employment` ya iba a Legal, y el
                              // departamento no debía ir a otro sitio
        fundraising: ceo,     // inversores y term sheets → dirección
        sales: general,       // @BeZhasBot — cara al cliente
        support: general,
      },
      categoryRoutes: {
        crypto_transfer: devops,
        treasury_movement: devops,
        wallet_operation: devops,
        contract_deploy: devops,
        contract_admin: devops,
        contract: legal,
        signature: legal,
        employment: legal,
      },
      fallback: ceo,
    });
  }

  /** Fija/actualiza el chat de un departamento (reusa el bot ya configurado o el fallback). */
  setChat(department, chatId) {
    const existing = this.routes[department] || {};
    this.routes[department] = { send: existing.send || this.fallback?.send, chatId, token: existing.token || this.fallback?.token };
  }

  _department(approval) {
    return approval.department || String(approval.agentId || '').split('.')[0] || '';
  }

  /** Categoría/enrutado especializado (cripto, contratos, legal) gana al departamento del agente. */
  routeFor(approval) {
    const category = approval.action?.category;
    if (category && this.categoryRoutes[category]) return this.categoryRoutes[category];
    return this.routes[this._department(approval)] || this.fallback;
  }

  async notify(approval = {}) {
    const route = this.routeFor(approval);
    if (!route || !route.send || !route.chatId) return { sent: false, reason: 'sin ruta/destino' };

    const replyMarkup = approval.approvalId ? {
      inline_keyboard: [[
        { text: 'Aprobar ✅', callback_data: `approve_${approval.approvalId}` },
        { text: 'Rechazar ❌', callback_data: `reject_${approval.approvalId}` }
      ]]
    } : null;

    return route.send({
      tenantId: approval.tenantId,
      to: route.chatId,
      text: this.format(approval),
      replyMarkup
    });
  }

  /**
   * Segundo aviso cuando nadie ha decidido a tiempo (llamado por HITLGate tras
   * `escalateAfterMs`). Va SIEMPRE al fallback (normalmente el bot del CEO),
   * no a la ruta original: si el canal especializado no respondió, quien
   * tenga que perseguirlo es un nivel por encima, no un reintento del mismo
   * canal que ya se ignoró.
   */
  async escalate(approval = {}) {
    const route = this.fallback;
    if (!route || !route.send || !route.chatId) return { sent: false, reason: 'sin ruta de escalado' };

    const replyMarkup = approval.approvalId ? {
      inline_keyboard: [[
        { text: 'Aprobar ✅', callback_data: `approve_${approval.approvalId}` },
        { text: 'Rechazar ❌', callback_data: `reject_${approval.approvalId}` }
      ]]
    } : null;

    return route.send({
      tenantId: approval.tenantId,
      to: route.chatId,
      text: `⏰ SIN RESPUESTA — escalado\n\n${this.format(approval)}`,
      replyMarkup,
    });
  }

  /**
   * Alerta proactiva (no requiere decisión): el agente ha detectado algo que un
   * humano debería mirar. Usa el MISMO enrutado por departamento que las
   * aprobaciones, así una anomalía on-chain llega al bot de DevOps y una de
   * tesorería al del CFO, sin configurar nada aparte.
   */
  async alert({ tenantId, department, title, lines = [] } = {}) {
    const route = this.routes[department] || this.fallback;
    if (!route || !route.send || !route.chatId) return { sent: false, reason: 'sin ruta/destino' };

    const text = [
      `⚠️ OPERANT — ${title}${department ? ` · ${department}` : ''}`,
      `Tenant: ${tenantId || '—'}`,
      ...lines.map((l) => `• ${l}`),
      'Revisa el panel para el detalle completo.',
    ].join('\n');

    return route.send({ tenantId, to: route.chatId, text });
  }

  /**
   * Suscribe el notificador a las alertas proactivas del bus de un tenant.
   * Sin esto, los agentes de vigilancia emitían el evento al vacío: nadie
   * escuchaba y la anomalía no llegaba a ninguna persona.
   */
  attach(bus, tenantId) {
    if (!bus?.on) return;

    bus.on('blockchain:anomaly_detected', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'blockchain',
        title: 'Anomalía on-chain detectada',
        lines: e.alerts || [],
      }).catch((err) => console.warn(`[alerts:${tenantId}] blockchain: ${err.message}`));
    });

    bus.on('treasury:runway_critical', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'treasury',
        title: 'Runway de tesorería crítico',
        lines: [
          `Balance: $${e.balanceUsd}`,
          `Runway estimado: ${e.runwayMonths} meses`,
        ],
      }).catch((err) => console.warn(`[alerts:${tenantId}] treasury: ${err.message}`));
    });

    bus.on('operations:anomaly_detected', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'operations',
        title: 'Anomalía operativa detectada',
        lines: e.alerts || [],
      }).catch((err) => console.warn(`[alerts:${tenantId}] operations: ${err.message}`));
    });

    // Un SKU se agota antes de que llegue un pedido hecho hoy: es urgente de
    // verdad, no un "conviene reponer" genérico.
    bus.on('operations:stock_critical', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'operations',
        title: '📦 Ruptura de stock inminente',
        lines: (e.skus || []).map((s) => `${s.sku}: quedan ${s.daysOfStockLeft.toFixed(1)} días`
          + (s.suggestedQty != null ? `, pedir ${s.suggestedQty} unidades` : ' — sin política de reposición configurada')),
      }).catch((err) => console.warn(`[alerts:${tenantId}] stock: ${err.message}`));
    });

    // SLA ya incumplido: ya no se puede evitar, pero sí gestionar el daño.
    bus.on('operations:sla_breached', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'operations',
        title: `⏱️ SLA incumplido (${e.type === 'response' ? 'respuesta' : 'resolución'})`,
        lines: [`Caso: ${e.caseId}`, `${e.minutesLate} minutos tarde`],
      }).catch((err) => console.warn(`[alerts:${tenantId}] sla: ${err.message}`));
    });

    // En riesgo, todavía a tiempo de actuar.
    bus.on('operations:sla_at_risk', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'operations',
        title: `⚠️ SLA en riesgo (${e.type === 'response' ? 'respuesta' : 'resolución'})`,
        lines: [`Caso: ${e.caseId}`, `Quedan ${e.minutesRemaining} minutos`],
      }).catch((err) => console.warn(`[alerts:${tenantId}] sla: ${err.message}`));
    });

    // Slashing crítico (double-signing típico): stake real perdido, no ruido operativo.
    bus.on('blockchain:slashing_critical', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'blockchain',
        title: `🔻 Slashing crítico (${(e.slashedPct * 100).toFixed(2)}%)`,
        lines: [`Validador: ${e.validatorId}`, e.jailed ? 'Encarcelado' : 'No encarcelado'],
      }).catch((err) => console.warn(`[alerts:${tenantId}] slashing: ${err.message}`));
    });

    // Desbloqueo de vesting próximo: presión de venta potencial que conviene ver venir.
    bus.on('treasury:vesting_unlock_upcoming', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'treasury',
        title: '🔓 Desbloqueo de vesting próximo',
        lines: [`${e.holder}: ${e.nextUnlockAmount} tokens el ${String(e.nextUnlockDate).slice(0, 10)}`],
      }).catch((err) => console.warn(`[alerts:${tenantId}] vesting: ${err.message}`));
    });

    // Pool BEZ/USDC por debajo de la política de liquidez o slippage del tenant.
    bus.on('treasury:liquidity_unhealthy', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'treasury',
        title: '💧 Liquidez del pool por debajo de la política',
        lines: e.reasons || [],
      }).catch((err) => console.warn(`[alerts:${tenantId}] liquidity: ${err.message}`));
    });

    // Un post programado cuya aprobación caducó. No es un error: es que hay
    // que volver a mirarlo contra el contexto de HOY antes de que salga.
    bus.on('marketing:approval_stale', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'marketing',
        title: '🕐 Publicación programada pendiente de revisar',
        lines: [
          `Red: ${e.network || '—'}`,
          'Su aprobación caducó: hay que revisarla contra el contexto de HOY antes de publicar.',
        ],
      }).catch((err) => console.warn(`[alerts:${tenantId}] social: ${err.message}`));
    });

    // Cliente en riesgo de irse. Llega con tiempo para llamarle, que es todo
    // el valor: enterarse al recibir la baja no sirve de nada.
    bus.on('sales:churn_risk', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'sales',
        title: `📉 Cliente en riesgo de baja (${e.score}/100)`,
        lines: [
          `Cuenta: ${e.customerId || '—'}`,
          ...(e.factors || []).slice(0, 3).map((f) => `· ${f.detail}`),
          e.recommendation ? `Sugerencia: ${e.recommendation}` : '',
        ].filter(Boolean),
      }).catch((err) => console.warn(`[alerts:${tenantId}] churn: ${err.message}`));
    });

    // Riesgo detectado con el ticket AÚN ABIERTO. A diferencia del CSAT (que
    // llega al cerrar y solo lo contesta una minoría), aquí todavía da tiempo
    // a intervenir antes de perder al cliente.
    bus.on('support:sentiment_alert', (e) => {
      const nombres = {
        churn_intent: 'quiere darse de baja',
        legal_threat: 'amenaza legal',
        reputational_threat: 'amenaza de reseña pública',
        repeat_contact: 'contacto reiterado sin respuesta',
      };
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'support',
        title: `⚠️ Cliente en riesgo (${e.severity})`,
        lines: [
          e.summary || '',
          (e.signals || []).length ? `Señales: ${e.signals.map((s) => nombres[s] || s).join(', ')}` : '',
          e.excerpt ? `Mensaje: "${e.excerpt}"` : '',
          e.taskId ? `Ticket: ${e.taskId}` : '',
        ].filter(Boolean),
      }).catch((err) => console.warn(`[alerts:${tenantId}] sentiment: ${err.message}`));
    });

    // Un cliente que puntúa 1 o 2 es la señal más accionable que tiene Soporte,
    // y caduca rápido: en el informe de fin de mes ya no se puede rescatar.
    bus.on('support:csat_detractor', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'support',
        title: `😞 Cliente insatisfecho (${e.rating}/5)`,
        lines: [
          `Ticket: ${e.taskId || '—'}`,
          e.comment ? `Comentario: "${e.comment}"` : 'Sin comentario.',
        ],
      }).catch((err) => console.warn(`[alerts:${tenantId}] csat: ${err.message}`));
    });

    // Un gasto que el categorizador no pudo clasificar con confianza. No es un
    // error: es la salvaguarda funcionando — mejor preguntar que inventar una
    // categoría que luego desalinea el IVA deducible.
    bus.on('finance:expense_needs_review', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'finance',
        title: '🧾 Gasto pendiente de categorizar',
        lines: [
          `Proveedor: ${e.vendor || '—'} · Concepto: ${e.description || '—'}`,
          e.suggestion ? `Sugerencia: ${e.suggestion}` : 'Sin sugerencia del modelo.',
        ],
      }).catch((err) => console.warn(`[alerts:${tenantId}] expense: ${err.message}`));
    });

    // Conciliación ambigua: dos o más facturas casan igual de bien con el
    // mismo movimiento. Adivinar aquí deja dos rastros falsos en los libros.
    bus.on('finance:reconciliation_ambiguous', (e) => {
      this.alert({
        tenantId: e.tenantId || tenantId,
        department: 'finance',
        title: `⚖️ Conciliación ambigua (${e.type === 'partial' ? 'pago parcial' : 'importe exacto'})`,
        lines: [
          `Movimiento: ${e.transactionId}`,
          `Candidatas: ${(e.candidates || []).join(', ')}`,
        ],
      }).catch((err) => console.warn(`[alerts:${tenantId}] reconciliation: ${err.message}`));
    });
  }

  format(a = {}) {
    const act = a.action || {};
    const dept = this._department(a);
    return [
      `🔔 OPERANT — Aprobación pendiente${dept ? ` · ${dept}` : ''}`,
      `Tenant: ${a.tenantId || '—'}`,
      `Agente: ${a.agentId || '—'}`,
      `Acción: ${act.category || '—'}${act.method ? '/' + act.method : ''}`,
      `Motivo: ${a.reason || '—'}`,
      act.flags?.length ? `⚠️ Cumplimiento: ${act.flags.join(' | ')}` : '',
      `ID: ${a.approvalId || '—'}`,
      'Apruébala o recházala en el panel o usando los botones de este chat.',
    ].filter(Boolean).join('\n');
  }
}

module.exports = HitlNotifier;
