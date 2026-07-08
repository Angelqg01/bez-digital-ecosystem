---
type: "platform-service"
layer: 2
priority: "P0"
cluster: "nucleo-blockchain"
repo_path: "smart-contracts/src/core/ (BEZCoinV2) + L2 soberana OP Stack"
port: 8545
tags: ["platform-map", "nucleo-blockchain", "p0"]
---

# BEZCoinV2 L2

> Capa 2 · Prioridad **P0** · [[Cluster-nucleo-blockchain]]

Token nativo de la L2 propia (chainId 2708, OP Stack: geth :8545 + consensus :5052 + batcher). ERC-20 con ERC20Permit para meta-transacciones gasless. ES EL TOKEN QUE ACTIVA LA CONEXIÓN BLOCKCHAIN PROPIA: gas fees, paymaster, validadores y recompensas edge corren sobre él. No confundir con BEZ V1 Polygon (0xEcBa…11A8), que es la moneda de cambio/liquidación externa.

**Ubicación:** `smart-contracts/src/core/ (BEZCoinV2) + L2 soberana OP Stack` · puerto :8545

## Conexiones

- [[Smart-Contracts]]
- [[Edge-Node]]
- [[BZ-Gas-Tank]]
- [[BEZ-Wallet]]
- [[Cluster-nucleo-blockchain]]
- [[BeZhas-Platform-Master]]
