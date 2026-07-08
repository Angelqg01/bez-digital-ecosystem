---
type: "platform-service"
layer: 2
priority: "P0"
cluster: "ia-conocimiento"
repo_path: "agent-runtime/ + core/AgentToolRegistry.js"
tags: ["platform-map", "ia-conocimiento", "p0"]
---

# Agent Runtime

> Capa 2 · Prioridad **P0** · [[Cluster-ia-conocimiento]]

8 agentes departamentales (trading, marketing, investor, legal, finance, blockchain-dev, devops, director) con permisos por tool, human-in-loop y circuit breaker. Todos consumen el Brain vía obsidian:* — búsqueda, episodios, grafo, fingerprint.

**Ubicación:** `agent-runtime/ + core/AgentToolRegistry.js`

## Conexiones

- [[Obsidian-Brain]]
- [[OpenClaw-Orchestrator]]
- [[Aegis-AI]]
- [[API-Backend]]
- [[Cluster-ia-conocimiento]]
- [[BeZhas-Platform-Master]]
