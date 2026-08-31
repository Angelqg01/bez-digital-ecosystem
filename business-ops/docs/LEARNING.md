# Aprendizaje — cómo "aprende" de verdad

Seamos precisos: un LLM **no se reentrena solo en producción**. Lo que produce el efecto de
"aprende de cada interacción" es una arquitectura de **memoria + retroalimentación**. Es real,
robusta y la usan los sistemas serios.

## El bucle (`LearningEngine`)

```
01 Captura   → cada interacción se guarda con su resultado
02 Memoria   → se indexa en vector DB; el agente recupera casos similares (RAG)
03 Feedback  → se registran resultados reales (deal ganado/perdido, 👍/👎, ticket resuelto)
04 Evalúa    → un job periódico mina aciertos y fallos por agente
05 Mejora    → patrones ganadores → playbooks; prompts actualizados con eval gates
```

## Tres niveles de memoria (`MemoryManager`)

| Nivel | Qué guarda | Dónde |
|---|---|---|
| Corto plazo | La conversación activa | RAM / Redis |
| Episódica | Todas las interacciones, buscables por similitud | Vector DB |
| Semántica | Perfiles y hechos acumulados | Postgres |

La episódica es la que da el "ya he visto esto antes": antes de actuar, el agente recupera
los casos pasados más parecidos y los usa como contexto (`BaseAgent.think()` lo hace).

## El bucle en código

```js
const engine = new LearningEngine({ memory, model, audit });
const report = await engine.cycle('sales.outreach');
// report.metrics.winRate, report.playbooks
```

Se ejecuta en cron (p. ej. cada noche). Destila los aciertos en playbooks reutilizables.

## Fine-tuning (opcional, avanzado)

Con suficientes interacciones de alta calidad puedes afinar modelos **pequeños** offline
(semanal/mensual), siempre con evals que validen que no empeora. Pero **el 90% del valor
viene de memoria + RAG + playbooks**, que es mucho más barato y seguro. No persigas el
fine-tuning antes de tiempo.
