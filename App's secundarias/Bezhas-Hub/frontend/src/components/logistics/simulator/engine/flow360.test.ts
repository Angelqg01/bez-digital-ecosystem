import { describe, it, expect } from 'vitest';
import { buildFlow360, BREACH_FROM_INDEX } from './flows';
import { getDynamicStep } from './getDynamicStep';
import { CARGOS } from './cargos';
import { LOCATIONS } from './types';
import { nftsForStep, escrowEventsForStep } from './chain';

describe('Flujo 360: Origen -> Tránsito -> Destino', () => {
  (['sea', 'air'] as const).forEach((mode) => {
    describe(`modo ${mode}`, () => {
      const flow = buildFlow360(mode);

      it('tiene 16 etapas continuas con ids 1..16', () => {
        expect(flow).toHaveLength(16);
        expect(flow.map((s) => s.id)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
      });

      it('las 10 primeras etapas son de la Zona Franca de Origen', () => {
        expect(flow.slice(0, 10).every((s) => s.phase === 'origin')).toBe(true);
        expect(flow[10].phase).toBe('transit');
        expect(flow.slice(11).every((s) => s.phase === 'destination')).toBe(true);
      });

      it('el ciclo B-UID es coherente: CREATED al inicio, DEPARTED al cerrar ZF, DELIVERED al final', () => {
        expect(flow[0].bUidStage).toBe('CREATED');
        expect(flow[9].bUidStage).toBe('DEPARTED');
        expect(flow[15].bUidStage).toBe('DELIVERED');
      });

      it('todas las etapas tienen validador con DID y locationIndex válido', () => {
        flow.forEach((s) => {
          expect(s.validator.did).toMatch(/^did:/);
          expect(s.locationIndex).toBeGreaterThanOrEqual(0);
          expect(s.locationIndex).toBeLessThan(LOCATIONS.length);
        });
      });

      it('el escrow permanece LOCKED hasta la entrega y se libera en el paso final', () => {
        flow.slice(0, 15).forEach((s) => expect(s.escrow).toBe('LOCKED'));
        expect(flow[15].escrow).toBe('RELEASED');
      });

      it('las métricas (km/co2) son monótonas crecientes', () => {
        for (let i = 1; i < flow.length; i++) {
          expect(flow[i].metrics.km).toBeGreaterThanOrEqual(flow[i - 1].metrics.km);
          expect(flow[i].metrics.co2).toBeGreaterThanOrEqual(flow[i - 1].metrics.co2);
        }
      });
    });
  });

  describe('getDynamicStep — happy path', () => {
    const flow = buildFlow360('sea');
    const cargo = CARGOS[0]; // arándanos

    it('sin breach la entrega libera el escrow', () => {
      const final = getDynamicStep(flow[15], cargo, 15, false);
      expect(final.escrow).toBe('RELEASED');
      expect(final.telemetry?.status).not.toContain('ALERTA');
    });

    it('aplica la temperatura óptima de la carga en fases refrigeradas', () => {
      const step = getDynamicStep(flow[5], CARGOS[1], 5, false); // atún, aduana
      expect(step.telemetry?.temp).toBe('-45.0°C');
    });
  });

  describe('getDynamicStep — breach path', () => {
    const flow = buildFlow360('sea');
    const cargo = CARGOS[0];

    it('el breach NO afecta a las etapas de la Zona Franca', () => {
      const zfStep = getDynamicStep(flow[6], cargo, 6, true);
      expect(zfStep.escrow).toBe('LOCKED');
      expect(zfStep.telemetry?.status).not.toContain('ALERTA');
    });

    it('el breach dispara alerta térmica desde el tránsito', () => {
      const transit = getDynamicStep(flow[BREACH_FROM_INDEX], cargo, BREACH_FROM_INDEX, true);
      expect(transit.telemetry?.status).toContain('ALERTA');
      expect(transit.telemetry?.temp).toBe('22.8°C');
      expect(transit.status.contract).toContain('DETENIDO');
    });

    it('con breach la entrega congela el escrow y abre disputa', () => {
      const final = getDynamicStep(flow[15], cargo, 15, true);
      expect(final.escrow).toBe('HALTED (DISPUTE)');
      expect(final.bc).toContain('FROZEN');
    });

    it('temperatura de breach depende de la carga (cryo/vino)', () => {
      expect(getDynamicStep(flow[10], CARGOS[1], 10, true).telemetry?.temp).toBe('10.4°C');
      expect(getDynamicStep(flow[10], CARGOS[2], 10, true).telemetry?.temp).toBe('28.5°C');
    });
  });

  describe('explorer: NFTs y escrow derivados del progreso', () => {
    it('mintea el DPP en el paso 1 y el certificado solo al final', () => {
      const early = nftsForStep([1, 2]);
      expect(early.find((n) => n.id === 'BZ-DPP-A1B2C3')?.minted).toBe(true);
      expect(early.find((n) => n.id === 'BZ-CERT-FINAL')?.minted).toBe(false);

      const done = nftsForStep(Array.from({ length: 16 }, (_, i) => i + 1));
      expect(done.every((n) => n.minted)).toBe(true);
    });

    it('escrow: lock -> debit aranceles -> release (o freeze con breach)', () => {
      const all = Array.from({ length: 16 }, (_, i) => i + 1);
      const ok = escrowEventsForStep(all, false);
      expect(ok.map((e) => e.type)).toEqual(['lock', 'debit', 'release']);

      const bad = escrowEventsForStep(all, true);
      expect(bad.map((e) => e.type)).toEqual(['lock', 'debit', 'freeze']);
    });
  });
});
