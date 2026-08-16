# BeZhas Blockchain — Guía de Instalación y Arranque
> [!IMPORTANT]
> **USO OBLIGATORIO DE PNPM v11+**: Este proyecto requiere estrictamente `pnpm` versión 11 o superior.
> **NUNCA** uses `npm` ni `yarn`. Se han eliminado todos los `package-lock.json`.


> Stack unificado: AEGIS + Agent Runtime + AI Engine + OpenClaw  
> Modelos IA: OpenCode · Kimi K2.6 · Gemma 4 · Qwen3.6  
> RTX 4090 · 128GB RAM · Windows

---

## Instalación en un solo paso (Windows)

```powershell
# 1. Abrir PowerShell como Administrador
Set-ExecutionPolicy Bypass -Scope Process -Force

# 2. Ir al proyecto
cd "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Blockchain"

# 3. Ejecutar setup completo
.\scripts\setup-windows.ps1

# 4. Para modelos pequeños (sin Kimi K2.6 ~40GB) usa:
.\scripts\setup-windows.ps1 -SmallModelsOnly
```

---

## Lo que instala el setup

| Herramienta | Comando | Descripción |
|---|---|---|
| **Ollama** | `winget install Ollama.Ollama` | Motor inferencia local |
| **Gemma 4 27B** | `ollama pull gemma4:27b` | Agentes departamentales |
| **Qwen3.6 MoE** | `ollama pull qwen3.6:35b-a3b` | Trading, Solidity, código |
| **Kimi K2.6** | `ollama pull kimi-k2` | Orquestación compleja 128k |
| **Qwen3.6 8B** | `ollama pull qwen3.6:8b` | DevOps ultra-rápido |
| **Embeddings** | `ollama pull nomic-embed-text` | RAG Obsidian |
| **OpenCode** | `ollama launch opencode` | IDE con contexto BeZhas |

---

## Configurar el .env antes de arrancar

```bash
# .env mínimo para P0:
TELEGRAM_BOT_TOKEN=         # De @BotFather en Telegram
TELEGRAM_ALERT_CHAT_ID=     # De @userinfobot
TELEGRAM_AUTHORIZED_USERS=  # Tu Telegram user ID
ANTHROPIC_API_KEY=          # De console.anthropic.com
REDIS_URL=redis://localhost:6379
```

---

## Arranque del sistema

### Solo P0 (Mínimo funcional — Telegram + Redis + Agentes)
```bash
# 1. Arrancar Redis con Docker
docker compose up -d redis

# 2. Verificar modelos Ollama
node scripts/ollama-status.js

# 3. Arrancar agentes BeZhas
pnpm run start
```

### Lanzar OpenCode (IDE para desarrollo)
```bash
# En el directorio del proyecto:
ollama launch opencode --model qwen3.6

# O con Kimi K2.6 para tareas largas:
ollama launch opencode --model kimi-k2
```

### Conectar canales con OpenClaw
```bash
# Configura Telegram, WhatsApp, Discord automáticamente:
ollama launch openclaw --yes
```

### Stack completo con Docker
```bash
docker compose up -d

# Con Open WebUI (interfaz web para Ollama):
docker compose --profile p1 up -d

# Con monitoring (Grafana + Prometheus):
docker compose --profile monitoring up -d
```

---

## Uso de los modelos por agente

| Agente | Modelo local primario | Razón |
|---|---|---|
| `trading-agent` | `qwen3.6:35b-a3b` | Algoritmos trading, MoE eficiente |
| `blockchain-agent` | `qwen3.6:35b-a3b` | Solidity, smart contracts |
| `marketing-agent` | `gemma4:27b` | Español, escritura persuasiva |
| `legal-agent` | `gemma4:27b` | Análisis legal español |
| `finance-agent` | `gemma4:27b` | Cálculos financieros |
| `devops-agent` | `qwen3.6:8b` | Ultra-rápido para alertas |
| `director-agent` | `kimi-k2` | Orquestación multi-paso 128k |

---

## Cascade de modelos cloud (si API keys disponibles)

```
Claude Sonnet 4 → Claude Haiku 4.5 → Gemini 2.0 Flash
→ Kimi Cloud (128k) → GPT-4o Mini → DeepSeek
→ [FALLBACK LOCAL] → Gemma4 / Qwen3.6 / Kimi K2.6 local
```

---

## Comandos útiles

```bash
# Ver estado de Ollama y modelos BeZhas
node scripts/ollama-status.js

# Ver logs del agente runtime
docker compose logs -f agent-lib

# Reconstruir Docker
pnpm run docker:rebuild

# Tests de contratos Solidity (Foundry)
pnpm run test:contracts

# Ver todos los agentes disponibles
node -e "import('./agent-lib/src/registry/AgentToolRegistry.js').then(m => console.log(m.agentRegistry.summary()))"
```

---

## Arquitectura de modelos locales (RTX 4090 — 24GB VRAM)

```
VRAM:  [══════ Qwen3.6:35b-a3b ~22GB ══════] ← Siempre cargado
RAM:   [════ Kimi K2.6 overflow ≈ 16GB ════] ← Cuando director-agent lo pide
VRAM:  [═══ Gemma4:27b ~18GB ═══]            ← Swap con Qwen3.6

OLLAMA_MAX_LOADED_MODELS=2  → Ollama gestiona el swap automáticamente
```

---

## Directorios del proyecto

```
BeZhas Blockchain/
├── aegis/              ← Seguridad, RBAC, audit, compliance
├── agent-lib/      ← Orquestador, agentes, HIL, memory
├── ai-engine/          ← XGBoost, LightGBM, IBKR, ML
├── openclaw/           ← Multi-model provider, ModelRouter
├── messaging-mcp/      ← Telegram MCP server (8 tools)
├── scripts/
│   ├── setup-windows.ps1
│   └── ollama-status.js
├── docker-compose.yml
├── package.json        ← Workspace raíz
└── .env                ← Config (NO commitear)
```

---

## Contratos canónicos

| Contrato | Red | Dirección |
|---|---|---|
| BEZ Token | Polygon | `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` |
| BEZ Token | BNB Chain | `0x8a1e3930fde1f151471c368fdbb39f3f63a65b55` |
| Treasury DAO | Polygon | `0x89c23890c742d710265dD61be789C71dC8999b12` |
| QualityEscrow | Polygon | `0x3EfC42095E8503d41Ad8001328FC23388E00e8a3` |
| Hot Wallet | Polygon | `0x52Df82920CBAE522880dD7657e43d1A754eD044E` |
