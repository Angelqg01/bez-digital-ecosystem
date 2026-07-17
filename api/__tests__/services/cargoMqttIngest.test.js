const { mockQuery } = require('../helpers');

const cargoMqtt = require('../../services/cargoMqttIngest');

function seedDevice(overrides = {}) {
  mockQuery.mockResolvedValueOnce({
    rows: [{
      device_id: 'dev_abc', bezhas_id: 'BZ_ID_ACME', type: 'multi',
      b_uid: null, config: { tempMin: 2, tempMax: 8, shockMax: 5 },
      status: 'active', signer_address: null,
      ...overrides,
    }],
    rowCount: 1,
  });
}

describe('cargoMqttIngest — handleMessage (same pipeline as HTTP)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  it('ingests a valid MQTT payload authenticated by deviceKey', async () => {
    seedDevice();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, metric: 'temperature', value: 5, breach: false }], rowCount: 1 }) // INSERT telemetry
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE last_seen

    const result = await cargoMqtt.handleMessage(
      'bezhas/cargo/dev_abc/telemetry',
      Buffer.from(JSON.stringify({ deviceKey: 'bzd_key', temperature: 5 }))
    );

    expect(result).not.toBeNull();
    expect(result.stored).toBe(1);
    expect(result.deviceId).toBe('dev_abc');
  });

  it('rejects a payload whose topic does not match the key owner', async () => {
    seedDevice(); // key resolves to dev_abc, but topic says dev_zzz
    const result = await cargoMqtt.handleMessage(
      'bezhas/cargo/dev_zzz/telemetry',
      Buffer.from(JSON.stringify({ deviceKey: 'bzd_key', temperature: 5 }))
    );
    expect(result).toBeNull();
  });

  it('rejects non-JSON payloads and payloads without deviceKey', async () => {
    expect(await cargoMqtt.handleMessage('bezhas/cargo/dev_abc/telemetry', Buffer.from('not json'))).toBeNull();
    expect(await cargoMqtt.handleMessage('bezhas/cargo/dev_abc/telemetry', Buffer.from('{"temperature":5}'))).toBeNull();
  });

  it('reports status without a broker connection', () => {
    const status = cargoMqtt.getStatus();
    expect(status.connected).toBe(false);
    expect(status.topic).toBe('bezhas/cargo/+/telemetry');
  });
});
