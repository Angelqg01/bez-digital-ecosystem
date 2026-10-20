const fs = require('fs');
const os = require('os');
const path = require('path');
const { exportarVault, seccionClientes } = require('../../services/knowledge/vaultPublic');
const { motivosNoPublicable, assertPublicable } = require('../../services/knowledge/publicSafety');
const { docCatalogoMcp, documentosAdicionales, VAULT_JSON } = require('../../services/knowledge/sources');
const { TOOLS } = require('../../config/mcp-tools');
const { KnowledgeService, MemoryStore } = require('../../services/knowledge');
const { seedPublicKnowledge } = require('../../services/knowledge/seed');

function vaultTemporal(notas) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-pub-'));
    for (const [rel, texto] of Object.entries(notas)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), texto);
    }
    return root;
}

const nota = (fm, cuerpo) => `---\n${fm}\n---\n# Título\n\n${cuerpo}\n`;

describe('publicSafety', () => {
    test.each([
        ['ruta', 'vive en App-nativas/BZ CargoLink/'],
        ['host local', 'escucha en localhost'],
        ['puerto', 'API Express :3001'],
        ['host interno', 'https://bezhas-brain-1.us-central1.run.app'],
        ['IP privada', 'Redis en 10.106.5.67'],
        ['secreto', 'necesita BRAIN_API_KEY'],
        ['fichero', 'ver useClientPermission.js'],
        ['enlace del vault', 'ver [[Cluster-finanzas-pagos]]'],
        ['clave', '0x' + 'a'.repeat(64)],
    ])('rechaza %s', (_m, texto) => {
        expect(motivosNoPublicable(texto).length).toBeGreaterThan(0);
        expect(() => assertPublicable(texto)).toThrow(/no es publicable/);
    });

    test('acepta texto de cliente con URLs públicas y direcciones de contrato', () => {
        expect(motivosNoPublicable('Disponible en https://pay.bezhas.com. Contrato 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8 en Polygon (cadena 137).')).toEqual([]);
    });
});

describe('exportarVault', () => {
    test('sólo notas visibility: public, y de ellas sólo «Para clientes»', () => {
        const root = vaultTemporal({
            '06-SubApps/Publica.md': nota('visibility: "public"', 'Interno: puerto secreto.\n\n## Para clientes\n\nTexto para clientes.\n\n## Conexiones\n- algo'),
            '06-SubApps/Privada.md': nota('type: "subapp"', '## Para clientes\n\nNo marcada.'),
        });
        const docs = exportarVault(root);
        expect(docs).toEqual([{ id: 'vault_06_subapps_publica', title: 'Título', content: 'Texto para clientes.', source: 'vault:06-SubApps/Publica.md' }]);
    });

    test.each(['00-Episodic-Memory', '01-Self-Model', '02-Decisions', '07-Sources', '99-Inbox'])(
        'nunca exporta la carpeta interna %s aunque esté marcada', (carpeta) => {
            const root = vaultTemporal({ [`${carpeta}/X.md`]: nota('visibility: public', '## Para clientes\n\nFiltrado.') });
            expect(exportarVault(root)).toEqual([]);
        });

    test('falla si una nota pública no tiene sección para clientes o filtra datos internos', () => {
        expect(() => exportarVault(vaultTemporal({ 'a/X.md': nota('visibility: public', 'Sin sección') }))).toThrow(/Para clientes/);
        expect(() => exportarVault(vaultTemporal({ 'a/X.md': nota('visibility: public', '## Para clientes\n\nCorre en localhost') }))).toThrow(/no es publicable/);
    });

    test('la sección acaba en el siguiente encabezado de nivel 1 o 2', () => {
        expect(seccionClientes('## Para clientes\n\nA\n### Sub\nB\n## Otra\nC')).toBe('A\n### Sub\nB');
    });

    test('vault-public.json está al día con docs/obsidian-vault', () => {
        const vault = path.resolve(__dirname, '..', '..', '..', 'docs', 'obsidian-vault');
        if (!fs.existsSync(vault)) return; // imagen sin el vault: lo comprueba el repositorio
        const esperado = `${JSON.stringify(exportarVault(vault), null, 2)}\n`;
        expect(fs.readFileSync(VAULT_JSON, 'utf8')).toBe(esperado);
    });
});

describe('catálogo MCP como conocimiento', () => {
    test('cubre todas las herramientas y deja claro que nada mueve fondos', () => {
        const [id, , contenido] = docCatalogoMcp();
        expect(id).toBe('bz_mcp_herramientas');
        for (const t of TOOLS) expect(contenido).toContain(t.name);
        expect(contenido).toMatch(/Ninguna herramienta firma transacciones ni mueve dinero/);
    });

    test('todas las fuentes adicionales son publicables', () => {
        expect(() => documentosAdicionales()).not.toThrow();
    });
});

describe('seed con las fuentes nuevas', () => {
    test('se indexan como PUBLIC globales y se recuperan sin sesión de tenant', async () => {
        const service = new KnowledgeService({ store: new MemoryStore() });
        await seedPublicKnowledge(service);
        const visitante = { userId: 'anon', tenantId: 'user:anon', roles: ['USER'], plan: 'free' };
        const cargolink = await service.search(visitante, 'CargoLink escrow envío');
        expect(cargolink[0].document_id).toBe('vault_06_subapps_bz_cargolink');
        expect(cargolink[0].classification).toBe('PUBLIC');
        // El catálogo del MCP no se indexa (desplazaba a los documentos curados en la evaluación).
        expect(await service.store.getDoc('bz_mcp_herramientas')).toBeNull();
        // idempotente
        await expect(seedPublicKnowledge(service)).resolves.toBe(0);
    });
});
