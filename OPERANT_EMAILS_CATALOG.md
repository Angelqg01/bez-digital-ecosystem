# Catálogo Completo de Correos Generados en Operant para BeZhas

**Última actualización:** 2026-09-20  
**Fuente:** `business-ops/src/agents/` — 6 agentes con generación de emails  
**Dominio:** @bezhas.com (Hostinger Mail)

---

## 📋 Resumen ejecutivo

Operant genera **6 tipos de correos** desde 4 departamentos:

| Departamento | Email | Agente | Tipo | Asunto | Dinámico |
|:---|:---|:---|:---|:---|:---:|
| **Ventas** | `ventas@bezhas.com` | OutreachAgent | 1er contacto B2B | `Contacto {empresa}` | ✅ |
| **Ventas** | `ventas@bezhas.com` | FollowUpAgent | Seguimiento | `Seguimiento · {empresa}` | ✅ |
| **Ventas** | `ventas@bezhas.com` | ProposalGeneratorAgent | Propuesta comercial | `Propuesta para {empresa}` | ❌ |
| **Finanzas** | `facturacion@bezhas.com` | InvoiceBot | Factura + pago | `Factura y enlace de pago - {cliente}` | ❌ |
| **Operaciones** | `operations@bezhas.com` | VendorCommsAgent | Proveedor | `{proveedor} — {motivo}` | ✅ |
| **Fundraising** | `investorelations@bezhas.com` | InvestorOutreachAgent | Contacto inversor | `Contacto {fondo}` | ✅ |

---

## 🏢 Departamento: VENTAS (3 agentes)

### 1. **OutreachAgent** → Primer Contacto Comercial

**ID:** `sales.outreach`  
**Tier LLM:** frontier (Opus)  
**Redacción:** Por el modelo (dinámica, per-lead)  
**Líneas rojas:**
- ❌ Cuenta en lista de exclusión (Acuerdos V1, partners confirmados)
- ❌ Cuenta en "Do Not Contact List" (dinámica, gestionada por tenant)
- 🔴 HITL obligatorio para contacto en frío (`cold_outbound`)

**Estructura del correo:**
```
Asunto: [DINÁMICO: extraído del draft por el modelo]
De:    {tenant.business.signature || firma predeterminada}
Para:  {lead.email}

Cuerpo:
-------
Saludo: Dirigido al contacto específico (lead.contact o rol de lead.role)
Valor:  Un solo caso de uso (ej: validación operativa, smart escrow)
CTA:    Derivación o llamada de 10 minutos
Firma:  Firma de la empresa (empresa/CEO)
```

**Ejemplo de salida:**
```
Asunto: Validación operativa de tu cadena de suministro
De:    Yoel (BeZhas)
Para:  director@logistica.es

Hola María,

Vi que Logística XYZ maneja 500+ envíos semanales en rutas EU-LATAM.
¿Te interesaría reducir un 40% de fricción en el settlement post-entrega?

Smart escrow: se libera el pago automáticamente cuando el cliente 
verifica. Sin intermediarios, sin esperas de 7 días.

¿Una llamada rápida (10 min) la próxima semana?

Yoel
BeZhas
```

**Segmentación:**
- Se clasifica a cada lead por segmento (`business.segmentOf(lead)`)
- Tono ajustado al segmento (CEO, ops, logística, legal, etc.)

**Condiciones:**
- Sin email de contacto → `{skipped: true, reason: 'sin email de contacto'}`
- Lead excluido o en DNC → `{status: 'blocked'}`
- Si sale de HITL → envío real al agente de email

---

### 2. **FollowUpAgent** → Seguimiento a Prospecto Silencioso

**ID:** `sales.followup`  
**Tier LLM:** mid (Sonnet)  
**Redacción:** Por el modelo (breve, máx 5 líneas)  
**Estrategia:** Política determinista (`platform/followUpPolicy`) — no decide el agente cuándo/si insistir

**Política de intentos:**
- Intento 1: +2 días de inactividad
- Intento 2: +3 días
- Intento 3: +4 días
- Máximo: 3 intentos (luego se cierra la secuencia)

**Estructura:**
```
Asunto: Seguimiento · {empresa}
Máx líneas: 5
Novedad obligatoria: dato, caso de uso, pregunta concreta (no repetir anterior)
Nunca: reproches, "solo por si acaso", "haciendo seguimiento"
Firma: De la empresa
```

**Líneas rojas:**
- 🔴 HITL obligatorio (`cold_outbound`: es contacto sin respuesta previa = frío)
- ❌ Blocado si lead en exclusión o DNC después de abierta la secuencia

**Conteo:** Solo sube si de verdad se envía (humano aprobó en HITL)

**Ejemplo:**
```
Asunto: Seguimiento · Logística XYZ

Hola,

Vi que en Portos EU el costo de settlement post-destino ronda 
el 8-12% del valor. En manufactura ES es más, casi el 15%.

¿Una charla de 15 min para ver si aplica en tu caso?

Yoel
```

---

### 3. **ProposalGeneratorAgent** → Propuesta Comercial con Precios Reales

**ID:** `sales.proposal`  
**Tier LLM:** frontier (Opus)  
**Redacción:** Modelo solo escribe prosa; importes los calcula el código (determinista)  
**Catálogo:** `platform/priceCatalog` (fuente de verdad de precios)

**Estructura:**
```
Asunto: Propuesta para {empresa}
De:     {tenant.business.signature}
Para:   {lead.email}

Cuerpo:
-------
Contexto: problema del cliente
Qué resuelve: beneficio clave
Líneas: [SKU | Descripción | Cantidad | Precio unitario | Total línea]
Subtotal: {monto}
Descuento (si aplica): {pct%} = -{monto}
Base imponible: {monto}
IVA: {monto}
TOTAL: {monto}
Siguiente paso: CTA
```

**Guardarraíles:**
1. **SKU desconocido → No hay propuesta.** Si el prospecto pide algo sin precio en catálogo, se rechaza con lista de SKUs disponibles
2. **Descuento > 15% → HITL obligatorio** (aprobación humana de margen)

**Línea roja:** `cold_outbound` + `pricing_concession` (si descuento fuerte)

**Ejemplo de respuesta:**
```json
{
  "status": "ok",
  "draft": "[propuesta redactada]",
  "quote": {
    "currency": "EUR",
    "lines": [
      {
        "sku": "ESCROW-MONTHLY",
        "description": "Smart Escrow + Settlement — hasta 500 ops/mes",
        "qty": 1,
        "unitPrice": "1500.00",
        "lineTotal": "1500.00"
      }
    ],
    "subtotalCents": 150000,
    "discountPct": 0,
    "vatCents": 31500,
    "totalCents": 181500,
    "total": "1.815,00 EUR"
  },
  "requiresApproval": false,
  "send": { "sent": true, "timestamp": "2026-09-19T10:32:00Z" }
}
```

---

## 💰 Departamento: FINANZAS (1 agente)

### **InvoiceBot** → Facturación Automatizada

**ID:** `finance.invoice-bot`  
**Tier LLM:** fast (Haiku)  
**Trigger:** Evento `sales:deal_won` (cuando se cierra un deal)  
**Integración:** Stripe (genera payment link)

**Estructura:**
```
Asunto: Factura y enlace de pago - {cliente}
De:     El equipo de Finanzas (BeZhas)
Para:   {clientEmail}

Cuerpo:
-------
Saludo: Hola,

Cuerpo:
- Adjuntamos detalles de tu factura
- Cliente: {cliente}
- Importe Total: {monto} EUR
- Enlace de Pago Seguro: {stripe_payment_link_url}

Cierre: Gracias por tu confianza.
Firma: El equipo de Finanzas.
```

**Campos:**
```js
{
  client: "Nombre Cliente",
  amount: 1815.00,  // EUR
  email: "cfo@empresa.es",
  items: [
    { sku: "ESCROW-MONTHLY", qty: 1, price: 1815.00 }
  ]
}
```

**Integración Stripe:**
```js
const paymentLink = await stripe.execute('createPaymentLink', {
  amount: 181500,  // cents
  customerId: "Empresa XYZ",
  description: "Factura por deal cerrado"
});
// Resultado: { url: "https://checkout.stripe.com/pay/cs_...", amount: 181500 }
```

**Eventos emitidos:**
- `finance:invoice_sent` — logs de auditoría (tenantId, cliente, monto, resultado)

**Ejemplo de respuesta:**
```json
{
  "client": "Logística XYZ S.L.",
  "amount": 1815.00,
  "paymentLink": {
    "url": "https://checkout.stripe.com/pay/cs_test_...",
    "amount": 181500
  },
  "emailResult": {
    "sent": true,
    "messageId": "msg_...",
    "timestamp": "2026-09-19T10:32:00Z"
  },
  "status": "completed"
}
```

---

## 🏭 Departamento: OPERACIONES (1 agente)

### **VendorCommsAgent** → Comunicación con Proveedores

**ID:** `operations.vendor-comms`  
**Tier LLM:** mid (Sonnet)  
**Tipos de mensaje:** RFQ (request for quote), seguimiento, confirmación

**Purposes soportados:**
```js
{
  'quote_request':         "Pide presupuesto para el material/servicio",
  'delay_followup':        "Pregunta firmeza pero cordialidad por retraso",
  'order_confirmation':    "Confirma términos: cantidades, precio, fecha"
}
```

**Estructura:**
```
Asunto: {proveedor} — {motivo}  [ej: "Acme Logistics — quote_request"]
De:     {tenant.business.signature}
Para:   {vendor.email}

Cuerpo:
-------
[Redactado por modelo]
Sin promesas económicas ni compromisos (eso lo decide Finanzas)
Firma: De la empresa
```

**Guardarraíles:**
- ❌ Sin email del proveedor → bloqueado
- 🔴 HITL si `cold: true` (primer contacto con nuevo proveedor)
- 🔄 Idempotencia: mismo proveedor + mismo purpose + misma referencia en el mismo día = no se reenvía

**Idempotencia:**
```
dedupeKey = "{vendor.email}|{purpose}|{referenceId}|{YYYY-MM-DD}"
storage: operations:vendor_comms_sent = { dedupeKey: { at: timestamp } }
```

**Líneas rojas:**
- `outbound` (comunicación externa)
- `cold_outbound` si es primer contacto (`cold: true`)
- `mass_outbound` si se dispara a muchos proveedores a la vez

**Ejemplo de tarea:**
```json
{
  "vendor": {
    "name": "Acme Logistics",
    "email": "buying@acmelogistics.com"
  },
  "purpose": "quote_request",
  "context": "Necesitamos transportar 50 contenedores 40ft EU→LATAM",
  "referenceId": "RFQ-2026-001",
  "cold": true
}
```

**Respuesta:**
```json
{
  "status": "ok",
  "draft": "[correo redactado]",
  "subject": "Acme Logistics — quote_request",
  "send": {
    "sent": true,
    "timestamp": "2026-09-19T11:00:00Z",
    "approvalRequired": true,
    "approvedBy": "admin@company.es"
  }
}
```

---

## 🚀 Departamento: FUNDRAISING (1 agente)

### **InvestorOutreachAgent** → Contacto con Inversores

**ID:** `fundraising.investor-outreach`  
**Tier LLM:** frontier (Opus)  
**Destinatarios:** VC, family office, fondos, inversores institucionales  
**Líneas rojas:** Mismo que sales (exclusión, DNC, HITL en frío)

**Estructura:**
```
Asunto: Contacto {fondo}
De:     {tenant.business.signature}
Para:   {lead.email}

Cuerpo:
-------
Saludo: A {contacto} ({rol}) de {fondo}
Tono: Ejecutivo, métricas concretas si aplican
Sin: Promesas de rentabilidad, cifras de retorno
CTA: Llamada 15-20 min o envío del deck
Firma: De la empresa
```

**Contexto predeterminado:**
```
"infraestructura Web3 B2B de BeZhas para logística/economía azul,
validación operativa y smart escrow"
```

**Condiciones:**
- Sin email → `{skipped: true, reason: 'sin email de contacto'}`
- Excluded → `{status: 'blocked'}`

**Líneas rojas:**
- 🔴 HITL obligatorio en frío (`cold_outbound`)
- ❌ Exclusión dura (cuentas donde BeZhas ya está financiada, etc.)

**Campos de entrada:**
```js
{
  lead: {
    contact: "Juan Martínez",
    contacto_nombre: "Juan Martínez",  // alias Spanish
    role: "Partner",
    contacto_cargo: "Partner",  // alias Spanish
    company: "Anterra Ventures",
    empresa: "Anterra Ventures",  // alias Spanish
    email: "juan@anterra.vc"
  },
  context: "[Opcional] Tracción a destacar, métricas, etc.",
  cold: true  // si es primer contacto
}
```

**Respuesta:**
```json
{
  "draft": "[correo redactado]",
  "subject": "Contacto Anterra Ventures",
  "cold": true,
  "send": {
    "sent": true,
    "timestamp": "2026-09-19T14:15:00Z"
  },
  "status": "ok"
}
```

---

## 🔐 Reglas Globales de Generación de Emails

### Líneas Rojas (Guardarraíles Duros)

| Línea Roja | Condición | Acción |
|:---|:---|:---|
| `cold_outbound` | 1er contacto (lead sin respuesta previa, proveedor nuevo, etc.) | **HITL obligatorio** antes de enviar |
| `pricing_concession` | Descuento > 15% en propuesta | **HITL obligatorio** (no lo decide el agente) |
| `mass_outbound` | Más de N envíos en tiempo T | **HITL obligatorio** (límite configurable) |
| `excluded_account` | Cuenta en lista de exclusión (Acuerdos V1, etc.) | **Bloqueo duro** (no se redacta ni se envía) |
| `do_not_contact` | Cuenta en DNC list (dinámica, tenant-managed) | **Bloqueo duro** + auditoría |

### Campos Estándar de Acción

```js
await this.act({
  category: 'outbound',        // tipo de acción (outbound, inbound, etc.)
  cold: boolean,               // si es contacto en frío
  tool: 'email',              // herramienta (email, sms, etc.)
  method: 'send',             // método (send, draft, etc.)
  recipientCount: 1,          // cuántos van a recibir
  args: {
    to: "email@dest.com",
    subject: "...",
    body: "..."
  }
});
```

### Auditoría

Cada email:
1. **Se registra en PolicyEngine** (guardarraíles)
2. **Se emite un evento** en el bus de eventos:
   - `sales:outreach_blocked` — outreach rechazado
   - `sales:outreach_sent` — outreach enviado
   - `finance:invoice_sent` — factura generada
   - etc.
3. **Se guarda en memoria** (remember) con contexto para sesiones futuras

### De/Para Dinámico

| Campo | Fuente |
|:---|:---|
| **De:** | `business.senderFor(department)` ← firma registrada del tenant por departamento |
| **Para:** | `lead.email` o `vendor.email` o `clientEmail` |
| **Asunto:** | Hardcoded o extraído del draft (modelo busca `Asunto:` en línea 1) |
| **Cuerpo:** | Redactado por el modelo (frontier/mid) o hardcoded (fast) |

---

## 📊 Estadísticas

| Métrica | Valor |
|:---|:---:|
| **Total de agentes con email** | 6 |
| **Departamentos cubiertos** | 4 (Ventas, Finanzas, Ops, Fundraising) |
| **Correos dinámicos (LLM)** | 5 (OutreachAgent, FollowUpAgent, VendorCommsAgent, InvestorOutreachAgent, ProposalGeneratorAgent) |
| **Correos semi-dinámicos (template + variables)** | 1 (InvoiceBot) |
| **Líneas rojas implementadas** | 5 (cold_outbound, pricing_concession, mass_outbound, excluded, dnc) |
| **Tier LLM más usado** | frontier (3 agentes: Outreach, Proposal, InvestorOutreach) |

---

## 🔗 Referencias de Código

| Componente | Ruta |
|:---|:---|
| **OutreachAgent** | `business-ops/src/agents/sales/OutreachAgent.js` |
| **FollowUpAgent** | `business-ops/src/agents/sales/FollowUpAgent.js` |
| **ProposalGeneratorAgent** | `business-ops/src/agents/sales/ProposalGeneratorAgent.js` |
| **InvoiceBot** | `business-ops/src/agents/finance/InvoiceBot.js` |
| **VendorCommsAgent** | `business-ops/src/agents/operations/VendorCommsAgent.js` |
| **InvestorOutreachAgent** | `business-ops/src/agents/fundraising/InvestorOutreachAgent.js` |
| **Policy: Follow-up** | `business-ops/src/platform/followUpPolicy.js` |
| **Catálogo precios** | `business-ops/src/platform/priceCatalog.js` |
| **Base channel email** | `business-ops/src/channels/EmailChannel.js` |
| **Connector email** | `business-ops/src/connectors/EmailConnector.js` |

---

## 💡 Notas Importantes

1. **No hay templates en HTML/CSS**: Todos los correos son **plain text** (UTF-8)
2. **Firma de empresa**: Se toma de `business.signature` (registrada en el perfil del tenant)
3. **Idioma**: Español (con soporte para campos dinámicos en Inglés en lead.role si aplica)
4. **Encoding**: UTF-8 (soporta caracteres acentuados, símbolos, etc.)
5. **Recepción de respuestas**: Se capturan vía webhook en `EmailChannel.parseInbound()` (SendGrid, Mailgun, Resend)
6. **Herramienta de envío**: Configurable per-tenant (SendGrid, Resend, nodemailer, etc.)

---

*Documento generado el 2026-09-19 — Claude Haiku 4.5*
