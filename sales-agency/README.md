# BeZhas Sales Agency

Agencia de ventas autónoma para BEZ-Coin y plataforma BeZhas B2B.

## Qué hace

1. **Scout**: Busca empresas reales por sector usando Claude + web search
2. **Score**: Puntúa cada lead del 0-100 (HOT ≥70, WARM 50-69, COLD <50)
3. **Email**: Envía primer contacto personalizado por IA (sin mencionar blockchain)
4. **Follow-up**: Sigue up automáticamente en días 4, 9, 16 y 25
5. **Telegram**: Alertas de leads HOT y reporte diario

## Setup (5 minutos)

```bash
cd sales-agency
cp .env.example .env
# Editar .env con tus credenciales
pnpm install
```

### Credenciales necesarias

| Variable | Dónde obtener |
|----------|---------------|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `GMAIL_USER` | Tu email Gmail |
| `GMAIL_APP_PASSWORD` | myaccount.google.com/apppasswords |
| `TELEGRAM_BOT_TOKEN` | @BotFather en Telegram |
| `TELEGRAM_CHAT_ID` | Escribe /start a @userinfobot |

## Uso

```bash
# Windows — doble clic
START.bat

# Terminal
node index.js               # Daemon (cron automático)
node index.js --mode=scout  # Scout + emails ahora mismo
node index.js --mode=followup # Solo procesar follow-ups
node index.js --mode=status   # Ver estado en consola
node index.js --mode=report   # Enviar reporte a Telegram
```

## Sectores activos

- **logistica** — Transitarios, aduanas, Algeciras
- **alimentacion** — Exportadores agroalimentarios, cooperativas
- **energia** — Empresas renovables, créditos carbono
- **crypto** — Inversores crypto España/Europa

## Archivos de datos

```
sales-agency/data/
├── leads.json      ← CRM completo (editable)
└── activity.log    ← Log de todas las acciones
```

## Cómo marcar un lead como cerrado (venta)

Editar `data/leads.json` y cambiar `"status": "demo_booked"` o `"status": "sold"`.
El lead sale del pipeline de follow-ups automáticamente.

## Límites

- `MAX_EMAILS_PER_DAY=30` — no quemar el dominio Gmail
- `MAX_LEADS_PER_SCOUT=5` — por sector por ejecución
- Rate limit entre emails: 3 segundos
