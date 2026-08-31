# Nodos: Enterprise y Edge

BeZhas distingue dos tipos de nodo. No compiten: cubren necesidades distintas y muchas empresas acaban operando ambos.

| | **Enterprise Node** | **Edge Node** |
| --- | --- | --- |
| Para quién | Empresa que integra la blockchain en su operación | Operador que aporta capacidad y valida trabajo |
| Función | Pasarela privada al protocolo: RPC, SDK, contratos, estado de validador | Validación DePIN: verifica tareas y gana BEZ por trabajo útil |
| Puerto por defecto | `4100` | `4000` |
| Requiere stake | Para validar, sí | Para cobrar recompensas, sí |
| Ingreso | Ahorro operativo + recompensas de validación | Recompensas por puntos de validación |

## Enterprise Node

Es la pieza que instalas dentro de tu perímetro para que tus sistemas hablen con la L2 sin exponer nada al exterior.

### Requisitos

- Node.js >= 20, pnpm >= 11
- Docker y Docker Compose (recomendado para producción)
- Acceso saliente al RPC de la L2
- 2 vCPU / 4 GB RAM como línea base; más si vas a servir RPC a mucha carga interna

### Configuración

```env
PORT=4100
API_KEY=<clave_generada_por_ti>
BEZHAS_L2_RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
PUBLIC_RPC_URL=http://127.0.0.1:8545
BEZHAS_SDK_PATH=../sdk
```

Para la red real, `CHAIN_ID=2708` y el RPC de BeZhas L2.

> `API_KEY` la generas tú y **no** se comparte, no se commitea y no viaja al frontend. Si la expones, rótala de inmediato.

### Arranque

Validación previa (comprueba configuración, conectividad RPC y contratos):

```bash
pnpm run validate
```

Local:

```bash
pnpm start
```

Con Docker:

```bash
cp .env.example .env    # edita tus valores
docker compose up -d
```

### Endpoints locales

| Endpoint | Devuelve |
| --- | --- |
| `GET /health` | Salud del nodo |
| `GET /network/stats` | Métricas de red |
| `GET /sdk/status` | Estado de la capa SDK |
| `GET /sdk/contracts` | Contratos y direcciones de la red configurada |
| `GET /sdk/frontend-config` | Configuración lista para inyectar en tu frontend |
| `GET /validator/status` | Estado de validación del operador |
| `GET /profitability/report` | Informe de rentabilidad del nodo |

Comprobación rápida:

```bash
curl http://127.0.0.1:4100/health
```

## Edge Node

Servicio ligero de validación. Firma y reporta el trabajo verificado, y acumula puntos que se convierten en BEZ según [las reglas de EdgeNodeRewards](/docs/validadores-staking).

### Configuración

```env
PORT=4000
RPC_URL=http://127.0.0.1:8545
EDGE_NODE_ADDRESS=<direccion_publica_del_nodo>
EDGE_NODE_PRIVATE_KEY=<gestor_de_secretos>
EDGE_NODE_API_KEY=<clave_generada_por_ti>
```

> La clave privada del nodo firma en su nombre. Cárgala desde un gestor de secretos, una variable de entorno inyectada en tiempo de ejecución o un HSM. **Nunca** en un archivo del repositorio, en una imagen Docker ni en un `.env` versionado. Quien tiene esa clave puede actuar como tu nodo y hacer que te penalicen.

### Arranque y comprobación

```bash
pnpm start
curl http://127.0.0.1:4000/health
```

### Registro y recompensas

```js
await edgeNodeRewards.registerNode();   // una sola vez
// … el nodo opera y el oráculo registra su trabajo …
await edgeNodeRewards.claimRewards();
```

Consulta tu estado con `getNodeInfo(direccion)`.

## Endurecimiento para producción

Estas reglas no son opcionales si el nodo toca la red real:

1. **Escucha en `127.0.0.1` por defecto.** Usa `0.0.0.0` solo detrás de firewall, VPN o reverse proxy con TLS.
2. **Nunca expongas el RPC a Internet sin autenticación y rate limiting.** Un RPC abierto es un vector de abuso y de fuga de patrones de negocio.
3. **Separa entornos.** La red local `31337` y la L2 `2708` no comparten direcciones de contrato. Mezclarlas produce fallos silenciosos.
4. **Rota claves y API keys** de forma periódica y de inmediato ante cualquier sospecha.
5. **Monitoriza el uptime.** Por debajo del 90% pierdes el estado activo de validador.
6. **Actualiza dependencias** y sigue los avisos de seguridad del protocolo.
7. **Haz copia de seguridad de la configuración**, nunca de las claves en claro.

## Verificación antes de pasar a producción

```bash
# Sintaxis de los servicios
node --check server.js

# Estado del validador contra la red objetivo
node scripts/validator-status.js \
  --chainId 2708 \
  --rpcUrl <TU_RPC> \
  --operator <TU_WALLET>

# Verificación del despliegue de contratos
node scripts/verify-deployment.js 2708
```

## Ver también

- [Validadores y staking](/docs/validadores-staking)
- [RPC y endpoints](/docs/rpc-endpoints)
- [Seguridad y buenas prácticas](/docs/seguridad)
