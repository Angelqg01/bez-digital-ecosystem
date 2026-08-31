# Decisión: ¿migrar la orquestación a LangGraph? — NO, por ahora

**Fase 5** del [Plan Parte 3](../../Plan%20Parte%203%20-%20Frameworks%20B2B%20y%20Optimizacion.md). Evaluada el 2026-08-07. Veredicto: **no migrar**. Revisar solo si se cruza el umbral descrito al final.

## Qué mediría si hiciera falta migrar

LangGraph gana su complejidad cuando hay: (a) branching condicional real —el
siguiente paso depende del resultado del anterior, decidido en caliente—, (b)
ciclos —un supervisor que re-planifica varias veces—, o (c) hand-off entre
varios agentes dentro de una misma tarea. Se midió el código real de
`src/core/Orchestrator.js` y `src/agents/DepartmentManager.js` contra esos tres criterios.

## Lo que hay hoy (medido, no estimado)

- **72 agentes** en **10 departamentos** (`src/agents/index.js`, `DEPARTMENT_REGISTRY`).
- **Clasificación de intención → departamento**: `Orchestrator._classify()` es
  una lista PLANA de reglas por palabra clave, primera que casa gana. No hay
  LLM decidiendo la ruta (solo se usaría un modelo "fast" si algún día se
  reemplazan las reglas), no hay ramas condicionadas por resultados previos.
- **Departamento → especialista**: `DepartmentManager._plan()` es un `Map`
  estático `task.type → specialistId`, con un único especialista por tarea
  (o el primero registrado si no hay ruta). **Cero branching, cero ciclos,
  cero hand-off entre agentes dentro de la misma tarea.**
- **HITL (la razón nº1 por la que la gente adopta LangGraph)** ya está
  resuelto de forma nativa y ya endurecido en la Fase 2: `HITLGate.park()`/
  `unpark()` + persistencia en Postgres/SQLite (`upsertTask`/`upsertApproval`)
  + rehidratación de huérfanos tras reinicio + timeout/escalado. Es
  funcionalmente equivalente al patrón `interrupt()`/`Command(resume=...)` de
  LangGraph, ya cubierto por 599 tests, y ya integrado con multi-tenencia,
  `PolicyEngine` y `AuditLog` — piezas que LangGraph no modela de fábrica y
  que habría que reconstruir igual como nodos/middleware propios.

## Por qué migrar ahora sería un coste sin beneficio

1. **No hay el problema que LangGraph resuelve.** Su valor está en grafos de
   estado con ramas y ciclos; aquí el flujo real es
   `clasificar → despachar a 1 departamento → 1 especialista → fin`. Un motor
   de grafos para una tubería lineal es complejidad sin contrapartida.
2. **Reescribir, no extender.** El orquestador actual (Node.js/Express,
   599 tests verdes en el repo) tiene ya resueltos multi-tenencia aislada por
   EventBus, cuotas por plan, reintentos con backoff que respetan efectos
   secundarios ya producidos (`sideEffectPerformed`), poda de memoria caliente,
   y HITL persistente. Nada de eso viene gratis en LangGraph: se reconstruiría
   a mano igual, esta vez sobre un framework ajeno y (en JS) menos maduro que
   su versión Python.
3. **Cambiaría de lenguaje/ecosistema sin necesidad.** El stack es
   deliberadamente de baja dependencia (`docs/STACK-SOBERANO.md`): SDK de
   Anthropic, `pg`, `express`, y poco más. LangGraph.js existe pero el grueso
   del ecosistema/documentación/soporte de LangGraph vive en Python — adoptarlo
   en serio empujaría hacia una migración de lenguaje, no solo de librería.

## Cuándo SÍ reconsiderar (umbral concreto, no una fecha)

Volver a evaluar cuando aparezca **cualquiera** de estos, no antes:

- Una tarea necesita que **el resultado de un especialista decida** a cuál
  siguiente especialista (o departamento) pasar — hoy `_plan()` no admite esto,
  siempre devuelve el mismo paso fijo por `task.type`.
- Aparece un caso real de **fan-out**: una sola solicitud debe repartirse entre
  2+ departamentos y sus resultados combinarse antes de responder.
- Se necesita un **supervisor que re-planifica en bucle** (pedir más
  información, reintentar con otro enfoque, N vueltas) en vez de una sola
  pasada determinista.

Si ninguno de los tres aparece, la orquestación actual sigue siendo la opción
correcta: más simple, más barata de operar, y ya probada.
