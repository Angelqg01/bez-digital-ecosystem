'use strict';

/**
 * Enrutado de lo que escribe un CLIENTE por un canal de mensajería.
 *
 * Las reglas por palabras clave del Orchestrator están pensadas para encargos internos («revisa el
 * contrato», «runway de tesorería»). Aplicadas a un cliente que escribe «¿Qué es BEZ-Coin?» mandaban
 * el mensaje a Tesorería y al cliente sólo le llegaba un acuse de recibo, sin respuesta; con «quiero
 * comprar» pasaba a Ventas, lo mismo. Todo lo que entra por Telegram, correo, WhatsApp o web va
 * primero a Soporte, que responde con la base de conocimiento y escala a una persona cuando no sabe.
 * Un input que ya trae tipo y departamento (webhooks de Stripe, leads…) no se toca.
 */

const CANALES_DE_CLIENTE = new Set(['telegram', 'email', 'whatsapp', 'web']);

function enrutarCanalDeCliente(canal, input) {
  if (CANALES_DE_CLIENTE.has(canal) && input && !input.type && !input.department) {
    input.type = 'support:ticket';
    input.department = 'support';
  }
  return input;
}

module.exports = { enrutarCanalDeCliente, CANALES_DE_CLIENTE };
