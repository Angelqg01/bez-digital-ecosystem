# 12 · Servicios que BeZhas puede ofrecer a través del RAG (investigación con ChatGPT, 2026-10-09)

Conversación: chatgpt.com, "Investigación de producto RAG". Solo se envió una descripción del producto, sin claves ni datos de clientes.
Lo de ChatGPT son hipótesis de producto, no capacidades ya implementadas.

## Servicios, por valor / esfuerzo
1. Captación y conversión: diagnóstico del cliente → plan recomendado → demo contextual (valor muy alto, esfuerzo bajo-medio). **Hecho:** siguiente paso por plan (`guide.js`).
2. Copiloto logístico y aduanero con CargoLink: expedientes, checklist documental, estado de envíos (muy alto, medio).
3. Asistente de tokenización RWA: cuestionario, metadatos, checklist jurídico, vista previa (muy alto, medio-alto). Ya existe `bezhas_tokenize_prepare` por MCP.
4. Inspección y trazabilidad con PureScan: informes de calidad por lote (alto, medio-alto).
5. Energía/CAE y fintech supervisada: expedientes CAE, cobros, nóminas, simulaciones DeFi (alto, medio-alto).

## Acceso directo a las apps nativas (implementado)
- Catálogo en servidor (`app_hub`, `app_defi`, `app_purescan`, `app_energy`, `app_cargolink`), destino https fijado por el servidor y validado contra una lista cerrada de hosts (`isSafeAppUrl`); el modelo nunca genera el enlace.
- Se abre en pestaña nueva con `noopener,noreferrer` y **sin contexto en la URL** (la app destino revalida sesión, organización y plan).
- Sustituible con `NATIVE_APP_URLS` cuando cambien los dominios.
- Pendiente (propuesto): SSO entre apps y borradores opacos guardados en servidor para pasar contexto.

## Qué no debe hacer el chat
Mover dinero o firmar; inventar saldos, estados, certificados o titularidad; dar asesoramiento jurídico o garantía MiCA; recomendar staking por incentivo comercial sin riesgos; pedir secretos; permitir que el modelo salte plan, límites o aprobación humana.

## Hoja de ruta propuesta
1. Conversión + navegación contextual + telemetría de conversión. 2. Piloto CargoLink / RWA con borradores y ERP de solo lectura. 3. Energía, Pay, nóminas y DeFi: primero simulaciones, luego ejecución con aprobación humana.
