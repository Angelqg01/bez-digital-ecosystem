---
type: "platform-service"
layer: 2
priority: "P1"
cluster: "nucleo-blockchain"
repo_path: "bezhas-edge-node/ + edge-gateway/"
port: 4000
tags: ["platform-map", "nucleo-blockchain", "p1"]
---

# Edge Node

> Capa 2 · Prioridad **P1** · [[Cluster-nucleo-blockchain]]

Relay B2B :4000 — webhook ERP → compliance MCP → firma → contrato L2. Flujo: evento → EventListener → DB → WebSocket al frontend → audit Redis.

**Ubicación:** `bezhas-edge-node/ + edge-gateway/` · puerto :4000

## Conexiones

- [[Smart-Contracts]]
- [[API-Backend]]
- [[BZ-Edge-Manager]]
- [[Cluster-nucleo-blockchain]]
- [[BeZhas-Platform-Master]]
