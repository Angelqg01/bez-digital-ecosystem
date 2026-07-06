const agent = require('../../services/energyArbitrageAgent');

describe('energyArbitrageAgent.evaluate — decision logic', () => {
  it('charges at max power on negative prices', () => {
    const d = agent.evaluate({ priceEurMwh: -8, socPct: 50, capacityKw: 500 });
    expect(d.strategy).toBe('MAX_CHARGE');
    expect(d.powerKw).toBe(500);
  });

  it('holds on negative price when battery is full', () => {
    const d = agent.evaluate({ priceEurMwh: -8, socPct: 96 });
    expect(d.strategy).toBe('HOLD');
    expect(d.powerKw).toBe(0);
  });

  it('charges when price is below the cheap threshold', () => {
    const d = agent.evaluate({ priceEurMwh: 22, socPct: 50 });
    expect(d.strategy).toBe('CHARGE');
  });

  it('holds when cheap but battery is full', () => {
    const d = agent.evaluate({ priceEurMwh: 22, socPct: 95 });
    expect(d.strategy).toBe('HOLD');
  });

  it('discharges & sells when price is above the expensive threshold', () => {
    const d = agent.evaluate({ priceEurMwh: 99, socPct: 80, capacityKw: 250 });
    expect(d.strategy).toBe('DISCHARGE_SELL');
    expect(d.powerKw).toBe(250);
  });

  it('holds when expensive but battery is low', () => {
    const d = agent.evaluate({ priceEurMwh: 99, socPct: 15 });
    expect(d.strategy).toBe('HOLD');
  });

  it('holds within the price band', () => {
    expect(agent.evaluate({ priceEurMwh: 50, socPct: 60 }).strategy).toBe('HOLD');
  });

  it('holds on missing data', () => {
    expect(agent.evaluate({ priceEurMwh: null, socPct: 60 }).strategy).toBe('HOLD');
    expect(agent.evaluate({ priceEurMwh: 50, socPct: null }).strategy).toBe('HOLD');
  });

  it('respects a custom config', () => {
    const d = agent.evaluate({ priceEurMwh: 60, socPct: 50, cfg: { dischargeAboveEurMwh: 55 } });
    expect(d.strategy).toBe('DISCHARGE_SELL');
  });
});

describe('energyArbitrageAgent helpers', () => {
  it('maps strategies to SCADA commands', () => {
    expect(agent.strategyToCommand('MAX_CHARGE')).toBe('CHARGE_BATTERY');
    expect(agent.strategyToCommand('CHARGE')).toBe('CHARGE_BATTERY');
    expect(agent.strategyToCommand('DISCHARGE_SELL')).toBe('DISCHARGE_BATTERY');
    expect(agent.strategyToCommand('HOLD')).toBeNull();
  });

  it('picks the battery node from telemetry', () => {
    const tel = { nodes: [{ id: 'n1', type: 'SOLAR' }, { id: 'n4', type: 'BATTERY', soc_pct: 70 }] };
    expect(agent.pickBattery(tel).id).toBe('n4');
    expect(agent.pickBattery({ nodes: [] })).toBeNull();
    expect(agent.pickBattery(null)).toBeNull();
  });

  it('estimates € exposure from power, price and duration', () => {
    expect(agent.estimateEur(500, 80, 1)).toBe(40);     // 0.5 MW × 1h × 80 €/MWh
    expect(agent.estimateEur(200, 100, 0.25)).toBe(5);  // 0.2 MW × 0.25h × 100
    expect(agent.estimateEur(0, 80, 1)).toBe(0);
  });
});

describe('energyArbitrageAgent.dispatchDecision — Phase 6 production safety', () => {
  const vppBroker = require('../../services/vppMqttBroker');
  const controlSecurity = require('../../services/controlSecurity');
  const hitlQueue = require('../../services/hitlQueue');
  const aegis = require('../../services/aegisAnomalyEngine');

  const decision = (over = {}) => ({ strategy: 'CHARGE', powerKw: 100, nodeId: 'n4', priceEurMwh: 20, socPct: 50, estimatedEur: 5, ...over });

  beforeEach(() => { hitlQueue._reset(); aegis._reset(); agent._resetLog(); jest.restoreAllMocks(); });

  it('shadow mode recommends but never actuates', async () => {
    const spy = jest.spyOn(vppBroker, 'publishSignedControl').mockReturnValue(true);
    const d = await agent.dispatchDecision(decision(), { mode: 'shadow' });
    expect(d.shadow).toBe(true);
    expect(d.dispatched).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('live mode signs + dispatches a small command via the F5 write-path', async () => {
    const signSpy = jest.spyOn(controlSecurity, 'signCommand');
    const pubSpy = jest.spyOn(vppBroker, 'publishSignedControl').mockReturnValue(true);
    const d = await agent.dispatchDecision(decision({ estimatedEur: 5 }), { mode: 'live', hitlAboveEur: 500 });
    expect(signSpy).toHaveBeenCalled();
    expect(pubSpy).toHaveBeenCalled();
    expect(d.signed).toBe(true);
    expect(d.dispatched).toBe(true);
    expect(d.hitlPending).toBeFalsy();
  });

  it('routes a large-€ command through HITL instead of dispatching', async () => {
    const pubSpy = jest.spyOn(vppBroker, 'publishSignedControl').mockReturnValue(true);
    const d = await agent.dispatchDecision(decision({ estimatedEur: 750 }), { mode: 'live', hitlAboveEur: 500 });
    expect(d.hitlPending).toBe(true);
    expect(d.dispatched).toBe(false);
    expect(pubSpy).not.toHaveBeenCalled();
    expect(hitlQueue.get(d.jobId).status).toBe('PENDING');
  });

  it('kill-switch blocks trading on a node with a recent HIGH Aegis anomaly', async () => {
    aegis.record([{ id: 'x', ts: new Date().toISOString(), node: 'n4', type: 'SPOOFING_ATTEMPT', severity: 'HIGH', result: 'FAIL' }]);
    const pubSpy = jest.spyOn(vppBroker, 'publishSignedControl').mockReturnValue(true);
    const d = await agent.dispatchDecision(decision(), { mode: 'live' });
    expect(d.blocked).toBe('aegis_high_anomaly');
    expect(d.dispatched).toBe(false);
    expect(pubSpy).not.toHaveBeenCalled();
  });

  it('does not actuate a HOLD decision', async () => {
    const pubSpy = jest.spyOn(vppBroker, 'publishSignedControl').mockReturnValue(true);
    const d = await agent.dispatchDecision(decision({ strategy: 'HOLD', powerKw: 0 }), { mode: 'live' });
    expect(d.dispatched).toBe(false);
    expect(pubSpy).not.toHaveBeenCalled();
  });
});
