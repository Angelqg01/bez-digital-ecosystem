# OpenClaw Setup Guide for BeZhas Commercial Operations

## Prerequisites

- **Windows 10+** (WSL2 recommended for full experience, but native works)
- **Node.js 24** (already installed per project requirements)
- **API key from a model provider:**
  - **Gemini** (recommended for high-volume SDR/prospecting — faster, cheaper)
  - **Claude Opus** (recommended for proposal writing, negotiation, complex scoping)
  - You can use both: Gemini for SDR cadence, Opus for AE/SE work

## Step 1: Install OpenClaw

```powershell
# Windows PowerShell
powershell -c "irm https://openclaw.ai/install.ps1 | iex"
```

## Step 2: Run Onboarding

```bash
openclaw onboard --install-daemon
```

The wizard will ask for:
1. Model provider (choose Anthropic for Claude Opus, or Google for Gemini)
2. API key
3. Gateway configuration (accept defaults)

## Step 3: Verify Gateway

```bash
openclaw gateway status
# Should show: Gateway listening on port 18789
```

## Step 4: Copy BeZhas Skills

Copy the 4 skills from this repo into your OpenClaw workspace:

```powershell
# From the project root
Copy-Item -Recurse "openclaw\skills\*" "$HOME\.openclaw\skills\" -Force
```

Or for workspace-level (higher precedence):

```powershell
mkdir -Force "$HOME\.openclaw\workspace\skills"
Copy-Item -Recurse "openclaw\skills\*" "$HOME\.openclaw\workspace\skills\" -Force
```

## Step 5: Configure Skills in openclaw.json

Edit `~/.openclaw/openclaw.json` and add:

```json
{
  "skills": {
    "entries": {
      "bezhas-growth": {
        "enabled": true,
        "config": {
          "apiUrl": "http://localhost:3001",
          "defaultSector": "logistics"
        }
      },
      "sdr-outreach": {
        "enabled": true
      },
      "solutions-engineer": {
        "enabled": true
      },
      "deal-bridge": {
        "enabled": true
      }
    }
  }
}
```

## Step 6: Connect Chat Channel

### Telegram (Recommended — fastest setup)
1. Create a bot via @BotFather on Telegram
2. Get the bot token
3. In OpenClaw dashboard, connect Telegram with the token
4. Now you can talk to your BeZhas Growth agent from your phone

### Discord (Team use)
1. Create a Discord bot at discord.com/developers
2. Install the Discord skill: `clawhub install discord`
3. Configure in openclaw.json

### WhatsApp
1. Install: `clawhub install wacli`
2. Scan QR code from OpenClaw dashboard

## Step 7: Connect BeZhas Backend (Optional — for live data)

If your BeZhas stack is running locally (`docker compose up`):

```bash
# In your OpenClaw session, tell the agent:
"Connect to BeZhas API at http://localhost:3001. 
My admin token is [your JWT token from /api/auth/login].
Use this to pull real contract data and sector info when preparing proposals."
```

The agent will use the SDK's CommercialAPIClient to:
- Pull real sector capabilities for proposals
- Check contract deployment status before promising features
- Get platform analytics for sales pitches

## Step 8: Test Each Skill

Open the OpenClaw dashboard or your connected chat app and test:

```
/bezhas-growth Qualify this lead: TechLogistics Corp, a $50M freight forwarder in Spain, 
CTO Juan García, looking to digitize proof-of-delivery. They use SAP WMS.

/sdr-outreach Write a Day 1 cold email for Juan García, CTO of TechLogistics Corp, 
about tokenized proof-of-delivery using SupplyTracker.sol

/solutions-engineer Scope an integration for a freight forwarder using SAP WMS 
that wants proof-of-delivery on blockchain. They process 500 shipments/day.

/deal-bridge Convert this technical scope into a CFO-ready executive summary 
for TechLogistics Corp.
```

## Using Multiple Models

For optimal cost/quality balance:

```json
{
  "models": {
    "default": "gemini-2.5-flash",
    "skills": {
      "sdr-outreach": "gemini-2.5-flash",
      "bezhas-growth": "claude-opus-4",
      "solutions-engineer": "claude-opus-4",
      "deal-bridge": "claude-opus-4"
    }
  }
}
```

- **Gemini Flash**: SDR cadence (high volume, personalization at scale)
- **Claude Opus**: Growth strategy, technical scoping, executive comms (quality-critical)

## Gemini Gem Configuration (Google AI Studio)

If you also want a standalone Gem in Google AI Studio that interfaces with your OpenClaw agent:

### Create the Gem

1. Go to aistudio.google.com → Gems
2. Create new Gem named "BeZhas Deal Bridge"
3. Paste this system instruction:

```
You are BeZhas Deal Bridge, a specialized business communication translator 
for BeZhas Blockchain — a Layer 2 enterprise blockchain with 72+ smart contracts 
across 16 industry sectors.

Your role:
- Receive technical briefs about BeZhas integrations and translate them into 
  executive-ready communications for CTO, COO, CFO, or board audiences.
- Every output must include: Executive Summary, Impact Analysis, Risk Assessment, 
  and a clear Call to Action.
- Never fabricate metrics. If a number isn't provided, write "to be validated 
  during pilot."
- Match tone to audience: CFO (numbers-first), COO (process-first), 
  CTO (architecture-first), Board (strategic narrative).

Key terminology translations:
- Smart contract → Automated business rule executing without intermediaries
- Non-custodial → Client controls their own assets, BeZhas cannot access them
- Gasless (Paymaster) → End-users pay zero fees, enterprise absorbs via pre-funded pool
- Account Abstraction → Simple login, no crypto wallets or seed phrases
- L2 / Layer 2 → Faster, cheaper blockchain inheriting Ethereum's security
- MCP / AI Engine → Built-in AI monitoring transactions and predicting costs
- SoulBound Token → Non-transferable digital certificate linked to an entity

Platform facts you can cite:
- 72+ smart contracts, 931+ tests (all passing)
- 16 industry sectors covered
- SDK with npm install, <1 week for MVP integration
- Gasless B2B via Paymaster contract
- Non-custodial wallets with social recovery
- On-chain audit trail, RBAC, circuit breakers, timelock
```

4. Save and test with a sample technical brief

## Automation: BeZhas OpenClaw AI Scheduler (GCP & Local)

El sistema comercial cuenta con un planificador inteligente programado (`openclaw_scheduler.py`) que lee dinámicamente los prompts comerciales en `D:\OpenClawData\Promts` y ejecuta flujos de alta capacidad de acción según el horario:

### 1. Horarios de Operación
- **Mañana (9:00 AM - 10:00 AM)**: Búsqueda activa de prospectos nominales en los 16 sectores ICP, cálculo del Fit Score, cualificación (BANT+) y generación automatizada de los métodos de contacto (Day 1 Cold Email y LinkedIn DM).
- **Noche (11:00 PM - 12:00 AM)**: Revisión de respuestas recibidas en las bandejas (Gmail API), clasificación de sentimiento/tipo (interés, dudas, objeciones) y generación de borradores de respuesta específicos y Plan de Acción comercial (AE & M&A).

### 2. Ejecución del Scheduler

Puedes iniciar el planificador en segundo plano (modo Daemon) para producción o GCP:
```bash
python openclaw_scheduler.py --daemon
```

### 3. Disparadores Manuales e Inmediatos (Pruebas)
Para ejecutar y verificar de forma inmediata cada ciclo de prospección/auditoría sin esperar al horario correspondiente:

- **Prospección y Mensajes de Contactar (Ciclo Mañana)**:
  ```bash
  python openclaw_scheduler.py --trigger morning
  ```

- **Revisión de Respuestas y Plan de Acción (Ciclo Noche)**:
  ```bash
  python openclaw_scheduler.py --trigger night
  ```

Los informes markdown resultantes se persistirán con marcas de tiempo en el directorio `openclaw/logs/` para revisión y control humano.


## Security Notes

- Never paste API keys or JWTs directly into OpenClaw chat — use environment variables
- Enable human approval for all outbound messages (proposals, emails, contracts)
- Review agent outputs before sending to clients — AI can hallucinate metrics
- Keep BeZhas API behind firewall; only expose to OpenClaw via localhost
- Audit agent actions via the on-chain audit log in PostgreSQL
