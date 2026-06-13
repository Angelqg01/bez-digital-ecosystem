# @bezhas/mcp-server — BeZhas Intelligence

Superficie **MCP oficial del BeZhas Hub** para instituciones, holdings y agentes IA.
Junto al contrato OpenAPI (`backend/openapi.json`) y el SDK cliente (`sdk/`), completa
la tríada de conexión **API · SDK · MCP**.

## Tools disponibles

| Categoría | Tools |
|---|---|
| Core | `analyze_gas_strategy` · `calculate_smart_swap` · `verify_regulatory_compliance` (AML/KYC) |
| Blockchain | `blockscout_explorer` · `tally_dao_governance` · `auditmos_security` |
| Operaciones | `github_repo_manager` · `firecrawl_scraper` · `playwright_automation` · `obliq_ai_sre` · `kinaxis_supply_chain` |
| Mercados | `alpaca_markets` |
| Pagos | payment-tools (Stripe, crypto, balances) |
| IA | `skill_creator_ai` |
| Comunicación | telegram · sync-contacts |

Inventario en vivo: `GET /api/mcp/tools`.

## Conexión

### 1. MCP nativo (Claude Desktop / Claude Code / VS Code) — STDIO

```json
{
  "mcpServers": {
    "bezhas-intelligence": {
      "command": "node",
      "args": ["<ruta>/packages/mcp-server/dist/index.js"],
      "env": { "POLYGON_RPC_URL": "https://polygon-rpc.com" }
    }
  }
}
```

### 2. HTTP REST (backends, integraciones servidor-a-servidor)

```bash
pnpm start:http   # expone :8080
curl -H "X-API-Key: $MCP_API_KEY" -X POST \
  http://localhost:8080/api/mcp/analyze-gas \
  -d '{"transactionType":"transfer"}' -H 'Content-Type: application/json'
```

## 🔐 Autenticación (HTTP)

El wrapper HTTP soporta auth por API key, **opt-in** para no romper despliegues previos:

| Estado | Comportamiento |
|---|---|
| `MCP_API_KEY` (o `MCP_API_KEYS=k1,k2`) definida | Toda ruta `/api/mcp/*` exige `X-API-Key: <key>` o `Authorization: Bearer <key>`. Sin clave → `401`. |
| Sin variable | Modo **legacy**: se permite el paso y se loggea un warning al arrancar. |

`/api/mcp/health` queda siempre público (probes de Cloud Run).

Los servicios del backend (`automationEngine`, `leadFinder`, `mcp-context`) envían la clave
automáticamente si el backend define `MCP_API_KEY` (helper `backend/utils/mcpAuthHeaders.js`).

> ⚠️ **Producción (Cloud Run `bezhas-intelligence`):** el servicio se despliega con
> `--allow-unauthenticated` y monta secrets sensibles (GitHub, Alpaca, 1inch). **Configura
> `MCP_API_KEY` como secret en el servicio Y en el backend** para activar el enforcement.
> Hasta entonces, el endpoint queda abierto (modo legacy).

## Tests

```bash
pnpm test        # vitest (166 tests, incluye auth middleware)
pnpm build       # tsc → dist/
```
