'use strict';

/**
 * BaseConnector — interfaz común de toda herramienta externa (CRM, email, pago...).
 * Los agentes llaman connector.execute(method, args). Cada connector valida y
 * registra. Las acciones sensibles las filtra antes el PolicyEngine vía BaseAgent.act().
 */
class BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    this.tenantId = tenantId;
    this.config = config;
    this.name = 'base';
  }
  async execute(method, args) {
    throw new Error(`${this.name}: execute(${method}) no implementado`);
  }
}
module.exports = BaseConnector;
