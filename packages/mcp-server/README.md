# @bezhas/mcp-server

Servidor MCP de BeZhas. Da a un modelo un conjunto acotado de herramientas para
consultar la cadena, cotizar pagos en BEZ, revisar cumplimiento y hablar con
servicios de terceros — con un vigilante delante que inspecciona cada llamada.

## Instalación

```bash
pnpm add @bezhas/mcp-server
```

## Arranque

Dos transportes, el mismo conjunto de herramientas detrás:

```bash
# STDIO — es el que usa un cliente MCP (Claude Desktop, Claude Code…).
pnpm start

# HTTP — para que otro servicio del ecosistema lo llame por REST.
pnpm run start:http
```

En desarrollo, con recarga:

```bash
pnpm run dev        # STDIO
pnpm run dev:http   # HTTP
```

### Como servidor MCP de un cliente

```json
{
  "mcpServers": {
    "bezhas": {
      "command": "node",
      "args": ["./node_modules/@bezhas/mcp-server/dist/index.js"],
      "env": { "NETWORK_MODE": "amoy" }
    }
  }
}
```

## Las 20 herramientas

| Grupo | Herramientas |
|---|---|
| Cadena y coste | `analyze_gas_strategy`, `calculate_smart_swap`, `blockscout_explorer` |
| Pagos | `get_payment_quote`, `process_stripe_payment`, `check_payment_status`, `get_wallet_balance`, `initiate_crypto_payment` |
| Cumplimiento y seguridad | `verify_regulatory_compliance`, `auditmos_security` |
| Gobernanza | `tally_dao_governance` |
| Infraestructura y terceros | `github_repo_manager`, `firecrawl_scraper`, `playwright_automation`, `skill_creator_ai`, `obliq_ai_sre`, `kinaxis_supply_chain`, `alpaca_markets` |
| Comunicación | `send_telegram_message`, `sync_contacts` |

**El transporte HTTP no las expone todas.** `http-server.ts` publica ruta REST
para 13; las cinco de pago y las dos de comunicación solo se alcanzan por
STDIO. Es a propósito: son las que mueven dinero o datos personales y no tienen
sentido colgadas de un endpoint sin autenticación propia.

### Sobre los precios

`get_payment_quote` e `initiate_crypto_payment` convierten con **constantes de
configuración**, no con un mercado en vivo. La respuesta lo dice en
`rateSource` y `rateDisclaimer`, y hay que trasladarlo a quien reciba la
cotización: sirven para orientar, no para liquidar una operación real. El
precio del BEZ sale siempre de `BEZ_PRICE_USD`; ninguna herramienta lleva el
suyo propio.

## Configuración

Copia `.env.example` a `.env`. Lo que más se toca:

| Variable | Para qué | Por omisión |
|---|---|---|
| `NETWORK_MODE` | `mainnet` · `amoy` · `localhost` | `amoy` |
| `POLYGON_RPC_URL` | Nodo de mainnet | `https://polygon-rpc.com` |
| `POLYGON_AMOY_RPC_URL` | Nodo de Amoy | `https://rpc-amoy.polygon.technology` |
| `BEZ_PRICE_USD` | Precio del BEZ para toda cotización | `0.50` |
| `BACKEND_URL` | Backend de BeZhas, para las herramientas de pago | `http://localhost:3001` |
| `HTTP_PORT` | Puerto del transporte HTTP | `8080` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECURITY_CHAT_ID` | Avisos al administrador | — |

Los valores numéricos se validan al leerlos: un `BEZ_PRICE_USD=abc` no se
convierte en `NaN` a la callada, se descarta y se usa el de reserva.

## El vigilante

Entre el modelo y cada herramienta hay un guardián que inspecciona los
parámetros de entrada y el resultado de salida. No consulta a ningún modelo
para decidir —si el modelo está siendo manipulado, preguntarle si le están
manipulando no sirve de nada—, sino que aplica reglas fijas:

- **Inyección de prompt** en los parámetros: se detecta y se bloquea a partir
  de la severidad configurada.
- **Secretos**: se redactan antes de que salgan en una respuesta o en el
  registro de auditoría.
- **Techo de dinero** por operación y por hora, para las herramientas
  clasificadas como críticas.
- **Ritmo de llamadas** por sujeto, con un tope aparte para las críticas.
- **Corte en caliente** de una herramienta concreta, sin desplegar.

Se ajusta con estas variables:

| Variable | Para qué |
|---|---|
| `WATCHDOG_ENFORCE` | `false` deja que observe y registre sin bloquear |
| `WATCHDOG_BLOCK_AT` | Severidad a partir de la cual bloquea (`low`…`critical`) |
| `WATCHDOG_MAX_TX_USD` | Techo por operación |
| `WATCHDOG_MAX_HOURLY_USD` | Techo por hora y sujeto |
| `WATCHDOG_CALLS_PER_MINUTE` | Ritmo máximo de llamadas |
| `WATCHDOG_CRITICAL_CALLS_PER_HOUR` | Ritmo máximo de las críticas |
| `WATCHDOG_DISABLED_TOOLS` | Lista separada por comas para cortar en caliente |
| `WATCHDOG_ALLOWED_DOMAINS` | Dominios permitidos a las herramientas de red |
| `WATCHDOG_AUDIT_FILE` | Dónde se vuelca la auditoría |
| `WATCHDOG_SUBJECT_SALT` | Sal para seudonimizar al sujeto en el registro |

El blindaje se aplica envolviendo el servidor, no herramienta a herramienta
(`hardenServer`), así que una herramienta nueva queda protegida por omisión sin
que nadie tenga que acordarse.

Por HTTP hay tres rutas para mirarlo: `/api/mcp/watchdog/status`,
`/api/mcp/watchdog/audit` y `/api/mcp/watchdog/inspect`.

## Docker

```bash
docker build -t bezhas/mcp-server packages/mcp-server
docker run -p 8080:8080 --env-file packages/mcp-server/.env bezhas/mcp-server
```

La imagen instala desde el lockfile, deja fuera las dependencias de desarrollo,
corre como usuario sin privilegios y trae `HEALTHCHECK` contra
`/api/mcp/health`. El proceso atiende `SIGTERM` y cierra ordenadamente, así que
un `docker stop` no corta peticiones en vuelo.

## Desarrollo

```bash
pnpm test           # 242 pruebas
pnpm run build      # compila a dist/
pnpm run lint
```

Las pruebas corren en CI en el job **MCP Server Tests**, y la publicación a npm
comprueba que el tarball contenga de verdad el fichero que `package.json`
declara como `main`.
