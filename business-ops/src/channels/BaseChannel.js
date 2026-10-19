'use strict';

/**
 * BaseChannel — contrato común de todo canal de entrada (web, Telegram, WhatsApp, email).
 *
 * Un canal solo traduce: normaliza el mensaje crudo del canal al input estándar
 * del Orchestrator, y formatea el resultado del agente al formato del canal.
 * NO contiene lógica de negocio: eso vive en los agentes.
 */
class BaseChannel {
  static get ACUSE() {
    return 'Hemos recibido tu mensaje. El equipo responsable lo revisará y te responderá lo antes posible.';
  }

  constructor({ name = 'base' } = {}) {
    this.name = name;
  }

  /**
   * Normaliza el payload crudo del canal al input del Orchestrator.
   * @returns {{ text, customerId, channel, meta }}
   */
  parseInbound(raw = {}) {
    throw new Error(`${this.name}: parseInbound() no implementado`);
  }

  /**
   * Formatea el resultado de una tarea al formato de respuesta del canal.
   * @param {object} task - tarea terminal del Orchestrator (con .result)
   */
  formatOutbound(task) {
    throw new Error(`${this.name}: formatOutbound() no implementado`);
  }

  /**
   * Verifica que la petición entrante es legítima (firma/secreto del proveedor).
   * Por defecto abierto; cada canal lo endurece según su proveedor.
   */
  verify(req) {
    return true;
  }

  /** Extrae el texto de respuesta al cliente de una tarea de Soporte resuelta. */
  static replyText(task) {
    if (!task) return '';
    if (task.status === 'failed') return 'No hemos podido procesar tu mensaje. Inténtalo de nuevo.';
    const r = task.result || {};
    // Soporte: resolution.reply, que está redactada para el cliente.
    if (r.resolution?.reply) return r.resolution.reply;
    // Cualquier otro departamento devuelve su resumen INTERNO (puntuaciones, notas del equipo…):
    // no es para el cliente. Se le acusa recibo y la tarea sigue su curso con el equipo.
    if (task.department && task.department !== 'support') return BaseChannel.ACUSE;
    return r.answer || r.summary || 'Recibido.';
  }
}

module.exports = BaseChannel;
