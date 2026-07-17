require('../helpers');

const iot = require('../../services/cargoLinkIot');

describe('cargoLinkIot — normalizeReadings (unified payload)', () => {
  it('normalizes the new flat sensor fields', () => {
    const readings = iot.normalizeReadings({
      temperature: 5, humidity: 60, shock: 1, light: 120, pressure: 780,
      seal: 'open', bleZone: 'WAREHOUSE-A3', rfid: 'TAG-1', lat: 36.14, lng: -5.43,
    });
    const metrics = readings.map((r) => r.metric);
    expect(metrics).toEqual(
      expect.arrayContaining(['temperature', 'humidity', 'shock', 'light', 'pressure', 'seal', 'ble_zone', 'rfid', 'gps'])
    );
    expect(readings.find((r) => r.metric === 'seal').value).toBe(1);
    expect(readings.find((r) => r.metric === 'ble_zone').zone).toBe('WAREHOUSE-A3');
  });

  it('accepts seal state in readings[] form (open/closed)', () => {
    const open = iot.normalizeReadings({ readings: [{ metric: 'seal', state: 'open' }] });
    const closed = iot.normalizeReadings({ readings: [{ metric: 'seal', state: 'closed' }] });
    expect(open[0].value).toBe(1);
    expect(closed[0].value).toBe(0);
  });
});

describe('cargoLinkIot — checkRule (rule matrix)', () => {
  const cfg = {};

  it('temperature outside range → COLD_CHAIN_BREACH', () => {
    const v = iot.checkRule({ metric: 'temperature', value: 14 }, cfg);
    expect(v).toMatchObject({ breach: true, eventType: 'COLD_CHAIN_BREACH', tamper: false });
  });

  it('light above threshold outside an authorized zone → LIGHT_BREACH with tamper', () => {
    const v = iot.checkRule({ metric: 'light', value: 300 }, cfg, { geo: { authorizedForUnseal: false, verified: false, matched: [] } });
    expect(v).toMatchObject({ breach: true, eventType: 'LIGHT_BREACH', tamper: true });
  });

  it('light above threshold INSIDE an authorized zone is not a breach', () => {
    const v = iot.checkRule({ metric: 'light', value: 300 }, cfg, { geo: { authorizedForUnseal: true, verified: true, matched: ['Aduana'] } });
    expect(v.breach).toBe(false);
    expect(v.eventType).toBe('LIGHT_BREACH');
  });

  it('humidity rule is inactive until configured', () => {
    expect(iot.checkRule({ metric: 'humidity', value: 99 }, {}).breach).toBe(false);
    const v = iot.checkRule({ metric: 'humidity', value: 99 }, { humidityMax: 80 });
    expect(v).toMatchObject({ breach: true, eventType: 'HUMIDITY_BREACH' });
  });

  it('pressure rule fires when configured (air cargo)', () => {
    expect(iot.checkRule({ metric: 'pressure', value: 700 }, {}).breach).toBe(false);
    const v = iot.checkRule({ metric: 'pressure', value: 700 }, { pressureMinHpa: 750 });
    expect(v).toMatchObject({ breach: true, eventType: 'PRESSURE_LOSS' });
  });

  it('e-seal opened outside every authorized zone → CONTAINER_UNSEALED with tamper', () => {
    const v = iot.checkRule({ metric: 'seal', value: 1 }, cfg, { geo: { verified: false, authorizedForUnseal: false, matched: [] } });
    expect(v).toMatchObject({ breach: true, tamper: true, eventType: 'CONTAINER_UNSEALED' });
  });

  it('e-seal opened inside a customs zone is a legitimate inspection', () => {
    const v = iot.checkRule({ metric: 'seal', value: 1 }, cfg, { geo: { verified: true, authorizedForUnseal: true, matched: ['Aduana Algeciras'] } });
    expect(v.breach).toBe(false);
    expect(v.eventType).toBe('CONTAINER_UNSEALED');
  });

  it('e-seal opened with NO fences configured records the event without tamper', () => {
    const v = iot.checkRule({ metric: 'seal', value: 1 }, cfg, { geo: { verified: null, authorizedForUnseal: false, matched: [] } });
    expect(v.breach).toBe(false);
    expect(v.tamper).toBe(false);
  });

  it('GPS outside all enforced corridors → GEOFENCE_EXIT', () => {
    const v = iot.checkRule({ metric: 'gps', value: null, lat: 37, lng: -6 }, cfg, { geo: { verified: false, authorizedForUnseal: false, matched: [], corridorExit: true } });
    expect(v).toMatchObject({ breach: true, eventType: 'GEOFENCE_EXIT' });
  });
});
