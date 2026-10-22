---
type: "subapp"
layer: 2
priority: "P0"
cluster: "finanzas-pagos"
repo_path: "App-nativas/Bezhas-Hub/"
port: 5173
domain: "hub.bezhas.com"
tags: ["platform-map", "finanzas-pagos", "p0"]
visibility: "public"
public_title: "Hub: centro de operaciones B2B"
---

# Bezhas Hub

> Capa 2 · Prioridad **P0** · [[Cluster-finanzas-pagos]]

ERP B2B multi-tenant (org/site/membership), API keys con scope y metering, BeZhas_ID, 4 planes definitivos (config/plans.js única fuente), hot-wallet signing GCP KMS, simulador logístico 360°. Migraciones 012-014.

**Ubicación:** `App-nativas/Bezhas-Hub/` · puerto :5173 · hub.bezhas.com

## Para clientes

Hub es una de las apps nativas de BeZhas y el centro de operaciones B2B de la plataforma: cada empresa tiene su organización, sus sedes y sus miembros, y desde ahí gestiona las claves de API con permisos acotados y el consumo de su plan. Las entidades se identifican con su ID único, que comparten el resto de SubApps. Incluye un simulador logístico para probar flujos antes de operar con datos reales.

Disponible en https://hub.bezhas.com.

También hay un plugin de WordPress y WooCommerce (versión 2.0.1, requiere PHP 8.2 o superior): trae el Hub a tu propio wp-admin para suscribirte a los planes, activar SubApps y cobrar con BeZhas-Pay. Se descarga en https://bezhas.com/downloads/bezhas-hub-2.0.1.zip y se instala en WordPress desde Plugins, Añadir nuevo, Subir plugin.

## Conexiones

- [[API-Backend]]
- [[BeZhas-Pay]]
- [[BeZhas-ID-Nota]]
- [[BZ-CargoLink]]
- [[Cluster-finanzas-pagos]]
- [[BeZhas-Platform-Master]]
