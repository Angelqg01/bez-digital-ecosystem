/**
 * Tests for SessionManager — in-memory mode (no Redis required).
 */
const SessionManager = require('../core/SessionManager');

describe('SessionManager', () => {
    let sessions;

    beforeEach(() => {
        sessions = new SessionManager();
    });

    test('creates a new session on get()', async () => {
        const session = await sessions.get('user1:conv1');
        expect(session.id).toBe('user1:conv1');
        expect(session.history).toEqual([]);
        expect(session.context).toEqual({});
        expect(session.lastTool).toBeNull();
        expect(session.createdAt).toBeDefined();
    });

    test('returns existing session on subsequent get()', async () => {
        const s1 = await sessions.get('user1:conv1');
        s1.context.test = true;
        await sessions.set('user1:conv1', s1);

        const s2 = await sessions.get('user1:conv1');
        expect(s2.context.test).toBe(true);
    });

    test('appendHistory adds entry', async () => {
        await sessions.get('s1');
        const session = await sessions.appendHistory('s1', {
            type: 'tool',
            name: 'bridge-health',
            input: {},
            output: { health: 'ok' },
        });
        expect(session.history).toHaveLength(1);
        expect(session.history[0].name).toBe('bridge-health');
        expect(session.history[0].timestamp).toBeDefined();
        expect(session.lastTool).toBe('bridge-health');
    });

    test('appendHistory trims to last 50 entries', async () => {
        await sessions.get('s2');
        for (let i = 0; i < 55; i++) {
            await sessions.appendHistory('s2', { type: 'tool', name: `tool-${i}` });
        }
        const session = await sessions.get('s2');
        expect(session.history).toHaveLength(50);
        expect(session.history[0].name).toBe('tool-5'); // oldest retained
        expect(session.history[49].name).toBe('tool-54'); // newest
    });

    test('updateContext merges data', async () => {
        await sessions.get('s3');
        await sessions.updateContext('s3', { sector: 'logistics' });
        await sessions.updateContext('s3', { toolCount: 5 });

        const session = await sessions.get('s3');
        expect(session.context).toEqual({ sector: 'logistics', toolCount: 5 });
    });

    test('destroy removes session', async () => {
        await sessions.get('temp');
        expect(sessions.size).toBe(1);

        await sessions.destroy('temp');
        expect(sessions.size).toBe(0);

        // New get creates fresh session
        const fresh = await sessions.get('temp');
        expect(fresh.history).toEqual([]);
    });

    test('size tracks in-memory sessions', async () => {
        expect(sessions.size).toBe(0);
        await sessions.get('a');
        await sessions.get('b');
        expect(sessions.size).toBe(2);
    });

    test('setRedis can be called without error', () => {
        expect(() => sessions.setRedis(null)).not.toThrow();
    });

    test('multiple sessions are independent', async () => {
        await sessions.appendHistory('user1:c1', { type: 'tool', name: 'tool-a' });
        await sessions.appendHistory('user2:c1', { type: 'tool', name: 'tool-b' });

        const s1 = await sessions.get('user1:c1');
        const s2 = await sessions.get('user2:c1');
        expect(s1.history).toHaveLength(1);
        expect(s1.history[0].name).toBe('tool-a');
        expect(s2.history).toHaveLength(1);
        expect(s2.history[0].name).toBe('tool-b');
    });
});
