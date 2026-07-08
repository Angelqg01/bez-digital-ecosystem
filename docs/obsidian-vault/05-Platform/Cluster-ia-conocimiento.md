---
type: "cluster"
layer: 1
cluster: "ia-conocimiento"
members: 6
tags: ["platform-map", "cluster", "ia-conocimiento"]
---

# Cluster IA y Conocimiento

> Capa 1 · [[BeZhas-Platform-Master]]

Cerebro y orquestación: Aegis (ML), OpenClaw (multi-LLM), agent-runtime (8 agentes), Brain Obsidian y base de conocimiento SKILL/.

## Miembros (por prioridad)

- **P0** [[Aegis-AI]] — FastAPI :8001 — DecisionEngine, AutoHealer, Monitor, 5 modelos ML.
- **P0** [[Agent-Runtime]] — 8 agentes departamentales (trading, marketing, investor, legal, finance, blockchain-dev, devops, director) con permisos por tool, human-in-loop y circuit breaker.
- **P0** [[Obsidian-Brain]] — Este vault.
- **P0** [[OpenClaw-Orchestrator]] — Orquestador multi-LLM: clasificación de intención, routing por orchestration-manifest.
- **P1** [[SKILL-Knowledge-Base]] — Base de conocimiento operativa para IA: config (blockchain/infra/seguridad), runbooks (deploy, incidentes, wallet ops), solutions (fixes por categoría), patterns (Solidity/API/testing) y feedback de sesiones.
- **P2** [[BeZhas-Docs]] — Documentación del ecosistema para desarrolladores y partners.
