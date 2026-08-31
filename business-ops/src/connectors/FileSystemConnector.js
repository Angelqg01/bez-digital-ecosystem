'use strict';
const fs = require('fs/promises');
const path = require('path');
const BaseConnector = require('./BaseConnector');

/**
 * FileSystemConnector — acceso SANDBOXED al disco del PC/servidor.
 *
 * Es la base del "FileAgent": permite a los agentes leer y gestionar archivos
 * (clasificar CVs, leer facturas, generar informes) DENTRO de una lista blanca de
 * carpetas y nunca fuera. Toda escritura/movimiento/borrado es una acción sensible
 * (category 'filesystem') que pasa por PolicyEngine/HITL vía BaseAgent.act().
 *
 * Seguridad:
 *   - `roots`: carpetas permitidas (absolutas). Cualquier ruta se resuelve y se
 *     verifica que cae DENTRO de una raíz; si no, se rechaza (anti path-traversal).
 *   - Lecturas: directas. Escrituras: el agente las pasa por guardrails.
 *
 *   FILE_ROOTS=D:\Gestión empresarial\operant-data;C:\operant\inbox   (separadas por ;)
 */
class FileSystemConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'fs';
    const raw = config.roots || process.env.FILE_ROOTS || '';
    this.roots = (Array.isArray(raw) ? raw : String(raw).split(/[;]/))
      .map((r) => r.trim()).filter(Boolean).map((r) => path.resolve(r));
    this.maxBytes = config.maxBytes || 10 * 1024 * 1024; // 10 MB por archivo
  }

  /** Resuelve y valida que la ruta cae dentro de una raíz permitida. */
  _safe(p) {
    if (!this.roots.length) throw new Error('fs: no hay carpetas permitidas (define FILE_ROOTS)');
    const resolved = path.resolve(this.roots[0], p);
    const ok = this.roots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
    if (!ok) throw new Error(`fs: ruta fuera del sandbox: ${p}`);
    return resolved;
  }

  async execute(method, args = {}) {
    switch (method) {
      case 'list': return this.list(args);
      case 'read': return this.read(args);
      case 'stat': return this.stat(args);
      case 'write': return this.write(args);
      case 'move': return this.move(args);
      case 'remove': return this.remove(args);
      default: throw new Error(`fs: método desconocido ${method}`);
    }
  }

  async list({ dir = '.' } = {}) {
    const full = this._safe(dir);
    const entries = await fs.readdir(full, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }));
  }

  async read({ file, encoding = 'utf8' } = {}) {
    const full = this._safe(file);
    const st = await fs.stat(full);
    if (st.size > this.maxBytes) throw new Error(`fs: archivo demasiado grande (${st.size} bytes)`);
    return { file, content: await fs.readFile(full, encoding), size: st.size };
  }

  async stat({ file } = {}) {
    const full = this._safe(file);
    const st = await fs.stat(full);
    return { file, size: st.size, isDir: st.isDirectory(), modified: st.mtimeMs };
  }

  async write({ file, content = '', encoding = 'utf8' } = {}) {
    const full = this._safe(file);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, encoding);
    return { file, written: true };
  }

  async move({ from, to } = {}) {
    const src = this._safe(from);
    const dst = this._safe(to);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
    return { from, to, moved: true };
  }

  async remove({ file } = {}) {
    const full = this._safe(file);
    await fs.rm(full, { recursive: false });
    return { file, removed: true };
  }
}

module.exports = FileSystemConnector;
