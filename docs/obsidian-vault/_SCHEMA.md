---
type: schema
hierarchy: Core
summary: Constitucion del Brain — estructura, convenciones y workflows que TODO agente debe seguir al leer o escribir en este vault.
tags: ["schema", "meta"]
---

# _SCHEMA — Cómo se mantiene este Brain

Este vault es el wiki persistente del ecosistema BeZhas, mantenido por agentes LLM (patrón: fuente cruda → wiki compilado → schema). El agente escribe; el humano dirige y pregunta. Léelo SIEMPRE antes de escribir en el vault.

## Capas

| Carpeta | Qué es | Quién escribe |
| --- | --- | --- |
| `07-Sources/raw/` | Fuentes crudas **inmutables** (artículos, PDFs→md, actas). Se leen, JAMÁS se editan ni se indexan al grafo. | Humano (o `ingest_source` con `raw_content`) |
| `07-Sources/` | Una nota-resumen por fuente ingerida (`type: source`) con links a las entidades que tocó. | Agente vía `ingest_source` |
| `05-Platform/` + `06-SubApps/` | Fichas de servicios y SubApps. **Generadas** por `buildPlatformMap.mjs` — para cambios permanentes edita el script, no la nota. | Script (idempotente) |
| `03-Maps/` | Capa 0: `BeZhas-Platform-Master` (entrada), `Brain-Daily-Report`, Canvas. | Script/agente |
| `02-Decisions/` | ADRs — decisiones trazables. Numeración `ADR-XXXX`. | Agente con aprobación humana |
| `00-Episodic-Memory/` | Episodios de agentes; `consolidated/` digests; `archive/` originales consolidados. | Tools `record_episode`/`consolidate_episodes` |
| `01-Self-Model/` | Auto-modelo del Director (JSON versionado). | Tool `update_self_model` |
| `99-Inbox/` | Notas sin clasificar; el lint diario decide su destino. | Cualquiera |
| `log.md` | Registro cronológico append-only: `## [fecha] op | título`. | Tools (automático) |

## Convenciones

- **Frontmatter obligatorio**: `type` (source|adr|episode|digest|platform-service|subapp|cluster|report|anchor), `tags`, y `summary` en notas de conocimiento.
- **Links**: `[[Titulo-De-Nota]]`. Los títulos usan guiones (slugify). Los links a `.canvas` llevan extensión. Wiki-syntax dentro de code-spans/fences NO cuenta como link (así se citan ejemplos).
- **Navegación**: de arriba hacia abajo — `BeZhas-Platform-Master` → cluster → ficha. Nunca listas planas.
- **Toda nota nueva debe tener un camino desde la Capa 0** (directo o vía cluster/fuente). El lint caza huérfanas.

## Operaciones

1. **Ingest** (`ingest_source`): lee la fuente cruda completa → resume → enlaza entidades existentes del mapa → **declara contradicciones** con notas actuales → el lint las resuelve. Después actualiza las fichas afectadas (`update_note` append) citando la fuente: `(fuente: [[titulo-fuente]])`.
2. **Query**: busca (`search_vault`/`semantic_search`) → lee → sintetiza. **Si la respuesta es valiosa, archívala como nota** (comparativas, análisis) — las exploraciones también componen.
3. **Lint** (skill `/brain-daily`): estructural (huérfanas, links muertos — automático) + **semántico** (contradicciones entre notas, afirmaciones obsoletas superadas por fuentes nuevas, conceptos mencionados sin página propia — criterio del agente).

## Reglas duras

- `07-Sources/raw/` es inmutable (escritura `wx`); la verdad histórica no se reescribe.
- Direcciones de contratos y datos fiscales: solo desde CLAUDE.md, nunca inventados.
- Dos tokens: [[BEZCoinV2-L2]] = gas de la L2 propia · BEZ V1 Polygon = liquidación externa.
- El fingerprint merkle ancla el estado del vault on-chain; tras publicar, registrar con `record_anchor`.
