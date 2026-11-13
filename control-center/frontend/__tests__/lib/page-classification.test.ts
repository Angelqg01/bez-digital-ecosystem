/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { PAGE_CLASSIFICATION, LEVELS, classifyPath } from '@/lib/page-classification';

const RAIZ = path.resolve(__dirname, '..', '..');
const HUB = path.resolve(RAIZ, '..', '..', 'App-nativas', 'Bezhas-Hub', 'frontend', 'src', 'config', 'pageClassification.js');

/** Rutas de las páginas de app/ (sin api/ y sin los grupos entre paréntesis). */
function rutasDePaginas(dir: string, base = ''): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory() || e.name === 'api' || e.name.startsWith('_')) continue;
        const grupo = /^\(.+\)$/.test(e.name);
        const ruta = grupo ? base : `${base}/${e.name}`;
        if (fs.existsSync(path.join(dir, e.name, 'page.tsx'))) out.push(ruta || '/');
        out.push(...rutasDePaginas(path.join(dir, e.name), ruta));
    }
    return out;
}

describe('clasificación de páginas del Control Center', () => {
    it('cada página de app/ tiene sello (si se crea una página hay que clasificarla)', () => {
        const paginas = rutasDePaginas(path.join(RAIZ, 'app'));
        // la portada vive en app/(landing)/page.tsx
        if (fs.existsSync(path.join(RAIZ, 'app', '(landing)', 'page.tsx'))) paginas.push('/');
        expect(paginas.length).toBeGreaterThan(50);
        const sinSello = [...new Set(paginas)].filter((r) => !classifyPath(r.replace(/\[[^\]]+\]/g, 'x')));
        expect(sinSello).toEqual([]);
    });

    it('los niveles de las filas existen', () => {
        const desconocidos = PAGE_CLASSIFICATION.filter(([, nivel]) => !LEVELS[nivel]).map(([ruta]) => ruta);
        expect(desconocidos).toEqual([]);
    });

    it('lo que administra la plataforma es SuperAdmin', () => {
        const rutas = ['/monitor', '/admin/login', '/admin/profile', '/admin/lo-que-sea', '/dashboard/sequencer'];
        expect(rutas.map((r) => classifyPath(r)?.level.id)).toEqual(rutas.map(() => 'superadmin'));
    });

    it('rutas dinámicas, barra final, query y hash', () => {
        expect(classifyPath('/docs/mi-guia')?.level.id).toBe('publico');
        expect(classifyPath('/dashboard/validators/0xabc')?.level.id).toBe('enterprise_vip');
        expect(classifyPath('/dashboard/validators/register')?.level.id).toBe('enterprise_vip');
        expect(classifyPath('/dashboard/credits/')?.level.id).toBe('starter');
        expect(classifyPath('/dashboard/credits?checkout=success#x')?.level.id).toBe('starter');
        expect(classifyPath('/no-existe')).toBeNull();
    });

    describe('coherencia con el Hub', () => {
        const hub = fs.readFileSync(HUB, 'utf8');

        it('mismos niveles, etiquetas y colores', () => {
            const delHub = [...hub.matchAll(/(\w+):\s*\{\s*id:\s*'(\w+)',\s*rank:\s*(\d),\s*label:\s*'([^']+)',\s*color:\s*'(#[0-9a-f]{6})'\s*\}/g)]
                .map((m) => ({ id: m[2], rank: Number(m[3]), label: m[4], color: m[5] }));
            expect(delHub).toHaveLength(6);
            expect(Object.values(LEVELS)).toEqual(delHub);
        });

        it('una página que está en los dos productos lleva el mismo nivel', () => {
            const filasHub = new Map([...hub.matchAll(/^\s*\['([^']+)',\s*'(\w+)'/gm)].map((m) => [m[1], m[2]] as const));
            // Misma ruta pero PÁGINAS distintas en cada producto: se excluyen aquí con el motivo.
            const PAGINAS_DISTINTAS: Record<string, string> = {
                '/developers': 'Hub: consola de claves API (Starter). Control Center: portal público de desarrolladores.',
            };
            const comunes = PAGE_CLASSIFICATION.filter(([ruta]) => filasHub.has(ruta) && !PAGINAS_DISTINTAS[ruta]);
            expect(comunes.length).toBeGreaterThan(5);
            const distintas = comunes
                .filter(([ruta, nivel]) => nivel !== filasHub.get(ruta))
                .map(([ruta, nivel]) => `${ruta}: Control Center=${nivel}, Hub=${filasHub.get(ruta)}`);
            expect(distintas).toEqual([]);
        });
    });
});
