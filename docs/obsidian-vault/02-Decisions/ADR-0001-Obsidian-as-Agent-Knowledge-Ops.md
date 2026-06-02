---
type: adr
hierarchy: Admin
canvasType: decision
status: accepted
created: "2026-05-09"
tags: ["obsidian", "memory", "agents"]
summary: Obsidian queda como memoria documental viva, auditable por humanos y conectada al runtime.
---

# ADR-0001 Obsidian as Agent Knowledge Ops

Obsidian se integra como vault Markdown local para memoria documental, decisiones, episodios, mapas y auto-modelo.

No sustituye Redis, Postgres, Qdrant, Neo4j ni la blockchain. Su funcion optima es hacer legible y editable por humanos la memoria consolidada de los agentes.

## Implementacion

- Servicio `obsidian-mcp` en puerto 4007.
- Vault en `docs/obsidian-vault`.
- Tools HTTP: `search_vault`, `get_note`, `create_note`, `update_note`, `list_notes`, `get_related_notes`, `record_episode`, `update_self_model`.
- Runtime tool prefix: `obsidian:*`.

## Criterio

Usar Obsidian para conocimiento, introspeccion y trazabilidad. Usar bases de datos para ejecucion, indices y estado caliente.
