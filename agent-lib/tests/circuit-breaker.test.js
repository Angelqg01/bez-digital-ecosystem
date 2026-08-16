/**
 * Tests: CircuitBreaker
 */
const CircuitBreaker = require('../core/CircuitBreaker');
const { CircuitOpenError, STATES } = require('../core/CircuitBreaker');

describe('CircuitBreaker', () => {
    let cb;

    beforeEach(() => {
        cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 100 });
    });

    // ── State model ──

    test('new circuit starts CLOSED', () => {
        const status = cb.getStatus('svc');
        expect(status.state).toBe('CLOSED');
        expect(status.failures).toBe(0);
    });

    test('successful call keeps CLOSED', async () => {
        const result = await cb.exec('svc', async () => 'ok');
        expect(result).toBe('ok');
        expect(cb.getStatus('svc').state).toBe('CLOSED');
    });

    test('failures below threshold stay CLOSED', async () => {
        const fail = async () => { throw new Error('fail'); };
        await expect(cb.exec('svc', fail)).rejects.toThrow('fail');
        await expect(cb.exec('svc', fail)).rejects.toThrow('fail');
        expect(cb.getStatus('svc').state).toBe('CLOSED');
        expect(cb.getStatus('svc').failures).toBe(2);
    });

    test('reaching threshold opens circuit', async () => {
        const fail = async () => { throw new Error('boom'); };
        for (let i = 0; i < 3; i++) {
            await expect(cb.exec('svc', fail)).rejects.toThrow();
        }
        expect(cb.getStatus('svc').state).toBe('OPEN');
    });

    test('OPEN circuit rejects immediately', async () => {
        const fail = async () => { throw new Error('x'); };
        for (let i = 0; i < 3; i++) await cb.exec('svc', fail).catch(() => { });
        await expect(cb.exec('svc', async () => 'ok')).rejects.toThrow(CircuitOpenError);
    });

    test('OPEN transitions to HALF_OPEN after timeout', async () => {
        const fail = async () => { throw new Error('x'); };
        for (let i = 0; i < 3; i++) await cb.exec('svc', fail).catch(() => { });

        // Wait for reset timeout
        await new Promise(r => setTimeout(r, 120));

        // Status should show HALF_OPEN
        const status = cb.getStatus('svc');
        expect(status.state).toBe('HALF_OPEN');
    });

    test('HALF_OPEN success closes circuit', async () => {
        const fail = async () => { throw new Error('x'); };
        for (let i = 0; i < 3; i++) await cb.exec('svc', fail).catch(() => { });
        await new Promise(r => setTimeout(r, 120));

        const result = await cb.exec('svc', async () => 'recovered');
        expect(result).toBe('recovered');
        expect(cb.getStatus('svc').state).toBe('CLOSED');
    });

    test('HALF_OPEN failure reopens circuit', async () => {
        const fail = async () => { throw new Error('x'); };
        for (let i = 0; i < 3; i++) await cb.exec('svc', fail).catch(() => { });
        await new Promise(r => setTimeout(r, 120));

        await expect(cb.exec('svc', fail)).rejects.toThrow();
        expect(cb.getStatus('svc').state).toBe('OPEN');
    });

    // ── Multi-circuit ──

    test('tracks multiple circuits independently', async () => {
        const fail = async () => { throw new Error('x'); };
        for (let i = 0; i < 3; i++) await cb.exec('a', fail).catch(() => { });
        await cb.exec('b', async () => 'ok');

        expect(cb.getStatus('a').state).toBe('OPEN');
        expect(cb.getStatus('b').state).toBe('CLOSED');
    });

    test('getAll returns all circuit statuses', async () => {
        await cb.exec('x', async () => 1);
        await cb.exec('y', async () => 2);
        const all = cb.getAll();
        expect(Object.keys(all)).toEqual(expect.arrayContaining(['x', 'y']));
    });

    test('size tracks number of circuits', async () => {
        await cb.exec('a', async () => 1);
        await cb.exec('b', async () => 2);
        expect(cb.size).toBe(2);
    });

    // ── Manual reset ──

    test('reset closes an open circuit', async () => {
        const fail = async () => { throw new Error('x'); };
        for (let i = 0; i < 3; i++) await cb.exec('svc', fail).catch(() => { });
        expect(cb.getStatus('svc').state).toBe('OPEN');

        cb.reset('svc');
        expect(cb.getStatus('svc').state).toBe('CLOSED');
        expect(cb.getStatus('svc').failures).toBe(0);
    });

    // ── Event log ──

    test('logs events for inspection', async () => {
        // Trigger failure then success — both generate log entries
        await cb.exec('svc', async () => { throw new Error('x'); }).catch(() => { });
        await cb.exec('svc', async () => 'a');
        const log = cb.getLog();
        expect(log.length).toBeGreaterThan(0);
        expect(log[0]).toHaveProperty('ts');
        expect(log[0]).toHaveProperty('circuit', 'svc');
    });

    test('log is capped at maxLogSize', async () => {
        cb.maxLogSize = 5;
        for (let i = 0; i < 10; i++) {
            cb.eventLog.push({ ts: Date.now(), circuit: 't', event: 'test' });
        }
        // Next exec triggers _log which trims
        await cb.exec('t', async () => { throw new Error('x'); }).catch(() => { });
        expect(cb.getLog(100).length).toBeLessThanOrEqual(6); // 5 + new
    });

    // ── CircuitOpenError ──

    test('CircuitOpenError has circuit name and remainingMs', async () => {
        const fail = async () => { throw new Error('x'); };
        for (let i = 0; i < 3; i++) await cb.exec('svc', fail).catch(() => { });
        try {
            await cb.exec('svc', async () => 'ok');
        } catch (err) {
            expect(err).toBeInstanceOf(CircuitOpenError);
            expect(err.circuit).toBe('svc');
            expect(err.remainingMs).toBeGreaterThan(0);
        }
    });

    // ── STATES export ──

    test('exports STATES constants', () => {
        expect(STATES.CLOSED).toBe('CLOSED');
        expect(STATES.OPEN).toBe('OPEN');
        expect(STATES.HALF_OPEN).toBe('HALF_OPEN');
    });
});
