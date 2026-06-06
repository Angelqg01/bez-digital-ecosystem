const { validateTransition } = require('../../services/cargoLinkValidators');

const tx = (cargo = {}) => ({ b_uid: 'BZ-X', pos_ref: null, cargo });

describe('cargoLinkValidators (real sector logic)', () => {
  describe('customs', () => {
    it('routes a normal low-value shipment to the GREEN lane', () => {
      const v = validateTransition('CUSTOMS_CLEARED', tx(), { manifestId: 'M1', declaredValue: 800, hsCode: '8471' });
      expect(v.valid).toBe(true);
      expect(v.result.lane).toBe('GREEN_LANE');
      expect(v.result.dutyEstimate).toBe(32); // 800 * 0.04
    });

    it('routes a restricted HS chapter to the RED lane with inspection', () => {
      const v = validateTransition('CUSTOMS_CLEARED', tx(), { manifestId: 'M1', declaredValue: 800, hsCode: '9301' });
      expect(v.result.lane).toBe('RED_LANE');
      expect(v.result.inspectionRequired).toBe(true);
    });

    it('escalates a high declared value to the ORANGE lane', () => {
      const v = validateTransition('CUSTOMS_CLEARED', tx(), { manifestId: 'M1', declaredValue: 90000, hsCode: '8471' });
      expect(v.result.lane).toBe('ORANGE_LANE');
    });

    it('blocks clearance when manifest/value are missing', () => {
      const v = validateTransition('CUSTOMS_CLEARED', tx(), {});
      expect(v.valid).toBe(false);
      expect(v.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('stowage (real COG)', () => {
    it('computes a balanced COG as VERIFIED', () => {
      const v = validateTransition('STOWED', tx(), {
        container: { length: 12, width: 2.4 },
        items: [
          { x: 5, y: 1.0, weight: 100 },
          { x: 7, y: 1.4, weight: 100 },
        ],
      });
      expect(v.valid).toBe(true);
      expect(v.result.cog.x).toBe(6);        // (5*100 + 7*100)/200
      expect(v.result.totalWeight).toBe(200);
      expect(v.result.status).toBe('VERIFIED');
    });

    it('flags an unbalanced load as WARNING', () => {
      const v = validateTransition('STOWED', tx(), {
        container: { length: 12, width: 2.4 },
        items: [{ x: 1, y: 0.2, weight: 500 }],
      });
      expect(v.result.status).toBe('WARNING');
      expect(v.reasons.join(' ')).toMatch(/unbalanced/);
    });

    it('blocks stowage with no positioned items', () => {
      const v = validateTransition('STOWED', tx(), { items: [] });
      expect(v.valid).toBe(false);
    });
  });

  describe('delivery (proof of delivery)', () => {
    it('accepts a signature hash as proof', () => {
      const v = validateTransition('DELIVERED', tx(), { signatureHash: '0xabc' });
      expect(v.valid).toBe(true);
      expect(v.result.proof).toBe('SIGNATURE');
    });

    it('accepts geo coordinates as proof', () => {
      const v = validateTransition('DELIVERED', tx(), { lat: 40.4, lng: -3.7, geoVerified: true });
      expect(v.valid).toBe(true);
      expect(v.result.proof).toBe('GEO');
      expect(v.result.geoVerified).toBe(true);
    });

    it('blocks delivery with no proof', () => {
      const v = validateTransition('DELIVERED', tx(), {});
      expect(v.valid).toBe(false);
    });
  });
});
