---
type: "platform-service"
layer: 2
priority: "P1"
cluster: "infra-devops"
repo_path: "docker-compose*.yml + nginx/ + monitoring/ + .github/workflows/"
tags: ["platform-map", "infra-devops", "p1"]
---

# Infraestructura Docker

> Capa 2 · Prioridad **P1** · [[Cluster-infra-devops]]

11 servicios base (postgres, redis, geth L2, consensus, batcher, api, aegis, ai-gateway, edge, control-center, obsidian-mcp). Nginx TLS/WAF, Prometheus+Grafana+Loki, CI 6 jobs. Cloud Run: 13 SubApps live; NO ejecutar gcp-deploy.sh (rota password Cloud SQL).

**Ubicación:** `docker-compose*.yml + nginx/ + monitoring/ + .github/workflows/`

## Conexiones

- [[Aegis-AI]]
- [[API-Backend]]
- [[Control-Center]]
- [[Cluster-infra-devops]]
- [[BeZhas-Platform-Master]]
