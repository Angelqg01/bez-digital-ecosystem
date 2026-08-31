---
name: brain-daily
description: Optimización diaria del flujo del Brain (vault Obsidian de BeZhas). Ejecuta el mantenimiento automatizado (mapa de plataforma, consolidación de episodios, embeddings, salud del grafo, fingerprint merkle) y luego corrige lo que la automatización no puede — conectar notas huérfanas, arreglar links muertos y decidir anclajes on-chain. Usar cada nuevo día de trabajo, cuando el usuario pida "optimiza el brain", "mantenimiento del vault", "brain daily", o tras añadir muchas notas/episodios nuevos.
---

# Brain Daily — Optimización del flujo del Brain

El Brain es `obsidian-mcp/` (:4007) + `docs/obsidian-vault/`. Este skill lo mantiene sano cada día: primero la parte mecánica (script), después la parte que requiere criterio (tú).

## Paso 1 — Ejecutar el mantenimiento automatizado

```powershell
cd D:\BeZhas-Blockchain\obsidian-mcp
node scripts/brainDaily.mjs
```

El script hace, en orden: regenera el mapa de plataforma (35 notas, idempotente), consolida episodios de +30 días en digests (`00-Episodic-Memory/consolidated/`), sincroniza embeddings si Ollama responde, detecta huérfanas y links muertos, calcula el merkle root y escribe `03-Maps/Brain-Daily-Report.md` + un episodio `brain-daily`.

Con `--dry-run` no escribe nada (úsalo si solo quieres diagnóstico).

## Paso 2 — Leer el reporte y actuar

Lee `docs/obsidian-vault/03-Maps/Brain-Daily-Report.md` y trabaja la lista:

1. **Huérfanas**: para cada una, decide — enlazarla desde el cluster correcto de `05-Platform/` o el hub `03-Maps/BeZhas-Platform-Master.md`, moverla a `99-Inbox` si es dudosa, o archivarla. Ninguna nota debe quedar sin camino desde la Capa 0.
2. **Links muertos**: crear la nota destino (si el concepto merece existir) o corregir el link en la nota origen. Ojo: links a carpetas (`[[00-Episodic-Memory]]`) y wiki-syntax dentro de código ya se ignoran — si aparece uno, es real.
3. **Digests nuevos**: ábrelos y verifica que el resumen es fiel; si un episodio consolidado contenía una decisión importante, promuévela a `02-Decisions/` como ADR.

## Paso 2b — Lint semántico (criterio, no automatizable)

Lee `docs/obsidian-vault/_SCHEMA.md` si no lo conoces. Después:

1. **Contradicciones declaradas**: busca `⚠️` en `07-Sources/` (`search_vault` query "contradicciones"). Cada una se resuelve: o se corrige la nota vieja (citando la fuente nueva), o se anota por qué la fuente no aplica. Nunca dejarla viva dos dailies seguidos.
2. **Afirmaciones obsoletas**: revisa las 3-5 notas más antiguas que hayan sido tocadas por fuentes recientes (mira `log.md`, entradas `ingest`) — ¿alguna afirmación quedó superada?
3. **Conceptos sin página**: si un término aparece enlazado 3+ veces sin nota propia (links muertos recurrentes en el reporte), créala.
4. **Fuentes pendientes**: si el usuario dejó archivos en `07-Sources/raw/` sin nota-resumen correspondiente en `07-Sources/`, ingiérelos con la tool `ingest_source` (leer completo → resumir → enlazar entidades → declarar contradicciones).

## Paso 3 — Sincronizar con la realidad del repo

Si esta semana se añadió/eliminó una SubApp, servicio, puerto o dominio, actualiza `obsidian-mcp/scripts/buildPlatformMap.mjs` (arrays `CLUSTERS`/`ENTRIES`) y re-ejecuta el paso 1. El mapa del vault debe reflejar el monorepo, no al revés.

## Paso 4 — Anclaje on-chain (opcional, pide confirmación)

El reporte incluye el merkle root del vault. Si el usuario quiere evidencia inmutable ese día: el blockchain-agent publica el root vía QualityOracle y después se registra con la tool `record_anchor` (root + txHash + chainId). NUNCA firmar transacciones desde obsidian-mcp.

## Paso 5 — Cierre

- Verifica salud: `Invoke-RestMethod http://localhost:4007/health` (si el servidor está corriendo, el watcher ya habrá reindexado los cambios).
- Si Ollama estaba OFF y el usuario lo quiere ON: `ollama pull nomic-embed-text` y re-ejecutar el paso 1.
- Resume en 3-4 líneas: notas totales, qué se consolidó, qué se conectó, root del día.

## Notas

- El servidor tiene además autopilot interno (`BRAIN_AUTOPILOT`, cada 24h consolida + re-embebe) — este skill añade la capa de criterio que el autopilot no tiene.
- Smoke test del servicio si tocaste código: `cd obsidian-mcp && pnpm test`.
