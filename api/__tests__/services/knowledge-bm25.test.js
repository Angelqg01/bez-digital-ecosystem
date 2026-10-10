const { tokenize, bm25Rank } = require('../../services/knowledge/bm25');

const doc = (id, title, content) => ({ id, title, content });
const CORPUS = [
    doc('tok', 'Tokenizar activos reales', 'BeZhas permite tokenizar un activo real en fracciones con un contrato en Polygon.'),
    doc('nom', 'Pagar nóminas', 'Los pagos de nómina se preparan con propósito payroll y aprobación humana.'),
    doc('bez', 'BEZ-Coin', 'BEZ vive en Polygon, cadena 137.'),
    doc('cap', 'Staking y DeFi', 'La app BZ Capital agrupa staking, farming y bridge.'),
    doc('pla', 'Planes y precios', 'Cuatro planes con precio mensual y anual.'),
];

describe('tokenize: raíz ligera', () => {
    it('conjugaciones, plurales y acentos convergen en la misma raíz', () => {
        const r = (t) => tokenize(t)[0];
        expect(r('tokenizo')).toBe(r('tokenizar'));
        expect(r('tokenización')).toBe(r('tokenizar'));
        expect(r('nóminas')).toBe(r('nómina'));
        expect(r('wallets')).toBe(r('wallet'));
        expect(r('empresas')).toBe(r('empresa'));
    });
    it('quita palabras de pregunta que no distinguen documentos', () => {
        expect(tokenize('¿Cómo puedo pagar mis nóminas?')).toEqual(['pagar', 'nomina']);
    });
});

describe('bm25Rank', () => {
    const top = (q, opts) => bm25Rank(q, CORPUS, opts)[0]?.chunk.id;
    it('«¿cómo tokenizo…?» encuentra el documento de tokenizar', () => expect(top('¿Cómo tokenizo una nave?')).toBe('tok'));
    it('«¿qué es el BEZ y en qué red está?» encuentra BEZ-Coin (el título pesa)', () => expect(top('¿Qué es el BEZ y en qué red está?')).toBe('bez'));
    it('una pregunta sin nada que ver no devuelve documentos', () => expect(bm25Rank('receta de paella valenciana con marisco', CORPUS)).toEqual([]));
    it('una sola palabra en común con una pregunta larga y distinta se descarta', () => {
        expect(bm25Rank('¿cuánto valdrá la capital de Mongolia el año que viene según los analistas?', CORPUS, { minCoverage: 0.5 })).toEqual([]);
    });
    it('cada resultado informa de su cobertura (0-1)', () => {
        const r = bm25Rank('tokenizar activos', CORPUS)[0];
        expect(r.coverage).toBeGreaterThan(0.9);
        expect(r.coverage).toBeLessThanOrEqual(1);
    });
    it('minCoverage 0 recupera el comportamiento anterior (cualquier coincidencia)', () => {
        expect(bm25Rank('capital de Mongolia', CORPUS, { minCoverage: 0 })[0].chunk.id).toBe('cap');
    });
});

describe('respuesta extractiva con coincidencia débil', () => {
    const { extractiveText: ext } = require('../../services/ai-workspace/gateway');
    const ctx = (rel) => `<untrusted_document ref="1" title="x" version="1" relevance="${rel}">\nTexto del documento\n</untrusted_document>`;
    it('relevancia alta: respuesta normal', () => expect(ext({ contextText: ctx('0.80') })).toMatch(/^Esto es lo que encontré/));
    it('relevancia baja: avisa de que puede no responder', () => expect(ext({ contextText: ctx('0.33') })).toMatch(/^No estoy seguro de que esto responda/));
    it('sin contexto: no encuentro', () => expect(ext({ contextText: '' })).toMatch(/^No encuentro información/));
});
