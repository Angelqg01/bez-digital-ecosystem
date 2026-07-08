---
type: adr
hierarchy: Admin
canvasType: decision
status: accepted
created: "2026-07-08"
tags: ["obsidian", "memory", "semantic", "audit", "ui"]
summary: El Brain gana capa semantica (Ollama embeddings con fallback lexico), consolidacion de episodios, fingerprint merkle para anclaje on-chain y consola visual en /ui.
---

# ADR-0003 Brain Semantic Layer & Console

Segunda iteracion sobre [[ADR-0002-Brain-Index-Optimization]]. Cuatro capacidades nuevas en `obsidian-mcp`:

## 1. Capa semantica (`semantic_search`)

- Embeddings via Ollama local (`OLLAMA_HOST`, modelo `EMBEDDINGS_MODEL`, default `nomic-embed-text`), similitud coseno en memoria (`src/semanticIndex.js`).
- Vectores cacheados en `.obsidian/bezhas-embeddings.json` — solo se re-embebe lo que cambia (hash de contenido).
- **Nunca bloquea**: si Ollama no responde, degrada a busqueda lexica con `mode: 'lexical-fallback'`.

## 2. Consolidacion de episodios (`consolidate_episodes`)

- El "dormir" de la memoria: episodios de mas de N dias (default 30) se resumen en un digest por agente+mes en `00-Episodic-Memory/consolidated/` y los originales se mueven a `archive/AAAA-MM/`.
- `dryRun: true` por defecto — devuelve el plan sin tocar nada.
- Los digests conservan `[[links]]` a cada episodio archivado: el grafo sigue navegable.

## 3. Fingerprint para anclaje on-chain (`get_vault_fingerprint` + `record_anchor`)

- Merkle root sha256 determinista de todo el vault (`src/brainOps.js`).
- `obsidian-mcp` NO firma transacciones: el blockchain-agent toma el `anchorPayload` y lo publica via QualityOracle. Tras publicar, `record_anchor` deja constancia (root + tx + chainId) como nota de decision.

## 4. Brain Console (`GET /ui`)

- Consola visual self-contained (sin CDNs): grafo de conocimiento force-directed, busqueda lexica/semantica, tags, recientes, detalle de nota con backlinks, y botones de fingerprint/consolidacion.
- `pnpm dev` arranca contra el vault del repo.

## Criterio

Sin cambios de fondo: Obsidian sigue siendo memoria documental; Ollama es opcional; el anclaje on-chain separa calculo (aqui) de firma (blockchain-agent).

## Links

[[ADR-0001-Obsidian-as-Agent-Knowledge-Ops]] · [[ADR-0002-Brain-Index-Optimization]]
