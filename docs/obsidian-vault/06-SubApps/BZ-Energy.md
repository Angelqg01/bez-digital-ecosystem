---
type: "subapp"
layer: 2
priority: "P1"
cluster: "energia-iot"
repo_path: "App-nativas/bez-energy/"
port: 3019
domain: "energy.bezhas.com"
tags: ["platform-map", "energia-iot", "p1"]
---

# BZ Energy

> Capa 2 · Prioridad **P1** · [[Cluster-energia-iot]]

VPP: ingesta MQTT (vppMqttBroker.js + simulador), EnergyOracle.sol + EnergyCAEToken.sol + BeZhasVPP.sol (64 tests forge), feed OMIE, agente de arbitraje, bridge SCADA on-chain. NEXT: deploy Amoy + wire frontend.

**Ubicación:** `App-nativas/bez-energy/` · puerto :3019 · energy.bezhas.com

## Conexiones

- [[Smart-Contracts]]
- [[API-Backend]]
- [[Cluster-energia-iot]]
- [[BeZhas-Platform-Master]]
