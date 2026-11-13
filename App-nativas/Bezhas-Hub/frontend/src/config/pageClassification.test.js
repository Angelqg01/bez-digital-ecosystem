import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyPath, classifyItem, PAGE_CLASSIFICATION, LEVELS, NATIVE_APP_CLASSIFICATION } from './pageClassification';
import { sidebarNavItems } from './sidebarConfig';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(aqui, '..', 'App.jsx'), 'utf8');

// Rutas declaradas (sin comentar) en el router de App.jsx.
const rutasDeApp = [...appSource.matchAll(/^[^/\n]*\{\s*path:\s*'([^']+)'/gm)].map((m) => m[1]).filter((p) => p !== '*');

describe('clasificación de páginas del Hub', () => {
  it('todos los niveles de las filas existen', () => {
    for (const [ruta, nivel] of PAGE_CLASSIFICATION) {
      expect(LEVELS[nivel], `${ruta} usa un nivel desconocido: ${nivel}`).toBeDefined();
    }
  });

  it('no hay rutas clasificadas dos veces con niveles distintos', () => {
    const vistos = new Map();
    for (const [ruta, nivel] of PAGE_CLASSIFICATION) {
      if (vistos.has(ruta)) expect(vistos.get(ruta), `${ruta} repetida`).toBe(nivel);
      vistos.set(ruta, nivel);
    }
  });

  it('cada ruta de App.jsx tiene sello (si se añade una ruta hay que clasificarla)', () => {
    expect(rutasDeApp.length).toBeGreaterThan(40);
    const sinSello = rutasDeApp.filter((r) => {
      if (r.startsWith('/')) return !classifyPath(r.replace(/:[A-Za-z]+/g, 'x'));
      // Relativas: o cuelgan de la raíz (profile, settings…) o de /admin.
      const limpia = r.replace(/:[A-Za-z]+/g, 'x');
      return !(classifyPath(`/${limpia}`) || classifyPath(`/admin/${limpia}`));
    });
    expect(sinSello).toEqual([]);
  });

  it('todo el panel de administración es SuperAdmin', () => {
    for (const r of ['/admin', '/admin/users-management', '/admin/config', '/admin/aegis', '/superpanel']) {
      expect(classifyPath(r)?.level.id, r).toBe('superadmin');
    }
  });

  it('las páginas públicas y de cuenta quedan en su nivel', () => {
    expect(classifyPath('/login').level.id).toBe('publico');
    expect(classifyPath('/docs/mi-guia').level.id).toBe('publico');
    expect(classifyPath('/profile/0xabc').level.id).toBe('starter');
    expect(classifyPath('/ad-center/campaigns').level.id).toBe('creator_pro');
    expect(classifyPath('/dao/industria-4-0').level.id).toBe('enterprise_vip');
  });

  it('ignora la barra final, la query y el hash', () => {
    expect(classifyPath('/pay/').level.id).toBe('starter');
    expect(classifyPath('/pay?x=1#y').level.id).toBe('starter');
  });

  it('una ruta desconocida no tiene sello', () => {
    expect(classifyPath('/no-existe')).toBeNull();
  });

  it('cada elemento del sidebar tiene sello, también las apps nativas', () => {
    const sin = sidebarNavItems.filter((i) => !classifyItem(i)).map((i) => i.label);
    expect(sin).toEqual([]);
  });

  it('las etiquetas de apps nativas clasificadas existen en el sidebar', () => {
    const etiquetas = new Set(sidebarNavItems.map((i) => i.label));
    for (const etiqueta of Object.keys(NATIVE_APP_CLASSIFICATION)) {
      expect(etiquetas.has(etiqueta), `${etiqueta} ya no está en el sidebar`).toBe(true);
    }
  });
});
