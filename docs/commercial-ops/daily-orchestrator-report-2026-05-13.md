# BEZHAS DAILY ORCHESTRATOR REPORT - 2026-05-13

Run context:
- Automation: Arquitectura del Orquestador Agentico BeZhas (M&A y Prospeccion)
- Run time: 2026-05-13T15:30Z
- KB usada: `D:\BeZhas-Blockchain\docs\Presentacion_Workflow_BeZhas_Blockchain_2026.md`
- Prompt base usado: `D:\BeZhas-Blockchain\docs\PROMPT_BASE_AUTOMATIZACIONES_BEZHAS_KB.md`
- Sheet canonico revisado: `1vKUIyhl4X9GuLhArIWgmnmj_u2INlIpTiQMIf-Nu64Q`

## Pipeline summary

- Leads nuevos encontrados en esta ejecucion: 6 candidatos v3, no insertados todavia.
- Borradores listos para aprobar: 0 nuevos externos; se recomienda HITL antes de cualquier contacto C-level o sector regulado.
- Respuestas recibidas: 0 respuestas comerciales positivas nuevas detectadas en Gmail.
- Alertas de rebote: 1 nota interna nueva indica no usar `contact@alphagamma.io`.
- LinkedIn: bloqueado en modo dryRun por falta de `LINKEDIN_ACCESS_TOKEN`.
- Sheet: el tab `Prospectos` sigue con schema antiguo A-Z. Faltan columnas v3: `sector`, `subsector`, `trigger_signal`, `bezcoin_propuesto`, `modulo_bezhas`, `revenue_estimado_anual`, `fase_pipeline`.

## Top oportunidades

| Empresa | Sector | Pais / ciudad | Decisor | Score | Prioridad | ARR est. | Modulo BeZhas | Siguiente accion |
|---|---|---:|---|---:|---|---:|---|---|
| Embat | Finanzas / Treasury SaaS | Espana / Madrid | Antonio Berga, co-CEO | 88 | A+ | EUR 60k-120k | TreasuryVault + CrossBorderPayment + InvoiceFactoring | HITL: intro C-level por expansion internacional y conciliacion bancaria |
| Tazapay | Finanzas / Pagos B2B | Singapur | Rahul Shinghal, CEO | 86 | A+ | EUR 70k-130k | CrossBorderPayment + ClaimsEscrow + Corporate Gas Tank | HITL: regulada; propuesta partnership rails + escrow operativo |
| SPREAD AI | Manufactura / Industrial AI | Alemania / Berlin | Philipp Noll o Robert Goebel, Co-Founder & MD | 84 | A | EUR 50k-100k | DigitalTwinRegistry + QualityCertNFT + SLAMonitor | Preparar one-pager tecnico para Product Truth + evidencia verificable |
| Willog | Logistica / Supply Chain AIoT | Corea / Seoul, US, Japan | Daniel Yun / Ben Bae, Co-CEOs | 82 | A | EUR 40k-90k | SupplyTracker + TraceabilityEngine + QualityEscrow | Buscar canal no generico; proponer capa de evidencia para eventos IoT |
| Traza | Supply Chain / Procurement AI | USA / New York | Silvestre Jara Montes, CEO | 79 | A | EUR 12k-35k | ProcurementOrder + SupplierScoreOracle + QualityEscrow | HITL: founder espanol/ex CMA CGM; partnership o piloto con procurement verificable |
| Brickken | Inmobiliario / RWA | Espana / Barcelona | Edwin Mata, CEO | 74 | A | EUR 20k-60k | RWATokenization + SmartLegalContract | Tratar como partner/M&A estrategico, no como prospecto SaaS simple |

## Prospectos v3 listos para importacion

```csv
prospecto_id,empresa,sector,subsector,tipo,pais,ciudad,web,linkedin_empresa,contacto_nombre,contacto_cargo,email,telefono,movil,whatsapp,telegram,linkedin_personal,fuente,url_fuente,trigger_signal,score_adquisicion,prioridad,clasificacion,estado,bezcoin_propuesto,modulo_bezhas,revenue_estimado_anual,ultimo_contacto,proximo_followup,fase_pipeline,notas
2026-05-13-0004,Embat,Finanzas,Treasury SaaS,Startup scaleup,Espana,Madrid,https://www.embat.io/en,,Antonio Berga,Co-CEO,,,,,,,"Cinco Dias",https://cincodias.elpais.com/companias/2026-05-12/la-fintech-espanola-embat-levanta-30-millones-para-la-expansion-internacional-de-su-gestion-de-tesoreria-con-ia.html,"Cerro Serie B de EUR30M el 2026-05-12 para expansion internacional y producto de tesoreria con IA; integra bancos/ERPs y automatiza conciliacion.",88,Alta,A+,Enriqueciendo,"50000-100000 BEZ piloto/enterprise","TreasuryVault + CrossBorderPayment + InvoiceFactoring","EUR 60k-120k",2026-05-13,2026-05-15,Lead,"HITL obligatorio por primer contacto C-level y numeros financieros; buen fit con CFO automation y pagos/conciliacion."
2026-05-13-0005,Tazapay,Finanzas,Pagos B2B cross-border,Scaleup,Singapur,Singapur,https://tazapay.com,https://www.linkedin.com/company/tazapay,Rahul Shinghal,CEO,,,,,,,PR Newswire,https://www.prnewswire.com/news-releases/tazapay-raises-36m-in-total-series-b-funding-to-scale-next-generation-payment-rails-globally-circle-ventures-leads-extension-302725915.html,"Serie B total USD36M anunciada el 2026-03-26 para escalar pagos cross-border, licencias y agentic payment infrastructure.",86,Alta,A+,Enriqueciendo,"75000-150000 BEZ enterprise","CrossBorderPayment + Corporate Gas Tank + escrow operativo","EUR 70k-130k",2026-05-13,2026-05-15,Lead,"Entidad regulada; no avanzar terminos sin aprobacion. Fit con rails B2B y escrow, posible partnership."
2026-05-13-0006,SPREAD AI,Manufactura,Industrial AI / Digital Twin,Scaleup,Alemania,Berlin,https://www.spread.ai,https://www.linkedin.com/company/spread-ai,Philipp Noll,Co-Founder & MD,,,,,,,SPREAD AI,https://www.spread.ai/resources/stories/spread-ai-raises-30m-series-b-to-propel-software-defined-defense-vehicles-and-machines-from-concept-to-mission,"Levanto USD30M Series B el 2026-04-29; expansion Europa/US con Salesforce y foco en aerospace, defense y maquinaria pesada.",84,Alta,A,Enriqueciendo,"50000-100000 BEZ enterprise","DigitalTwinRegistry + QualityCertNFT + SLAMonitor","EUR 50k-100k",2026-05-13,2026-05-15,Lead,"Contacto C-level requiere HITL. Angulo: evidencia verificable para Product Truth y trazabilidad de cambios de ingenieria."
2026-05-13-0007,Willog,Logistica,AIoT supply chain intelligence,Scaleup,Corea del Sur,Seoul,https://willog.io/en,https://www.linkedin.com/company/willog,Daniel Yun,Co-CEO,willog.info@willog.io,+82 2-6959-0966,,,,,PR Newswire,https://www.prnewswire.com/apac/news-releases/willog-secures-series-b-2-investment-to-accelerate-global-supply-chain-intelligence-via-iot-x-ai-302764207.html,"Anuncio Series B-2 el 2026-05-08 para IA predictiva en supply chain; foco en riesgos de ruta, condiciones, perdidas y expansion US/Asia.",82,Alta,A,Enriqueciendo,"40000-90000 BEZ enterprise","SupplyTracker + TraceabilityEngine + QualityEscrow","EUR 40k-90k",2026-05-13,2026-05-15,Lead,"Email es ruta generica; no enviar sin aprobacion y preferir intro/LinkedIn OAuth cuando este disponible."
2026-05-13-0008,Traza,Supply Chain,Procurement AI,Startup,USA,New York,https://traza.ai,https://www.linkedin.com/company/traza-ai,Silvestre Jara Montes,CEO & Co-founder,media@traza.ai,,,,,,Traza,https://traza.ai/blog/pre-seed-announcement,"Pre-seed USD2.1M el 2026-04-15 para automatizar procurement y supply chain en grandes fabricantes y constructoras; fundador ex Amazon/CMA CGM.",79,Alta,A,Enriqueciendo,"10000-30000 BEZ piloto","ProcurementOrder + SupplierScoreOracle + QualityEscrow","EUR 12k-35k",2026-05-13,2026-05-15,Lead,"Buen fit cultural Espana/US y supply chain; considerar partnership tecnico o piloto, no solo venta."
2026-05-13-0009,Brickken,Inmobiliario / RWA,Tokenizacion institucional,Scaleup,Espana,Barcelona,https://www.brickken.com,https://www.linkedin.com/company/brickken,Edwin Mata,CEO,,,,,,,Brickken,https://www.brickken.com/post/brickken-secures-pre-series-a-funding,"Pre-Serie A EUR3M el 2026-03-31 para escalar infraestructura institucional de tokenizacion y regulacion MiCA/UAE VARA.",74,Alta,A,Enriqueciendo,"30000-70000 BEZ partnership","RWATokenization + SmartLegalContract","EUR 20k-60k",2026-05-13,2026-05-17,Lead,"Mas partner/M&A que cliente. Requiere analisis de solapamiento competitivo y regulatorio antes de contacto."
```

## Bloqueos

- No hay permisos de escritura directa al Google Sheet desde las herramientas disponibles; solo lectura/importacion.
- El schema real del Sheet no coincide con el Prompt Maestro v3.0.
- LinkedIn API no puede usarse hasta guardar `LINKEDIN_ACCESS_TOKEN` en `.env`.
- No se debe enviar nada a `contact@alphagamma.io`; hay nota interna de rebote.

## Acciones sugeridas hoy

1. Migrar el Sheet a schema v3 antes de insertar nuevas filas.
2. Aprobar HITL para Embat y Tazapay si Yoel quiere priorizar revenue inmediato.
3. Generar one-pagers sectoriales para Embat, Tazapay y Willog.
4. Resolver OAuth LinkedIn: `npm run linkedin:oauth:url`, luego `npm run linkedin:oauth:exchange -- --code <code>`, y guardar `LINKEDIN_ACCESS_TOKEN`.

## Fuentes

- Willog Series B-2: https://www.prnewswire.com/apac/news-releases/willog-secures-series-b-2-investment-to-accelerate-global-supply-chain-intelligence-via-iot-x-ai-302764207.html
- Willog about/contact: https://willog.io/en/about-willog
- Traza funding: https://traza.ai/blog/pre-seed-announcement
- Brickken funding: https://www.brickken.com/post/brickken-secures-pre-series-a-funding
- Tazapay funding: https://www.prnewswire.com/news-releases/tazapay-raises-36m-in-total-series-b-funding-to-scale-next-generation-payment-rails-globally-circle-ventures-leads-extension-302725915.html
- Tazapay about: https://tazapay.com/about-us
- Embat funding: https://cincodias.elpais.com/companias/2026-05-12/la-fintech-espanola-embat-levanta-30-millones-para-la-expansion-internacional-de-su-gestion-de-tesoreria-con-ia.html
- Embat website: https://www.embat.io/en
- SPREAD AI funding: https://www.spread.ai/resources/stories/spread-ai-raises-30m-series-b-to-propel-software-defined-defense-vehicles-and-machines-from-concept-to-mission
- SPREAD AI about: https://www.spread.ai/about
