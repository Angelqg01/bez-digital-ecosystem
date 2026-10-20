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
| Identity & Security | `team-invitations-stalled` | invitaciones de equipo sin aceptar > 14 días, por rol (`organization_members`) | hr |
| Identity & Security | `access-review-due` | cada 90 días: revisión de accesos (recuentos de miembros por estado y de owner/admin activos) | hr |
| Treasury & Web3 | `investor-update-due` | cada 30 días: borrador del informe a inversores desde métricas agregadas (suscripciones activas, compras de plan y de BEZ, validadores activos) | fundraising |
| Ecosystem & RWA | `sales-intake-backlog` | ≥ 5 leads en la cola del formulario que el embudo no absorbe (OPERANT `/funnel`) | sales |
| Treasury & Web3 | `past-due-subscriptions` | suscripciones en mora (`gateway_subscriptions`) | finance |
| Treasury & Web3 | `failed-payments` | ≥ 3 pagos fallidos en 7 días (`payment_transactions`) | finance |
| Treasury & Web3 | `treasury-intents-stuck` | movimientos `awaiting_approval` / `awaiting_manual_execution` / `failed_needs_review` > 24 h (`tx_intents`) | treasury |
| MCP Intelligence | `rag-coverage` | ≥ 25 % de consultas del chat sin cobertura (métrica `bezhas_ai_retrieval_total`, mínimo 20) | support |
| Obsidian Map | `marketing-drafts-due` | borradores de la cola social sin aprobar que tocan en < 24 h (OPERANT `/marketing/queue`) | marketing |
| Brain Live | `validators-silent` | validadores que latieron ayer y no hoy (solo desde las 12:00 UTC) o penalizaciones en 7 días (`validator_heartbeats`, `validator_slashes`) | blockchain |
| Identity & Security | `dmarc-health` | mensajes que no pasan DMARC (digest del buzón) | operations |
| Watchdog | `operant-failures` | tareas recientes fallidas o interrumpidas | operations |
| DAO Governance | `audit-chain` | verificación de la cadena de auditoría | legal |

### Cobertura por departamento de OPERANT

Los 10 departamentos tienen al menos una señal propia. Dos de ellos, `hr` y `fundraising`, no tienen datos personales ni de correo de los que partir (y no se leen), así que su señal es **de cadencia** y usa solo agregados:

- `hr`: invitaciones de equipo atascadas y la revisión trimestral de accesos. La tarea recibe recuentos por rol o estado, nunca nombres ni correos.
- `fundraising`: el informe mensual a inversores. La tarea recibe las métricas medidas; las que no se pueden medir se le dicen como **pendientes** (no se rellenan ni se estiman), no puede citar cifras que no estén en el mensaje y debe dejar claro que el token es de utilidad, no una inversión.

Las señales de cadencia miden contra la última vez que el panel lanzó esa misma automatización (`admin_automation_runs`): lanzarla a mano o «forzar» reinicia el ciclo. Sin poder leer el registro, no actúan.

La pestaña muestra esta cobertura (`GET /automations` → `coverage`).

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
| `ADMIN_OPERANT_CACHE=off` | Desactiva la caché corta de lecturas del panel. |

Ejemplo (no ejecutado; el token va en Secret Manager, no en el comando):

```bash
gcloud scheduler jobs create http bezhas-admin-automation \
  --schedule="0 * * * *" --uri="https://api.bezhas.com/api/admin/operant/automations/tick" \
  --http-method=POST --headers="x-automation-token=$(gcloud secrets versions access latest --secret=admin-automation-token)"
```

## Rendimiento

Las lecturas del panel (`status`, `overview`, `approvals`, `audit/verify`, bandeja y DMARC) se cachean unos segundos (10–30 s) y las peticiones simultáneas comparten una sola llamada: cada una abría una conexión a OPERANT y, la bandeja, otra IMAP (2–4 s). Los errores no se cachean y cualquier escritura vacía la caché. `ADMIN_OPERANT_CACHE=off` la desactiva.

## Antes de activarlo en producción

1. Aplicar la migración `068` (es aditiva: una tabla y un índice).
2. OPERANT desplegado como servicio privado y `OPERANT_INTERNAL_KEY` / `OPERANT_API_URL` en la API.
3. `rag-coverage` usa un contador por instancia: con varias instancias de Cloud Run cada una ve solo el suyo (ver "Límites").

## Límites conocidos

- La métrica del RAG es por instancia y se reinicia con cada despliegue; solo da una idea de la cobertura.
- Las señales SQL (`plan_purchases`, `gateway_subscriptions`, `payment_transactions`, `onboarding_sessions`, `validator_*`, `tx_intents`, `organization_members`) se validaron contra un Postgres 16 desechable con datos de prueba, no contra Cloud SQL.
- Aprobar y rechazar se probó con aprobaciones reales de OPERANT (transferencias simuladas, sin clave ni correo): el rechazo no ejecuta nada y la aprobación ejecuta una sola vez.
- Los registros de auditoría de OPERANT guardados antes de la corrección de `undefined` (commit `d7ed4800`) no se pueden reparar y seguirán fallando al verificarse.
