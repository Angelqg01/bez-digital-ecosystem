---
type: "cluster"
layer: 1
cluster: "finanzas-pagos"
members: 6
tags: ["platform-map", "cluster", "finanzas-pagos"]
---

# Cluster Finanzas y Pagos

> Capa 1 · [[BeZhas-Platform-Master]]

Todo el flujo de dinero: gateway BEZ-Pay, wallet AA, on-ramps fiat (MoonPay/Transak), KYC MiCA por volumen, gas tank y capital DeFi. Moneda de liquidación: BEZ V1 Polygon 0xEcBa…11A8.

## Miembros (por prioridad)

- **P0** [[API-Backend]] — Express :3001 — 35 rutas (auth, wallet, blockchain, energy, gateway), 19 servicios, PostgreSQL + Redis.
- **P0** [[BEZ-Wallet]] — Wallet AA no-custodial (SmartWallet + Factory + Paymaster + WalletGuardian).
- **P0** [[Bezhas-Hub]] — ERP B2B multi-tenant (org/site/membership), API keys con scope y metering, BeZhas_ID, 4 planes definitivos (config/plans.
- **P0** [[BeZhas-Pay]] — Gestor de pagos: checkout hosted (pay.
- **P1** [[BZ-Capital]] — DeFi: pool interno BEZ/USDC (BeZhasDEX, reemplaza QuickSwap; oracle lee BEZHAS_DEX_ADDRESS), staking y farming (LP-token mismatch abierto).
- **P1** [[BZ-Gas-Tank]] — Paymaster manager: patrocinio de gas B2B, recargas y límites por tenant.
