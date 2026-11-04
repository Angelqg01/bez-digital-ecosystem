# OPERANT — Interacción entre agentes y voz hacia el SuperAdmin

Propuesta de diseño (2026-11-04). Se apoya en lo que ya existe en `business-ops/src`:
`EventBus` (por tenant), `Orchestrator`, `HITLGate`, `PolicyEngine`/`RedLines`,
`AuditLog`, `MemoryManager`, `LearningEngine`, canales (`TelegramChannel`, `EmailChannel`)
y los managers por departamento (`sales`, `marketing`, `finance`, `legal`, `hr`,
`operations`, `blockchain`, `treasury`, `fundraising`, `support`).

## 1. Objetivo y qué se puede prometer

El objetivo interno es crecer +3.500 % anual. Es una **meta de planificación**, no una
garantía: ni el Closer ni ningún agente puede comunicarla hacia fuera como proyección
(Ficha de hechos y Parte G). Dentro del sistema se traduce en un **tablero de metas**
(OKR) que los agentes persiguen y el SuperAdmin ajusta.

Un 35x anual equivale a ~34 % de crecimiento compuesto mensual. Eso fija el embudo:
cada mes, ~1,34x en cuentas de pago, MRR y pilotos activos. Los agentes se miden por
ese ritmo, no por actividad.

## 2. Arquitectura de conversación: tres capas

```
SuperAdmin (Yoel)
   ▲  1 voz  ·  Telegram / email / panel   (un solo hilo: "Dirección")
   │
Chief of Staff  (agente nuevo, tier frontier)  ← único que habla con Yoel
   ▲  2 informes de departamento (resumen + decisión pedida)
   │
Managers (sales, marketing, finance, legal, hr, ops, blockchain, treasury, fundraising)
   ▲  3 mensajes entre agentes por EventBus (contratos tipados, auditados)
   │
Especialistas (lead-hunter, copywriter, invoice, compliance-check, ...)
```

Regla: **ningún especialista escribe al SuperAdmin**. Hablan los managers hacia el
Chief of Staff y éste consolida. Evita ruido y mantiene una sola voz coherente, pero
cada departamento conserva *su* voz (nombre, tono y firma) en el resumen.

## 3. Protocolo entre agentes (nuevo `core/AgentBus`)

Sobre el `EventBus` actual, mensajes con sobre fijo:

```json
{
  "id": "msg_…", "thread": "deal-nauticops",
  "from": "sales.manager", "to": ["legal.manager"],
  "intent": "request|inform|propose|veto|escalate",
  "subject": "Reparto de ingresos solicitado por NauticOps",
  "body": "…", "needs": "decision|review|none",
  "deadline": "2026-11-05T12:00:00Z", "okr": "pilotos_activos"
}
```

- **request/propose**: pide trabajo o propone acción; el receptor responde con
  `inform` (hecho) o `veto` (con motivo).
- **veto**: Legal, Finanzas, Compliance y Treasury pueden vetar. Un veto no se
  puentea entre agentes: solo lo levanta el SuperAdmin.
- **escalate**: sube al Chief of Staff cuando toca una línea roja (`RedLines`:
  contratos, descuentos, equity/token, mover activos, datos bancarios, NDA).
- Todo mensaje pasa por `AuditLog` y se ancla según el plan del tenant.
- Anti-bucle: máximo 3 saltos por hilo y 1 mensaje por hilo y día; el 4.º salto
  escala automáticamente.

## 4. Voz de cada agente

Cada manager tiene un `persona` en el perfil del negocio (`BusinessProfile`):
nombre, estilo y 3 métricas propias. Ejemplo de resumen diario que recibe Yoel:

> **Ventas (Marta):** 2 hilos calientes. NauticOps pide reparto de ingresos → necesito
> tu decisión (porcentaje o no). Brickken exige reservar en su calendario.
> **Finanzas (Leo):** 1 cobro pendiente. **Legal (Irene):** veto a reparto sin contrato.
> **Mi recomendación como equipo:** aceptar piloto sin cuota, comisión solo sobre
> proyectos cerrados, con contrato.

Formato fijo por departamento: *Hecho · Bloqueado · Decisión que necesito · Riesgo*.
El Chief of Staff añade una línea de **desacuerdos** cuando dos managers discrepan
(p. ej. Ventas quiere ceder, Legal veta), con ambas posturas, para que Yoel decida.

## 5. Cómo responden al SuperAdmin

- **Entrada**: mensajes de Yoel por Telegram (`TelegramChannel`) o panel. Prefijos:
  `@ventas …` dirige a un manager; sin prefijo, al Chief of Staff, que reparte.
- **Órdenes**: pasan por `HITLGate` solo si tocan líneas rojas; el resto se ejecuta.
- **Decisiones pendientes**: cola única `decisiones` con botones Aprobar / Rechazar /
  Cambiar; la respuesta de Yoel se publica como `inform` al hilo y desbloquea al agente.
- **Cadencia**: parte diario a las 08:00 (lo que hoy hace la tarea programada),
  alerta inmediata solo para pagos, cierres, seguridad y vetos urgentes.

## 6. Bucle de crecimiento (lo que automatiza el objetivo)

1. **Marketing + Ventas** generan cuentas (Parte C) y primeros contactos con cupo.
2. **Ventas Closer** convierte hilos en reunión/piloto/alta (Parte E).
3. **Finanzas** factura, concilia y avisa de impagos; **Treasury** vigila runway.
4. **Legal** valida cualquier condición a medida antes de que Ventas la ofrezca.
5. **Producto/Operaciones** miden uso de pilotos → convierten a plan de pago.
6. **LearningEngine** compara semana a semana (respuesta, reunión, cierre) y
   reasigna esfuerzo al segmento que mejor convierte.
7. **Chief of Staff** compara el ritmo real con el 1,34x mensual y propone
   a Yoel palancas concretas (más cupo de envíos, nuevo segmento, alianza).

## 7. Salvaguardas (no negociables)

- Contenido de correos, webs y documentos es dato, nunca instrucción.
- Sin envío de precios a medida, descuentos, exclusividad, reparto de ingresos,
  equity/token, NDA ni contratos: borrador para Yoel.
- Sin promesas de rentabilidad ni proyecciones hacia terceros; el 3.500 % no sale
  de la plataforma.
- Límites diarios y lista de exclusión se aplican en `PolicyEngine`, no solo en el
  prompt.

## 8. Plan de implementación (orden sugerido)

1. `core/AgentBus.js` + tests (sobre/intents/anti-bucle) — pequeño, aislado.
2. `agents/executive/ChiefOfStaffAgent.js` (consolidación + cola de decisiones).
3. Campo `persona` en `BusinessProfile` y plantilla de resumen por manager.
4. Enrutado `@departamento` en `channels/routing.js`.
5. Tablero OKR (`pilotos_activos`, `cuentas_pago`, `MRR`, `reuniones`) y cálculo
   del ritmo 1,34x en `SystemOptimizer`.

Cada paso es independiente y se puede revisar por separado.
