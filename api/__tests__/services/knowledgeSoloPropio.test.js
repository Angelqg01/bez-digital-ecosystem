const { KnowledgeService, MemoryStore } = require('../../services/knowledge');
const { buscarConocimiento, principalDeApp } = require('../../services/knowledge/search');

describe('buscarConocimiento con soloPropio (OPERANT de una empresa cliente)', () => {
    const ENV = process.env;
    afterAll(() => { process.env = ENV; });

    async function montar() {
        process.env = { ...ENV, KNOWLEDGE_TENANT_INGEST: 'true' };
        const knowledge = new KnowledgeService({ store: new MemoryStore() });
        const admin = { userId: 'sys', tenantId: 'sys', roles: ['ADMIN'], plan: 'enterprise_vip' };
        await knowledge.ingest(admin, { id: 'pub_envios', title: 'Envíos BeZhas', content: 'Plazos de envío de BeZhas CargoLink.', classification: 'PUBLIC', global: true });
        await knowledge.ingest(principalDeApp({ id: 'acme' }, 'business'), { id: 'acme_envios', title: 'Envíos ACME', content: 'Plazos de envío de ACME: 48 horas.', classification: 'INTERNAL' });
        await knowledge.ingest(principalDeApp({ id: 'otra' }, 'business'), { id: 'otra_envios', title: 'Envíos OTRA', content: 'Plazos de envío de OTRA: 24 horas.', classification: 'INTERNAL' });
        return knowledge;
    }

    test('sin soloPropio ve lo público y lo suyo, nunca lo de otra empresa', async () => {
        const knowledge = await montar();
        const r = await buscarConocimiento({ app: { id: 'acme' }, plan: 'business', pregunta: 'plazos de envío', knowledge });
        const docs = r.resultados.map((x) => x.documento);
        expect(docs).toEqual(expect.arrayContaining(['pub_envios', 'acme_envios']));
        expect(docs).not.toContain('otra_envios');
    });

    test('con soloPropio sólo lo suyo', async () => {
        const knowledge = await montar();
        const r = await buscarConocimiento({ app: { id: 'acme' }, plan: 'business', pregunta: 'plazos de envío', soloPropio: true, knowledge });
        expect(r.resultados.map((x) => x.documento)).toEqual(['acme_envios']);
    });

    test('con la ingesta de tenants apagada, soloPropio no devuelve nada', async () => {
        const knowledge = await montar();
        process.env.KNOWLEDGE_TENANT_INGEST = 'false';
        const r = await buscarConocimiento({ app: { id: 'acme' }, plan: 'business', pregunta: 'plazos de envío', soloPropio: true, knowledge });
        expect(r.sinResultados).toBe(true);
    });
});
