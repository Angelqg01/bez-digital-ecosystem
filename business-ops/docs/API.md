# API REST

Base: `http://localhost:4000`.

Autenticación:

- `/` y `/signup` son públicos. `/signup` puede exigir `x-signup-secret` si existe
  `SIGNUP_SECRET`.
- Las rutas `/tenants/:tenantId/*` requieren `x-api-key` del tenant o la clave admin
  `INTERNAL_API_KEY`.
- Los webhooks `/channels/:channel/:tenantId/inbound` se validan con el secreto propio
  del canal, no con la clave del tenant.

Los endpoints sin API key se autentican con una firma o un secreto, y **sin él configurado
quedan cerrados**, nunca abiertos: `/webhooks/stripe/:tenantId` exige la firma HMAC de
Stripe sobre el cuerpo **crudo** (una firma legítima reutilizada sobre otro cuerpo no vale),
`/webhooks/leads/:tenantId` responde 503 sin `LEADS_WEBHOOK_SECRET`, y `/csat/:token` solo
acepta enlaces firmados y sin caducar. El único que escribe sin credencial es
`/intake/:tenantId`, el formulario público, y por eso lleva honeypot, consentimiento RGPD
obligatorio, throttle por IP y techo de cola.

Todo esto está cubierto por `test/http-api.test.js`, que levanta el servidor real y le
habla por HTTP.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Salud del sistema |
| POST | `/signup` | Alta self-service y emisión de API key |
| POST | `/tenants` | Alta de empresa cliente por operador admin |
| POST | `/tenants/:tenantId/handle` | Procesar solicitud de cliente final |
| GET | `/tenants/:tenantId/tasks/:taskId` | Estado de una tarea |
| GET | `/tenants/:tenantId/approvals` | Aprobaciones HITL pendientes |
| POST | `/tenants/:tenantId/approvals/:approvalId` | Resolver una aprobación |
| ALL | `/channels/:channel/:tenantId/inbound` | Entrada síncrona/asíncrona por web, Telegram, WhatsApp o email |
| POST | `/tenants/:tenantId/kb` | Ingesta de artículos en la base de conocimiento |
| GET | `/tenants/:tenantId/support/metrics` | KPIs de Soporte |
| GET | `/tenants/:tenantId/policies` | Ver políticas del tenant |
| PUT | `/tenants/:tenantId/policies/:category` | Endurecer una categoría (`always_approve` o `block`) |
| DELETE | `/tenants/:tenantId/policies/:category` | Retirar una política personalizada |
| GET | `/tenants/:tenantId/events` | Stream SSE para el panel (`?key=<apiKey>`) |
| GET | `/tenants/:tenantId/dashboard` | Estado agregado para la consola |
| GET | `/tenants/:tenantId/billing/invoice` | Previsualización de factura |
| GET | `/tenants/:tenantId/usage` | Consumo, coste y límites del tenant |
| PUT | `/hitl/telegram` | Configurar chat Telegram de HITL por departamento (admin) |

## Ejemplos

**Alta de tenant**
```json
POST /signup
{ "tenantId": "acme", "plan": "pro", "departments": ["sales", "support"] }
```
Devuelve una `apiKey` que debe guardarse: no se puede recuperar después.

**Solicitud de cliente final**
```json
POST /tenants/acme/handle
{ "text": "Quiero una demo y precio", "channel": "web", "customerId": "c1" }
→ { "ok": true, "taskId": "t_..." }
```

**Resolver aprobación HITL**
```json
POST /tenants/acme/approvals/appr_123
{ "approved": true, "note": "visto bueno del director comercial" }
```

**Cargar conocimiento de Soporte**
```json
POST /tenants/acme/kb
{
  "title": "Cambios de plan",
  "body": "Los cambios de plan se aplican en la siguiente factura.",
  "tags": ["facturacion", "planes"]
}
```

**Política del tenant**
```json
PUT /tenants/acme/policies/outbound
{ "rule": "always_approve" }
```
