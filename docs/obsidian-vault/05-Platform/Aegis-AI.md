---
type: "platform-service"
layer: 2
priority: "P0"
cluster: "ia-conocimiento"
repo_path: "aegis/"
port: 8001
tags: ["platform-map", "ia-conocimiento", "p0"]
---

# Aegis AI

> Capa 2 · Prioridad **P0** · [[Cluster-ia-conocimiento]]

FastAPI :8001 — DecisionEngine, AutoHealer, Monitor, 5 modelos ML. Capa 1 de seguridad: rate limiting Redis, roles ADMIN/OPERATOR/VIEWER/BOT, audit log. Privado en Cloud Run (OIDC via gcpServiceAuth.js).

**Ubicación:** `aegis/` · puerto :8001

## Conexiones

- [[Agent-Runtime]]
- [[OpenClaw-Orchestrator]]
- [[Infraestructura-Docker]]
- [[Cluster-ia-conocimiento]]
- [[BeZhas-Platform-Master]]
