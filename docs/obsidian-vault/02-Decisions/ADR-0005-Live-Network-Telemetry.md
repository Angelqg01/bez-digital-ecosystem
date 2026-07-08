---
type: adr
hierarchy: Admin
canvasType: decision
status: accepted
created: "2026-07-08"
tags: ["obsidian", "telemetry", "usage", "l2", "ui"]
summary: El Brain Console dibuja en vivo el tráfico de API — qué actor usa qué función, tokens y BEZ movido — y separa el token L2 propio (BEZCoinV2, chainId 2708) del BEZ V1 Polygon de liquidación.
---

# ADR-0005 Live Network Telemetry & L2 Token Node

## Telemetría de red en el grafo

Cada request autenticada de la API/gateway/SubApps y cada tool del Brain emite un evento `{source, target, fn, tokens, bez}` a `POST /telemetry/usage` del obsidian-mcp. El `UsageTracker` (src/usageTracker.js) agrega por arista `source→target::fn`, mantiene totales y persiste debounced en `.obsidian/bezhas-usage.json`.

- **Ingesta backend**: `api/services/brainTelemetry.js` — middleware Express fire-and-forget, mapea prefijos de ruta a nodos del mapa (`/api/payments`→BeZhas-Pay, `/api/l2`→BEZCoinV2-L2, etc.), normaliza IDs para no explotar cardinalidad, lee tokens/BEZ de headers `x-ai-tokens`/`x-bez-amount`. Nunca bloquea la request.
- **Visualización**: Brain Console (`/ui`) pinta líneas discontinuas teal con partículas doradas entre nodos, halo por volumen de uso, y nodos-actor rosa (agentes/tenants/usuarios API sin nota propia). Paneles: totales (llamadas/tokens/BEZ), funciones más usadas y conexiones más activas. Poll cada 4s.
- **Tools/endpoints**: `get_usage_stats` (agentes), `GET /telemetry/summary` (UI/admin).
- **Admin**: tab **Brain Live** en `/admin/profile` (control-center) embebe la consola + KPIs en vivo.

## Dos tokens, dos roles

- **[[BEZCoinV2-L2]]** — token NATIVO de la L2 soberana propia (OP Stack, chainId 2708, geth :8545). Es el que **activa la conexión blockchain propia**: gas, paymaster, validadores, recompensas edge. Nodo P0 en cluster núcleo-blockchain.
- **BEZ V1 Polygon** `0xEcBa…11A8` — moneda de cambio/liquidación externa (billing, pagos fiat↔cripto). NO es el gas de la red propia.

El mapa y CLAUDE.md dejan explícita la separación para que agentes y automatizaciones no los confundan.

## Links

[[ADR-0004-Platform-Knowledge-Layer]] · [[BEZCoinV2-L2]] · [[Obsidian-Brain]] · [[API-Backend]]
