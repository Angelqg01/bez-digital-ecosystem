---
type: "source"
agent: "director-agent"
source_file: "raw/llm-wiki-pattern.md"
tags: ["source", "pattern", "knowledge-ops"]
created: "2026-07-09T19:24:22.245Z"
---

# LLM Wiki Pattern

> Fuente ingerida al wiki. Original inmutable en `07-Sources/raw/llm-wiki-pattern.md`.

## Resumen

Patron para bases de conocimiento personales mantenidas por LLMs: en vez de RAG que re-deriva en cada consulta, el LLM compila y mantiene un wiki persistente e interconectado. Tres capas: fuentes crudas inmutables, wiki generado por el LLM, y schema que disciplina al agente. Operaciones: ingest (integrar fuente en 10-15 paginas), query (respuestas valiosas se archivan de vuelta), lint (contradicciones, huerfanas, afirmaciones obsoletas). Es el patron que este Brain implementa desde ADR-0002 a ADR-0005.

## Puntos clave

- El wiki es un artefacto persistente que compone: cross-references ya hechas, contradicciones ya marcadas
- El humano dirige fuentes y preguntas; el LLM hace TODO el mantenimiento (el coste de mantener cae a ~cero)
- index.md navegable evita infra RAG hasta ~cientos de paginas; log.md cronologico parseable con grep
- Respuestas buenas se archivan como paginas nuevas: las exploraciones tambien componen
- Lint periodico: contradicciones, claims obsoletos, huerfanas, conceptos sin pagina

## Entidades relacionadas

- [[Obsidian-Brain]]
- [[SKILL-Knowledge-Base]]
- [[Cluster-ia-conocimiento]]

[[BeZhas-Platform-Master]]
