---
type: "platform-service"
layer: 2
priority: "P0"
cluster: "nucleo-blockchain"
repo_path: "smart-contracts/"
tags: ["platform-map", "nucleo-blockchain", "p0"]
---

# Smart Contracts

> Capa 2 · Prioridad **P0** · [[Cluster-nucleo-blockchain]]

Proyecto Foundry: BEZCoinV2, QualityEscrow, Bridge, Governance, Staking, wallet AA (SmartWallet/Paymaster/MultiSig), 16 sectores × 4 contratos, contratos Energy VPP. Build: forge build --sizes · Test: forge test (1206 verdes). Tras compilar SIEMPRE sync-daemon a los ABIs del frontend.

**Ubicación:** `smart-contracts/`

## Conexiones

- [[SDK-BeZhas]]
- [[Edge-Node]]
- [[BZ-Energy]]
- [[API-Backend]]
- [[Cluster-nucleo-blockchain]]
- [[BeZhas-Platform-Master]]
