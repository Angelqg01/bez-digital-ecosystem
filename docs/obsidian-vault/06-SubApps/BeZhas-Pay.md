---
type: "subapp"
layer: 2
priority: "P0"
cluster: "finanzas-pagos"
repo_path: "App-nativas/bezhas-pay-manager/"
domain: "pay.bezhas.com"
tags: ["platform-map", "finanzas-pagos", "p0"]
visibility: "public"
public_title: "Pay: cobros y checkout"
---

# BeZhas Pay

> Capa 2 · Prioridad **P0** · [[Cluster-finanzas-pagos]]

Gestor de pagos: checkout hosted (pay.bezhas.com/c/<token>), webhook MoonPay firmado, refunds, plugin WordPress Embedded Gateway v2.0 (35 tests). Liquidación en BEZ V1 Polygon.

**Ubicación:** `App-nativas/bezhas-pay-manager/` · pay.bezhas.com

## Para clientes

Pay es el gestor de cobros de la plataforma. Genera páginas de pago alojadas (checkout) que la empresa comparte con su cliente, admite reembolsos y ofrece un plugin para WordPress. La liquidación se hace en BEZ-Coin sobre Polygon. Desde la IA conectada por MCP se puede abrir una orden de cobro y consultar su estado, pero el pago lo hace siempre el cliente en la página de checkout.

Disponible en https://pay.bezhas.com.

## Conexiones

- [[API-Backend]]
- [[Bezhas-Hub]]
- [[BEZ-Wallet]]
- [[Cluster-finanzas-pagos]]
- [[BeZhas-Platform-Master]]
