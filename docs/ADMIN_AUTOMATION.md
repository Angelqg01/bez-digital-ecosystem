# Automatización del panel SuperAdmin con OPERANT

La pestaña **OPERANT** de `/admin/profile` conecta cada sección del panel con un
departamento de OPERANT. Código: `api/services/adminAutomation.js`, rutas en
`api/routes/admin-operant.js`, registro en la migración `068_admin_automation.sql`.

## Qué hace

Cada automatización mide una **señal** de solo lectura y, si pide acción, lanza
una **tarea** al departamento. Las señales son agregados (recuentos, tasas): ni
emails de clientes, ni chats, ni correos entran en la tarea.

| Sección del panel | Automatización | Señal | Departamento |
|---|---|---|---|
| Ecosystem & RWA | `pending-plan-assignments` | compras de plan pagadas sin asignar (`plan_purchases`) | support |
| Ecosystem & RWA | `stuck-onboarding` | altas sin completar > 3 días (`onboarding_sessions`) | support |
| Treasury & Web3 | `past-due-subscriptions` | suscripciones en mora (`gateway_subscriptions`) | finance |
| Treasury & Web3 | `failed-payments` | ≥ 3 pagos fallidos en 7 días (`payment_transactions`) | finance |
| MCP Intelligence | `rag-coverage` | ≥ 25 % de consultas del chat sin cobertura (métrica `bezhas_ai_retrieval_total`, mínimo 20) | support |
| Identity & Security | `dmarc-health` | mensajes que no pasan DMARC (digest del buzón) | operations |
| Watchdog | `operant-failures` | tareas recientes fallidas o interrumpidas | operations |
| DAO Governance | `audit-chain` | verificación de la cadena de auditoría | legal |

Además, **Sincronizar RAG → OPERANT** copia a la base de conocimiento de OPERANT
la documentación **pública** del RAG (global, publicada, `PUBLIC`), para que
Soporte conteste con la misma verdad que el chat. Es idempotente (`rag:<id>`).

## Garantías

- Una señal que no se puede medir sale como **sin datos**, con el motivo. Nunca "todo bien" inventado.
- La misma señal no crea la misma tarea dos veces durante `ADMIN_AUTOMATION_COOLDOWN_HOURS` (24 por defecto).
- Sin la tabla `admin_automation_runs` **no se lanza nada** (ni con «forzar»): sin registro no hay enfriamiento ni auditoría.
- Las escrituras exigen sesión SuperAdmin **y** la cabecera `x-bezhas-admin: 1` (fuerza el preflight de CORS). Cada una deja una fila con el actor.
- Lo que la tarea haga hacia fuera (enviar, mover dinero, tocar contratos) lo frenan las líneas rojas y la cola de aprobación de OPERANT; este módulo solo pide trabajo.

## Ejecución programada

`POST /api/admin/operant/automations/tick` evalúa todo y lanza lo que toque.
Para Cloud Scheduler hace falta un token propio, porque no hay sesión de admin:

| Variable | Efecto |
|---|---|
| `ADMIN_AUTOMATION_TOKEN` | ≥ 32 caracteres. Sin él, la puerta del programador está cerrada. Cabecera: `x-automation-token`. |
| `ADMIN_AUTOMATION_ENABLED=false` | Apaga el tick (503). |
| `ADMIN_AUTOMATION_COOLDOWN_HOURS` | Enfriamiento por señal (24). |

Ejemplo (no ejecutado; el token va en Secret Manager, no en el comando):

```bash
gcloud scheduler jobs create http bezhas-admin-automation \
  --schedule="0 * * * *" --uri="https://api.bezhas.com/api/admin/operant/automations/tick" \
  --http-method=POST --headers="x-automation-token=$(gcloud secrets versions access latest --secret=admin-automation-token)"
```

## Antes de activarlo en producción

1. Aplicar la migración `068` (es aditiva: una tabla y un índice).
2. OPERANT desplegado como servicio privado y `OPERANT_INTERNAL_KEY` / `OPERANT_API_URL` en la API.
3. `rag-coverage` usa un contador por instancia: con varias instancias de Cloud Run cada una ve solo el suyo (ver "Límites").

## Límites conocidos

- La métrica del RAG es por instancia y se reinicia con cada despliegue; solo da una idea de la cobertura.
- Las señales de `plan_purchases`, `gateway_subscriptions`, `payment_transactions` y `onboarding_sessions` se validaron contra un Postgres 16 desechable con datos de prueba, no contra Cloud SQL.
- Resolver aprobaciones desde el panel está probado con el puente simulado; no se probó con una aprobación real de OPERANT.
