---
type: adr
hierarchy: Admin
canvasType: decision
status: accepted
created: "2026-07-08"
tags: ["obsidian", "platform-map", "automation", "brain-daily"]
summary: El vault gana una capa de conocimiento de plataforma en 3 niveles (master, clusters, servicios/SubApps) generada por script idempotente, mas el ciclo diario brain-daily (skill + autopilot).
---

# ADR-0004 Platform Knowledge Layer & Daily Flow

## Capa de conocimiento (3 niveles de prioridad)

- **Capa 0**: [[BeZhas-Platform-Master]] — hub central, ruta crítica P0 y reglas transversales.
- **Capa 1**: 7 clusters por tipo de información en `05-Platform/Cluster-*` (núcleo-blockchain, ia-conocimiento, finanzas-pagos, logistica-rwa, energia-iot, identidad-comunidad, infra-devops).
- **Capa 2**: 11 servicios de plataforma (`05-Platform/`) + 16 SubApps (`06-SubApps/`), cada uno con frontmatter estructurado (priority P0-P2, cluster, repo_path, port, domain) y conexiones `[[...]]` entre sí.

Generado por `obsidian-mcp/scripts/buildPlatformMap.mjs` — **idempotente**: la fuente de verdad del mapa es ese script; si el monorepo cambia (nueva SubApp, puerto, dominio), se edita el script y se re-ejecuta. 46 notas, ~192 edges en el grafo.

## Ciclo diario (brain-daily)

Tres niveles de automatización:

1. **Autopilot** (dentro del servidor, `BRAIN_AUTOPILOT`, cada 24h): consolida episodios >30d + re-embebe si Ollama responde.
2. **Script** `scripts/brainDaily.mjs` (standalone): mapa + consolidación + embeddings + huérfanas/links muertos + fingerprint → escribe [[Brain-Daily-Report]] + episodio idempotente por día.
3. **Skill** `/brain-daily` (`.claude/skills/brain-daily/`): la capa con criterio — conectar huérfanas, arreglar links muertos, promover decisiones de digests a ADRs, decidir anclaje on-chain.

## Criterio

Los agentes navegan **de arriba hacia abajo** (master → cluster → servicio), nunca por lista plana. El detector de higiene ignora links a carpetas y wiki-syntax dentro de código. El reporte diario escapa los links muertos que lista (para no re-crearlos).

## Links

[[ADR-0003-Brain-Semantic-Layer-and-Console]] · [[BeZhas-Platform-Master]] · [[Obsidian-Brain]]
