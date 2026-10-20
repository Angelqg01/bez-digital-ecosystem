---
type: "subapp"
layer: 2
priority: "P0"
cluster: "finanzas-pagos"
repo_path: "App-nativas/bez-wallet/"
domain: "wallet.bezhas.com"
tags: ["platform-map", "finanzas-pagos", "p0"]
visibility: "public"
---

# BEZ Wallet

> Capa 2 · Prioridad **P0** · [[Cluster-finanzas-pagos]]

Wallet AA no-custodial (SmartWallet + Factory + Paymaster + WalletGuardian). Login/subscribe-with-wallet SIWE compartido (_shared/bezhas-wallet-auth.js).

**Ubicación:** `App-nativas/bez-wallet/` · wallet.bezhas.com

## Para clientes

BEZ Wallet es la billetera no custodial de la plataforma: las claves son del usuario y nadie más las conoce ni las pide. Usa cuentas inteligentes, que permiten que el gas lo patrocine la empresa y añadir guardianes para recuperar el acceso. Sirve también para iniciar sesión y suscribirse firmando con la propia wallet.

Disponible en https://wallet.bezhas.com.

## Conexiones

- [[Smart-Contracts]]
- [[BeZhas-Pay]]
- [[BZ-Gas-Tank]]
- [[Cluster-finanzas-pagos]]
- [[BeZhas-Platform-Master]]
