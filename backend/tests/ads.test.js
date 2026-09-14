// backend/tests/ads.test.js
/**
 * Esta suite probaba `POST /api/ads/request-ad` y `POST /api/ads/verify-event`
 * contra `routes/ads.routes.js`. Las dos peticiones devolvían 404 porque esa
 * ruta **nunca estuvo montada** en `server.js`, y no podía estarlo: su primera
 * línea requería `../services/adService`, un módulo que no existe en el
 * repositorio ni aparece en el historial de git. Montarla habría lanzado
 * MODULE_NOT_FOUND al arrancar.
 *
 * Era un prototipo abandonado. El sistema de anuncios que sí se despliega vive
 * en `/api/campaigns`, `/api/ad-rewards`, `/api/advertiser-profile` y
 * `/api/admin/ads`. Se ha borrado la ruta muerta; lo único aprovechable era
 * `utils/nlp.js`, que es el emparejador de contexto y sigue siendo la pieza que
 * usará el servidor de anuncios cuando se conecte. Es lo que se prueba aquí.
 */

const { matchContextToCampaign } = require('../utils/nlp');

const campanas = [
    { id: 'c-defi', text: 'Swap sin comisiones en DeFi', keywords: ['defi', 'swap', 'liquidez'] },
    { id: 'c-nft', text: 'Acuña tu primer NFT', keywords: ['nft', 'arte', 'coleccionable'] },
    { id: 'c-mixta', text: 'DeFi y NFT en un solo sitio', keywords: ['defi', 'nft'] },
];

describe('matchContextToCampaign', () => {
    it('devuelve la campaña con más palabras clave coincidentes', () => {
        const resultado = matchContextToCampaign(['defi', 'nft'], campanas);
        expect(resultado).not.toBeNull();
        expect(resultado.id).toBe('c-mixta');
        expect(resultado.text).toMatch(/DeFi|NFT/);
    });

    it('empareja una sola palabra clave con su campaña', () => {
        expect(matchContextToCampaign(['coleccionable'], campanas).id).toBe('c-nft');
        expect(matchContextToCampaign(['liquidez'], campanas).id).toBe('c-defi');
    });

    it('ignora mayúsculas y minúsculas', () => {
        expect(matchContextToCampaign(['DeFi'], campanas).id).toBe('c-defi');
        expect(matchContextToCampaign(['NFT', 'Arte'], campanas).id).toBe('c-nft');
    });

    it('devuelve null cuando ninguna campaña coincide', () => {
        expect(matchContextToCampaign(['cocina', 'jardinería'], campanas)).toBeNull();
    });

    it('ante un empate se queda con la primera, de forma determinista', () => {
        const empate = [
            { id: 'a', keywords: ['defi'] },
            { id: 'b', keywords: ['defi'] },
        ];
        expect(matchContextToCampaign(['defi'], empate).id).toBe('a');
    });

    describe('entradas inválidas (llegan del cliente y de la base de datos)', () => {
        it('no revienta con un contexto que no es un array', () => {
            expect(matchContextToCampaign(undefined, campanas)).toBeNull();
            expect(matchContextToCampaign('defi', campanas)).toBeNull();
            expect(matchContextToCampaign(null, campanas)).toBeNull();
        });

        it('no revienta con una lista de campañas que no es un array', () => {
            expect(matchContextToCampaign(['defi'], undefined)).toBeNull();
            expect(matchContextToCampaign(['defi'], null)).toBeNull();
        });

        it('salta las campañas sin keywords en vez de lanzar', () => {
            const sucias = [
                null,
                { id: 'sin-keywords' },
                { id: 'keywords-nulas', keywords: null },
                { id: 'buena', keywords: ['defi'] },
            ];
            expect(matchContextToCampaign(['defi'], sucias).id).toBe('buena');
        });

        it('devuelve null con contexto o campañas vacíos', () => {
            expect(matchContextToCampaign([], campanas)).toBeNull();
            expect(matchContextToCampaign(['defi'], [])).toBeNull();
        });
    });
});
