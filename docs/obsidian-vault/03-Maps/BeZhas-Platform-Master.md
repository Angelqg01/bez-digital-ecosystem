---
type: "master-map"
layer: 0
clusters: 7
services: 28
tags: ["platform-map", "master"]
---

# BeZhas Platform Master

Hub central del ecosistema. Tres capas: **Capa 0** (este mapa) → **Capa 1** (clusters por tipo de información) → **Capa 2** (servicios core y SubApps). Los agentes deben empezar aquí: baja por cluster, no por lista plana.

## Capa 1 — Clusters

- [[Cluster-nucleo-blockchain]] — Contratos, L2 soberana (OP Stack, chainId 2708), SDK y relays on-chain.
- [[Cluster-ia-conocimiento]] — Cerebro y orquestación: Aegis (ML), OpenClaw (multi-LLM), agent-runtime (8 agentes), Brain Obsidian y base de conocimiento SKILL/.
- [[Cluster-finanzas-pagos]] — Todo el flujo de dinero: gateway BEZ-Pay, wallet AA, on-ramps fiat (MoonPay/Transak), KYC MiCA por volumen, gas tank y capital DeFi.
- [[Cluster-logistica-rwa]] — Trazabilidad física→on-chain: CargoLink (POS↔BeZhas_ID), simulador logístico 360°, PureScan, Vision Scan y gemelos digitales RWA.
- [[Cluster-energia-iot]] — VPP: ingesta MQTT de telemetría, EnergyOracle + CAE tokens + BeZhasVPP on-chain, feed OMIE y agente de arbitraje.
- [[Cluster-identidad-comunidad]] — BeZhas_ID (B-UID único multi-tenant), reputación Prestige, onboarding Genesis y red social Sphere.
- [[Cluster-infra-devops]] — Docker (11 servicios), nginx WAF, Prometheus/Grafana/Loki, CI/CD GitHub Actions, Cloud Run (13 SubApps live) y control-center.

## Ruta crítica (P0)

- [[Smart-Contracts]] (nucleo-blockchain)
- [[BEZCoinV2-L2]] (nucleo-blockchain)
- [[API-Backend]] (finanzas-pagos)
- [[Agent-Runtime]] (ia-conocimiento)
- [[Aegis-AI]] (ia-conocimiento)
- [[OpenClaw-Orchestrator]] (ia-conocimiento)
- [[Obsidian-Brain]] (ia-conocimiento)
- [[Bezhas-Hub]] (finanzas-pagos)
- [[BeZhas-Pay]] (finanzas-pagos)
- [[BEZ-Wallet]] (finanzas-pagos)
- [[BeZhas-ID-Nota]] (identidad-comunidad)

## Reglas transversales

- PNPM v11+ SIEMPRE (nunca npm/yarn). Foundry, no Hardhat.
- Direcciones de contratos NUNCA se cambian sin confirmación — ver CLAUDE.md.
- Dos tokens, dos roles: [[BEZCoinV2-L2]] activa la conexión blockchain propia (gas nativo L2 chainId 2708); BEZ V1 Polygon `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` es la moneda de cambio/liquidación externa.
- Tras compilar contratos: sync-daemon → ABIs frontend.
- Memoria agéntica: [[Obsidian-Brain]] · decisiones en [[ADR-0001-Obsidian-as-Agent-Knowledge-Ops]].

## Mapas relacionados

- [[BeZhas-Blockchain-Map]]
- [[BeZhas-Autonomy-Loop.canvas]]
