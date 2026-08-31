# Nodos y Validadores

Ejecuta tu propio nodo RPC o validador en la red BeZhas.

## Tipos de nodos

### 1. Nodo RPC (lectura)

Para consultar el estado de la blockchain sin validar transacciones.

**Requisitos**:
- CPU: 4 cores
- RAM: 8 GB
- Disco: 500 GB SSD
- Conexión: 100 Mbps

**Instalación** (Docker):

```bash
docker pull bezhas/node:latest

docker run -d \
  -v bezhas-data:/data \
  -p 8545:8545 \
  -e NETWORK=polygon \
  -e RPC_PORT=8545 \
  bezhas/node:latest
```

**Verificar**:

```bash
curl http://localhost:8545 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### 2. Validador (con stake)

Participa en consenso y obtén rewards.

**Requisitos**:
- CPU: 8 cores
- RAM: 16 GB
- Disco: 1 TB SSD
- Stake: 32 BEZ mínimo
- Uptime: >99.5%

**Instalación**:

```bash
# 1. Instalar cliente Geth/Prysm
docker pull bezhas/validator:latest

# 2. Generar claves
docker run --rm bezhas/validator:latest \
  generate-keys \
  --output=/keys \
  --passphrase=YOUR_PASSPHRASE

# 3. Hacer stake
# Dirígete a https://bez.digital/staking
# Conecta tu wallet con 32+ BEZ
# Confirma transacción

# 4. Ejecutar validador
docker run -d \
  -v bezhas-validator-keys:/keys \
  -v bezhas-validator-data:/data \
  -p 13000:13000/udp \
  -p 12000:12000/udp \
  -e VALIDATOR_KEYS=/keys \
  -e PASSPHRASE=YOUR_PASSPHRASE \
  bezhas/validator:latest
```

**Monitorear**:

```bash
# Logs
docker logs -f <container_id>

# Validador activo?
curl https://bez.digital/api/v1/validator/status?address=0x...
```

## Sincronización

### Full sync (recomendado para validadores)

```bash
docker run bezhas/node:latest \
  --syncmode=full \
  --datadir=/data
```

Tiempo: ~48 horas en conexión de 100 Mbps

### Fast sync (para RPC nodes)

```bash
docker run bezhas/node:latest \
  --syncmode=fast \
  --datadir=/data
```

Tiempo: ~12 horas

## Configuración avanzada

**config.toml**:

```toml
[node]
syncmode = "full"
maxpeers = 50
port = 30303

[rpc]
enabled = true
port = 8545
host = "0.0.0.0"
apis = ["eth", "web3", "net"]

[validator]
enabled = true
grpc-gateway-port = 3500
monitoringport = 8080
```

## Rewards

**Validadores**:
- Base: 4% APY (en 32 BEZ)
- + Performance bonus (hasta 8% si 99.9% uptime)
- Redimible cada epoch

**RPC Nodes**:
- Sin rewards directos
- Pero: puedes ofrecer RPC endpoint como servicio

## Troubleshooting

**Sincronización lenta**:
→ Aumentar peers: `--maxpeers=100`
→ Mejor conexión de internet

**Validador offline**:
→ Verificar Docker container está corriendo: `docker ps`
→ Ver logs: `docker logs <id>`
→ Slashing: se deduce 0.1-32 BEZ si está offline >7 días

**Insufficient stake**:
→ Staking mínimo: 32 BEZ
→ Recibir rewards: 32+ BEZ

## Documentación completa

- Guía de validador: https://bez.digital/docs/validator
- Ethstaker community: https://bez.digital/ethstaker
- Discord: https://discord.gg/bezhas
