---
type: "platform-service"
layer: 2
priority: "P0"
cluster: "ia-conocimiento"
repo_path: "core/OpenClawOrchestrator.js + openclaw/"
tags: ["platform-map", "ia-conocimiento", "p0"]
---

# OpenClaw Orchestrator

> Capa 2 · Prioridad **P0** · [[Cluster-ia-conocimiento]]

Orquestador multi-LLM: clasificación de intención, routing por orchestration-manifest.json, fallback Claude → Gemini 2.0 Flash → GPT-4o → DeepSeek → LLaMA local (Ollama). Gate + router + cache listos para BeZhasAgentManager (30/30 tests).

**Ubicación:** `core/OpenClawOrchestrator.js + openclaw/`

## Conexiones

- [[Agent-Runtime]]
- [[Aegis-AI]]
- [[Obsidian-Brain]]
- [[Cluster-ia-conocimiento]]
- [[BeZhas-Platform-Master]]
