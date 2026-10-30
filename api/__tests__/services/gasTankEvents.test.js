const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...a) => mockQuery(...a) }));
const { emitToOrg } = require('../../services/gasTank/events');

beforeEach(() => mockQuery.mockReset());

test('encola el evento para cada app de la organización con el organizationId en los datos', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'app-1' }, { id: 'app-2' }] });
    const emit = jest.fn().mockResolvedValue(1);
    expect(await emitToOrg('org-1', 'gas.recharged', { credits: 5 }, { paymentWebhooks: { emit } })).toBe(2);
    expect(emit).toHaveBeenCalledWith('app-1', 'gas.recharged', { organizationId: 'org-1', credits: 5 });
    expect(emit).toHaveBeenCalledWith('app-2', 'gas.recharged', { organizationId: 'org-1', credits: 5 });
});

test('sin apps no hace nada, y un fallo nunca se propaga', async () => {
    const emit = jest.fn();
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await emitToOrg('org-1', 'gas.recharged', {}, { paymentWebhooks: { emit } })).toBe(0);
    expect(emit).not.toHaveBeenCalled();
    mockQuery.mockRejectedValueOnce(new Error('db caída'));
    await expect(emitToOrg('org-1', 'gas.recharged', {}, { paymentWebhooks: { emit } })).resolves.toBe(0);
});
