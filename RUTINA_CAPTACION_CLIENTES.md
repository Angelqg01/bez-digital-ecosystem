# Rutina operativa — captación de clientes y venta de token

> Borrador de trabajo | Septiembre 2026 | Cierra el ciclo de los 5 pasos ya
> ejecutados (compradores → regiones → estructura → mercado → jurisdicción) y
> lo convierte en un ritmo diario/semanal real sobre OPERANT.

---

## 0. Qué se empaquetó hoy en OPERANT

`business-ops/config/business/bezhas.json` — el perfil que ya lee en producción
el escuadrón de Ventas (`SalesManager` + sus 10 especialistas) — se actualizó
con:

- **Mercado nuevo:** "Emiratos Árabes Unidos" en `markets`.
- **Segmento nuevo:** `eau_free_zone` (Jebel Ali, DMCC, JAFZA, ADGM), con sus
  propias palabras clave para que `LeadScorerAgent` no meta un prospecto de
  Dubái en el cajón de "sin_clasificar".
- **Cadencia y ángulos de seguimiento** para ese segmento, calcados del mismo
  ritmo que ya usan logística/puerto/agro (`[0,4,9,16,25]` días), redactados
  para pasar por el mismo test que ya protege esto en CI
  (`followup-cadence.test.js`: cero jerga cripto, cero precio, en frío).
- **`expansionPlaybooks`**: un bloque nuevo que apunta a los cinco documentos
  ya generados (memo MiCA, litepaper, calendario LatAm, este archivo) y dice
  explícitamente que **el token nunca pasa por el escuadrón de Ventas
  automatizado** — eso ya lo garantizaban `coldCopyRules` y `humanEscalation`
  del propio perfil, esto solo lo deja trazado.

Verificado con `npm test` en `business-ops/`: 747 tests, 732 pasan, 0 fallos —
nada de lo anterior se rompió.

**Lo que esto NO hace:** no activa nada en producción. `sales:hunt` sigue
necesitando que Helix/OPERANT corran sobre `api.bez.digital`, que sigue caído
por la suspensión de facturación de GCP (ver más abajo).

---

## 1. Rutina diaria (L-V)

| Hora | Quién | Qué pasa |
|---|---|---|
| 08:00 | OPERANT (automático) | `sales:hunt` busca prospectos EAU (`eau_free_zone`) + España, según el ICP del perfil |
| 08:05 | OPERANT (automático) | `sales:score` puntúa contra las `scoringBands` del perfil |
| 08:10 | OPERANT (automático) | `sales:match-pitch` elige SubApp y ángulo (CargoLink para EAU, por el problema aduanero) |
| 08:15 | OPERANT (automático) | `sales:outreach` redacta el primer contacto — y se **detiene siempre** aquí: `cold_outbound` es línea roja, no hay nivel de autonomía que la salte |
| 09:00-09:30 | **Humano** | Revisar y aprobar/rechazar la cola de HITL de la noche — sin esto, no sale ni un solo email |
| Durante el día | OPERANT (automático en `assist`) | `sales:followup`, `sales:book-meeting`, `sales:crm-sync` corren solos una vez el prospecto ya respondió (cálido) |
| Fin de día | **Humano** | Si alguien pregunta explícitamente por el token: escalar a mano — nunca lo cierra el agente (regla ya en `humanEscalation`) |

**El cuello de botella de diseño, a propósito:** todo primer contacto en frío
pasa por un humano. Eso es lo que impide que la "máquina" mande spam cripto
por error — pero también significa que sin alguien revisando esa cola cada
mañana, la máquina genera candidatos y no avanza ninguno.

---

## 2. Rutina semanal

| Día | Acción |
|---|---|
| Lunes | Revisar métricas de la semana: leads EAU vs. España, tasa de aprobación HITL, respuestas, reuniones agendadas |
| Miércoles | Publicar 2-3 piezas del `CALENDARIO_CONTENIDO_LATAM.md` en Telegram/X — hoy es manual, OPERANT no tiene el departamento de Marketing activado para esto todavía |
| Viernes | Revisar `sales:churn` sobre clientes ya activos; ajustar `scoringBands`/keywords si algo se está clasificando mal |

---

## 3. Rutina mensual

- Revisar el dial de `SalesAutonomy` (`manual` → `assist` → `full_auto`): ¿el
  volumen de aprobaciones ya es lo bastante fiable para subir de nivel en
  seguimientos y CRM? (el frío nunca sube de nivel, por diseño)
- Checkpoint del Paso 5: ¿ya se contactó al proveedor de servicios ADGM?
- Si ya hay ventas de BEZ-Coin en curso: actualizar la hoja de cómputo
  agregado de 12 meses del memo MiCA (Tramo B, umbral de 1M€)

---

## 4. Lo que necesito de ti para que esto sea una máquina pro

Ordenado por lo que bloquea todo lo demás primero.

1. **Reactivar la facturación de GCP.** Bloquea literalmente todo lo automático
   — sin `api.bez.digital` en pie, `sales:hunt`/`sales:outreach` no corren en
   producción, solo se pueden ejecutar a mano.
2. **Alguien fijo en la cola de HITL cada mañana.** Puedes ser tú o delegarlo,
   pero sin esa persona la máquina genera candidatos y ninguno sale a la calle.
3. **Acceso real a HubSpot** (API key, o confirmar que el que ya está conectado
   en este entorno tiene permiso de escritura) — sin esto `sales:crm-sync`
   simula, no sincroniza de verdad.
4. **Asiento de LinkedIn Sales Navigator** activo para el filtro guardado de
   EAU del Paso 3 — sin datos reales de Jebel Ali/DMCC, `sales:hunt` trabaja
   sobre el ICP en teoría, no sobre prospectos reales.
5. **SPF/DKIM/DMARC confirmados en `bez.digital`.** Si el dominio no está bien
   configurado, cada envío de `ventas@bez.digital` rebota o cae en spam y toda
   la automatización es inútil aunque todo lo demás funcione.
6. **Alguien para Telegram/X** que ejecute el calendario LatAm — sin persona
   asignada, ese documento se queda en papel.
7. **Decisión y presupuesto sobre el proveedor de servicios ADGM** — para que
   el Paso 5 deje de ser una recomendación y se convierta en una entidad real.
8. *(Opcional, más adelante)* Si quieres que aprovisione el hosting en
   Hostinger que mencionaste, dime cuándo — tengo las herramientas conectadas
   pero no he tocado nada todavía.

Dime cuáles de estos ya están resueltos y cuáles no, y ajusto la rutina a lo
que realmente hay disponible — no tiene sentido dejar la cadencia diaria
corriendo contra bloqueos que ya conocemos.
