require('../helpers');

const oracle = require('../../services/cargoDisputeOracle');

describe('cargoDisputeOracle — gradeBreach', () => {
  it('CONTAINER_UNSEALED with tamper is CRITICAL, without tamper is OK', () => {
    expect(oracle.gradeBreach({ eventType: 'CONTAINER_UNSEALED', tamper: true }).level).toBe(3);
    expect(oracle.gradeBreach({ eventType: 'CONTAINER_UNSEALED', tamper: false }).level).toBe(0);
  });

  it('LIGHT_BREACH before customs clearance is CRITICAL, later MODERATE', () => {
    expect(oracle.gradeBreach({ eventType: 'LIGHT_BREACH' }, { txStatus: 'CREATED' }).level).toBe(3);
    expect(oracle.gradeBreach({ eventType: 'LIGHT_BREACH' }, { txStatus: 'IN_TRANSIT' }).level).toBe(2);
  });

  it('COLD_CHAIN_BREACH severity scales with the deviation', () => {
    const config = { tempMin: 2, tempMax: 8 };
    expect(oracle.gradeBreach({ eventType: 'COLD_CHAIN_BREACH', value: 10, config }).level).toBe(1); // +2°C
    expect(oracle.gradeBreach({ eventType: 'COLD_CHAIN_BREACH', value: 15, config }).level).toBe(2); // +7°C
  });

  it('SHOCK_ALERT above 2x limit escalates to MODERATE', () => {
    const config = { shockMax: 5 };
    expect(oracle.gradeBreach({ eventType: 'SHOCK_ALERT', value: 7, config }).level).toBe(1);
    expect(oracle.gradeBreach({ eventType: 'SHOCK_ALERT', value: 12, config }).level).toBe(2);
  });

  it('PRESSURE_LOSS and GEOFENCE_EXIT are MODERATE; HUMIDITY_BREACH is MINOR', () => {
    expect(oracle.gradeBreach({ eventType: 'PRESSURE_LOSS' }).level).toBe(2);
    expect(oracle.gradeBreach({ eventType: 'GEOFENCE_EXIT' }).level).toBe(2);
    expect(oracle.gradeBreach({ eventType: 'HUMIDITY_BREACH' }).level).toBe(1);
  });
});

describe('cargoDisputeOracle — evaluate + settlement', () => {
  const tx = { status: 'IN_TRANSIT', escrow_amount_bez: 100, escrow_status: 'LOCKED' };

  it('no breaches → NONE', () => {
    const v = oracle.evaluate({ breaches: [], tx });
    expect(v.action).toBe('NONE');
    expect(v.severity).toBe(0);
  });

  it('MINOR breach → ALERT_ONLY, escrow untouched', () => {
    const v = oracle.evaluate({
      breaches: [{ eventType: 'COLD_CHAIN_BREACH', value: 9.5, config: { tempMin: 2, tempMax: 8 }, reason: 'x' }],
      tx,
    });
    expect(v.severity).toBe(1);
    expect(v.action).toBe('ALERT_ONLY');
    expect(v.settlement.escrowStatus).toBeNull();
    expect(v.settlement.payToSellerBEZ).toBe(100);
    expect(v.webhookEvent).toBe('ON_COLD_CHAIN_BREACH');
  });

  it('MODERATE breach → HOLD_ESCROW with partial refund proposal', () => {
    const v = oracle.evaluate({
      breaches: [{ eventType: 'PRESSURE_LOSS', reason: 'cabin pressure lost' }],
      tx,
    });
    expect(v.severity).toBe(2);
    expect(v.action).toBe('HOLD_ESCROW');
    expect(v.settlement.escrowStatus).toBe('DISPUTED');
    expect(v.settlement.refundToBuyerBEZ).toBeGreaterThan(0);
    expect(v.settlement.refundToBuyerBEZ + v.settlement.payToSellerBEZ).toBeCloseTo(100);
    expect(v.webhookEvent).toBe('ON_DISPUTE_OPENED');
  });

  it('CRITICAL tamper → AUTO_CLAIM with full refund', () => {
    const v = oracle.evaluate({
      breaches: [{ eventType: 'CONTAINER_UNSEALED', tamper: true, reason: 'seal opened outside zone' }],
      tx,
    });
    expect(v.severity).toBe(3);
    expect(v.action).toBe('AUTO_CLAIM');
    expect(v.settlement.refundToBuyerBEZ).toBe(100);
    expect(v.settlement.payToSellerBEZ).toBe(0);
  });

  it('the worst breach in the batch dictates the verdict', () => {
    const v = oracle.evaluate({
      breaches: [
        { eventType: 'HUMIDITY_BREACH', reason: 'humid' },
        { eventType: 'CONTAINER_UNSEALED', tamper: true, reason: 'tamper' },
      ],
      tx,
    });
    expect(v.severity).toBe(3);
    expect(v.reasons).toHaveLength(2);
  });
});
