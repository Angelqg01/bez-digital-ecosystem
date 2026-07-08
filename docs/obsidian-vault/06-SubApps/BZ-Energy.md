---
type: "subapp"
layer: 2
priority: "P1"
cluster: "energia-iot"
repo_path: "App's secundarias/bez-energy/"
port: 3019
domain: "energy.bez.digital"
tags: ["platform-map", "energia-iot", "p1"]
---

# BZ Energy

> Capa 2 · Prioridad **P1** · [[Cluster-energia-iot]]

VPP: ingesta MQTT (vppMqttBroker.js + simulador), EnergyOracle.sol + EnergyCAEToken.sol + BeZhasVPP.sol (64 tests forge), feed OMIE, agente de arbitraje, bridge SCADA on-chain. NEXT: deploy Amoy + wire frontend.

**Ubicación:** `App's secundarias/bez-energy/` · puerto :3019 · energy.bez.digital

## Conexiones

- [[Smart-Contracts]]
- [[API-Backend]]
- [[Cluster-energia-iot]]
- [[BeZhas-Platform-Master]]
