---
estado: vigente
dominio: documentacion
revisado: 2026-11-13
---

# Base de conocimiento para agentes (RAG interno)

El índice interno (`api/services/knowledgeIndex.js`) lee `docs/**/*.md`. Para que un agente no cite un
documento caducado con la misma autoridad que uno vigente, cada documento puede declarar metadatos al
principio del fichero:

```
---
estado: vigente        # vigente | borrador | obsoleto | archivado
dominio: contratos     # contratos | api | frontend | operant | seguridad | despliegue | negocio | documentacion
revisado: 2026-11-13   # fecha de la última comprobación contra el código
---
```

## Reglas

- `borrador`, `obsoleto` y `archivado` **no se indexan**. Lo histórico va a `docs/archivo/` (`git mv`).
- Sin front-matter el documento se indexa igual (compatibilidad), pero no sale con `estado`.
- Con `KNOWLEDGE_SOLO_ETIQUETADOS=1` sólo se sirven los `estado: vigente`. Es el modo previsto para
  producción cuando `docs/` esté etiquetado entero.
- Cada resultado de `buscar` devuelve `estado`, `dominio` y `revisado` si existen: el agente debe
  mencionar la fecha de revisión al citar.
- Un documento que contradiga al código se corrige o se mueve a `archivo/`, no se deja como `vigente`.

Etiquetados hoy: `reference/ESTADO_REDES_Y_TOKEN.md`, `runbooks/DEX-KEEPER.md`, `OPERANT_SUBAPP.md` y este.
