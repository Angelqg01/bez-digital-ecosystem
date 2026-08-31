---
type: "subapp"
layer: 2
priority: "P0"
cluster: "finanzas-pagos"
repo_path: "App-nativas/Bezhas-Hub/"
port: 5173
domain: "hub.bez.digital"
tags: ["platform-map", "finanzas-pagos", "p0"]
---

# Bezhas Hub

> Capa 2 · Prioridad **P0** · [[Cluster-finanzas-pagos]]

ERP B2B multi-tenant (org/site/membership), API keys con scope y metering, BeZhas_ID, 4 planes definitivos (config/plans.js única fuente), hot-wallet signing GCP KMS, simulador logístico 360°. Migraciones 012-014.

**Ubicación:** `App-nativas/Bezhas-Hub/` · puerto :5173 · hub.bez.digital

## Conexiones

- [[API-Backend]]
- [[BeZhas-Pay]]
- [[BeZhas-ID-Nota]]
- [[BZ-CargoLink]]
- [[Cluster-finanzas-pagos]]
- [[BeZhas-Platform-Master]]
