const broker = require('../../services/vppMqttBroker');

describe('vppMqttBroker — Edge Node telemetry ingestion', () => {
  beforeEach(() => broker._reset());

  it('returns null when no telemetry has been received', () => {
    expect(broker.getLatestTelemetry()).toBeNull();
    expect(broker.getNodeTelemetry('n1')).toBeNull();
  });

  it('ingests a payload into a buildTelemetry-compatible shape', () => {
    broker.ingest('n1', {
      type: 'SOLAR', name: 'Array Alpha', status: 'ONLINE', protocol: 'MQTT/Modbus',
      metrics: { output_kw: 12.5, voltage_v: 226, efficiency: 96 },
    });

    const t = broker.getLatestTelemetry();
    expect(t).not.toBeNull();
    expect(t.nodes).toHaveLength(1);

    const n = t.nodes[0];
    expect(n.id).toBe('n1');
    expect(n.type).toBe('SOLAR');
    expect(n.output_kw).toBe(12.5);
    expect(n.voltage_v).toBe(226);
    expect(n).not.toHaveProperty('_rxAt'); // internal field is stripped
    expect(t.global.total_output_kw).toBe(12.5);
  });

  it('computes global net flow as generation minus load', () => {
    broker.ingest('n1', { type: 'SOLAR', metrics: { output_kw: 20 } });
    broker.ingest('n5', { type: 'LOAD', metrics: { consumption_kw: 8 } });

    const g = broker.getLatestTelemetry().global;
    expect(g.total_output_kw).toBe(20);
    expect(g.net_flow_kw).toBe(12);
    expect(g.self_sufficiency_pct).toBe(100); // generation >= load → capped at 100
  });

  it('reports self-sufficiency below 100 when load exceeds generation', () => {
    broker.ingest('n1', { type: 'SOLAR', metrics: { output_kw: 5 } });
    broker.ingest('n5', { type: 'LOAD', metrics: { consumption_kw: 10 } });

    const g = broker.getLatestTelemetry().global;
    expect(g.self_sufficiency_pct).toBe(50);
    expect(g.net_flow_kw).toBe(-5);
  });

  it('marks a node OFFLINE when its telemetry is stale', () => {
    broker.ingest('n1', { type: 'SOLAR', status: 'ONLINE', metrics: { output_kw: 10 } });

    const realNow = Date.now;
    Date.now = () => realNow() + 60_000; // jump past the 30s staleness window
    try {
      const n = broker.getNodeTelemetry('n1').nodes[0];
      expect(n.status).toBe('OFFLINE');
    } finally {
      Date.now = realNow;
    }
  });

  it('ignores invalid payloads', () => {
    expect(broker.ingest('n1', null)).toBeNull();
    expect(broker.ingest('', { type: 'X' })).toBeNull();
    expect(broker.getLatestTelemetry()).toBeNull();
  });

  it('publishControl returns false when the broker is not connected', () => {
    expect(broker.publishControl('n1', 'CHARGE_BATTERY', { powerKw: 50 })).toBe(false);
  });

  it('exposes the documented topic contract', () => {
    expect(broker.TELEMETRY_TOPIC).toBe('bezhas/edge/+/telemetry');
    expect(broker.controlTopic('n4')).toBe('bezhas/edge/n4/control');
  });
});
