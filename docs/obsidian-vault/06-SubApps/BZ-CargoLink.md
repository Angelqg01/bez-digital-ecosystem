---
type: "subapp"
layer: 2
priority: "P1"
cluster: "logistica-rwa"
repo_path: "App-nativas/BZ CargoLink/"
port: 3017
domain: "cargolink.bezhas.com"
tags: ["platform-map", "logistica-rwa", "p1"]
---

# BZ CargoLink

> Capa 2 · Prioridad **P1** · [[Cluster-logistica-rwa]]

Logística: POS del cliente ↔ BeZhas_ID (un objeto B-UID + lifecycle, roles no pipelines), webhooks firmados fan-out, escrow BEZ. Permisos just-in-time (useClientPermission.js).

**Ubicación:** `App-nativas/BZ CargoLink/` · puerto :3017 · cargolink.bezhas.com

## Conexiones

- [[Bezhas-Hub]]
- [[BeZhas-ID-Nota]]
- [[BZ-PureScan]]
- [[RWA-Gemelos-Digitales]]
- [[Cluster-logistica-rwa]]
- [[BeZhas-Platform-Master]]
