/**
 * Tests: RuntimeEventBus
 */
const eventBus = require('../core/RuntimeEventBus');
const { RuntimeEventBus } = require('../core/RuntimeEventBus');

describe('RuntimeEventBus', () => {
    afterEach(() => {
        eventBus.removeAllListeners('runtime-event');
        // Reset sequence
        eventBus._seq = 0;
    });

    test('is an EventEmitter singleton', () => {
        expect(eventBus).toBeInstanceOf(RuntimeEventBus);
    });

    test('publish emits a runtime-event', (done) => {
        eventBus.on('runtime-event', (evt) => {
            expect(evt).toHaveProperty('type', 'tool:invoke');
            expect(evt).toHaveProperty('tool', 'bridge-health');
            expect(evt).toHaveProperty('ts');
            expect(evt).toHaveProperty('id');
            done();
        });
        eventBus.publish('tool:invoke', { tool: 'bridge-health' });
    });

    test('publish increments sequence', () => {
        eventBus.publish('a', {});
        eventBus.publish('b', {});
        expect(eventBus.seq).toBe(2);
    });

    test('event includes all payload fields', (done) => {
        eventBus.on('runtime-event', (evt) => {
            expect(evt.user).toBe('0x123');
            expect(evt.custom).toBe(true);
            done();
        });
        eventBus.publish('tool:result', { user: '0x123', custom: true });
    });

    test('multiple listeners receive the same event', () => {
        const received = [];
        eventBus.on('runtime-event', (e) => received.push('a'));
        eventBus.on('runtime-event', (e) => received.push('b'));
        eventBus.publish('test', {});
        expect(received).toEqual(['a', 'b']);
    });

    test('supports high max listeners', () => {
        expect(eventBus.getMaxListeners()).toBe(100);
    });

    test('publish returns the event object', () => {
        const evt = eventBus.publish('foo', { bar: 1 });
        expect(evt.type).toBe('foo');
        expect(evt.bar).toBe(1);
        expect(evt.id).toBeGreaterThan(0);
    });
});
