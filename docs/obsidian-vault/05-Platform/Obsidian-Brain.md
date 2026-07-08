---
type: "platform-service"
layer: 2
priority: "P0"
cluster: "ia-conocimiento"
repo_path: "obsidian-mcp/ + docs/obsidian-vault/"
port: 4007
tags: ["platform-map", "ia-conocimiento", "p0"]
---

# Obsidian Brain

> Capa 2 · Prioridad **P0** · [[Cluster-ia-conocimiento]]

Este vault. MCP :4007 con índice en memoria, búsqueda léxica ponderada + semántica (Ollama), consolidación de episodios, fingerprint merkle para anclaje on-chain y Brain Console en /ui. ADRs 0001-0003.

**Ubicación:** `obsidian-mcp/ + docs/obsidian-vault/` · puerto :4007

## Conexiones

- [[Agent-Runtime]]
- [[SKILL-Knowledge-Base]]
- [[Smart-Contracts]]
- [[Cluster-ia-conocimiento]]
- [[BeZhas-Platform-Master]]
