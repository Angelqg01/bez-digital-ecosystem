# Estrategia de modelos

La respuesta profesional no es "un modelo", es una **estrategia por capas** detrás del
`ModelGateway`. Usas potencia donde aporta y velocidad/coste donde no.

| Trabajo | Tier | Por qué |
|---|---|---|
| Orquestador, decisiones estratégicas | `frontier` | juicio, contexto largo, uso fiable de herramientas |
| Redacción (emails, propuestas, negociación) | `frontier` | la escritura cierra o pierde deals |
| Atención conversacional | `mid` | equilibrio calidad/coste |
| Routing, clasificación, triage, scoring | `fast` | alto volumen, baja complejidad |
| Extracción de datos, resúmenes | `fast` | tarea mecánica |
| Memoria / búsqueda semántica | embeddings | indexar y recuperar historial |

## El Gateway desacopla todo

Los agentes piden un **tier**, no un modelo concreto:

```js
this.modelTier = 'frontier';   // en el constructor del agente
await this.think(prompt);      // el gateway elige el modelo del tier
```

El mapeo tier → modelo vive en un solo sitio (`ModelGateway.DEFAULT_TIERS` o config). Cambiar
de proveedor o de versión **no toca ni un agente**. Esto evita el lock-in y centraliza coste,
reintentos y telemetría.

## Recomendación

- **Cerebro y cara-al-cliente** → modelo frontera fuerte en razonamiento y escritura.
- **Masivo y mecánico** → modelo rápido y barato.
- **Siempre** detrás del Gateway, nunca llamando al SDK del proveedor desde un agente.

> En modo desarrollo sin claves, el Gateway responde simulado para que pruebes el flujo
> completo sin gastar tokens.
