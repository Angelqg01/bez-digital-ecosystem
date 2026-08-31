'use strict';

const EventEmitter = require('events');

/**
 * EventBus — bus de eventos del sistema. Una instancia por tenant para
 * mantener el aislamiento. Los eventos clave: 'hitl:pending', 'task:queued',
 * 'task:completed', 'task:failed', 'agent:action'.
 */
class EventBus extends EventEmitter {
  constructor(tenantId) {
    super();
    this.tenantId = tenantId;
    this.setMaxListeners(100);
  }
}

module.exports = EventBus;
