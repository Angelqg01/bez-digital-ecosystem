import { describe, it, expect } from 'vitest';
import { STEPS, STEPS_BEFORE_EMAIL, nextIndex, toProfile, isEmail } from './onboardingFlow';

describe('flujo del cuestionario', () => {
    it('el email se pide tras la cuarta pregunta, con el caso de uso ya contestado', () => {
        expect(STEPS[STEPS_BEFORE_EMAIL - 1].id).toBe('caso');
    });

    it('salta la pregunta del ERP si no se quiere conectar uno', () => {
        const i = STEPS.findIndex((s) => s.id === 'integraciones');
        expect(STEPS[nextIndex(i, { integraciones: ['sdk'] })].id).toBe('participacion');
        expect(STEPS[nextIndex(i, { integraciones: ['erp'] })].id).toBe('erp');
    });

    it('termina cuando no quedan pasos', () => {
        expect(nextIndex(STEPS.length - 1, {})).toBe(-1);
    });

    it('el perfil solo lleva campos del catálogo y omite el ERP si no aplica', () => {
        const p = toProfile({
            cargo: 'ti', estructura: 'unica', sector: 'logistica', empleados: '11-50', facturacion: '1m-5m',
            documentos: '1k-10k', caso: 'pagos', integraciones: ['sdk'], erp: 'odoo', participacion: 'lectura', extra: 'x',
        });
        expect(p.erp).toBeUndefined();
        expect(p.extra).toBeUndefined();
        expect(p.integraciones).toEqual(['sdk']);
    });

    it('valida el email', () => {
        expect(isEmail(' ana@empresa.com ')).toBe(true);
        expect(isEmail('ana@empresa')).toBe(false);
    });
});
