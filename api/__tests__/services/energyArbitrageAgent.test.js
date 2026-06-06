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
});
