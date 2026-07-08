---
type: adr
hierarchy: Admin
canvasType: decision
status: accepted
created: "2026-07-07"
tags: ["obsidian", "memory", "performance", "agents"]
summary: El Brain pasa de leer el vault en disco por consulta a un indice en memoria con watcher, busqueda ponderada y grafo de conocimiento.
---

# ADR-0002 Brain Index Optimization

El servicio `obsidian-mcp` (puerto 4007) ahora mantiene un **indice en memoria** (`src/vaultIndex.js`) construido al arrancar y actualizado por watcher (chokidar) y por las propias tools de escritura. Antes, cada `search_vault` o `get_related_notes` releia el vault completo desde disco.

## Cambios

- **Indice en memoria**: notas, frontmatter (gray-matter), links, tags, mtime. Invalidacion incremental por watcher — ediciones desde Obsidian desktop o `git pull` se reflejan sin reiniciar.
- **Busqueda ponderada**: titulo x8, tags x4, summary x2, cuerpo x1, bonus por frase exacta. Filtros opcionales `folder` y `tags`.
- **Resolucion de links normalizada**: `[[Treasury Policy]]` resuelve a `Treasury-Policy.md` (mismo slug que usa `create_note`). Antes esos backlinks quedaban colgando.
- **Nuevas tools**: `get_recent_notes` (recall episodico barato), `get_tags` (taxonomia viva), `get_graph` (nodos + edges + huerfanos, alimenta Canvas/UI).
- **Guardas de escritura**: `create_note`/`update_note` respetan `OBSIDIAN_MAX_NOTE_BYTES` tambien al escribir (antes solo al leer).
- **Smoke test**: `pnpm test` en `obsidian-mcp/` arranca el servidor contra un vault temporal y verifica todas las tools.

## Criterio

Sigue vigente ADR-0001: Obsidian es memoria documental legible por humanos; Redis/Postgres/Qdrant siguen siendo el estado caliente. Este ADR solo elimina el cuello de botella de I/O y anade recall por recencia, tags y grafo.

## Links

[[ADR-0001-Obsidian-as-Agent-Knowledge-Ops]]
