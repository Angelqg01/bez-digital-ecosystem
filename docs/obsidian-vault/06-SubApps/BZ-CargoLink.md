---
type: "subapp"
layer: 2
priority: "P1"
cluster: "logistica-rwa"
repo_path: "App-nativas/BZ CargoLink/"
port: 3017
domain: "cargolink.bezhas.com"
tags: ["platform-map", "logistica-rwa", "p1"]
visibility: "public"
---

# BZ CargoLink

> Capa 2 · Prioridad **P1** · [[Cluster-logistica-rwa]]

Logística: POS del cliente ↔ BeZhas_ID (un objeto B-UID + lifecycle, roles no pipelines), webhooks firmados fan-out, escrow BEZ. Permisos just-in-time (useClientPermission.js).

**Ubicación:** `App-nativas/BZ CargoLink/` · puerto :3017 · cargolink.bezhas.com

## Para clientes

BZ CargoLink conecta la logística de la empresa con el resto del ecosistema. Cada envío es un único expediente identificado con su ID único por el que pasan remitente, transportista, destinatario y pagador, cada uno con su papel. Avisa a los sistemas de cada parte con notificaciones firmadas y puede retener el pago en BEZ (escrow) hasta que se cumple la entrega. Los permisos se conceden en el momento en que hacen falta.

Disponible en https://cargolink.bezhas.com.

## Conexiones

- [[Bezhas-Hub]]
- [[BeZhas-ID-Nota]]
- [[BZ-PureScan]]
- [[RWA-Gemelos-Digitales]]
- [[Cluster-logistica-rwa]]
- [[BeZhas-Platform-Master]]
