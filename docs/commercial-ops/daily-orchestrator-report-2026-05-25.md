# BEZHAS DAILY ORCHESTRATOR REPORT - 2026-05-25

## Pipeline summary

- Base documental local revisada: KB BeZhas, prompt base y prompt maestro del orquestador.
- LinkedIn validado: sigue en `dryRun` por falta de `LINKEDIN_ACCESS_TOKEN`.
  - Prospecting log: `D:\BeZhas-Blockchain\logs\linkedin\2026-05-25T12-42-14-711Z-prospecting.json`
  - Messages log: `D:\BeZhas-Blockchain\logs\linkedin\2026-05-25T12-42-14-690Z-messages.json`
- Google Sheet canonico validado: `Prospectos!A1:Z1` y `Archivados!A1:Z1` coinciden con schema v1 A-Z.
- Google Sheets devolvio 429 rate limit al buscar filas por `2026-05-25` y `Respondio+`; no se escribio en Sheet para evitar doble registro o corrupcion.
- Gmail revisado desde el ultimo ciclo: no hay respuesta nueva de Jose Baqueiro ni Jacobo Camba despues de los borradores del 2026-05-23.
- Gmail si muestra nueva oportunidad warm: Blue Core/ZF Cadiz envio convocatoria de `Blue Financiacion`, abierta hasta el 2026-06-02.

## Warm opportunities

1. Blue Core / Zona Franca de Cadiz - Blue Financiacion
   - Fuente: email de Carmen / admin@zfbluecore.es del 2026-05-25.
   - Trigger: convocatoria abierta hasta el 2026-06-02 para reforzar plan financiero, financiacion publica/privada, inversion y negociacion.
   - Encaje BeZhas: preparar acceso a financiacion para piloto local puerto/aduanas/logistica y convertir el plan comercial en tesis financiable.
   - Accion: draft Gmail creado, no enviado: `r-4906720039290823911`.

2. Jose Baqueiro - reunion presencial semana del 2026-06-15
   - Estado: draft existente pendiente de envio/revision: `r-1987023227163511445`.
   - Objetivo: confirmar martes 2026-06-16 o miercoles 2026-06-17 por la manana.
   - Material necesario: lista de 5 cuentas Cadiz + preguntas para validar introduccion y cargo correcto.

3. Jacobo Camba - prototipo de cliente + 5 primeras cuentas
   - Estado: draft existente pendiente de envio/revision: `r-5939437865199051809`.
   - Objetivo: cerrar ICP local y convertirlo en one-pager simple: 1 cliente, 1 dolor, 1 flujo, 1 KPI.
   - Artefacto creado: `D:\BeZhas-Blockchain\docs\commercial-ops\one-pager-icp-cadiz-2026-05-25.md`.

## HubSpot blockers

Siguen abiertas tareas HITL antiguas de alto impacto:

- Terminal Link Texas - task `491632255189`, draft `r5460482716325763036`
- DP World Antwerp Gateway - task `491632169166`, draft `r-6024606522200628199`
- PSA Antwerp CFS - task `491635431660`, draft `r3047480471549991788`
- MPET - task `491635706073`, draft `r-6840012310085297923`

No se modificaron en HubSpot porque la politica del conector exige confirmacion explicita para cambios CRM.

## Top actions for Yoel

1. Revisar y enviar el draft a Carmen/Blue Core antes del 2026-06-02.
2. Revisar y enviar los drafts a Jacobo y Jose para cerrar el camino Cadiz.
3. Resolver `LINKEDIN_ACCESS_TOKEN` para activar busqueda/mensajeria oficial o mantener Sales Navigator manual.
4. Cerrar o aprobar las 4 tareas HITL vencidas en HubSpot.

## Decision

El mayor ROI del ciclo no es anadir mas prospectos frios. Es convertir Blue Core/ZF Cadiz en una ruta de financiacion y validar con Jose/Jacobo el ICP local con 5 cuentas iniciales antes de contactar empresas portuarias.

## Cadence hygiene addendum - 2026-05-25T14:44:13+02:00

- Gmail desde la ultima ejecucion: sin respuestas humanas utiles ni rebotes nuevos posteriores al 2026-05-23 en busqueda general de outreach BeZhas.
- PSA Sines: confirmado fallo definitivo a `geral@psasines.pt` tras delays previos; DSN `19e4a0f5ec7ff811` etiquetado `bounce` y archivado. CRM actualizado a `Rebote`; no reenviar a esa direccion.
- Arola: sin respuesta humana tras autorespuesta y follow-up. Se creo draft de cambio de ruta a `cadaduana@arola.com` desde directorio oficial Puerto de Cadiz: `r-4139952895094417573`.
- Hutchison Ports BEST: sin respuesta humana tras follow-up a Operaciones/Logistica. Se creo draft de cambio de ruta a Comercial/Facturacion/Cargo Solutions segun web oficial BEST: `r8570784250325935779`.
- HubSpot: 4 deals activos siguen en `appointmentscheduled` sin modificacion desde el 2026-05-14; no se escribio en HubSpot porque requiere confirmacion explicita.
- Slack: solo aparece visible `#general-bezhasgroupflow`; no se publico resumen al no existir canal comercial especifico visible.
- Google Sheets: escrituras de PSA/Arola/BEST devolvieron exito, pero la verificacion posterior devolvio 429 `RATE_LIMIT_EXCEEDED`; no hacer mas lecturas contra Sheets en este ciclo.
