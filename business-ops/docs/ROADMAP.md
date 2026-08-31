# Roadmap de construcción

No construyas las capas a la vez. Saca un vertical funcional de punta a punta primero.

> **Estado a julio 2026:** las 6 fases del blueprint original están cerradas. El roadmap
> vivo es ahora el del **stack soberano** (`STACK-SOBERANO.md` §4), que va de "funciona
> con APIs de pago" a "funciona con infraestructura propia". Detalle de ingeniería por
> fase en `PLAN-DESARROLLO.md`.

## Fase 1–6 (blueprint original) — cerradas

| Fase | Qué | Estado | Dónde verificarlo |
|---|---|---|---|
| 1 | Núcleo de un solo tenant (orquestador + cola + BaseAgent + HITL) | ✅ | `test/foundations.test.js`, `test/hitl.test.js` |
| 2 | Memoria + aprendizaje (vector DB, RAG, feedback) | ✅ | `test/vector-recall.test.js`, `test/learning.test.js` |
| 3 | Multi-tenancy real (Postgres RLS, namespaces, planes) | ✅ | `test/store.test.js`, `test/sqlite-store.test.js` |
| 4 | Los 6 departamentos (Ventas, Soporte, Marketing, Finanzas, RR.HH., Operaciones) | ✅ | `test/finance-marketing.test.js`, `test/hr-operations.test.js` |
| 5 | Panel de control + onboarding self-service + facturación | ✅ | `test/dashboard.test.js`, `test/onboarding.test.js`, `test/billing.test.js` |
| 6 | Guardrails de producción + observabilidad + evals | ✅ | `test/policies.test.js`, `test/telemetry.test.js`, `evals/` |

Además, fuera del plan original: durabilidad de tareas y HITL tras reinicio, tool-use con
guardrails por invocación, adaptador MCP, agentes proactivos (Scheduler), digest del CEO,
perfil de negocio por tenant y motor IA local (Ollama). Ver la tabla de estado del `README.md`.

## Regla de oro

Un cliente real usando **un** departamento de verdad > seis departamentos a medias sin
usuarios. Saca valor end-to-end rápido, véndelo, y deja que los clientes reales te digan
qué construir después.

## Roadmap activo: stack soberano

| Fase | Qué | Estado |
|---|---|---|
| A | Cimientos soberanos (Postgres+pgvector, Valkey, MinIO, Ollama, FileSystem sandbox) | ✅ **Cerrada.** Verificada contra los servicios vivos con `npm run pilot` (30 comprobaciones): Postgres+pgvector con RLS, MinIO real, Ollama generando y embebiendo en local |
| B | Primer vertical propio: Ventas + CRM (Twenty, email propio, n8n) | 🟡 Twenty ✅ · email propio ✅ · n8n ✅ conector · pendiente cablear workflows reales |
| C | Comunicaciones (Chatwoot omnicanal, WhatsApp, llamadas IA con PBX+Whisper+TTS) | 🔲 |
| D | Banco y finanzas (ledger doble entrada, BTCPay, Invoice Ninja, HITL absoluto) | 🔲 |
| E | Resto de departamentos sobre ERPNext (HR, inventario, compras, contabilidad) | 🔲 |
| F | Continuo: SigNoz, evals, LearningEngine | 🟡 Evals ✅ · LearningEngine ✅ · exportador OTLP pendiente |

## Siguientes pasos inmediatos

Lo que bloquea cerrar las fases A y B — todo es **verificación contra servicios vivos**,
no código nuevo:

1. ~~Levantar los cimientos y probarlos de verdad~~ — **hecho**. Reproducible:
   ```bash
   docker compose -f infra/docker-compose.full.yml --profile core up -d
   npm i minio                     # declarado en optionalDependencies
   docker exec operant-ollama-1 ollama pull nomic-embed-text
   docker exec operant-ollama-1 ollama pull qwen2.5:3b     # o el que quepa en tu RAM

   # Postgres: migrar con el rol DUEÑO, ejecutar con el rol de aplicación.
   PG_APP_PASSWORD='<contraseña>' \
     DATABASE_URL=postgres://operant:operant@localhost:5432/operant npm run db:migrate

   DATABASE_URL=postgres://operant_app:'<contraseña>'@localhost:5432/operant npm test
   DATABASE_URL=postgres://operant_app:'<contraseña>'@localhost:5432/operant npm run pilot
   ```
   `npm run pilot` (`test/pilot-bezhas.js`) recorre el tenant BeZhas de punta a punta contra
   los servicios vivos y da un informe de 30 comprobaciones. No toca nada hacia fuera:
   arranca sin credenciales de Telegram, Stripe, correo ni wallet.
2. **Cablear los primeros workflows de n8n** (cierra Fase B): el conector
   (`connectors/AutomationConnector.js`) y su política ya están; falta crear en n8n los
   workflows que consumen los eventos del bus (lead creado → CRM, factura emitida → correo)
   y apuntar `N8N_API_URL`.
3. **Exportador OTLP** a SigNoz — la telemetría ya tiene forma OTel, falta el transporte
   y las alertas.
4. **Verificar la ruta Stripe real** (hoy sin claves, sin verificar) y el correo propio
   con Stalwart (IP + SPF/DKIM/DMARC).

> Recordatorio del principio rector: antes de abrir la Fase C, conviene tener **un cliente
> real** usando el vertical de Ventas soberano de punta a punta.
