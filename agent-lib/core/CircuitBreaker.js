/**
 * CircuitBreaker — Protects external service calls (Aegis, AI-Engine MCP, SDK).
 *
 * States:
 *   CLOSED      → Normal operation. Failures are counted.
 *   OPEN        → Requests fail immediately. After resetTimeout, moves to HALF_OPEN.
 *   HALF_OPEN   → One probe request allowed. Success → CLOSED, Failure → OPEN.
 *
 * Usage:
 *   const cb = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000 });
 *   const result = await cb.exec('aegis', () => axios.get(...));
 */

const STATES = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker {
    /**
     * @param {{ failureThreshold?: number, resetTimeout?: number, halfOpenMax?: number }} [opts]
     */
    constructor(opts = {}) {
        this.failureThreshold = opts.failureThreshold || 5;
        this.resetTimeout = opts.resetTimeout || 30_000; // ms before OPEN → HALF_OPEN
        this.halfOpenMax = opts.halfOpenMax || 1; // probes allowed in HALF_OPEN

        /** @type {Map<string, { state: string, failures: number, lastFailure: number, halfOpenAttempts: number }>} */
        this.circuits = new Map();

        /** @type {Array<{ ts: number, circuit: string, event: string, detail?: string }>} */
        this.eventLog = [];
        this.maxLogSize = 200;
    }

    // ── Public API ──────────────────────────────────────────────

    /**
     * Execute a function through the circuit breaker.
     * @param {string} circuitName  Unique name for the service (e.g. "aegis", "mcp", "sdk")
     * @param {() => Promise<any>} fn  The async function to protect
     * @returns {Promise<any>}
     */
    async exec(circuitName, fn) {
        const circuit = this._ensure(circuitName);

        // Transition OPEN → HALF_OPEN if timeout elapsed
        if (circuit.state === STATES.OPEN) {
            const elapsed = Date.now() - circuit.lastFailure;
            if (elapsed >= this.resetTimeout) {
                this._transition(circuitName, circuit, STATES.HALF_OPEN);
            } else {
                this._log(circuitName, 'rejected', `circuit open, ${Math.ceil((this.resetTimeout - elapsed) / 1000)}s left`);
                throw new CircuitOpenError(circuitName, this.resetTimeout - elapsed);
            }
        }

        // HALF_OPEN — allow limited probes
        if (circuit.state === STATES.HALF_OPEN) {
            if (circuit.halfOpenAttempts >= this.halfOpenMax) {
                throw new CircuitOpenError(circuitName, 0);
            }
            circuit.halfOpenAttempts++;
        }

        try {
            const result = await fn();
            this._onSuccess(circuitName, circuit);
            return result;
        } catch (err) {
            this._onFailure(circuitName, circuit, err);
            throw err;
        }
    }

    /**
     * Get status of a named circuit.
     * @param {string} circuitName
     * @returns {{ state: string, failures: number, lastFailure: number | null }}
     */
    getStatus(circuitName) {
        const c = this.circuits.get(circuitName);
        if (!c) return { state: STATES.CLOSED, failures: 0, lastFailure: null };
        // Check for auto-transition
        if (c.state === STATES.OPEN && (Date.now() - c.lastFailure) >= this.resetTimeout) {
            return { state: STATES.HALF_OPEN, failures: c.failures, lastFailure: c.lastFailure };
        }
        return { state: c.state, failures: c.failures, lastFailure: c.lastFailure };
    }

    /**
     * Get all circuit statuses.
     * @returns {Object<string, { state: string, failures: number }>}
     */
    getAll() {
        const result = {};
        for (const name of this.circuits.keys()) {
            result[name] = this.getStatus(name);
        }
        return result;
    }

    /**
     * Manually reset a circuit to CLOSED.
     * @param {string} circuitName
     */
    reset(circuitName) {
        const circuit = this._ensure(circuitName);
        this._transition(circuitName, circuit, STATES.CLOSED);
        circuit.failures = 0;
    }

    /**
     * Get recent event log entries.
     * @param {number} [limit=50]
     * @returns {Array}
     */
    getLog(limit = 50) {
        return this.eventLog.slice(-limit);
    }

    /** Total number of tracked circuits */
    get size() {
        return this.circuits.size;
    }

    // ── Internal ────────────────────────────────────────────────

    /** @private */
    _ensure(name) {
        if (!this.circuits.has(name)) {
            this.circuits.set(name, {
                state: STATES.CLOSED,
                failures: 0,
                lastFailure: 0,
                halfOpenAttempts: 0,
            });
        }
        return this.circuits.get(name);
    }

    /** @private */
    _onSuccess(name, circuit) {
        if (circuit.state === STATES.HALF_OPEN) {
            this._transition(name, circuit, STATES.CLOSED);
            circuit.failures = 0;
            this._log(name, 'recovered');
        } else {
            // Reset failure counter on success in CLOSED state
            if (circuit.failures > 0) {
                circuit.failures = 0;
                this._log(name, 'reset-failures');
            }
        }
    }

    /** @private */
    _onFailure(name, circuit, err) {
        circuit.failures++;
        circuit.lastFailure = Date.now();

        if (circuit.state === STATES.HALF_OPEN) {
            this._transition(name, circuit, STATES.OPEN);
            this._log(name, 'probe-failed', err.message);
        } else if (circuit.failures >= this.failureThreshold) {
            this._transition(name, circuit, STATES.OPEN);
            this._log(name, 'tripped', `${circuit.failures} failures`);
        } else {
            this._log(name, 'failure', `${circuit.failures}/${this.failureThreshold}`);
        }
    }

    /** @private */
    _transition(name, circuit, newState) {
        const oldState = circuit.state;
        circuit.state = newState;
        if (newState === STATES.HALF_OPEN) circuit.halfOpenAttempts = 0;
        this._log(name, 'state-change', `${oldState} → ${newState}`);
    }

    /** @private */
    _log(circuit, event, detail) {
        this.eventLog.push({ ts: Date.now(), circuit, event, detail });
        if (this.eventLog.length > this.maxLogSize) {
            this.eventLog = this.eventLog.slice(-this.maxLogSize);
        }
    }
}

class CircuitOpenError extends Error {
    constructor(circuitName, remainingMs) {
        super(`Circuit "${circuitName}" is OPEN — retry after ${Math.ceil(remainingMs / 1000)}s`);
        this.name = 'CircuitOpenError';
        this.circuit = circuitName;
        this.remainingMs = remainingMs;
    }
}

module.exports = CircuitBreaker;
module.exports.CircuitOpenError = CircuitOpenError;
module.exports.STATES = STATES;
