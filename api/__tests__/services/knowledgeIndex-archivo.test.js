/**
 * El índice interno sobre docs/ no debe servir material archivado ni volcados
 * con nombre sospechoso. Ver docs/archivo/README.md.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('knowledgeIndex: qué se indexa de docs/', () => {
    let raiz;
    let indice;

    beforeAll(() => {
        raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-docs-'));
        fs.mkdirSync(path.join(raiz, 'runbooks'));
        fs.mkdirSync(path.join(raiz, 'archivo', 'l2-op-stack'), { recursive: true });
        fs.writeFileSync(path.join(raiz, 'runbooks', 'despliegue.md'),
            '# Despliegue\n\nEl zorrocanario vigente se despliega en Cloud Run.\n');
        fs.writeFileSync(path.join(raiz, 'archivo', 'l2-op-stack', 'borrador.md'),
            '# Borrador\n\nEl zorrocanario archivado decía que BEZ vive en otra red.\n');
        fs.writeFileSync(path.join(raiz, 'archivo', 'README.md'),
            '# Archivo\n\nNota sobre el zorrocanario histórico.\n');
        fs.writeFileSync(path.join(raiz, 'wallet-backup.md'),
            '# Copia\n\nzorrocanario con datos que no deben indexarse.\n');

        process.env.KNOWLEDGE_DOCS_DIR = raiz;
        jest.isolateModules(() => { indice = require('../../services/knowledgeIndex'); });
    });

    afterAll(() => {
        delete process.env.KNOWLEDGE_DOCS_DIR;
        fs.rmSync(raiz, { recursive: true, force: true });
    });

    test('encuentra el documento vigente', () => {
        const { fragmentos } = indice.buscar('zorrocanario', 10);
        expect(fragmentos.length).toBeGreaterThan(0);
        expect(JSON.stringify(fragmentos)).toContain('vigente');
    });

    test('no devuelve nada de docs/archivo ni de ficheros vetados por nombre', () => {
        const { fragmentos } = indice.buscar('zorrocanario', 10);
        const texto = JSON.stringify(fragmentos);
        expect(texto).not.toContain('archivado');
        expect(texto).not.toContain('histórico');
        expect(texto).not.toContain('no deben indexarse');
        expect(fragmentos.map((f) => f.archivo)).toEqual(['runbooks/despliegue.md']);
    });
});

describe('knowledgeIndex: metadatos de front-matter', () => {
    let raiz;
    const cargar = (env = {}) => {
        let m;
        Object.assign(process.env, env);
        jest.isolateModules(() => { m = require('../../services/knowledgeIndex'); });
        return m;
    };

    beforeAll(() => {
        raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-meta-'));
        const w = (n, c) => fs.writeFileSync(path.join(raiz, n), c);
        w('vigente.md', '---\nestado: vigente\ndominio: contratos\nrevisado: 2026-11-13\n---\n# Red\n\nxilofono en Polygon.\n');
        w('borrador.md', '---\nestado: borrador\n---\n# Idea\n\nxilofono en otra red.\n');
        w('obsoleto.md', '---\nestado: obsoleto\n---\n# Viejo\n\nxilofono antiguo.\n');
        w('sin-meta.md', '# Suelto\n\nxilofono sin etiquetar.\n');
        process.env.KNOWLEDGE_DOCS_DIR = raiz;
    });
    afterAll(() => {
        delete process.env.KNOWLEDGE_DOCS_DIR;
        delete process.env.KNOWLEDGE_SOLO_ETIQUETADOS;
        fs.rmSync(raiz, { recursive: true, force: true });
    });

    test('no indexa borrador ni obsoleto y devuelve los metadatos del vigente', () => {
        delete process.env.KNOWLEDGE_SOLO_ETIQUETADOS;
        const { fragmentos } = cargar().buscar('xilofono', 10);
        expect(fragmentos.map((f) => f.archivo).sort()).toEqual(['sin-meta.md', 'vigente.md']);
        const v = fragmentos.find((f) => f.archivo === 'vigente.md');
        expect(v).toMatchObject({ estado: 'vigente', dominio: 'contratos', revisado: '2026-11-13' });
        expect(JSON.stringify(fragmentos)).not.toContain('estado: vigente'); // el front-matter no es texto
    });

    test('con KNOWLEDGE_SOLO_ETIQUETADOS=1 sólo sirve lo declarado vigente', () => {
        const { fragmentos } = cargar({ KNOWLEDGE_SOLO_ETIQUETADOS: '1' }).buscar('xilofono', 10);
        expect(fragmentos.map((f) => f.archivo)).toEqual(['vigente.md']);
    });
});
