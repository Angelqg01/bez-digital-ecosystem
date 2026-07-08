---
type: "cluster"
layer: 1
cluster: "nucleo-blockchain"
members: 4
tags: ["platform-map", "cluster", "nucleo-blockchain"]
---

# Cluster Núcleo Blockchain

> Capa 1 · [[BeZhas-Platform-Master]]

Contratos, L2 soberana (OP Stack, chainId 2708), SDK y relays on-chain. Fuente de verdad: smart-contracts/ (Foundry, 78+ contratos, 1206 tests verdes).

## Miembros (por prioridad)

- **P0** [[BEZCoinV2-L2]] — Token nativo de la L2 propia (chainId 2708, OP Stack: geth :8545 + consensus :5052 + batcher).
- **P0** [[Smart-Contracts]] — Proyecto Foundry: BEZCoinV2, QualityEscrow, Bridge, Governance, Staking, wallet AA (SmartWallet/Paymaster/MultiSig), 16 sectores × 4 contratos, contratos Energy VPP.
- **P1** [[Edge-Node]] — Relay B2B :4000 — webhook ERP → compliance MCP → firma → contrato L2.
- **P1** [[SDK-BeZhas]] — @bezhas/sdk v3 (registry multi-chain, módulos por sector, cubre las 13 SubApps) y @bezhas/connect (embed B2B: Pay + CargoLink + Capability Registry + widget <script>, 30 tests).
