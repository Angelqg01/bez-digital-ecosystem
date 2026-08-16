/**
 * RuntimeEventBus — In-process event emitter for SSE streaming.
 *
 * Tools and commands emit events here; the SSE endpoint subscribes.
 * Uses Node EventEmitter (no Redis dependency — keeps it testable).
 *
 * Event types:
 *   tool:invoke   — tool execution started
 *   tool:result   — tool execution completed
 *   tool:error    — tool execution failed
 *   command:exec  — slash command dispatched
 *   circuit:change — circuit breaker state change
 *   parity:audit  — parity audit completed
 */

const { EventEmitter } = require('events');

class RuntimeEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // support many SSE clients
        this._seq = 0;
    }

    /**
     * Emit a typed runtime event.
     * @param {string} type  Event type (e.g. "tool:invoke")
     * @param {object} payload  Event data
     */
    publish(type, payload = {}) {
        this._seq++;
        const event = {
            id: this._seq,
            type,
            ts: Date.now(),
            ...payload,
        };
        this.emit('runtime-event', event);
        return event;
    }

    /** Current sequence number */
    get seq() { return this._seq; }
}

// Singleton — shared across the runtime
const bus = new RuntimeEventBus();

module.exports = bus;
module.exports.RuntimeEventBus = RuntimeEventBus;
