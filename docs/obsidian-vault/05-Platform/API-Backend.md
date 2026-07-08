---
type: "platform-service"
layer: 2
priority: "P0"
cluster: "finanzas-pagos"
repo_path: "api/"
port: 3001
tags: ["platform-map", "finanzas-pagos", "p0"]
---

# API Backend

> Capa 2 · Prioridad **P0** · [[Cluster-finanzas-pagos]]

Express :3001 — 35 rutas (auth, wallet, blockchain, energy, gateway), 19 servicios, PostgreSQL + Redis. Tests de integración con Anvil :8546 (ANVIL_BIN=anvil.exe). Gateway BEZ-Pay: /payments/buy con gates KYC MiCA, refunds, hosted checkout pay.bez.digital.

**Ubicación:** `api/` · puerto :3001

## Conexiones

- [[Smart-Contracts]]
- [[Bezhas-Hub]]
- [[BeZhas-Pay]]
- [[Agent-Runtime]]
- [[Cluster-finanzas-pagos]]
- [[BeZhas-Platform-Master]]
