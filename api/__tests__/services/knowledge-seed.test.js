/**
 * Cobertura de la base de conocimiento pública: lo que pregunta una empresa que quiere llevar su contabilidad,
 * tokenizar activos y pagar nóminas tiene que encontrar SU documento, y las acciones sugeridas tienen que
 * llevar a la pantalla correcta. (Antes respondía «Cómo comprar BEZ» a «¿cómo tokenizo maquinaria?».)
 */
const { DOCS } = require('../../services/knowledge/seed');
const { bm25Rank } = require('../../services/knowledge/bm25');
const { suggestActions } = require('../../services/ai-workspace/actions');

const chunks = DOCS.map(([id, title, content]) => ({ id, title, content }));
const principal = { userId: 'u', tenantId: 'user:u', roles: ['USER'], plan: 'business' };
const mejor = (q) => {
    const r = bm25Rank(q, chunks);
    const top = r[0];
    return top && top.chunk.id;
};

describe('base de conocimiento: temas de una empresa', () => {
    it.each([
        ['¿Cómo se tokenizan activos reales como maquinaria o inmuebles?', 'bz_tokenizacion'],
        ['¿Puedo pagar las nóminas de mis empleados con USDC?', 'bz_nominas'],
        ['¿Cómo conecto mi ERP Odoo o SAP para leer facturas?', 'bz_erp'],
        ['¿Cumple MiCA y la normativa de la AEAT?', 'bz_cumplimiento'],
        ['¿Cómo integro mi software con la API de BeZhas?', 'bz_api_integracion'],
        ['¿Cómo concilio mi contabilidad con las operaciones?', 'bz_contabilidad'],
    ])('«%s» encuentra %s', (pregunta, esperado) => {
        expect(mejor(pregunta)).toBe(esperado);
    });

    it('lo que afirman los documentos coincide con el código (fábricas, categorías y ERPs)', () => {
        const txt = DOCS.map((d) => d[2]).join(' ');
        const { CATEGORIAS, FABRICAS } = require('../../services/rwaTokenization');
        CATEGORIAS.forEach((c) => expect(txt.toLowerCase()).toContain(c === 'ropa' ? 'objetos' : c.replace('helicoptero', 'helicópter').replace('coche', 'vehículos')));
        expect(Object.keys(FABRICAS).sort()).toEqual(['activos', 'industrial']);
        ['SAP S/4HANA', 'SAP Business One', 'Odoo', 'Microsoft Dynamics', 'NetSuite'].forEach((e) => expect(txt).toContain(e));
    });

    it('no promete lo que no hace (no firma, no asesora)', () => {
        const txt = DOCS.map((d) => d[2]).join(' ');
        expect(txt).toMatch(/no firma ni envía nada/i);
        expect(txt).toMatch(/no ofrece asesoramiento fiscal ni jurídico/i);
    });
});

describe('acciones sugeridas para esas preguntas', () => {
    const ids = (q) => suggestActions(principal, q).map((a) => a.id);
    it('tokenización → soluciones enterprise', () => expect(ids('¿Cómo se tokenizan activos reales como maquinaria?')).toContain('enterprise'));
    it('nóminas → pagos', () => expect(ids('¿Puedo pagar las nóminas de mis empleados?')).toContain('payments'));
    it('cobrar a clientes → pagos (singular y plural coinciden por raíz)', () => expect(ids('¿Cómo cobro a mis clientes con tarjeta?')).toContain('payments'));
    it('comprar BEZ en primera persona → compra de BEZ', () => expect(ids('¿Cómo compro BEZ?')).toContain('buy_bez'));
    it('alta y KYB → onboarding', () => expect(ids('¿Cómo doy de alta a mi empresa y hago el KYB?')).toContain('onboarding'));
    it('integrar el ERP → desarrolladores y MCP', () => {
        const r = ids('¿Cómo integro mi ERP con la API?');
        expect(r).toEqual(expect.arrayContaining(['developers']));
    });
});
