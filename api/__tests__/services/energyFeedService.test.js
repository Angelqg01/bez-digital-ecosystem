const feed = require('../../services/energyFeedService');

const SAMPLE = `MARGINALPDBC;
2026;06;06;01;42.10;45.30;
2026;06;06;02;38.00;40.10;
2026;06;06;03;25.50;28.00;
2026;06;06;04;-3.20;-1.00;
2026;06;06;05;55.00;60.00;
*`;

describe('energyFeedService — OMIE marginalpdbc parser', () => {
  it('parses hourly rows with PT and ES prices', () => {
    const rows = feed.parseMarginalPdbc(SAMPLE);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ hour: 1, price_pt: 42.1, price_es: 45.3 });
    expect(rows[3]).toMatchObject({ hour: 4, price_pt: -3.2, price_es: -1.0 });
    expect(rows[0].date).toEqual({ year: 2026, month: 6, day: 6 });
  });

  it('ignores header, footer and blank lines', () => {
    expect(feed.parseMarginalPdbc('MARGINALPDBC;\n\n*')).toEqual([]);
    expect(feed.parseMarginalPdbc('')).toEqual([]);
  });

  it('falls back to a single price column when only one is present', () => {
    const rows = feed.parseMarginalPdbc('2026;06;06;01;50.00;');
    expect(rows[0].price_es).toBe(50);
    expect(rows[0].price_pt).toBe(50);
  });

  it('builds the /market/omie response from parsed rows', () => {
    const rows = feed.parseMarginalPdbc(SAMPLE);
    const now = new Date('2026-06-06T02:30:00'); // local hour 2 → OMIE hour 3
    const r = feed.buildOmieResponse(rows, now);
    expect(r.price_eur_mwh).toBe(28.0);                 // hour 3 ES price
    expect(r.source).toBe('OMIE marginalpdbc');
    expect(r.predictions.in_1h.price).toBe(-1.0);       // hour 4
    expect(r.ai_recommendation).toBe('CHARGE_BATTERY'); // 28 < 30 threshold
    expect(r.curve).toHaveLength(5);
  });

  it('flags deeply negative prices (< -5) as a critical-charge signal', () => {
    const rows = [{ hour: 1, price_pt: -8, price_es: -8, date: { year: 2026, month: 6, day: 6 } }];
    const now = new Date('2026-06-06T00:30:00'); // local hour 0 → OMIE hour 1
    const r = feed.buildOmieResponse(rows, now);
    expect(r.price_eur_mwh).toBe(-8);
    expect(r.signal_strength).toBe('CRITICAL_CHARGE');
    expect(r.ai_recommendation).toBe('CHARGE_BATTERY');
  });

  it('selects the right period for 96-row (quarter-hourly) data', () => {
    // 96 periods; price_es encodes the period index so we can assert selection.
    const rows = Array.from({ length: 96 }, (_, i) => ({
      hour: i + 1, price_pt: i + 1, price_es: i + 1, date: { year: 2026, month: 6, day: 6 },
    }));
    const now = new Date('2026-06-06T10:20:00'); // 10h * 4 + floor(20/15)=1 + 1 = period 42
    const r = feed.buildOmieResponse(rows, now);
    expect(r.price_eur_mwh).toBe(42);
    expect(r.predictions.in_1h.price).toBe(46); // +4 periods = +1 hour
    expect(r.predictions.in_6h.price).toBe(66); // +24 periods = +6 hours
  });

  it('returns null for empty rows', () => {
    expect(feed.buildOmieResponse([])).toBeNull();
  });

  it('builds a dated OMIE file URL', () => {
    const url = feed.omieFileUrl(new Date('2026-06-06T10:00:00'));
    expect(url).toContain('marginalpdbc_20260606.1');
  });
});
