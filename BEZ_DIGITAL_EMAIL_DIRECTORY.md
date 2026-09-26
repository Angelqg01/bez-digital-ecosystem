# Directorio Completo de Correos @bezhas.com

**Actualizado:** 2026-09-21 (verificado contra la API de Hostinger)  
**Fuente:** `business-ops/config/business/bezhas.json`  
**Estado:** 1 buzón (`yoelceo@bezhas.com`) + 5 alias creados. Decisión del 2026-09-21: no se crean más; los departamentos sin alias usan el remitente general `yoelceo@bezhas.com`

Solo hay **un buzón**: el plan Starter Business Email incluye 1 asiento. Las
direcciones por departamento son **alias** de ese buzón. Hostinger rechaza con
`553 Sender address rejected` cualquier remitente que no sea el buzón o uno de sus
alias, así que un departamento sin alias no puede enviar.

---

## 📧 Lista Completa (11 Direcciones + el buzón)

### ✅ Alias creados (5)

| # | Departamento | Email | Estado |
|:---|:---|:---|:---:|
| 1 | **Ventas** | `ventas@bezhas.com` | ✅ Activo |
| 2 | **Finanzas** | `facturacion@bezhas.com` | ✅ Activo |
| 3 | **Soporte** | `support@bezhas.com` | ✅ Activo |
| 4 | **Marketing** | `marketing@bezhas.com` | ✅ Activo |
| 5 | **Blockchain** | `infrastructure@bezhas.com` | ✅ Activo |

### ↩️ Sin alias propio: usan el remitente general (`BeZhas <yoelceo@bezhas.com>`)

| Departamento | Antes previsto | Ahora |
|:---|:---|:---|
| **Operaciones** | `operations@` | `yoelceo@bezhas.com` |
| **Legal** | `legaladvice@` | `yoelceo@bezhas.com` |
| **Fundraising** | `investorelations@` | `yoelceo@bezhas.com` |
| **RRHH** | `rrhh@` | `yoelceo@bezhas.com` |
| **Tesorería** | `tesoreria@` | `yoelceo@bezhas.com` |
| **General** | `hola@` | `yoelceo@bezhas.com` |

Las secciones de detalle de más abajo describen qué agentes usan cada área; las
direcciones marcadas como `operations@`, `legaladvice@`, `investorelations@`, `rrhh@`,
`tesoreria@` y `hola@` **no existen** en Hostinger y enviar desde ellas se rechaza (553).

---

## 🔍 Detalles por Email

### 1. `ventas@bezhas.com`
- **Departamento:** Ventas
- **Agentes que lo usan:**
  - OutreachAgent (primer contacto B2B)
  - FollowUpAgent (seguimiento a prospectos)
  - ProposalGeneratorAgent (envío de propuestas)
- **Tipo de correos:** Comercial (clientes potenciales, propuestas)
- **Línea roja:** HITL en frío

---

### 2. `support@bezhas.com`
- **Departamento:** Soporte
- **Agentes que lo usan:**
  - SupportManager
  - SupportChatAgent
  - ResolverAgent
- **Tipo de correos:** Respuestas a tickets, resoluciones
- **Función:** Respuesta a clientes actuales con dudas/incidencias

---

### 3. `marketing@bezhas.com`
- **Departamento:** Marketing
- **Agentes que lo usan:**
  - CampaignAnalystAgent
  - SocialSchedulerAgent
  - ContentPlannerAgent
- **Tipo de correos:** Boletines, campañas, contenido
- **Función:** Comunicación de marketing y eventos

---

### 4. `facturacion@bezhas.com`
- **Departamento:** Finanzas
- **Agentes que lo usan:**
  - InvoiceBot
  - InvoiceAgent
- **Tipo de correos:** Facturas, links de pago Stripe, estados de cuenta
- **Función:** Comunicación de facturación y pagos
- **Trigger:** Evento `sales:deal_won`

---

### 5. `rrhh@bezhas.com`
- **Departamento:** RRHH
- **Agentes que lo usan:**
  - RecruiterScreenAgent
  - OnboardingAgent
  - InterviewSchedulerAgent
  - HRManager
- **Tipo de correos:** Ofertas, onboarding, entrevistas
- **Función:** Comunicación con candidatos y nuevos empleados

---

### 6. `operations@bezhas.com`
- **Departamento:** Operaciones
- **Agentes que lo usan:**
  - VendorCommsAgent (comunicación a proveedores)
  - OpsCoordinatorAgent
  - OperationsManager
  - ProcurementAgent
- **Tipo de correos:** RFQs, confirmaciones de orden, seguimiento de entregas
- **Función:** Comunicación con proveedores y coordinación operativa

---

### 7. `infrastructure@bezhas.com`
- **Departamento:** Blockchain / Infraestructura
- **Agentes que lo usan:**
  - BlockchainOpsManager
  - ComplianceCheckAgent
  - GasOptimizerAgent
  - OnChainMonitorAgent
- **Tipo de correos:** Alertas técnicas, reportes de infraestructura
- **Función:** Comunicación técnica y de seguridad blockchain

---

### 8. `legaladvice@bezhas.com`
- **Departamento:** Legal
- **Agentes que lo usan:**
  - ContractReviewAgent
  - DPIAAgent
  - RegulatoryAdvisorAgent
  - LegalManager
- **Tipo de correos:** Avisos legales, cumplimiento, DPIA
- **Función:** Comunicación legal y de compliance

---

### 9. `tesoreria@bezhas.com`
- **Departamento:** Tesorería
- **Agentes que lo usan:**
  - TreasuryManager
  - TokenomicsAgent
  - LiquidityWatcherAgent
  - VestingMonitorAgent
- **Tipo de correos:** Reportes de tesorería, tokens, vesting
- **Función:** Comunicación de gestión de tesorería y tokens

---

### 10. `investorelations@bezhas.com`
- **Departamento:** Fundraising
- **Agentes que lo usan:**
  - InvestorOutreachAgent
  - FundraisingManager
  - InvestorScorerAgent
  - CapTableAgent
- **Tipo de correos:** Contacto con VCs, family offices, fondos
- **Función:** Comunicación de captación de inversión

---

### 11. `hola@bezhas.com` (FALLBACK)
- **Tipo:** Genérico
- **Uso:** Dirección por defecto si no hay departamento específico
- **Función:** Punto de contacto general

---

## ⚙️ Configuración Técnica

```json
{
  "email": {
    "domain": "bezhas.com",
    "displayName": "BeZhas",
    "default": "yoelceo@bezhas.com",
    "provider": "hostinger",
    "smtp": {
      "host": "smtp.hostinger.com",
      "port": 465,
      "secure": true
    },
    "byDepartment": {
      "sales": "ventas@bezhas.com",
      "support": "support@bezhas.com",
      "marketing": "marketing@bezhas.com",
      "finance": "facturacion@bezhas.com",
      "blockchain": "infrastructure@bezhas.com"
    }
  }
}
```

---

## 🔄 Cómo se Asigna la Dirección

En Operant, cada agente obtiene su dirección automáticamente basado en el departamento:

```javascript
// En BaseAgent.js
const from = this.business.senderFor(this.department);
// Ejemplo: OutreachAgent (sales) → ventas@bezhas.com
```

### Precedencia
1. **Primero:** Email específico del departamento (byDepartment)
2. **Fallback:** `yoelceo@bezhas.com` (departamentos sin alias propio)

---

## 📬 Dónde se Configuran

**Archivo único de configuración:**
```
business-ops/config/business/bezhas.json
└── email
    ├── domain: "bezhas.com"
    ├── displayName: "BeZhas"
    ├── default: "yoelceo@bezhas.com"
    └── byDepartment: { ... }
```

---

## 📊 Resumen Estadístico

- **Alias activos:** 5 de 11 (más el buzón `yoelceo@bezhas.com`)
- **Dominio:** bezhas.com
- **Patrón:** {alias}@bezhas.com
- **Excepciones:** `hola@bezhas.com` (genérico), `facturacion@bezhas.com` (finanzas)
- **Agentes asociados:** 72 (distribuidos en 9 departamentos)
- **Línea de firma:** CEO (Yoel A. Hernández) — todas incluyen firma corporativa estándar

---

## ✅ Checklist de Validación

Cuando se añade un nuevo departamento a Operant:

- [ ] Alias creado en Hostinger (hPanel → Correo → Alias del buzón `yoelceo@bezhas.com`); sin él, el envío se rechaza con 553
- [ ] Entrada añadida en `byDepartment` (bezhas.json)
- [ ] Agent creado con `department: 'nuevo_dept'`
- [ ] Prueba de envío (HITL o sandbox)
- [ ] Firma corporativa registrada
- [ ] Webhook de recepción configurado (inbound parse)

---

*Documento de referencia rápida — Operant Email Directory*  
*Última actualización: 2026-09-19*
