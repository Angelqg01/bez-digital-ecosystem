---
type: "cluster"
layer: 1
cluster: "infra-devops"
members: 3
tags: ["platform-map", "cluster", "infra-devops"]
---

# Cluster Infraestructura y DevOps

> Capa 1 · [[BeZhas-Platform-Master]]

Docker (11 servicios), nginx WAF, Prometheus/Grafana/Loki, CI/CD GitHub Actions, Cloud Run (13 SubApps live) y control-center.

## Miembros (por prioridad)

- **P1** [[BZ-Edge-Manager]] — Gestión de edge nodes B2B: registro, salud, recompensas (EdgeNodeRewards).
- **P1** [[Control-Center]] — Dashboard corporativo Next.
- **P1** [[Infraestructura-Docker]] — 11 servicios base (postgres, redis, geth L2, consensus, batcher, api, aegis, ai-gateway, edge, control-center, obsidian-mcp).
