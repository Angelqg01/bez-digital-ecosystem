'use strict';

const { currentTask } = require('./executionContext');

/**
 * HITLGate — Human In The Loop. Pausa acciones que requieren aprobación humana
 * y las resuelve cuando llega la respuesta (desde el panel, Telegram, etc.).
 *
 * Durabilidad: con `store` (setFact no basta: usa upsertApproval/listApprovals),
 * cada solicitud y cada decisión se persisten. Tras un reinicio, las pendientes
 * se rehidratan como HUÉRFANAS: el agente que esperaba ya no existe, pero la
 * decisión humana no se pierde — si el humano aprueba, la acción se ejecuta
 * directamente vía `onOrphanApproved` (los conectores del tenant); si rechaza,
 * queda registrado y auditado. Nada desaparece en silencio.
 *
 * Timeout + escalado: si nadie responde en `escalateAfterMs`, se reintenta el
 * aviso por un segundo canal (`onEscalate`, normalmente el bot de un nivel
 * superior) SIN cancelar la espera. Si aun así nadie responde en `timeoutMs`,
 * la acción se cancela de forma segura (equivale a un rechazo) — nunca se
 * ejecuta sola por silencio. Y si el humano decide de todos modos DESPUÉS de
 * que el sistema ya cerró la espera (timeout o carrera panel/bot), esa
 * decisión tardía no se pierde: queda auditada como voto tardío aunque ya no
 * pueda cambiar lo ya ejecutado.
 */
class HITLGate {
  constructor({
    bus, audit, timeoutMs = 0, escalateAfterMs = 0,
    notify = null, onEscalate = null,
    store = null, tenantId = null, onOrphanApproved = null,
    maxSettled = 500,
  } = {}) {
    this.bus = bus;
    this.audit = audit;
    this.timeoutMs = timeoutMs;           // 0 = sin timeout (espera indefinida)
    this.escalateAfterMs = escalateAfterMs; // 0 = sin escalado
    this.notify = notify;                 // función opcional para avisar al humano (1er aviso)
    this.onEscalate = onEscalate;         // función opcional: 2º aviso por otro canal, tras escalateAfterMs
    this.store = store;
    this.tenantId = tenantId;
    this.onOrphanApproved = onOrphanApproved; // async (action) => resultado
    this.maxSettled = maxSettled;
    this._pending = new Map();  // approvalId -> { resolve, cleanup, payload }
    this._orphans = new Map();  // approvalId -> payload (pendientes de antes del reinicio)
    this._mirrored = new Map(); // approvalId -> payload (viven en otro plano; ver mirror())
    this._settled = new Map();  // approvalId -> { status, note, payload } — terminal, con tope
  }

  /** Persistencia best-effort de una aprobación (nunca frena el flujo). */
  _persist(record) {
    if (!this.store?.upsertApproval) return;
    Promise.resolve(this.store.upsertApproval(record))
      .catch((err) => console.warn(`[hitl:${record.tenantId}] no se pudo persistir ${record.approvalId}: ${err.message}`));
  }

  /**
   * Rehidratación tras un reinicio: las aprobaciones que quedaron pendientes
   * vuelven a la bandeja como huérfanas (visibles y decidibles).
   */
  async hydrate() {
    if (!this.store?.listApprovals || !this.tenantId) return 0;
    const pending = await this.store.listApprovals({ tenantId: this.tenantId, status: 'pending' });
    for (const a of pending) {
      this._orphans.set(a.approvalId, {
        tenantId: a.tenantId, agentId: a.agentId, action: a.action, reason: a.reason, orphan: true,
      });
    }
    return pending.length;
  }

  /**
   * Registra una solicitud de aprobación y notifica al humano.
   * Devuelve una promesa que se resuelve al aprobar/rechazar/agotarse el plazo.
   */
  request(req) {
    const approvalId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._persist({ approvalId, tenantId: req.tenantId, agentId: req.agentId, action: req.action, reason: req.reason, status: 'pending' });
    if (this.audit) {
      this.audit.log({ tenantId: req.tenantId, event: 'hitl:requested', approvalId, agentId: req.agentId, action: req.action });
    }
    if (this.bus) {
      // Notifica al panel/observabilidad que hay una acción esperando aprobación.
      this.bus.emit('hitl:pending', { approvalId, ...req });
    }
    if (this.notify) {
      // El aviso al humano NO puede tumbar la plataforma. `notify` sale a la
      // red (Telegram) y falla como falla la red: un DNS que no resuelve un
      // segundo. Sin este catch, esa promesa rechazada sin capturar mata el
      // proceso entero de Node — con todas las tareas en vuelo dentro.
      // Ocurrió de verdad: `getaddrinfo ENOTFOUND api.telegram.org` durante
      // una ejecución del embudo se llevó por delante el servidor.
      //
      // Que el aviso no llegue es malo, pero recuperable: la aprobación YA
      // está persistida (línea de arriba) y sigue en el panel esperando. Que
      // se caiga la plataforma no es recuperable.
      // Se invoca igual de síncrono que antes (hay quien cuenta el aviso justo
      // después de request()); lo único que cambia es que ni una excepción ni
      // una promesa rechazada salen de aquí.
      const fallo = (err) => {
        console.warn(`[hitl:${req.tenantId}] no se pudo avisar de ${approvalId}: ${err.message}. La aprobación sigue pendiente en el panel.`);
        this.audit?.log({ tenantId: req.tenantId, event: 'hitl:notify_failed', approvalId, error: err.message });
      };
      try {
        const enviado = this.notify({ approvalId, ...req });
        if (enviado && typeof enviado.then === 'function') enviado.catch(fallo);
      } catch (err) {
        fallo(err);
      }
    }

    const waiter = new Promise((resolvePromise) => {
      let timeoutTimer = null;
      let escalateTimer = null;
      const cleanup = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (escalateTimer) clearTimeout(escalateTimer);
      };

      // Escalado: un segundo aviso (otro canal/bot) antes de rendirse. Solo
      // tiene sentido si dispara ANTES del timeout duro.
      if (this.escalateAfterMs > 0 && (this.timeoutMs === 0 || this.escalateAfterMs < this.timeoutMs)) {
        escalateTimer = setTimeout(() => {
          this._persist({
            approvalId, tenantId: req.tenantId, agentId: req.agentId, action: req.action,
            reason: req.reason, status: 'pending', escalatedAt: new Date().toISOString(),
          });
          if (this.audit) this.audit.log({ tenantId: req.tenantId, event: 'hitl:escalated', approvalId, agentId: req.agentId });
          if (this.bus) this.bus.emit('hitl:escalated', { approvalId, ...req });
          if (this.onEscalate) {
            Promise.resolve(this.onEscalate({ approvalId, ...req }))
              .catch((err) => console.warn(`[hitl:${req.tenantId}] no se pudo escalar ${approvalId}: ${err.message}`));
          }
        }, this.escalateAfterMs);
      }

      // Timeout duro: cancela la espera de forma segura. Equivale a un
      // rechazo (nunca se ejecuta sola una acción sin respuesta humana), pero
      // marcada como `timedOut` para que quien la reciba pueda distinguirla.
      if (this.timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          this._pending.delete(approvalId);
          if (escalateTimer) clearTimeout(escalateTimer);
          const note = 'timeout: sin respuesta humana';
          this._finishRecord(approvalId, req, false, note, 'timeout');
          this._remember(approvalId, 'timeout', note, req);
          resolvePromise({ approved: false, note, action: req.action, timedOut: true });
        }, this.timeoutMs);
      }

      this._pending.set(approvalId, { resolve: resolvePromise, cleanup, payload: req });
    });

    // Esperar a un humano puede tardar horas: mientras tanto, esta tarea suelta
    // su hueco en la cola del tenant y lo vuelve a pedir (con prioridad) cuando
    // llega la decisión. Sin esto, N aprobaciones pendientes bloquean al tenant.
    // Fuera de una tarea (API directa, canal síncrono, test) no hay contexto y
    // el comportamiento es el de siempre: esperar sin más.
    const exec = currentTask();
    if (!exec) return waiter;

    exec.park(approvalId);
    return waiter.then(async (decision) => { await exec.unpark(); return decision; });
  }

  /**
   * Resuelve una aprobación pendiente. Lo llama el panel/API/bot.
   * Para huérfanas (de antes de un reinicio): registra la decisión y, si es
   * un sí, ejecuta la acción vía onOrphanApproved.
   * Para una aprobación YA cerrada (timeout, o resuelta dos veces por una
   * carrera panel/bot): no fantasea con que no existe — la reconoce, la
   * audita como voto tardío y devuelve true (no false, que se leería igual
   * que "ID desconocido").
   */
  resolve(approvalId, approved, note = '') {
    const p = this._pending.get(approvalId);
    if (p) {
      p.cleanup();
      this._pending.delete(approvalId);
      this._finishRecord(approvalId, p.payload, approved, note);
      this._remember(approvalId, approved ? 'approved' : 'rejected', note, p.payload);
      p.resolve({ approved, note, action: p.payload.action });
      return true;
    }

    const orphan = this._orphans.get(approvalId);
    if (orphan) {
      this._orphans.delete(approvalId);
      this._finishRecord(approvalId, orphan, approved, note);
      this._remember(approvalId, approved ? 'approved' : 'rejected', note, orphan);
      if (approved && this.onOrphanApproved) {
        // El agente que esperaba murió con el reinicio; la acción aprobada se
        // ejecuta igual (guardrails ya pasados: el humano ES la aprobación).
        Promise.resolve(this.onOrphanApproved(orphan.action))
          .then(() => this.audit?.log({ tenantId: orphan.tenantId, event: 'hitl:orphan-executed', approvalId }))
          .catch((err) => this.audit?.log({ tenantId: orphan.tenantId, event: 'hitl:orphan-failed', approvalId, error: err.message }));
      }
      return true;
    }

    const settled = this._settled.get(approvalId);
    if (settled) {
      if (this.audit) {
        this.audit.log({
          tenantId: settled.payload.tenantId, event: 'hitl:late-decision', approvalId,
          approved, note, finalStatus: settled.status,
        });
      }
      return true;
    }

    return false;
  }

  _finishRecord(approvalId, payload, approved, note, status = approved ? 'approved' : 'rejected') {
    this._persist({
      approvalId, tenantId: payload.tenantId, agentId: payload.agentId,
      action: payload.action, reason: payload.reason,
      status, note, resolvedAt: new Date().toISOString(),
    });
    if (this.audit) {
      this.audit.log({ tenantId: payload.tenantId, event: 'hitl:resolved', approvalId, approved, status, note, orphan: !!payload.orphan });
    }
    if (this.bus) {
      // Telemetry cuenta aprobados/rechazados escuchando este evento.
      this.bus.emit('hitl:resolved', { approvalId, tenantId: payload.tenantId, approved, status });
    }
  }

  /** Recuerda el desenlace de una aprobación ya cerrada (con tope de memoria),
   *  para que una decisión humana tardía no se confunda con un ID desconocido. */
  _remember(approvalId, status, note, payload) {
    this._settled.set(approvalId, { status, note, payload });
    if (this._settled.size > this.maxSettled) {
      this._settled.delete(this._settled.keys().next().value);
    }
  }

  /** Consulta una aprobación pendiente/huérfana/ya-cerrada SIN resolverla (para enrutado por bot). */
  peek(approvalId) {
    const p = this._pending.get(approvalId);
    if (p) return { ...p.payload, orphan: false };
    const o = this._orphans.get(approvalId);
    if (o) return { ...o, orphan: true };
    const s = this._settled.get(approvalId);
    if (s) return { ...s.payload, alreadyResolved: true, status: s.status };
    return null;
  }

  /**
   * Registra una aprobación que VIVE EN OTRO PLANO (hoy: la cola SCADA de la
   * API de BeZhas) para que aparezca en la misma bandeja y en la misma
   * auditoría que las de aquí.
   *
   * Deliberadamente NO la controla: quien decide sobre un comando de red
   * eléctrica sigue siendo su propia cola, en memoria y sin depender de que
   * este servicio esté vivo. Si esta plataforma se cayera, un operador tiene
   * que poder rechazar un deslastre igual. Aquí solo se refleja, para que
   * exista un único sitio donde mirar y un único registro de quién aprobó qué.
   */
  mirror(record) {
    const { approvalId, tenantId } = record;
    if (!approvalId || !tenantId) return null;

    this._persist({ ...record, mirrored: true });

    // Visible en la bandeja mientras esté pendiente; al decidirse en su propio
    // plano, deja de ocupar sitio aquí (el rastro queda en la auditoría).
    if ((record.status || 'pending') === 'pending') {
      this._mirrored.set(approvalId, { ...record, mirrored: true });
    } else {
      this._mirrored.delete(approvalId);
    }

    this.audit?.log({
      tenantId,
      event: `hitl:mirror:${record.status || 'pending'}`,
      approvalId,
      action: record.action,
      origin: record.origin || 'externo',
      approvedBy: record.approvedBy || null,
    });
    this.bus?.emit('hitl:mirrored', record);
    return { approvalId, mirrored: true };
  }

  listPending(tenantId) {
    const live = [...this._pending.entries()]
      .filter(([, p]) => p.payload.tenantId === tenantId)
      .map(([id, p]) => ({ approvalId: id, ...p.payload }));
    const orphans = [...this._orphans.entries()]
      .filter(([, o]) => o.tenantId === tenantId)
      .map(([id, o]) => ({ approvalId: id, ...o }));
    // Las reflejadas se ven aquí pero NO se deciden aquí: manda su propio plano.
    const espejo = [...this._mirrored.entries()]
      .filter(([, m]) => m.tenantId === tenantId)
      .map(([id, m]) => ({ approvalId: id, ...m, decidableAqui: false }));
    return [...orphans, ...espejo, ...live];
  }
}

module.exports = HITLGate;
