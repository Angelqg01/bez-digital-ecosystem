const { siguientePaso } = require('../../services/ai-workspace/guide');

describe('guía de siguiente paso', () => {
    it('sin plan, pedir ERP propone Business y nombra el plan actual', () => {
        const r = siguientePaso({ plan: 'none' }, 'quiero conectar mi SAP');
        expect(r.tema).toBe('erp');
        expect(r.requierePlan).toBe('business');
        expect(r.texto).toMatch(/Siguiente paso/);
        expect(r.texto).toMatch(/Suscribirme a un plan/);
    });
    it('con plan suficiente no vende, da el paso concreto', () => {
        const r = siguientePaso({ plan: 'business' }, 'quiero conectar mi SAP');
        expect(r.requierePlan).toBeNull();
        expect(r.texto).toMatch(/bezhas_erp_documents/);
        expect(r.texto).not.toMatch(/requiere el plan/);
    });
    it('automatizar con API/MCP/SDK guía en pasos y exige sólo Starter', () => {
        const r = siguientePaso({ plan: 'starter' }, '¿cómo automatizo con el SDK?');
        expect(r.tema).toBe('automatizar');
        expect(r.texto).toMatch(/pnpm add @bezhas\/sdk/);
    });
    it('comprar BEZ no exige plan', () => {
        const r = siguientePaso({ plan: 'none' }, 'quiero comprar BEZ');
        expect(r.tema).toBe('comprar_bez');
        expect(r.requierePlan).toBeNull();
    });
    it('siempre añade un consejo de seguridad', () => {
        expect(siguientePaso({ plan: 'business' }, 'hola').texto).toMatch(/Consejo de seguridad/);
    });
    it('sin plan y sin tema invita a contratar Starter', () => {
        expect(siguientePaso({}, 'hola').texto).toMatch(/Starter/);
    });
});
